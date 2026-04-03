package com.portfolio.service.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotNull;

public class OtpRequest {

    @NotNull(message = "Email is required")
    @Email(message = "Invalid email format")
    private String email;

    public OtpRequest() {}

    public OtpRequest(String email) {
        this.email = email;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

}
