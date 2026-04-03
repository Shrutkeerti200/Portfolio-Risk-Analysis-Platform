package com.portfolio.service.repository;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.portfolio.service.model.OtpVerification;

@Repository
public interface OtpVerificationRepository extends JpaRepository<OtpVerification, UUID> {
    
    Optional<OtpVerification> findTopByEmailAndUsedFalseAndExpiresAtAfterOrderByExpiresAtDesc(String email, LocalDateTime now);

    long countByEmailAndExpiresAtAfter(String email, LocalDateTime now);

    void deleteByExpiresAtBefore(LocalDateTime now);

}
