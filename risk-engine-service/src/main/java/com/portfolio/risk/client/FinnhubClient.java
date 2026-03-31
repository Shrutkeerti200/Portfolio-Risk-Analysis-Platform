package com.portfolio.risk.client;

import java.math.BigDecimal;
import java.math.RoundingMode;

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
}
