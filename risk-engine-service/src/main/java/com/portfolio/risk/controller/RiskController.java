package com.portfolio.risk.controller;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.portfolio.risk.model.RiskSnapshot;
import com.portfolio.risk.repository.RiskSnapshotRepository;
import com.portfolio.risk.service.RiskCalculationService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/risk")
@RequiredArgsConstructor
public class RiskController {

    private final RiskCalculationService riskCalculationService;
    private final RiskSnapshotRepository riskSnapshotRepository;

    @PostMapping("/calculate/{portfolioId}")
    public ResponseEntity<?> calculateRisk(@PathVariable UUID portfolioId) {
        try {
            RiskSnapshot snapshot = riskCalculationService.calculatePortfolioRisk(portfolioId);
            if (snapshot == null) {
                Map<String, String> error = new HashMap<>();
                error.put("error", "Could not calculate risk - no holdings or price data found");
                return ResponseEntity.badRequest().body(error);
            }
            return ResponseEntity.ok(snapshot);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.internalServerError().body(error);

        }
    }

    @GetMapping("/portfolio/{portfolioId}")
    public ResponseEntity<?> getLatestRisk(@PathVariable UUID portfolioId) {
        return riskSnapshotRepository.findTopByPortfolioIdOrderByCalculatedAtDesc(portfolioId)
                .map(snapshot -> ResponseEntity.ok((Object) snapshot))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/portfolio/{portfolioId}/history")
    public ResponseEntity<List<RiskSnapshot>> getRiskHistory(@PathVariable UUID portfolioId) {
        List<RiskSnapshot> history = riskSnapshotRepository.findByPortfolioIdOrderByCalculatedAtDesc(portfolioId);
        return ResponseEntity.ok(history);
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        Map<String, String> status = new HashMap<>();
        status.put("service", "risk-engine");
        status.put("status", "UP");
        return ResponseEntity.ok(status);
    }
}
