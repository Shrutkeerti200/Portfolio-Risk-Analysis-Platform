package com.portfolio.notification.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RiskAlertMessage {

    private UUID userId;
    private UUID portfolioId;
    private UUID alertRuleId;
    private String metricType;
    private BigDecimal currentValue;
    private BigDecimal thresholdValue;
    private String direction;
    private String message;
    private LocalDateTime triggeredAt;
}
