package com.portfolio.service.service;

import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {

    private final JavaMailSender mailSender;

    public void sendOtpEmail(String toEmail, String otpCode) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true);

            helper.setTo(toEmail);
            helper.setSubject("Portfolio Risk Platform - Email Verification");
            helper.setText(buildOtpEmailBody(otpCode), true);

            mailSender.send(message);
            log.info("OTP email sent to: {}", toEmail);
        } catch (MessagingException e) {
            log.error("Failed to send OTP email to: {}", toEmail, e);
            throw new RuntimeException("Failed to send verification email. Please try again.");
        }
    }

    private String buildOtpEmailBody(String otpCode) {
        return """
                <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #1f2937; border-radius: 12px; color: #e5e7eb;">
                    <h2 style="color: #ffffff; text-align: center; margin-bottom: 8px;">Portfolio Risk Platform</h2>
                    <p style="text-align: center; color: #9ca3af; margin-bottom: 24px;">Email Verification</p>
                    <div style="background: #111827; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 24px;">
                        <p style="color: #9ca3af; margin-bottom: 12px;">Your verification code is:</p>
                        <h1 style="color: #3b82f6; font-size: 36px; letter-spacing: 8px; margin: 0;">%s</h1>
                    </div>
                    <p style="color: #9ca3af; text-align: center; font-size: 14px;">This code expires in <strong style="color: #ffffff;">5 minutes</strong>.</p>
                    <p style="color: #6b7280; text-align: center; font-size: 12px; margin-top: 24px;">If you didn't request this code, please ignore this email.</p>
                </div>
                """.formatted(otpCode);
    }
}
