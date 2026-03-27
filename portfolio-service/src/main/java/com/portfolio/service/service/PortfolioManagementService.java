package com.portfolio.service.service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.portfolio.service.dto.HoldingRequest;
import com.portfolio.service.dto.HoldingResponse;
import com.portfolio.service.dto.PortfolioRequest;
import com.portfolio.service.dto.PortfolioResponse;
import com.portfolio.service.dto.TransactionResponse;
import com.portfolio.service.model.Holding;
import com.portfolio.service.model.Portfolio;
import com.portfolio.service.model.Transaction;
import com.portfolio.service.model.User;
import com.portfolio.service.repository.HoldingRepository;
import com.portfolio.service.repository.PortfolioRepository;
import com.portfolio.service.repository.TransactionRepository;
import com.portfolio.service.repository.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class PortfolioManagementService {

    private final PortfolioRepository portfolioRepository;

    private final TransactionRepository transactionRepository;

    private final HoldingRepository holdingRepository;

    private final UserRepository userRepository;

    // ---------------------Portfolio Opreations---------------------//
    @Transactional(readOnly = true)
    public List<PortfolioResponse> getUserPortfolios(String email) {

        User user = findUserByEmail(email);
        List<Portfolio> portfolios = portfolioRepository.findByUserId(user.getId());
        return portfolios.stream().map(this::toPortfolioResponse).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public PortfolioResponse getPortfolioById(String email, UUID portfolioId) {

        User user = findUserByEmail(email);
        Portfolio portfolio = portfolioRepository.findByIdAndUserId(portfolioId, user.getId())
                .orElseThrow(() -> new RuntimeException("Portfolio not found"));
        return toPortfolioResponse(portfolio);
    }

    @Transactional
    public PortfolioResponse createPortfolio(String email, PortfolioRequest request) {

        User user = findUserByEmail(email);

        if (portfolioRepository.existsByNameAndUserId(request.getName(), user.getId())) {
            throw new RuntimeException("Portfolio with this name already exists");
        }

        Portfolio portfolio = Portfolio.builder()
                .user(user)
                .name(request.getName())
                .description(request.getDescription())
                .build();

        Portfolio saved = portfolioRepository.save(portfolio);
        return toPortfolioResponse(saved);
    }

    @Transactional
    public PortfolioResponse updatePortfolio(String email, UUID portfolioId, PortfolioRequest request) {

        User user = findUserByEmail(email);
        Portfolio portfolio = portfolioRepository.findByIdAndUserId(portfolioId, user.getId())
                .orElseThrow(() -> new RuntimeException("Portfolio not found"));

        portfolio.setName(request.getName());
        portfolio.setDescription(request.getDescription());

        Portfolio saved = portfolioRepository.save(portfolio);
        return toPortfolioResponse(saved);
    }

    @Transactional
    public void deletePortfolio(String email, UUID portfolioId) {

        User user = findUserByEmail(email);
        Portfolio portfolio = portfolioRepository.findByIdAndUserId(portfolioId, user.getId())
                .orElseThrow(() -> new RuntimeException("Portfolio not found"));

        // Delete the portfolio
        portfolioRepository.delete(portfolio);
    }

    // ---------------------Holding Opreations---------------------//
    
    @Transactional(readOnly = true)
    public List<HoldingResponse> getPortfolioHoldings(String email, UUID portfolioId) {

        User user = findUserByEmail(email);
        portfolioRepository.findByIdAndUserId(portfolioId, user.getId())
                .orElseThrow(() -> new RuntimeException("Portfolio not found"));

        List<Holding> holdings = holdingRepository.findByPortfolioId(portfolioId);

        return holdings.stream().map(this::toHoldingResponse).collect(Collectors.toList());
    }

    @Transactional
    public HoldingResponse addHolding(String email, UUID portfolioId, HoldingRequest request) {
        User user = findUserByEmail(email);
        Portfolio portfolio = portfolioRepository.findByIdAndUserId(portfolioId, user.getId())
                .orElseThrow(() -> new RuntimeException("Portfolio not found"));

        String symbol = request.getStockSymbol().toUpperCase();

        // Check if holding already exists
        if (holdingRepository.existsByPortfolioIdAndStockSymbol(portfolioId, symbol)) {
            throw new RuntimeException("Holding for " + symbol + " already exists in the portfolio");
        }

        Holding holding = Holding.builder()
                .portfolio(portfolio)
                .stockSymbol(symbol)
                .quantity(request.getQuantity())
                .avgBuyPrice(request.getBuyPrice())
                .build();

        Holding saved = holdingRepository.save(holding);

        //Record BUY transaction
        Transaction transaction = Transaction.builder()
                .holding(saved)
                .type(Transaction.TransactionType.BUY)
                .quantity(request.getQuantity())
                .pricePerUnit(request.getBuyPrice())
                .totalAmount(request.getQuantity().multiply(request.getBuyPrice()))
                .executedAt(LocalDateTime.now())
                .build();

        transactionRepository.save(transaction);

        return toHoldingResponse(saved);

    }

    @Transactional
    public HoldingResponse updateHolding(String email, UUID holdingId, HoldingRequest request) {

        Holding holding = holdingRepository.findById(holdingId)
                .orElseThrow(() -> new RuntimeException("Holding not found"));

        User user = findUserByEmail(email);
        if (!holding.getPortfolio().getUser().getId().equals(user.getId())) {
            throw new RuntimeException("Holding not found");
        }

        BigDecimal oldQuantity = holding.getQuantity();
        BigDecimal newQuantity = request.getQuantity();
        BigDecimal priceDiff = request.getBuyPrice();

        holding.setQuantity(newQuantity);
        holding.setAvgBuyPrice(request.getBuyPrice());

        Holding saved = holdingRepository.save(holding);

        // Record transaction based on quantity change
        Transaction.TransactionType type = newQuantity.compareTo(oldQuantity) > 0 ? Transaction.TransactionType.BUY : Transaction.TransactionType.SELL;

        BigDecimal quantityDiff = newQuantity.subtract(oldQuantity).abs();

        Transaction transaction = Transaction.builder()
                .holding(saved)
                .type(type)
                .quantity(quantityDiff)
                .pricePerUnit(priceDiff)
                .totalAmount(quantityDiff.multiply(priceDiff))
                .executedAt(LocalDateTime.now())
                .build();

        transactionRepository.save(transaction);

        return toHoldingResponse(saved);
    }

    @Transactional
    public void deleteHolding(String email, UUID holdingId) {

        Holding holding = holdingRepository.findById(holdingId)
                .orElseThrow(() -> new RuntimeException("Holding not found"));

        User user = findUserByEmail(email);
        if (!holding.getPortfolio().getUser().getId().equals(user.getId())) {
            throw new RuntimeException("Holding not found");
        }

        holdingRepository.delete(holding);
    }

    // ---------------------Transaction Opreations---------------------//
    
    @Transactional(readOnly = true)
    public List<TransactionResponse> getPortfolioTransactions(String email, UUID portfolioId) {

        User user = findUserByEmail(email);
        portfolioRepository.findByIdAndUserId(portfolioId, user.getId())
                .orElseThrow(() -> new RuntimeException("Portfolio not found"));

        List<Transaction> transactions = transactionRepository.findByHoldingPortfolioIdOrderByExecutedAtDesc(portfolioId);

        return transactions.stream().map(this::toTransactionResponse).collect(Collectors.toList());
    }

    // ---------------------Helper methods---------------------------// 
    private User findUserByEmail(String email) {

        return userRepository.findByEmail(email).orElseThrow(() -> new RuntimeException("User not found"));
    }

    private PortfolioResponse toPortfolioResponse(Portfolio portfolio) {
        List<HoldingResponse> holdingResponse = portfolio.getHoldings() != null ? portfolio.getHoldings().stream().map(this::toHoldingResponse).collect(Collectors.toList()) : List.of();

        return PortfolioResponse.builder()
                .id(portfolio.getId())
                .name(portfolio.getName())
                .description(portfolio.getDescription())
                .holdings(holdingResponse)
                .createdAt(portfolio.getCreatedAt())
                .updatedAt(portfolio.getUpdatedAt())
                .build();
    }

    private HoldingResponse toHoldingResponse(Holding holding) {
        return HoldingResponse.builder()
                .id(holding.getId())
                .stockSymbol(holding.getStockSymbol())
                .quantity(holding.getQuantity())
                .avgBuyPrice(holding.getAvgBuyPrice())
                .totalInvested(holding.getQuantity().multiply(holding.getAvgBuyPrice()))
                .createdAt(holding.getCreatedAt())
                .updatedAt(holding.getUpdatedAt())
                .build();
    }

    private TransactionResponse toTransactionResponse(Transaction transaction) {
        return TransactionResponse.builder()
                .id(transaction.getId())
                .holdingId(transaction.getHolding().getId())
                .stockSymbol(transaction.getHolding().getStockSymbol())
                .type(transaction.getType().name())
                .quantity(transaction.getQuantity())
                .pricePerUnit(transaction.getPricePerUnit())
                .totalAmount(transaction.getTotalAmount())
                .executedAt(transaction.getExecutedAt())
                .build();
    }
}
