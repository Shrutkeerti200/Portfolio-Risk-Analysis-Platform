package com.portfolio.service.dto;

import java.math.BigDecimal;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class HoldingRequest {

    @NotBlank(message = "Stock symbol is required")
    private String stockSymbol;

    @NotNull(message = "Quantity is required")
    @DecimalMin(value = "0.0001", message = "Quantity must be greater than zero")
    private BigDecimal quantity;

    @NotNull(message = "Buy price is required")
    @DecimalMin(value = "0.0001", message = "Buy price must be greater than zero")
    private BigDecimal buyPrice;

    public HoldingRequest() {
    }

    public HoldingRequest(String stockSymbol, BigDecimal quantity, BigDecimal buyPrice) {
        this.stockSymbol = stockSymbol;
        this.quantity = quantity;
        this.buyPrice = buyPrice;
    }

    public String getStockSymbol() {
        return stockSymbol;
    }

    public void setStockSymbol(String stockSymbol) {
        this.stockSymbol = stockSymbol;
    }

    public BigDecimal getQuantity() {
        return quantity;
    }

    public void setQuantity(BigDecimal quantity) {
        this.quantity = quantity;
    }

    public BigDecimal getBuyPrice() {
        return buyPrice;
    }

    public void setBuyPrice(BigDecimal buyPrice) {
        this.buyPrice = buyPrice;
    }
}
