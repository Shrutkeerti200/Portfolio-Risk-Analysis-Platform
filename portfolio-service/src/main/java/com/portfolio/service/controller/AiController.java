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
}
