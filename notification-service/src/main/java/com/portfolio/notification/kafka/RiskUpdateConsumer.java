package com.portfolio.notification.kafka;

import java.math.BigDecimal;

import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.portfolio.notification.service.AlertEvaluatorService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Component
@RequiredArgsConstructor
@Slf4j
public class RiskUpdateConsumer {

    private final ObjectMapper objectMapper;
    private final AlertEvaluatorService alertEvaluatorService;

    @KafkaListener(topics = "stock-price-updates", groupId = "notification-group")
    public void consumerPriceUpdate(String message) {
        try {
            JsonNode node = objectMapper.readTree(message);
            String symbol = node.get("symbol").asText();
            BigDecimal price = node.get("currentPrice").decimalValue();

            log.debug("Notification service received price update: {} = ${}", symbol, price);

            alertEvaluatorService.evaluateAlertsForStock(symbol);
        } catch (Exception e) {
            log.error("Error processing price update in notification service: {}", e.getMessage());
        }
    }
}
