package com.portfolio.service.dto;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PortfolioResponse {

    private UUID id;

    private String name;

    private String description;

    private List<HoldingResponse> holdings;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
