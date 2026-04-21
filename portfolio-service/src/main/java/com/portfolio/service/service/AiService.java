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

    /**
     * General portfolio analysis chat.
     */
    public String analyzePortfolio(String question, String portfolioContext) {
        String systemPrompt = "You are a helpful financial portfolio analyst assistant for a Portfolio Risk Analytics Platform. "
                + "You have access to the user's portfolio data below. Use this data to answer their question accurately. "
                + "Be concise (under 200 words). Use specific numbers from the data. "
                + "Never provide specific buy/sell financial advice. Remind users this is for informational purposes only.\n\n"
                + "USER'S PORTFOLIO DATA:\n" + portfolioContext;

        return callGroq(systemPrompt, question, 1024, 0.7);
    }

    /**
     * Research a stock before adding it to portfolio.
     */
    public String researchStock(String symbol, String portfolioContext) {
        String systemPrompt = "You are a stock research analyst. The user is considering adding " + symbol + " to their portfolio. "
                + "Provide a brief research summary (under 250 words) covering:\n"
                + "1. What the company does (1 sentence)\n"
                + "2. Recent stock performance and key metrics (P/E, market cap if known)\n"
                + "3. Key strengths and growth drivers\n"
                + "4. Key risks to consider\n"
                + "5. How it fits with their current portfolio (see data below)\n\n"
                + "Be factual and balanced. Never recommend buying or selling — present information so the user can decide.\n"
                + "Remind the user this is for informational purposes only.\n\n"
                + "USER'S CURRENT PORTFOLIO:\n" + portfolioContext;

        String question = "Give me a research summary for " + symbol;
        return callGroq(systemPrompt, question, 1024, 0.7);
    }

    /**
     * Generate a daily portfolio digest.
     */
    public String generateDailyDigest(String portfolioContext) {
        String systemPrompt = "You are a portfolio analyst writing a daily briefing for an investor. "
                + "Based on the portfolio data below, write a concise daily digest (under 300 words) covering:\n"
                + "1. **Portfolio Overview** — Total value, overall P/L, and how the portfolio performed today\n"
                + "2. **Top Movers** — Which holdings had the biggest gains or losses\n"
                + "3. **Risk Check** — Comment on the current volatility, Sharpe ratio, VaR, and beta values. Are they healthy?\n"
                + "4. **Observations** — Any concentration risks, diversification issues, or notable patterns\n"
                + "5. **What to Watch** — 1-2 things the investor should keep an eye on\n\n"
                + "Use a professional but approachable tone. Use the actual numbers from the data. "
                + "Format with clear sections using **bold** headers. "
                + "Remind the user this is for informational purposes only.\n\n"
                + "PORTFOLIO DATA:\n" + portfolioContext;

        String question = "Generate my daily portfolio digest for today.";
        return callGroq(systemPrompt, question, 1500, 0.7);
    }

    /**
     * Explain technical indicators for a specific stock in beginner-friendly language.
     */
    public String explainIndicators(String indicatorData) {
        String systemPrompt = "You are a friendly financial educator inside a portfolio risk analytics app called Riskient. "
                + "A beginner investor is looking at technical indicator charts and wants to understand what they mean. "
                + "You will receive the actual data from three charts: Price with Moving Averages (SMA 10 & SMA 20), "
                + "RSI (14-period), and Daily Momentum (% change bars).\n\n"
                + "Explain the charts in a conversational, beginner-friendly way (under 250 words) with these sections:\n"
                + "1. **Price & Moving Averages** — Is the price trending up or down? Is it above or below the SMAs? "
                + "Explain what that means using a simple analogy (e.g., 'think of SMAs as a smoothed-out path the stock has been walking').\n"
                + "2. **RSI Reading** — What does the current RSI number mean? Is the stock overbought, oversold, or neutral? "
                + "Explain in plain English what that implies.\n"
                + "3. **Momentum Check** — Are recent days mostly green (bullish) or red (bearish)? "
                + "Is the momentum strengthening, fading, or mixed?\n"
                + "4. **The Big Picture** — In 1-2 sentences, summarize what all three indicators together suggest. "
                + "Keep it simple — like explaining to a friend who just started investing.\n\n"
                + "If the user holds this stock, briefly mention how their position is doing in context.\n\n"
                + "IMPORTANT: Use the actual numbers from the data. Do NOT make up values. "
                + "Use **bold** for section headers. End with a brief reminder that this is not financial advice.";
 
        String question = "Please explain these technical indicator charts for me:\n\n" + indicatorData;
        return callGroq(systemPrompt, question, 1200, 0.7);
    }

    /**
     * Rewrite a raw alert message into a human-readable summary.
     */
    public String summarizeAlert(String alertTitle, String alertMessage, String portfolioContext) {
        String systemPrompt = "You are a portfolio risk advisor. The user received the following alert:\n"
                + "Title: " + alertTitle + "\n"
                + "Message: " + alertMessage + "\n\n"
                + "Rewrite this alert in plain English (under 100 words). Explain:\n"
                + "1. What happened in simple terms\n"
                + "2. Why it matters\n"
                + "3. What the user might want to look at\n\n"
                + "Use the portfolio data below for context. Be calm and factual — don't cause panic. "
                + "Never recommend specific trades.\n\n"
                + "PORTFOLIO DATA:\n" + portfolioContext;

        String question = "Explain this alert to me simply.";
        return callGroq(systemPrompt, question, 512, 0.5);
    }

    /**
     * Core method that calls the Groq API.
     */
    private String callGroq(String systemPrompt, String userMessage, int maxTokens, double temperature) {
        try {
            String url = "https://api.groq.com/openai/v1/chat/completions";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Authorization", "Bearer " + apiKey);

            Map<String, Object> body = Map.of(
                    "model", "llama-3.3-70b-versatile",
                    "messages", List.of(
                            Map.of("role", "system", "content", systemPrompt),
                            Map.of("role", "user", "content", userMessage)
                    ),
                    "max_tokens", maxTokens,
                    "temperature", temperature
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
            return "Sorry, I'm unable to process your request right now. Please try again later.";
        }
    }
}
