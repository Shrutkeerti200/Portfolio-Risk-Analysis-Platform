package com.portfolio.risk.model;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "risk_snapshots")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RiskSnapshot {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "portfolio_id", nullable=false)
    private UUID portfolioId;

    @Column(name = "volatility", precision = 10, scale = 6)
    private BigDecimal volatility;

    @Column(name = "sharpe_ratio", precision = 10, scale = 6)
    private BigDecimal sharpeRatio;

    @Column(name = "value_at_risk", precision = 15, scale = 4)
    private BigDecimal valueAtRisk;

    @Column(name = "portfolio_beta", precision = 10, scale = 6)
    private BigDecimal portfolioBeta;

    @Column(name = "total_value", precision = 15, scale = 4)
    private BigDecimal totalValue;

    @Column(name = "daily_return", precision = 10, scale = 6)
    private BigDecimal dailyReturn;

    @Column(name = "calculated_at", nullable=false)
    private LocalDateTime calculatedAt;
}
