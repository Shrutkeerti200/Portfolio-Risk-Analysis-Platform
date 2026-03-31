package com.portfolio.risk.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PriceUpdateMessage {

    private String symbol;

    private BigDecimal currentPrice;

    private BigDecimal previousClose;

    private BigDecimal changePercent;
    
    private Long volume;

    private LocalDateTime timestamp;
}
