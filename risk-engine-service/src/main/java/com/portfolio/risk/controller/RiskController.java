package com.portfolio.risk.controller;

import java.time.DayOfWeek;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.portfolio.risk.client.FinnhubClient;
import com.portfolio.risk.client.YahooFinanceClient;
import com.portfolio.risk.model.RiskSnapshot;
import com.portfolio.risk.model.StockPrice;
import com.portfolio.risk.repository.RiskSnapshotRepository;
import com.portfolio.risk.repository.StockPriceRepository;
import com.portfolio.risk.service.RiskCalculationService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/risk")
@RequiredArgsConstructor
public class RiskController {

    private final RiskCalculationService riskCalculationService;
    private final RiskSnapshotRepository riskSnapshotRepository;
    private final StockPriceRepository stockPriceRepository;
    private final FinnhubClient finnhubClient;
    private final YahooFinanceClient yahooFinanceClient;

    private static final ZoneId ET_ZONE = ZoneId.of("America/New_York");

    @PostMapping("/calculate/{portfolioId}")
    public ResponseEntity<?> calculateRisk(@PathVariable UUID portfolioId) {
        try {
            RiskSnapshot snapshot = riskCalculationService.calculatePortfolioRisk(portfolioId);
            if (snapshot == null) {
                Map<String, String> error = new HashMap<>();
                error.put("error", "Could not calculate risk - no holdings or price data found");
                return ResponseEntity.badRequest().body(error);
            }
            return ResponseEntity.ok(snapshot);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.internalServerError().body(error);
        }
    }

    @GetMapping("/portfolio/{portfolioId}")
    public ResponseEntity<?> getLatestRisk(@PathVariable UUID portfolioId) {
        return riskSnapshotRepository.findTopByPortfolioIdOrderByCalculatedAtDesc(portfolioId)
                .map(snapshot -> ResponseEntity.ok((Object) snapshot))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/portfolio/{portfolioId}/history")
    public ResponseEntity<List<RiskSnapshot>> getRiskHistory(@PathVariable UUID portfolioId) {
        List<RiskSnapshot> history = riskSnapshotRepository.findByPortfolioIdOrderByCalculatedAtDesc(portfolioId);
        return ResponseEntity.ok(history);
    }

    @GetMapping("/prices/{symbol}")
    public ResponseEntity<?> getLatestPrice(@PathVariable String symbol) {
        return stockPriceRepository.findTopBySymbolOrderByFetchedAtDesc(symbol.toUpperCase())
                .map(price -> ResponseEntity.ok((Object) price))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/prices")
    public ResponseEntity<?> getPricesForSymbols(@RequestParam List<String> symbols) {
        Map<String, Object> prices = new HashMap<>();
        for (String symbol : symbols) {
            stockPriceRepository.findTopBySymbolOrderByFetchedAtDesc(symbol.toUpperCase())
                    .ifPresent(price -> prices.put(symbol.toUpperCase(), price));
        }
        return ResponseEntity.ok(prices);
    }

    @GetMapping("/prices/{symbol}/history")
    public ResponseEntity<?> getPriceHistory(@PathVariable String symbol,
                                              @RequestParam(defaultValue = "100") int limit) {
        List<StockPrice> history = stockPriceRepository.findRecentPrices(symbol.toUpperCase(), limit);
        java.util.Collections.reverse(history);
        return ResponseEntity.ok(history);
    }

    /**
     * Returns current market status — whether NYSE/NASDAQ is open or closed.
     */
    @GetMapping("/market-status")
    public ResponseEntity<Map<String, Object>> getMarketStatus() {
        ZonedDateTime nowET = ZonedDateTime.now(ET_ZONE);
        boolean isOpen = isMarketOpen(nowET);

        Map<String, Object> status = new HashMap<>();
        status.put("isOpen", isOpen);
        status.put("currentTimeET", nowET.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss z")));

        if (isOpen) {
            ZonedDateTime closeTime = nowET.withHour(16).withMinute(0).withSecond(0);
            status.put("message", "Market is open");
            status.put("closesAt", closeTime.format(DateTimeFormatter.ofPattern("h:mm a z")));
        } else {
            ZonedDateTime nextOpen = getNextMarketOpen(nowET);
            status.put("message", "Market is closed");
            status.put("opensAt", nextOpen.format(DateTimeFormatter.ofPattern("EEE, MMM d 'at' h:mm a z")));
        }

        return ResponseEntity.ok(status);
    }

    /**
     * Fetches historical candle data from Yahoo Finance (free, no API key needed).
     * Resolution auto-selected based on date range:
     *   <= 7 days  → 1h (hourly)
     *   <= 90 days → 1d (daily)
     *   > 90 days  → 1wk (weekly)
     */
    @GetMapping("/prices/{symbol}/candles")
    public ResponseEntity<?> getCandleData(
            @PathVariable String symbol,
            @RequestParam long from,
            @RequestParam long to,
            @RequestParam(required = false) String resolution) {

        String interval;
        if (resolution != null && !resolution.isEmpty()) {
            interval = resolution;
        } else {
            long diffDays = (to - from) / 86400;
            if (diffDays <= 7) {
                interval = "1h";
            } else if (diffDays <= 90) {
                interval = "1d";
            } else {
                interval = "1wk";
            }
        }

        List<YahooFinanceClient.CandleData> candles = yahooFinanceClient.getCandles(
                symbol.toUpperCase(), interval, from, to);

        if (candles.isEmpty()) {
            Map<String, String> error = new HashMap<>();
            error.put("error", "No candle data available for " + symbol);
            error.put("symbol", symbol.toUpperCase());
            return ResponseEntity.ok(error);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("symbol", symbol.toUpperCase());
        result.put("resolution", interval);
        result.put("count", candles.size());
        result.put("candles", candles);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        Map<String, String> status = new HashMap<>();
        status.put("service", "risk-engine");
        status.put("status", "UP");
        return ResponseEntity.ok(status);
    }

    // ── Private helpers ──

    private boolean isMarketOpen(ZonedDateTime nowET) {
        DayOfWeek day = nowET.getDayOfWeek();
        if (day == DayOfWeek.SATURDAY || day == DayOfWeek.SUNDAY) {
            return false;
        }
        int timeAsMinutes = nowET.getHour() * 60 + nowET.getMinute();
        return timeAsMinutes >= 570 && timeAsMinutes < 960;
    }

    private ZonedDateTime getNextMarketOpen(ZonedDateTime nowET) {
        ZonedDateTime next = nowET;

        if (next.getDayOfWeek() != DayOfWeek.SATURDAY
                && next.getDayOfWeek() != DayOfWeek.SUNDAY
                && (next.getHour() * 60 + next.getMinute()) < 570) {
            return next.withHour(9).withMinute(30).withSecond(0);
        }

        next = next.plusDays(1);
        while (next.getDayOfWeek() == DayOfWeek.SATURDAY || next.getDayOfWeek() == DayOfWeek.SUNDAY) {
            next = next.plusDays(1);
        }
        return next.withHour(9).withMinute(30).withSecond(0);
    }
}