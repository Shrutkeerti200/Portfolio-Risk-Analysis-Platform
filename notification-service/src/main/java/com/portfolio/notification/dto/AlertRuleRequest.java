package com.portfolio.notification.dto;

import java.math.BigDecimal;
import java.util.UUID;

import jakarta.validation.constraints.NotNull;

public class AlertRuleRequest {

    @NotNull(message = "User ID is required")
    private UUID userId;

    @NotNull(message = "Portfolio ID is required")
    private UUID portfolioId;

    @NotNull(message = "Metric type is required")
    private String metricType;

    @NotNull(message = "Threshold value is required")
    private BigDecimal thresholdValue;

    private String direction;

    public AlertRuleRequest() {
    }

    public UUID getUserId() {
        return userId;
    }

    public void setUserId(UUID userId) {
        this.userId = userId;
    }

    public UUID getPortfolioId() {
        return portfolioId;
    }

    public void setPortfolioId(UUID portfolioId) {
        this.portfolioId = portfolioId;
    }

    public String getMetricType() {
        return metricType;
    }

    public void setMetricType(String metricType) {
        this.metricType = metricType;
    }

    public BigDecimal getThresholdValue() {
        return thresholdValue;
    }

    public void setThresholdValue(BigDecimal thresholdValue) {
        this.thresholdValue = thresholdValue;
    }

    public String getDirection() {
        return direction;
    }

    public void setDirection(String direction) {
        this.direction = direction;
    }
}
