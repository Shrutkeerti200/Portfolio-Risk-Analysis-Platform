package com.portfolio.notification.controller;

import java.math.BigDecimal;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.portfolio.notification.service.AlertEvaluatorService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@RestController
@RequestMapping("/api/internal")
@RequiredArgsConstructor
@Slf4j
public class InternalPriceController {

    private final ObjectMapper objectMapper;
    private final AlertEvaluatorService alertEvaluatorService;

    @PostMapping("/price-update")
    public ResponseEntity<Void> receivePriceUpdate(@RequestBody String message) {
        try {
            JsonNode node = objectMapper.readTree(message);
            String symbol = node.get("symbol").asText();
            BigDecimal price = node.get("currentPrice").decimalValue();

            log.debug("Received price update via REST: {} = ${}", symbol, price);
            alertEvaluatorService.evaluateAlertsForStock(symbol);

            return ResponseEntity.ok().build();
        } catch (Exception e) {
            log.error("Error processing REST price update: {}", e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }
}