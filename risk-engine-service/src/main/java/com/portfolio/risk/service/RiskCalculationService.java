package com.portfolio.risk.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDateTime;
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
            volatility = calculatePortfolioVolatility(weights, stockReturns);
            dailyReturn = calculatePortfolioDailyReturn(weights, stockReturns);
            sharpeRatio = calculateSharpeRatio(dailyReturn, volatility);
            valueAtRisk = calculateValueAtRisk(totalValue, dailyReturn, volatility);
            beta = calculateBeta(weights, stockReturns);
        } else {
            log.info("Not enough historical data yet for full risk calculation. Saving basic snapshot");
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
