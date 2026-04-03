package com.portfolio.service.service;

import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
public class AiService {

    @Value("${groq.api-key}")
    private String apiKey;

    private final RestTemplate restTemplate = new RestTemplate();

    public String analyzePortfolio(String question, String portfolioContext) {
        try {
            String url = "https://api.groq.com/openai/v1/chat/completions";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Authorization", "Bearer " + apiKey);

            String systemPrompt = "You are a helpful financial portfolio analyst assistant for a Portfolio Risk Analytics Platform. "
                    + "You have access to the user's portfolio data below. Use this data to answer their question accurately. "
                    + "Be concise (under 200 words). Use specific numbers from the data. "
                    + "Never provide specific buy/sell financial advice. Remind users this is for informational purposes only.\n\n"
                    + "USER'S PORTFOLIO DATA:\n" + portfolioContext;

            Map<String, Object> body = Map.of(
                    "model", "llama-3.3-70b-versatile",
                    "messages", List.of(
                            Map.of("role", "system", "content", systemPrompt),
                            Map.of("role", "user", "content", question)
                    ),
                    "max_tokens", 1024,
                    "temperature", 0.7
            );

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

            @SuppressWarnings("unchecked")
            Map<String, Object> response = restTemplate.postForObject(url, request, Map.class);

            if (response != null && response.containsKey("choices")) {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> choices = (List<Map<String, Object>>) response.get("choices");
                if (!choices.isEmpty()) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
                    return (String) message.get("content");
                }
            }

            return "I couldn't generate a response. Please try again.";
        } catch (Exception e) {
            System.err.println("Error calling Groq API: " + e.getMessage());
            return "Sorry, I'm unable to analyze your portfolio right now. Please try again later.";
        }
    }
}
