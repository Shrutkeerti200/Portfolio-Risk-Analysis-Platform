package com.portfolio.risk.kafka;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.portfolio.risk.dto.PriceUpdateMessage;

import lombok.extern.slf4j.Slf4j;

@Component
@Slf4j
public class PriceProducer {

    private static final String TOPIC = "stock-price-updates";

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;
    private final String messagingMode;
    private final WebClient notificationWebClient;

    public PriceProducer(
            @Autowired(required = false)
            KafkaTemplate<String, String> kafkaTemplate,
            ObjectMapper objectMapper,
            @Value("${messaging.mode:kafka}") String messagingMode,
            @Value("${notification.service.url:http://localhost:8083}") String notificationServiceUrl) {
        this.kafkaTemplate = kafkaTemplate;
        this.objectMapper = objectMapper;
        this.messagingMode = messagingMode;
        this.notificationWebClient = WebClient.builder()
                .baseUrl(notificationServiceUrl)
                .build();
    }

    public void sendPriceUpdate(PriceUpdateMessage message) {
        try {
            String json = objectMapper.writeValueAsString(message);

            if ("rest".equalsIgnoreCase(messagingMode)) {
                sendViaRest(json, message);
            } else {
                if (kafkaTemplate != null) {
                    kafkaTemplate.send(TOPIC, message.getSymbol(), json);
                    log.info("Published price update via Kafka: {} = ${}",
                            message.getSymbol(), message.getCurrentPrice());
                } else {
                    log.warn("Kafka mode selected but KafkaTemplate is null");
                }
            }
        } catch (Exception e) {
            log.error("Error sending price update: {}", e.getMessage());
        }
    }

    private void sendViaRest(String json, PriceUpdateMessage message) {
        try {
            notificationWebClient.post()
                    .uri("/api/internal/price-update")
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(json)
                    .retrieve()
                    .bodyToMono(Void.class)
                    .subscribe(
                        success -> log.info("Sent price update via REST: {} = ${}",
                                message.getSymbol(), message.getCurrentPrice()),
                        error -> log.warn("Failed to send price update via REST: {}",
                                error.getMessage())
                    );
        } catch (Exception e) {
            log.warn("Error sending price update via REST: {}", e.getMessage());
        }
    }
}