package com.portfolio.risk.service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import com.portfolio.risk.client.FinnhubClient;
import com.portfolio.risk.dto.PriceUpdateMessage;
import com.portfolio.risk.kafka.PriceProducer;
import com.portfolio.risk.model.StockPrice;
import com.portfolio.risk.repository.StockPriceRepository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class PriceFetcherService {

    private final FinnhubClient finnhubClient;
    private final PriceProducer priceProducer;
    private final StockPriceRepository stockPriceRepository;
    private final RedisTemplate<String, String> redisTemplate;
    private final EntityManager entityManager;

    @Value("${price.fetch.delay-between-calls:1200}")
    private long delayBetweenCalls;

    /**
     * Fetches prices for all stocks held in portfolios.
     * Interval is configurable via price.fetch.interval:
     * - Local: 30s (default)
     * - Production: 120s (set PRICE_FETCH_INTERVAL=120000 on Render)
     * Finnhub free tier allows 60 calls/minute.
     */
    @Scheduled(fixedRateString = "${price.fetch.interval:30000}")
    public void fetchPrices() {
        List<String> symbols = getActiveSymbols();

        if (symbols.isEmpty()) {
            log.debug("No active stock symbols to fetch prices for");
            return;
        }

        log.info("Fetching prices for {} symbols: {}", symbols.size(), symbols);

        for (String symbol : symbols) {
            try {
                FinnhubClient.StockQuote quote = finnhubClient.getQuote(symbol);

                if (quote != null) {
                    StockPrice stockPrice = StockPrice.builder()
                            .symbol(symbol)
                            .price(quote.getCurrentPrice())
                            .previousClose(quote.getPreviousClose())
                            .changePercent(quote.getChangePercent())
                            .volume(quote.getVolume())
                            .fetchedAt(LocalDateTime.now())
                            .build();

                    stockPriceRepository.save(stockPrice);

                    // Cache in Redis — 180s TTL to survive between fetch cycles
                    String redisKey = "price:" + symbol;
                    String redisValue = quote.getCurrentPrice().toPlainString();
                    redisTemplate.opsForValue().set(redisKey, redisValue, Duration.ofSeconds(180));

                    PriceUpdateMessage message = PriceUpdateMessage.builder()
                            .symbol(symbol)
                            .currentPrice(quote.getCurrentPrice())
                            .previousClose(quote.getPreviousClose())
                            .changePercent(quote.getChangePercent())
                            .volume(quote.getVolume())
                            .timestamp(LocalDateTime.now())
                            .build();

                    priceProducer.sendPriceUpdate(message);
                }

                Thread.sleep(delayBetweenCalls);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            } catch (Exception e) {
                log.error("Error fetching price for {}: {}", symbol, e.getMessage());
            }
        }
    }

    /**
     * Gets all unique stock symbols from holdings table.
     * This queries the portfolio-service's holdings table directly
     * since both services share the same database.
     */
    @SuppressWarnings("unchecked")
    private List<String> getActiveSymbols() {
        try {
            Query query = entityManager.createNativeQuery(
                "SELECT DISTINCT stock_symbol FROM holdings");
            return query.getResultList();
        } catch (Exception e) {
            log.error("Error fetching active symbols: {}", e.getMessage());
            return List.of();
        }
    }
}