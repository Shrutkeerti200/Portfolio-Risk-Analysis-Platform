package com.portfolio.risk.kafka;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.portfolio.risk.dto.PriceUpdateMessage;
import com.portfolio.risk.service.RiskCalculationService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Component
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(name = "messaging.mode", havingValue = "kafka", matchIfMissing = true)
public class PriceConsumer {

    private final ObjectMapper objectMapper;
    private final RiskCalculationService riskCalculationService;

    @KafkaListener(topics = "stock-price-updates", groupId = "risk-engine-group")
    public void consumePriceUpdate(String message) {
        try {
            PriceUpdateMessage priceUpdate = objectMapper.readValue(message, PriceUpdateMessage.class);
            log.info("Consumed price update: {} = ${}", priceUpdate.getSymbol(), priceUpdate.getCurrentPrice());

            // Trigger risk recalculation for affected portfolios
            riskCalculationService.recalculateForStock(priceUpdate.getSymbol());
        } catch (Exception e) {
            log.error("Error processing price update: {}", e.getMessage());
        }
    }
}