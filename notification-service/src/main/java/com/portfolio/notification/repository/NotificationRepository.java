package com.portfolio.notification.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.portfolio.notification.model.Notification;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, UUID>{

    List<Notification> findByUserIdOrderByCreatedAtDesc(UUID userId);

    long countByUserIdAndIsReadFalse(UUID userId);

    List<Notification> findByUserIdAndIsReadFalseOrderByCreatedAtDesc(UUID userId);

}
