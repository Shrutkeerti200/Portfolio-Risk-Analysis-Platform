package com.portfolio.notification.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.portfolio.notification.model.AlertRule;


@Repository
public interface AlertRuleRepository extends JpaRepository<AlertRule, UUID>{

    List<AlertRule> findByUserIdAndIsActiveTrue(UUID userId);

    List<AlertRule> findByPortfolioIdAndIsActiveTrue(UUID userId);

    List<AlertRule> findByUserId(UUID userId); 

}
