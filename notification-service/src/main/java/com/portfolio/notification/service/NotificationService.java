package com.portfolio.notification.service;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.portfolio.notification.dto.AlertRuleRequest;
import com.portfolio.notification.model.AlertRule;
import com.portfolio.notification.model.Notification;
import com.portfolio.notification.repository.AlertRuleRepository;
import com.portfolio.notification.repository.NotificationRepository;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final AlertRuleRepository alertRuleRepository;

    // -------------NOTIFICATION OPERATIONS -------------------//
    public List<Notification> getUserNotifications(UUID userId) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    public long getUnreadCount(UUID userId) {
        return notificationRepository.countByUserIdAndIsReadFalse(userId);
    }

    @Transactional
    public Notification markAsRead(UUID notificationId) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new RuntimeException("Notification not found"));

        notification.setIsRead(true);
        return notificationRepository.save(notification);
    }

    @Transactional
    public void markAllAsRead(UUID userId) {
        List<Notification> unreadNotifications = notificationRepository.findByUserIdAndIsReadFalseOrderByCreatedAtDesc(userId);
        for (Notification notification : unreadNotifications) {
            notification.setIsRead(true);
        }
        notificationRepository.saveAll(unreadNotifications);
    }

    @Transactional
    public void deleteNotification(UUID notificationId) {
        if (!notificationRepository.existsById(notificationId)) {
            throw new RuntimeException("Notification not found");
        }
        notificationRepository.deleteById(notificationId);
    }

    // -------------ALERT RULE OPERATIONS -------------------//
    public List<AlertRule> getUserAlertRules(UUID userId) {
        return alertRuleRepository.findByUserId(userId);
    }

    @Transactional
    public AlertRule createAlertRule(AlertRuleRequest request) {
        AlertRule rule = AlertRule.builder()
                .userId(request.getUserId())
                .portfolioId(request.getPortfolioId())
                .metricType(AlertRule.MetricType.valueOf(request.getMetricType()))
                .thresholdValue(request.getThresholdValue())
                .direction(request.getDirection() != null ? AlertRule.Direction.valueOf(request.getDirection()) : AlertRule.Direction.ABOVE)
                .isActive(true)
                .build();

        return alertRuleRepository.save(rule);
    }

    @Transactional
    public AlertRule updateAlertRule(UUID ruleId, AlertRuleRequest request) {
        AlertRule rule = alertRuleRepository.findById(ruleId)
                .orElseThrow(() -> new RuntimeException("Alert rule not found"));

        rule.setMetricType(AlertRule.MetricType.valueOf(request.getMetricType()));
        rule.setThresholdValue(request.getThresholdValue());
        if (request.getDirection() != null) {
            rule.setDirection(AlertRule.Direction.valueOf(request.getDirection()));
        }   

        return alertRuleRepository.save(rule);
    }

    @Transactional
    public void deleteAlertRule(UUID ruleId) {
        if (!alertRuleRepository.existsById(ruleId)) {
            throw new RuntimeException("Alert rule not found");
        }
        alertRuleRepository.deleteById(ruleId);
    }

}
