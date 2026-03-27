package com.portfolio.service.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.portfolio.service.model.Transaction;

@Repository
public interface TransactionRepository extends JpaRepository<Transaction, UUID> {

    List<Transaction> findByHoldingIdOrderByExecutedAtDesc(UUID holdingId);

    List<Transaction> findByHoldingPortfolioIdOrderByExecutedAtDesc(UUID portfolioId);
}
