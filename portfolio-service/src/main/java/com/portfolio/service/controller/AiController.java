package com.portfolio.service.controller;

import java.util.HashMap;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.portfolio.service.service.AiService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiController {

    private final AiService aiService;
    private final ObjectMapper objectMapper;

    /**
     * General portfolio analysis chat.
     */
    @PostMapping("/chat")
    public ResponseEntity<Map<String, String>> chat(@RequestBody String body, Authentication auth) {
        Map<String, String> result = new HashMap<>();

        if (auth == null) {
            result.put("error", "Unauthorized");
            return ResponseEntity.status(401).body(result);
        }

        try {
            JsonNode json = objectMapper.readTree(body);
            String question = json.has("question") ? json.get("question").asText() : null;
            String portfolioContext = json.has("portfolioContext") ? json.get("portfolioContext").asText() : "";

            if (question == null || question.isBlank()) {
                result.put("response", "Please ask a question.");
                return ResponseEntity.badRequest().body(result);
            }

            System.out.println("AI chat request from " + auth.getName() + ": " + question);
            String response = aiService.analyzePortfolio(question, portfolioContext);
            result.put("response", response);
            return ResponseEntity.ok(result);

        } catch (Exception e) {
            result.put("response", "Error processing request: " + e.getMessage());
            return ResponseEntity.badRequest().body(result);
        }
    }

    /**
     * Research a stock symbol — returns company overview, risks, and fit with current portfolio.
     */
    @PostMapping("/research")
    public ResponseEntity<Map<String, String>> researchStock(@RequestBody String body, Authentication auth) {
        Map<String, String> result = new HashMap<>();

        if (auth == null) {
            result.put("error", "Unauthorized");
            return ResponseEntity.status(401).body(result);
        }

        try {
            JsonNode json = objectMapper.readTree(body);
            String symbol = json.has("symbol") ? json.get("symbol").asText() : null;
            String portfolioContext = json.has("portfolioContext") ? json.get("portfolioContext").asText() : "";

            if (symbol == null || symbol.isBlank()) {
                result.put("response", "Please provide a stock symbol.");
                return ResponseEntity.badRequest().body(result);
            }

            String response = aiService.researchStock(symbol.toUpperCase(), portfolioContext);
            result.put("response", response);
            result.put("symbol", symbol.toUpperCase());
            return ResponseEntity.ok(result);

        } catch (Exception e) {
            result.put("response", "Error researching stock: " + e.getMessage());
            return ResponseEntity.badRequest().body(result);
        }
    }

    /**
     * Generate a daily portfolio digest — performance summary, top movers, risk check.
     */
    @PostMapping("/digest")
    public ResponseEntity<Map<String, String>> dailyDigest(@RequestBody String body, Authentication auth) {
        Map<String, String> result = new HashMap<>();

        if (auth == null) {
            result.put("error", "Unauthorized");
            return ResponseEntity.status(401).body(result);
        }

        try {
            JsonNode json = objectMapper.readTree(body);
            String portfolioContext = json.has("portfolioContext") ? json.get("portfolioContext").asText() : "";

            if (portfolioContext.isBlank()) {
                result.put("response", "No portfolio data available to generate a digest.");
                return ResponseEntity.badRequest().body(result);
            }

            String response = aiService.generateDailyDigest(portfolioContext);
            result.put("response", response);
            return ResponseEntity.ok(result);

        } catch (Exception e) {
            result.put("response", "Error generating digest: " + e.getMessage());
            return ResponseEntity.badRequest().body(result);
        }
    }

    /**
     * Explain technical indicators (SMA, RSI, Momentum) for a stock in beginner-friendly language.
     */
    @PostMapping("/explain-indicators")
    public ResponseEntity<Map<String, String>> explainIndicators(@RequestBody String body, Authentication auth) {
        Map<String, String> result = new HashMap<>();
 
        if (auth == null) {
            result.put("error", "Unauthorized");
            return ResponseEntity.status(401).body(result);
        }
 
        try {
            JsonNode json = objectMapper.readTree(body);
            String indicatorData = json.has("indicatorData") ? json.get("indicatorData").asText() : "";
 
            if (indicatorData.isBlank()) {
                result.put("response", "No indicator data available to explain.");
                return ResponseEntity.badRequest().body(result);
            }
 
            String response = aiService.explainIndicators(indicatorData);
            result.put("response", response);
            return ResponseEntity.ok(result);
 
        } catch (Exception e) {
            result.put("response", "Error explaining indicators: " + e.getMessage());
            return ResponseEntity.badRequest().body(result);
        }
    }

    /**
     * Summarize an alert in plain English with context.
     */
    @PostMapping("/summarize-alert")
    public ResponseEntity<Map<String, String>> summarizeAlert(@RequestBody String body, Authentication auth) {
        Map<String, String> result = new HashMap<>();

        if (auth == null) {
            result.put("error", "Unauthorized");
            return ResponseEntity.status(401).body(result);
        }

        try {
            JsonNode json = objectMapper.readTree(body);
            String title = json.has("title") ? json.get("title").asText() : "";
            String message = json.has("message") ? json.get("message").asText() : "";
            String portfolioContext = json.has("portfolioContext") ? json.get("portfolioContext").asText() : "";

            String response = aiService.summarizeAlert(title, message, portfolioContext);
            result.put("response", response);
            return ResponseEntity.ok(result);

        } catch (Exception e) {
            result.put("response", "Error summarizing alert: " + e.getMessage());
            return ResponseEntity.badRequest().body(result);
        }
    }
}
