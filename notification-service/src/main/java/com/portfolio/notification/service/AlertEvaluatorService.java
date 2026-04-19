package com.portfolio.notification.service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.portfolio.notification.model.AlertRule;
import com.portfolio.notification.model.Notification;
import com.portfolio.notification.repository.AlertRuleRepository;
import com.portfolio.notification.repository.NotificationRepository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class AlertEvaluatorService {

    private final AlertRuleRepository alertRuleRepository;
    private final NotificationRepository notificationRepository;
    private final EntityManager entityManager;

    // Cooldown period — same alert won't fire again within this duration
    private static final int COOLDOWN_MINUTES = 60;

    @Transactional
    public void evaluateAlertsForStock(String symbol) {
        List<UUID> portfolioIds = getPortfolioIdsForStock(symbol);

        for (UUID portfolioId : portfolioIds) {
            List<AlertRule> rules = alertRuleRepository.findByPortfolioIdAndIsActiveTrue(portfolioId);

            for (AlertRule rule : rules) {
                try {
                    evaluateRule(rule);
                } catch (Exception e) {
                    log.error("Error evaluating rule {}: {}", rule.getId(), e.getMessage());
                }
            }
        }
    }

    private void evaluateRule(AlertRule rule) {
        BigDecimal currentValue = getCurrentMetricValue(rule.getPortfolioId(), rule.getMetricType());

        if (currentValue == null) {
            return;
        }

        boolean triggered = false;

        if (rule.getDirection() == AlertRule.Direction.ABOVE
                && currentValue.compareTo(rule.getThresholdValue()) > 0) {
            triggered = true;
        } else if (rule.getDirection() == AlertRule.Direction.BELOW
                && currentValue.compareTo(rule.getThresholdValue()) < 0) {
            triggered = true;
        }

        if (triggered) {
            // Check cooldown — skip if same alert fired within the last hour
            String title = "Risk Alert: " + rule.getMetricType().name();
            if (hasRecentNotification(rule.getUserId(), title, COOLDOWN_MINUTES)) {
                log.debug("Skipping alert for rule {} — cooldown active (fired within last {} min)",
                        rule.getId(), COOLDOWN_MINUTES);
                return;
            }

            String message = String.format(
                    "Alert: %s is %s (threshold: %s, current: %s)",
                    rule.getMetricType().name(),
                    rule.getDirection() == AlertRule.Direction.ABOVE ? "above" : "below",
                    rule.getThresholdValue().toPlainString(),
                    currentValue.toPlainString()
            );

            log.info("Alert triggered for portfolio {}: {}", rule.getPortfolioId(), message);

            Notification notification = Notification.builder()
                    .userId(rule.getUserId())
                    .title(title)
                    .message(message)
                    .type(Notification.NotificationType.RISK_ALERT)
                    .isRead(false)
                    .build();

            notificationRepository.save(notification);
        }
    }

    /**
     * Checks if a notification with the same title was created for this user
     * within the last N minutes. Prevents alert spam.
     */
    private boolean hasRecentNotification(UUID userId, String title, int minutes) {
        try {
            Query query = entityManager.createNativeQuery(
                "SELECT COUNT(*) FROM notifications " +
                "WHERE user_id = :userId " +
                "  AND title = :title " +
                "  AND created_at > :cutoff"
            );
            query.setParameter("userId", userId);
            query.setParameter("title", title);
            query.setParameter("cutoff", LocalDateTime.now().minusMinutes(minutes));

            Long count = ((Number) query.getSingleResult()).longValue();
            return count > 0;
        } catch (Exception e) {
            log.error("Error checking recent notifications: {}", e.getMessage());
            return false;
        }
    }

    private BigDecimal getCurrentMetricValue(UUID portfolioId, AlertRule.MetricType metricType) {
        try {
            String column = switch (metricType) {
                case VOLATILITY -> "volatility";
                case SHARPE_RATIO -> "sharpe_ratio";
                case VAR -> "value_at_risk";
                case BETA -> "portfolio_beta";
                case DAILY_RETURN -> "daily_return";
            };

            Query query = entityManager.createNativeQuery(
                    "SELECT " + column + " FROM risk_snapshots WHERE portfolio_id = :portfolioId ORDER BY calculated_at DESC LIMIT 1"
            );
            query.setParameter("portfolioId", portfolioId);

            List<?> results = query.getResultList();
            if (!results.isEmpty() && results.get(0) != null) {
                return new BigDecimal(results.get(0).toString());
            }
        } catch (Exception e) {
            log.error("Error fetching current metric value for portfolio {}: {}", portfolioId, e.getMessage());
            return null;
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    private List<UUID> getPortfolioIdsForStock(String symbol) {
        try {
            Query query = entityManager.createNativeQuery(
                    "SELECT DISTINCT portfolio_id FROM holdings WHERE stock_symbol = :symbol"
            );
            query.setParameter("symbol", symbol);

            return query.getResultList();
        } catch (Exception e) {
            log.error("Error fetching portfolio IDs for stock {}: {}", symbol, e.getMessage());
            return List.of();
        }
    }
}