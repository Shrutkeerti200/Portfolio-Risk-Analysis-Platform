package com.portfolio.risk.client;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import com.fasterxml.jackson.annotation.JsonProperty;

import lombok.Data;
import lombok.extern.slf4j.Slf4j;

@Component
@Slf4j
public class FinnhubClient {

    private final WebClient webClient;

    private final String apiKey;

    public FinnhubClient(
            @Value("${finnhub.base-url}") String baseUrl,
            @Value("${finnhub.api-key}") String apiKey) {
        this.apiKey = apiKey;
        this.webClient = WebClient.builder()
                .baseUrl(baseUrl)
                .build();
    }

    public StockQuote getQuote(String symbol) {
        try {
            FinnhubQuoteResponse response = webClient.get()
                    .uri(uriBuilder -> uriBuilder
                        .path("/quote")
                        .queryParam("symbol", symbol)
                        .queryParam("token", apiKey)
                        .build())
                    .retrieve()
                    .bodyToMono(FinnhubQuoteResponse.class)
                    .block();

            if (response == null || response.getCurrentPrice() == null || response.getCurrentPrice().compareTo(BigDecimal.ZERO) == 0) {
                log.warn("No price data returned for symbol: {}", symbol);
                return null;
            }

            BigDecimal changePercent = BigDecimal.ZERO;
            if (response.getPreviousClose() != null && response.getPreviousClose().compareTo(BigDecimal.ZERO) != 0) {
                changePercent = response.getCurrentPrice()
                        .subtract(response.getPreviousClose())
                        .divide(response.getPreviousClose(), 4, RoundingMode.HALF_UP)
                        .multiply(BigDecimal.valueOf(100));
            }

            return StockQuote.builder()
                    .symbol(symbol)
                    .currentPrice(response.getCurrentPrice())
                    .previousClose(response.getPreviousClose())
                    .changePercent(changePercent)
                    .high(response.getHigh())
                    .low(response.getLow())
                    .open(response.getOpen())
                    .volume(response.getVolume())
                    .build();

        } catch (Exception e) {
            log.error("Error fetching quote for {}: {}", symbol, e.getMessage());
            return null;
        }
    }

    /**
     * Fetches historical candle data from Finnhub.
     *
     * @param symbol     Stock symbol (e.g., "AAPL")
     * @param resolution Candle resolution: 1, 5, 15, 30, 60, D, W, M
     * @param from       Unix timestamp for start
     * @param to         Unix timestamp for end
     * @return List of CandleData points, or empty list on error
     */
    public List<CandleData> getCandles(String symbol, String resolution, long from, long to) {
        try {
            FinnhubCandleResponse response = webClient.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/stock/candle")
                            .queryParam("symbol", symbol)
                            .queryParam("resolution", resolution)
                            .queryParam("from", from)
                            .queryParam("to", to)
                            .queryParam("token", apiKey)
                            .build())
                    .retrieve()
                    .bodyToMono(FinnhubCandleResponse.class)
                    .block();

            if (response == null || !"ok".equals(response.getStatus())
                    || response.getClose() == null || response.getClose().isEmpty()) {
                log.warn("No candle data returned for symbol: {} (resolution={}, from={}, to={})",
                        symbol, resolution, from, to);
                return List.of();
            }

            List<CandleData> candles = new ArrayList<>();
            for (int i = 0; i < response.getClose().size(); i++) {
                candles.add(CandleData.builder()
                        .symbol(symbol)
                        .open(response.getOpen().get(i))
                        .high(response.getHigh().get(i))
                        .low(response.getLow().get(i))
                        .close(response.getClose().get(i))
                        .volume(response.getVolume().get(i))
                        .timestamp(response.getTimestamp().get(i))
                        .build());
            }

            log.info("Fetched {} candles for {} (resolution={})", candles.size(), symbol, resolution);
            return candles;

        } catch (Exception e) {
            log.error("Error fetching candles for {}: {}", symbol, e.getMessage());
            return List.of();
        }
    }


    // --- Response DTOs ---
    @Data
    public static class FinnhubQuoteResponse {

        @JsonProperty("c")
        private BigDecimal currentPrice;

        @JsonProperty("pc")
        private BigDecimal previousClose;

        @JsonProperty("h")
        private BigDecimal high;

        @JsonProperty("l")
        private BigDecimal low;

        @JsonProperty("o")
        private BigDecimal open;

        @JsonProperty("d")
        private BigDecimal change;

        @JsonProperty("dp")
        private BigDecimal changePercent;

        @JsonProperty("t")
        private Long timestamp;

        @JsonProperty("v")
        private Long volume;
    }

    @Data
    public static class FinnhubCandleResponse {
        @JsonProperty("s")
        private String status; // "ok" or "no_data"
        @JsonProperty("o")
        private List<BigDecimal> open;
        @JsonProperty("h")
        private List<BigDecimal> high;
        @JsonProperty("l")
        private List<BigDecimal> low;
        @JsonProperty("c")
        private List<BigDecimal> close;
        @JsonProperty("v")
        private List<Long> volume;
        @JsonProperty("t")
        private List<Long> timestamp;
    }

    @Data
    @lombok.Builder
    public static class StockQuote {

        private String symbol;
        private BigDecimal currentPrice;
        private BigDecimal previousClose;
        private BigDecimal changePercent;
        private BigDecimal high;
        private BigDecimal low;
        private BigDecimal open;
        private Long volume;
    }

    @Data
    @lombok.Builder
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
