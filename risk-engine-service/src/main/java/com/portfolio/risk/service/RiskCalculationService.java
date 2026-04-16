package com.portfolio.risk.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.portfolio.risk.model.RiskSnapshot;
import com.portfolio.risk.model.StockPrice;
import com.portfolio.risk.repository.RiskSnapshotRepository;
import com.portfolio.risk.repository.StockPriceRepository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class RiskCalculationService {

    private final StockPriceRepository stockPriceRepository;

    private final RiskSnapshotRepository riskSnapshotRepository;

    private final RedisTemplate<String, String> redisTemplate;

    private final ObjectMapper objectMapper;

    private final EntityManager entityManager;

    // Risk-free rate (US Treasury yield approx 4.5%)
    private static final BigDecimal RISK_FREE_RATE = new BigDecimal("0.045");

    // Trading days per year;
    private static final int TRADING_DAYS = 252;

    // VaR confidence level (95%)
    private static final double VAR_CONFIDENCE = 1.645;

    // US Eastern timezone for market hours check
    private static final ZoneId ET_ZONE = ZoneId.of("America/New_York");

    //Recalculate risk for all portfolio containing a specific stock
    @Transactional
    public void recalculateForStock(String symbol) {
        List<UUID> portfolioIds = getPortfolioIdsForStock(symbol);

        for (UUID portfolioId : portfolioIds) {
            try {
                calculatePortfolioRisk(portfolioId);
            } catch (Exception e) {
                log.error("Error calculating risk for portfolio {}: {}", portfolioId, e.getMessage());
            }
        }
    }

    //Calculate all risk metrics for a portfolio
    @Transactional
    public RiskSnapshot calculatePortfolioRisk(UUID portfolioId) {
        log.info("Calculating risk for portfolio: {}", portfolioId);

        //If market is closed, return the last meaningful snapshot from DB or Redis
        if (!isMarketOpen()) {
            log.info("Market is closed. Returning last meaningful snapshot for portfolio: {}", portfolioId);
            return getLastMeaningfulSnapshot(portfolioId);
        }

        //Get holdings for this portfolio
        List<Object[]> holdings = getPortfolioHoldings(portfolioId);

        if (holdings.isEmpty()) {
            log.warn("No holdings found for portfolio: {}", portfolioId);
            return null;
        }

        // Calculate total portfolio value
        BigDecimal totalValue = BigDecimal.ZERO;
        Map<String, BigDecimal> weights = new HashMap<>();
        Map<String, BigDecimal> holdingValues = new HashMap<>();

        for (Object[] holding : holdings) {
            String symbol = (String) holding[0];
            BigDecimal quantity = (BigDecimal) holding[1];

            // Gte latest price from Redis or DB
            BigDecimal currentPrice = getCurrentPrice(symbol);
            if (currentPrice == null) {
                continue;
            }

            BigDecimal value = quantity.multiply(currentPrice);
            holdingValues.put(symbol, value);
            totalValue = totalValue.add(value);
        }

        if (totalValue.compareTo(BigDecimal.ZERO) == 0) {
            log.warn("Total portfolio value is zero for portfolio: {}", portfolioId);
            return null;
        }

        // Calculate weights
        for (Map.Entry<String, BigDecimal> entry : holdingValues.entrySet()) {
            weights.put(entry.getKey(), entry.getValue().divide(totalValue, 6, RoundingMode.HALF_UP));
        }

        // Calculate daily returns for each stock
        Map<String, List<BigDecimal>> stockReturns = new HashMap<>();
        boolean hasEnoughtData = false;
        for (String symbol : holdingValues.keySet()) {
            List<BigDecimal> returns = calculateDailyReturns(symbol);
            if (!returns.isEmpty()) {
                stockReturns.put(symbol, returns);
                hasEnoughtData = true;
            }
        }

        // Calculate portfolio metrics
        BigDecimal volatility = calculatePortfolioVolatility(weights, stockReturns);
        BigDecimal dailyReturn = calculatePortfolioDailyReturn(weights, stockReturns);
        BigDecimal sharpeRatio = calculateSharpeRatio(dailyReturn, volatility);
        BigDecimal valueAtRisk = calculateValueAtRisk(totalValue, dailyReturn, volatility);
        BigDecimal beta = calculateBeta(weights, stockReturns);

        if (!hasEnoughtData) {
            log.info("Not enough historical data yet for full risk calculation. Saving basic snapshot");
        }

        // If metrics are all zeros even during market hours, preserve last meaningful risk metrics, only update totalValue
        if (isAllZeroMetrics(volatility, sharpeRatio, valueAtRisk, dailyReturn)) {
            log.info("Calculated metrics are all zero for portfolio {}. Checking for last meaningful snapshot.", portfolioId);
            RiskSnapshot lastGood = getLastMeaningfulSnapshot(portfolioId);
            if (lastGood != null) {
                RiskSnapshot preservedSnapshot = RiskSnapshot.builder()
                        .portfolioId(portfolioId)
                        .volatility(lastGood.getVolatility())
                        .sharpeRatio(lastGood.getSharpeRatio())
                        .valueAtRisk(lastGood.getValueAtRisk())
                        .portfolioBeta(lastGood.getPortfolioBeta())
                        .totalValue(totalValue) // Update only total value
                        .dailyReturn(lastGood.getDailyReturn())
                        .calculatedAt(LocalDateTime.now())
                        .build();

                RiskSnapshot saved = riskSnapshotRepository.save(preservedSnapshot);
                cacheRiskMetrics(portfolioId, saved);

                log.info("Preserved last meaningful metrics for portfolio {}: volatility={}, sharpe={}, var={}, beta={}, value={}", portfolioId, preservedSnapshot.getVolatility(), preservedSnapshot.getSharpeRatio(), preservedSnapshot.getValueAtRisk(), preservedSnapshot.getPortfolioBeta(), preservedSnapshot.getTotalValue());
                return saved;
            }
        }

        // Save risk snapshot
        RiskSnapshot snapshot = RiskSnapshot.builder()
                .portfolioId(portfolioId)
                .volatility(volatility)
                .sharpeRatio(sharpeRatio)
                .valueAtRisk(valueAtRisk)
                .portfolioBeta(beta)
                .totalValue(totalValue)
                .dailyReturn(dailyReturn)
                .calculatedAt(LocalDateTime.now())
                .build();

        RiskSnapshot saved = riskSnapshotRepository.save(snapshot);

        // cache in Redis
        cacheRiskMetrics(portfolioId, saved);

        log.info("Risk calculated for portfolio {}: volatility={}, sharpe={}, var={}, beta={}, value={}", portfolioId, volatility, sharpeRatio, valueAtRisk, beta, totalValue);
        return saved;
    }

    // MARKET HOURS AND SNAPSHOT HELPERS
    private boolean isMarketOpen() {
        ZonedDateTime nowET = ZonedDateTime.now(ET_ZONE);
        DayOfWeek day = nowET.getDayOfWeek();

        // weekend check
        if (day == DayOfWeek.SATURDAY || day == DayOfWeek.SUNDAY) {
            return false;
        }

        int hour = nowET.getHour();
        int minute = nowET.getMinute();
        int timeAsMinutes = hour * 60 + minute;

        return timeAsMinutes >= 570 && timeAsMinutes < 960; // 9:30 AM to 4:00 PM ET
    }

    /**
     * Retrieves the last snapshot where risk metrics are NOT all zeros.
     * This is the "last meaningful" snapshot from when the market was open
     * and we had actual price movement to calculate from.
     */
    private RiskSnapshot getLastMeaningfulSnapshot(UUID portfolioId) {
        try {
            Query query = entityManager.createNativeQuery(
                "SELECT * FROM risk_snapshots " +
                "WHERE portfolio_id = :portfolioId " +
                "  AND (volatility != 0 OR sharpe_ratio != 0 OR value_at_risk != 0 OR daily_return != 0) " +
                "ORDER BY calculated_at DESC " +
                "LIMIT 1",
                RiskSnapshot.class
            );
            query.setParameter("portfolioId", portfolioId);

            @SuppressWarnings("unchecked")
            List<RiskSnapshot> results = query.getResultList();
            if (!results.isEmpty()) {
                RiskSnapshot snapshot = results.get(0);
                log.info("Found last meaningful snapshot for portfolio {} from {}",
                        portfolioId, snapshot.getCalculatedAt());
                return snapshot;
            }
        } catch (Exception e) {
            log.error("Error fetching last meaningful snapshot for portfolio {}: {}", portfolioId, e.getMessage());
        }

        log.warn("No meaningful snapshot found for portfolio: {}", portfolioId);
        return null;
    }

    /**
     * Checks if all calculated risk metrics are zero.
     * Typically means the market is closed or not enough price variation yet.
     */
    private boolean isAllZeroMetrics(BigDecimal volatility, BigDecimal sharpeRatio,
                                      BigDecimal valueAtRisk, BigDecimal dailyReturn) {
        return volatility.compareTo(BigDecimal.ZERO) == 0
            && sharpeRatio.compareTo(BigDecimal.ZERO) == 0
            && valueAtRisk.compareTo(BigDecimal.ZERO) == 0
            && dailyReturn.compareTo(BigDecimal.ZERO) == 0;
    }

    // CALCULATION METHODS
    private BigDecimal calculatePortfolioVolatility(Map<String, BigDecimal> weights, Map<String, List<BigDecimal>> stockReturns) {

        if (stockReturns.isEmpty()) {
            return BigDecimal.ZERO;
        }

        // Simplified: weighted average of indivbidual volatilities
        BigDecimal weightedVariance = BigDecimal.ZERO;

        for (Map.Entry<String, BigDecimal> entry : weights.entrySet()) {
            String symbol = entry.getKey();
            BigDecimal weight = entry.getValue();

            List<BigDecimal> returns = stockReturns.getOrDefault(symbol, List.of());

            if (!returns.isEmpty()) {
                BigDecimal stockVolatility = calculateStdDev(returns);

                // Annualize: daily vol * sqrt(252)
                BigDecimal annualizedVol = stockVolatility.multiply(
                        BigDecimal.valueOf(Math.sqrt(TRADING_DAYS)));
                weightedVariance = weightedVariance.add(weight.multiply(weight).multiply(annualizedVol.multiply(annualizedVol)));
            }
        }

        if (weightedVariance.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO;
        }

        return BigDecimal.valueOf(Math.sqrt(weightedVariance.doubleValue())).setScale(6, RoundingMode.HALF_UP);
    }

    private BigDecimal calculatePortfolioDailyReturn(Map<String, BigDecimal> weights, Map<String, List<BigDecimal>> stockReturns) {
        BigDecimal portfolioReturn = BigDecimal.ZERO;

        for (Map.Entry<String, BigDecimal> entry : weights.entrySet()) {
            String symbol = entry.getKey();
            BigDecimal weight = entry.getValue();
            List<BigDecimal> returns = stockReturns.getOrDefault(symbol, List.of());

            if (!returns.isEmpty()) {
                BigDecimal avgReturns = returns.stream()
                        .reduce(BigDecimal.ZERO, BigDecimal::add)
                        .divide(BigDecimal.valueOf(returns.size()), 6, RoundingMode.HALF_UP);
                portfolioReturn = portfolioReturn.add(weight.multiply(avgReturns));
            }
        }

        return portfolioReturn.setScale(6, RoundingMode.HALF_UP);
    }

    private BigDecimal calculateSharpeRatio(BigDecimal dailyReturn, BigDecimal volatility) {
        if (volatility.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO;
        }

        // Annaulize daily return
        BigDecimal annualReturn = dailyReturn.multiply(BigDecimal.valueOf(TRADING_DAYS));

        // Sharpe = (Return - RiskFreeRate) / Volatility
        return annualReturn.subtract(RISK_FREE_RATE).divide(volatility, 6, RoundingMode.HALF_UP);
    }

    private BigDecimal calculateValueAtRisk(BigDecimal totalValue, BigDecimal dailyReturn, BigDecimal volatility) {
        if (volatility.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO;
        }

        // Daily VaR at 95% confidence
        // VaR = Portfolio Value * (Mean Return - 1.645 * Daily Volatility)
        BigDecimal dailyVol = volatility.divide(BigDecimal.valueOf(Math.sqrt(TRADING_DAYS)), 6, RoundingMode.HALF_UP);
        BigDecimal varReturn = dailyReturn.subtract(BigDecimal.valueOf(VAR_CONFIDENCE).multiply(dailyVol));

        return totalValue.multiply(varReturn).abs().setScale(4, RoundingMode.HALF_UP);
    }

    private BigDecimal calculateBeta(Map<String, BigDecimal> weights, Map<String, List<BigDecimal>> stockReturns) {
        // Simplified beta: weighted average of individual stock betas
        // Using SPY as market proxy (beta = 1.0 for market)
        // For now, estimate based on volatility relative to market
        BigDecimal weightedBeta = BigDecimal.ZERO;

        for (Map.Entry<String, BigDecimal> entry : weights.entrySet()) {
            String symbol = entry.getKey();
            BigDecimal weight = entry.getValue();
            List<BigDecimal> returns = stockReturns.getOrDefault(symbol, List.of());

            if (!returns.isEmpty()) {
                BigDecimal stockVol = calculateStdDev(returns);
                // Simplified: beta = stock volatility / market volatility 
                // Market daily vol is approx 0.01 (1%)
                BigDecimal estimatedBeta = stockVol.divide(new BigDecimal("0.01"), 6, RoundingMode.HALF_UP);
                // Cap beta between 0 and 3
                estimatedBeta = estimatedBeta.min(new BigDecimal("3.0")).max(new BigDecimal("0.1"));
                weightedBeta = weightedBeta.add(weight.multiply(estimatedBeta));
            }
        }

        return weightedBeta.setScale(6, RoundingMode.HALF_UP);
    }

    // ------------------------- HELPER METHODS -----------------------------//
    private List<BigDecimal> calculateDailyReturns(String symbol) {
        List<StockPrice> prices = stockPriceRepository.findRecentPrices(symbol, 30);
        List<BigDecimal> returns = new ArrayList<>();

        for (int i = 1; i < prices.size(); i++) {
            BigDecimal prevPrice = prices.get(i - 1).getPrice();
            BigDecimal currPrice = prices.get(i).getPrice();

            if (prevPrice.compareTo(BigDecimal.ZERO) != 0) {
                BigDecimal dailyReturn = currPrice.subtract(prevPrice).divide(prevPrice, 6, RoundingMode.HALF_UP);
                returns.add(dailyReturn);
            }
        }

        return returns;
    }

    private BigDecimal calculateStdDev(List<BigDecimal> values) {
        if (values.size() < 2) {
            return BigDecimal.ZERO;
        }

        BigDecimal mean = values.stream().reduce(BigDecimal.ZERO, BigDecimal::add).divide(BigDecimal.valueOf(values.size()), 10, RoundingMode.HALF_UP);
        BigDecimal sumSquaredDiffs = values.stream().map(v -> v.subtract(mean).pow(2)).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal variance = sumSquaredDiffs.divide(BigDecimal.valueOf(values.size() - 1), 10, RoundingMode.HALF_UP);

        return BigDecimal.valueOf(Math.sqrt(variance.doubleValue())).setScale(6, RoundingMode.HALF_UP);
    }

    private BigDecimal getCurrentPrice(String symbol) {
        // Try Redis cache first
        String cached = redisTemplate.opsForValue().get("price:" + symbol);

        if (cached != null) {
            return new BigDecimal(cached);
        }

        // Fallback to DB
        return stockPriceRepository.findTopBySymbolOrderByFetchedAtDesc(symbol).map(StockPrice::getPrice).orElse(null);
    }

    @SuppressWarnings("unchecked")
    private List<UUID> getPortfolioIdsForStock(String symbol) {
        try {
            Query query = entityManager.createNativeQuery("SELECT DISTINCT portfolio_id FROM holdings WHERE stock_symbol = :symbol");
            query.setParameter("symbol", symbol);
            return query.getResultList();
        } catch (Exception e) {
            log.error("Error finding portfolios for stock (): {}", symbol, e.getMessage());
            return List.of();
        }
    }

    @SuppressWarnings("unchecked")
    private List<Object[]> getPortfolioHoldings(UUID portfolioId) {

        try {
            Query query = entityManager.createNativeQuery(
                    "SELECT stock_symbol, quantity FROM holdings WHERE portfolio_id = :portfolioId");
            query.setParameter("portfolioId", portfolioId);
            return query.getResultList();
        } catch (Exception e) {
            log.error("Error fetching holdings for portfolio {}: {}", portfolioId, e.getMessage());
            return List.of();
        }
    }

    private void cacheRiskMetrics(UUID portfolioId, RiskSnapshot snapshot) {
        try {
            String key = "risk:" + portfolioId;
            Map<String, String> metrics = new HashMap<>();
            metrics.put("volatility", snapshot.getVolatility().toPlainString());
            metrics.put("sharpeRatio", snapshot.getSharpeRatio().toPlainString());
            metrics.put("valueAtRisk", snapshot.getValueAtRisk().toPlainString());
            metrics.put("portfolioBeta", snapshot.getPortfolioBeta().toPlainString());
            metrics.put("totalValue", snapshot.getTotalValue().toPlainString());
            metrics.put("dailyReturn", snapshot.getDailyReturn().toPlainString());

            redisTemplate.opsForHash().putAll(key, metrics);
            redisTemplate.expire(key, Duration.ofMinutes(120));
        } catch (Exception e) {
            log.error("Error caching risk metrics: {}", e.getMessage());
        }
    }
}
