package com.portfolio.service.dto;

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
public class HoldingResponse {

    private UUID id;

    private String stockSymbol;

    private BigDecimal quantity;

    private BigDecimal avgBuyPrice;

    private BigDecimal totalInvested;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
