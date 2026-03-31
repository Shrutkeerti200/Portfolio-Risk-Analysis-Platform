package com.portfolio.risk.kafka;

import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.portfolio.risk.dto.PriceUpdateMessage;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Component
@RequiredArgsConstructor
@Slf4j
public class PriceProducer {

    private static final String TOPIC = "stock-price-updates";

    private final KafkaTemplate<String, String> kafkaTemplate;

    private final ObjectMapper objectMapper;

    public void sendPriceUpdate(PriceUpdateMessage message) {
        try {
            String json = objectMapper.writeValueAsString(message);
            kafkaTemplate.send(TOPIC, message.getSymbol(), json);
            log.info("Published price update: {} = ${}", message.getSymbol(), message.getCurrentPrice());
        } catch (Exception e) {
            log.error("Error serializing price update: {}", e.getMessage());
        }
    }
}
