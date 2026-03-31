package com.portfolio.risk.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.portfolio.risk.model.RiskSnapshot;


@Repository
public interface RiskSnapshotRepository extends JpaRepository<RiskSnapshot, UUID>{

    Optional<RiskSnapshot> findTopByPortfolioIdOrderByCalculatedAtDesc(UUID portfolioId);

    List<RiskSnapshot> findByPortfolioIdOrderByCalculatedAtDesc(UUID portfolioId);

}
