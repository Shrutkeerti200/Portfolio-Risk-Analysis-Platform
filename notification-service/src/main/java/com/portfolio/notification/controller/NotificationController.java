package com.portfolio.notification.controller;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.portfolio.notification.dto.AlertRuleRequest;
import com.portfolio.notification.model.AlertRule;
import com.portfolio.notification.model.Notification;
import com.portfolio.notification.service.NotificationService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    // ------------- NOTIFICATION ENDPOINTS -------------------//
    @GetMapping("/notifications/{userId}")
    public ResponseEntity<?> getNotifications(@PathVariable UUID userId) {
        return ResponseEntity.ok(notificationService.getUserNotifications(userId));
    }

    @GetMapping("/notifications/{userId}/unread/count")
    public ResponseEntity<Map<String, Long>> getUnreadCount(@PathVariable UUID userId) {
        long count = notificationService.getUnreadCount(userId);
        Map<String, Long> response = new HashMap<>();
        response.put("unreadCount", count);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/notifications/{notificationId}/read")
    public ResponseEntity<Notification> markAsRead(@PathVariable UUID notificationId) {

        return ResponseEntity.ok(notificationService.markAsRead(notificationId));
    }

    @PutMapping("/notifications/{userId}/read-all")
    public ResponseEntity<Map<String, String>> markAllAsRead(@PathVariable UUID userId) {
        notificationService.markAllAsRead(userId);
        Map<String, String> response = new HashMap<>();
        response.put("message", "All notifications marked as read");
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/notifications/{notificationId}")
    public ResponseEntity<Map<String, String>> deleteNotification(@PathVariable UUID notificationId) {
        notificationService.deleteNotification(notificationId);
        Map<String, String> response = new HashMap<>();
        response.put("message", "Notification deleted");
        return ResponseEntity.ok(response);
    }

    // ------------- ALERT RULE ENDPOINTS -------------------//
    @GetMapping("/alert/rules/{userId}")
    public ResponseEntity<List<AlertRule>> getAlertRules(@PathVariable UUID userId) {
        return ResponseEntity.ok(notificationService.getUserAlertRules(userId));
    }

    @PostMapping("/alerts/rules")
    public ResponseEntity<?> createAlertRule(@Valid @RequestBody AlertRuleRequest request) {
        try {
            AlertRule rule = notificationService.createAlertRule(request);
            return ResponseEntity.status(HttpStatus.CREATED).body(rule);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    @PutMapping("/alerts/rules/{ruleId}")
    public ResponseEntity<?> updateAlertRule(@PathVariable UUID ruleId, @Valid @RequestBody AlertRuleRequest request) {
        try {
            AlertRule rule = notificationService.updateAlertRule(ruleId, request);
            return ResponseEntity.ok(rule);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    @DeleteMapping("/alerts/rules/{ruleId}")
    public ResponseEntity<Map<String, String>> deleteAlertRule(@PathVariable UUID ruleId) {
        notificationService.deleteAlertRule(ruleId);
        Map<String, String> response = new HashMap<>();
        response.put("message", "Alert rule deleted");
        return ResponseEntity.ok(response);
    }

    // ------------- HEALTH CHECK -------------------//

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> healthCheck() {
        Map<String, String> status = new HashMap<>();
        status.put("service", "Notification service is healthy");
        status.put("status", "OK");
        return ResponseEntity.ok(status);
    }

}
