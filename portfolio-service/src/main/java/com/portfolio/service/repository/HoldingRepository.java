package com.portfolio.service.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.portfolio.service.model.Holding;

@Repository
public interface HoldingRepository extends JpaRepository<Holding, UUID> {

    List<Holding> findByPortfolioId(UUID portfolioId);

    Optional<Holding> findByPortfolioIdAndStockSymbol(UUID portfolioId, String stockSymbol);

    boolean existsByPortfolioIdAndStockSymbol(UUID portfolioId, String stockSymbol);
}
