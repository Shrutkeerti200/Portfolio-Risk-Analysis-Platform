package com.portfolio.service.service;

import java.security.SecureRandom;
import java.time.LocalDateTime;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.portfolio.service.model.OtpVerification;
import com.portfolio.service.repository.OtpVerificationRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class OtpService {

    private final OtpVerificationRepository otpRepository;
    private final EmailService emailService;
    private final SecureRandom secureRandom = new SecureRandom();

    @Value("${app.otp.expiry-minutes:5}")
    private int otpExpiryMinutes;

    private static final int MAX_OTP_REQUESTS = 5;

    @Transactional
    public void sendOtp(String email) {
        long recentCount = otpRepository.countByEmailAndExpiresAtAfter(
                email, LocalDateTime.now().minusMinutes(15));

        if (recentCount >= MAX_OTP_REQUESTS) {
            throw new RuntimeException("Too many OTP requests. Please try again later.");
        }

        String otpCode = generateOtp();

        OtpVerification otp = OtpVerification.builder()
                .email(email)
                .otpCode(otpCode)
                .expiresAt(LocalDateTime.now().plusMinutes(otpExpiryMinutes))
                .build();

        otpRepository.save(otp);
        emailService.sendOtpEmail(email, otpCode);
        log.info("OTP generated and sent for email: {}", email);
    }

    @Transactional
    public boolean verifyOtp(String email, String otpCode) {
        OtpVerification otp = otpRepository
                .findTopByEmailAndUsedFalseAndExpiresAtAfterOrderByExpiresAtDesc(
                        email, LocalDateTime.now())
                .orElseThrow(() -> new RuntimeException("No valid OTP found. Please request a new one."));

        if (otp.getAttempts() >= 3) {
            otp.setUsed(true);
            otpRepository.save(otp);
            throw new RuntimeException("Too many incorrect attempts. Please request a new OTP.");
        }

        if (!otp.getOtpCode().equals(otpCode)) {
            otp.setAttempts(otp.getAttempts() + 1);
            otpRepository.save(otp);
            throw new RuntimeException("Invalid OTP. " + (3 - otp.getAttempts()) + " attempts remaining.");
        }

        otp.setUsed(true);
        otpRepository.save(otp);
        return true;
    }

    private String generateOtp() {
        int otp = 100000 + secureRandom.nextInt(900000);
        return String.valueOf(otp);
    }
}
