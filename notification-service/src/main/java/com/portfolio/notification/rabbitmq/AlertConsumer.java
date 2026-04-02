package com.portfolio.notification.rabbitmq;

import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import com.portfolio.notification.dto.RiskAlertMessage;
import com.portfolio.notification.model.Notification;
import com.portfolio.notification.repository.NotificationRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Component
@RequiredArgsConstructor
@Slf4j
public class AlertConsumer {

    private final NotificationRepository notificationRepository;

    @RabbitListener(queues = "alert-notifications")
    public void handleRiskAlert(RiskAlertMessage alertMessage) {
        log.info("Received risk alert for user {}: {}", alertMessage.getUserId(), alertMessage.getMessage());

        try {
            Notification notification = Notification.builder()
                    .userId(alertMessage.getUserId())
                    .title("Risk Alert: " + alertMessage.getMetricType())
                    .message(alertMessage.getMessage())
                    .type(Notification.NotificationType.RISK_ALERT)
                    .isRead(false)
                    .build();

            notificationRepository.save(notification);
            log.info("Notification saved for user: {}", alertMessage.getUserId());
        } catch (Exception e) {
            log.error("Error processing risk alert: {}", e.getMessage());
        }
    }
}
