package com.portfolio.risk.client;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.Builder;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;

@Component
@Slf4j
public class YahooFinanceClient {

    private final WebClient webClient;
    private final ObjectMapper objectMapper;

    public YahooFinanceClient(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.webClient = WebClient.builder()
                .baseUrl("https://query1.finance.yahoo.com")
                .defaultHeader("User-Agent", "Mozilla/5.0")
                .build();
    }

    /**
     * Fetches historical candle data from Yahoo Finance.
     *
     * @param symbol   Stock symbol (e.g., "AAPL")
     * @param interval Candle interval: 1d, 1wk, 1mo
     * @param from     Unix timestamp start (seconds)
     * @param to       Unix timestamp end (seconds)
     * @return List of CandleData points
     */
    public List<CandleData> getCandles(String symbol, String interval, long from, long to) {
        try {
            String response = webClient.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/v8/finance/chart/{symbol}")
                            .queryParam("period1", from)
                            .queryParam("period2", to)
                            .queryParam("interval", interval)
                            .build(symbol))
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            if (response == null) {
                log.warn("No response from Yahoo Finance for {}", symbol);
                return List.of();
            }

            return parseResponse(symbol, response);

        } catch (Exception e) {
            log.error("Error fetching Yahoo Finance candles for {}: {}", symbol, e.getMessage());
            return List.of();
        }
    }

    private List<CandleData> parseResponse(String symbol, String response) {
        List<CandleData> candles = new ArrayList<>();

        try {
            JsonNode root = objectMapper.readTree(response);
            JsonNode result = root.path("chart").path("result");

            if (result.isMissingNode() || !result.isArray() || result.isEmpty()) {
                log.warn("No chart data in Yahoo Finance response for {}", symbol);
                return candles;
            }

            JsonNode firstResult = result.get(0);
            JsonNode timestamps = firstResult.path("timestamp");
            JsonNode indicators = firstResult.path("indicators").path("quote").get(0);

            if (timestamps.isMissingNode() || indicators == null) {
                log.warn("Missing timestamps or indicators for {}", symbol);
                return candles;
            }

            JsonNode opens = indicators.path("open");
            JsonNode highs = indicators.path("high");
            JsonNode lows = indicators.path("low");
            JsonNode closes = indicators.path("close");
            JsonNode volumes = indicators.path("volume");

            for (int i = 0; i < timestamps.size(); i++) {
                if (closes.get(i) == null || closes.get(i).isNull()) {
                    continue;
                }

                candles.add(CandleData.builder()
                        .symbol(symbol)
                        .open(getBigDecimal(opens, i))
                        .high(getBigDecimal(highs, i))
                        .low(getBigDecimal(lows, i))
                        .close(getBigDecimal(closes, i))
                        .volume(volumes.get(i) != null && !volumes.get(i).isNull()
                                ? volumes.get(i).asLong() : 0L)
                        .timestamp(timestamps.get(i).asLong())
                        .build());
            }

            log.info("Parsed {} candles from Yahoo Finance for {}", candles.size(), symbol);

        } catch (Exception e) {
            log.error("Error parsing Yahoo Finance response for {}: {}", symbol, e.getMessage());
        }

        return candles;
    }

    private BigDecimal getBigDecimal(JsonNode array, int index) {
        if (array.get(index) == null || array.get(index).isNull()) {
            return BigDecimal.ZERO;
        }
        return BigDecimal.valueOf(array.get(index).asDouble());
    }

    @Data
    @Builder
    public static class CandleData {
        private String symbol;
        private BigDecimal open;
        private BigDecimal high;
        private BigDecimal low;
        private BigDecimal close;
        private Long volume;
        private Long timestamp;
    }
}