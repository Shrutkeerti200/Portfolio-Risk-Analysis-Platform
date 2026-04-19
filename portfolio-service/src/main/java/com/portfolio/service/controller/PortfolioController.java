package com.portfolio.service.controller;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.portfolio.service.dto.HoldingRequest;
import com.portfolio.service.dto.HoldingResponse;
import com.portfolio.service.dto.PortfolioRequest;
import com.portfolio.service.dto.PortfolioResponse;
import com.portfolio.service.dto.TransactionRequest;
import com.portfolio.service.dto.TransactionResponse;
import com.portfolio.service.service.PortfolioManagementService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/portfolios")
@RequiredArgsConstructor
public class PortfolioController {

    private final PortfolioManagementService portfolioService;

    // -------------------- PORTFOLIO ENDPOINTS ------------------- //
    @GetMapping
    public ResponseEntity<List<PortfolioResponse>> getAllPortfolios(Authentication auth) {
        List<PortfolioResponse> portfolios = portfolioService.getUserPortfolios(auth.getName());
        return ResponseEntity.ok(portfolios);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getPortfolio(@PathVariable UUID id, Authentication auth) {
        try {
            PortfolioResponse portfolio = portfolioService.getPortfolioById(auth.getName(), id);
            return ResponseEntity.ok(portfolio);
        } catch (Exception e) {
            return ResponseEntity.status(404).body("Portfolio not found or access denied");
        }
    }

    @PostMapping
    public ResponseEntity<?> createPortfolio(@Valid @RequestBody PortfolioRequest request, Authentication auth) {
        try {
            PortfolioResponse portfolio = portfolioService.createPortfolio(auth.getName(), request);
            return ResponseEntity.status(HttpStatus.CREATED).body(portfolio);
        } catch (Exception e) {
            return errorResponse(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updatePortfolio(@PathVariable UUID id, @Valid @RequestBody PortfolioRequest request, Authentication auth) {
        try {
            PortfolioResponse portfolio = portfolioService.updatePortfolio(auth.getName(), id, request);
            return ResponseEntity.ok(portfolio);
        } catch (RuntimeException e) {
            return errorResponse(HttpStatus.NOT_FOUND, e.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deletePortfolio(@PathVariable UUID id, Authentication auth) {
        try {
            portfolioService.deletePortfolio(auth.getName(), id);
            return ResponseEntity.ok(Map.of("message", "Portfolio deleted successfully"));
        } catch (RuntimeException e) {
            return errorResponse(HttpStatus.NOT_FOUND, e.getMessage());
        }
    }

    // -------------------- HOLDING ENDPOINTS ------------------- //
    @GetMapping("/{portfolioId}/holdings")
    public ResponseEntity<?> getHoldings(@PathVariable UUID portfolioId, Authentication auth) {
        try {
            List<HoldingResponse> holdings = portfolioService.getPortfolioHoldings(auth.getName(), portfolioId);
            return ResponseEntity.ok(holdings);
        } catch (RuntimeException e) {
            return errorResponse(HttpStatus.NOT_FOUND, e.getMessage());
        }
    }

    @PostMapping("/{portfolioId}/holdings")
    public ResponseEntity<?> addHolding(@PathVariable UUID portfolioId, @Valid @RequestBody HoldingRequest request, Authentication auth) {
        try {
            HoldingResponse holding = portfolioService.addHolding(auth.getName(), portfolioId, request);
            return ResponseEntity.status(HttpStatus.CREATED).body(holding);
        } catch (Exception e) {
            return errorResponse(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    @PutMapping("/holdings/{holdingId}")
    public ResponseEntity<?> updateHolding(@PathVariable UUID holdingId, @Valid @RequestBody HoldingRequest request, Authentication auth) {
        try {
            HoldingResponse holding = portfolioService.updateHolding(auth.getName(), holdingId, request);
            return ResponseEntity.ok(holding);
        } catch (RuntimeException e) {
            return errorResponse(HttpStatus.NOT_FOUND, e.getMessage());
        }
    }

    @DeleteMapping("/holdings/{holdingId}")
    public ResponseEntity<?> deleteHolding(@PathVariable UUID holdingId, Authentication auth) {
        try {
            portfolioService.deleteHolding(auth.getName(), holdingId);
            return ResponseEntity.ok(Map.of("message", "Holding deleted successfully"));
        } catch (RuntimeException e) {
            return errorResponse(HttpStatus.NOT_FOUND, e.getMessage());
        }
    }

    // -------------------- TRANSACTION ENDPOINTS ------------------- //
    /**
     * Add a BUY or SELL transaction to an existing holding.
     * Recalculates avg cost basis for buys, validates quantity for sells.
     */
    @PostMapping("/holdings/{holdingId}/transactions")
    public ResponseEntity<?> addTransaction(
            @PathVariable UUID holdingId,
            @Valid @RequestBody TransactionRequest request,
            Authentication auth) {
        try {
            HoldingResponse holding = portfolioService.addTransaction(auth.getName(), holdingId, request);
            return ResponseEntity.ok(holding);
        } catch (RuntimeException e) {
            return errorResponse(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    /**
     * Get all transactions for a specific holding.
     */
    @GetMapping("/holdings/{holdingId}/transactions")
    public ResponseEntity<?> getHoldingTransactions(@PathVariable UUID holdingId, Authentication auth) {
        try {
            List<TransactionResponse> transactions = portfolioService.getHoldingTransactions(auth.getName(), holdingId);
            return ResponseEntity.ok(transactions);
        } catch (RuntimeException e) {
            return errorResponse(HttpStatus.NOT_FOUND, e.getMessage());
        }
    }

    /**
     * Get all transactions across all holdings in a portfolio.
     */
    @GetMapping("/{portfolioId}/transactions")
    public ResponseEntity<?> getTransactions(@PathVariable UUID portfolioId, Authentication auth) {
        try {
            List<TransactionResponse> transactions = portfolioService.getPortfolioTransactions(auth.getName(), portfolioId);
            return ResponseEntity.ok(transactions);
        } catch (RuntimeException e) {
            return errorResponse(HttpStatus.NOT_FOUND, e.getMessage());
        }
    }

    // -------------------- Helper Methods ------------------- //
    private ResponseEntity<Map<String, String>> errorResponse(HttpStatus status, String message) {
        Map<String, String> error = new HashMap<>();
        error.put("error", message);
        return ResponseEntity.status(status).body(error);
    }
}
