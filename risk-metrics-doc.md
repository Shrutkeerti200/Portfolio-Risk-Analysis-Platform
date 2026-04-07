# Finlytics — Financial Terms & Formulas Explained

This document explains all the financial terms, risk metrics, and formulas used in the Finlytics platform. Written for developers and users who want to understand the calculations behind the dashboard.

---

## Table of Contents

1. [Basic Portfolio Terms](#basic-portfolio-terms)
2. [Risk Metrics](#risk-metrics)
3. [Market Data Terms](#market-data-terms)
4. [Alert System Terms](#alert-system-terms)
5. [Architecture Terms](#architecture-terms)

---

## Basic Portfolio Terms

### Portfolio
A collection of financial investments (stocks) grouped together. A user can have multiple portfolios with different strategies (e.g., "Tech Growth", "Dividend Income").

### Holding
A specific stock position within a portfolio. For example, "50 shares of AAPL" is one holding.

### Quantity
The number of shares owned for a particular stock.

### Average Buy Price (Avg Cost)
The average price per share at which the stock was purchased.

```
Avg Buy Price = Total Amount Spent / Number of Shares
Example: Bought 50 shares of AAPL at $170 → Avg Buy Price = $170.00
```

### Total Invested (Cost Basis)
The total amount of money spent to acquire a holding.

```
Total Invested = Quantity × Average Buy Price
Example: 50 shares × $170.00 = $8,500.00
```

### Current Price
The stock's real-time market price fetched from Finnhub API. Updated every 30 seconds during market hours (Monday–Friday, 9:30 AM – 4:00 PM ET).

### Current Value (Market Value)
What the holding is worth right now based on the current market price.

```
Current Value = Quantity × Current Price
Example: 50 shares × $252.18 = $12,609.00
```

### Profit/Loss (P/L)
The difference between what the holding is worth now and what was originally invested.

```
P/L = Current Value − Total Invested
P/L = (Quantity × Current Price) − (Quantity × Avg Buy Price)
P/L = Quantity × (Current Price − Avg Buy Price)

Example: 50 × ($252.18 − $170.00) = 50 × $82.18 = +$4,109.00
```

### P/L Percentage
The profit or loss expressed as a percentage of the original investment.

```
P/L % = (P/L / Total Invested) × 100
P/L % = ((Current Price − Avg Buy Price) / Avg Buy Price) × 100

Example: (($252.18 − $170.00) / $170.00) × 100 = +48.3%
```

### Asset Allocation
How the total investment is distributed across different stocks. Expressed as a percentage.

```
Allocation % = (Holding Value / Total Portfolio Value) × 100
Example: AAPL worth $8,500 in a $65,000 portfolio = 13.1% allocation
```

---

## Risk Metrics

### 1. Volatility (σ)

**What it measures:** How much the portfolio's value fluctuates over time. Higher volatility = more unpredictable returns = higher risk.

**Why it matters:** A portfolio with 30% volatility swings much more wildly than one with 5% volatility. Conservative investors prefer low volatility.

**Formula:**

```
Daily Returns:
  r_t = (Price_t − Price_(t-1)) / Price_(t-1)

Daily Volatility:
  σ_daily = Standard Deviation of daily returns

Annualized Volatility:
  σ_annual = σ_daily × √252

Where 252 = number of trading days in a year
```

**Example:**
```
If daily returns over 5 days are: +0.5%, -0.3%, +0.8%, -0.2%, +0.4%
Mean daily return = 0.24%
Daily σ = 0.42%
Annualized σ = 0.42% × √252 = 6.67%
```

**Interpretation:**
| Volatility    | Risk Level  | Typical Assets                    |
|---------------|-------------|-----------------------------------|
| < 10%         | Low         | Government bonds, blue-chip stocks|
| 10% – 20%     | Moderate    | S&P 500 index, diversified funds  |
| 20% – 40%     | High        | Individual tech stocks            |
| > 40%         | Very High   | Crypto, meme stocks, penny stocks |

---

### 2. Sharpe Ratio

**What it measures:** How much extra return you earn for each unit of risk taken. It's the most widely used risk-adjusted return metric.

**Why it matters:** A portfolio returning 20% with 30% volatility is worse risk-adjusted than one returning 10% with 5% volatility. The Sharpe Ratio captures this.

**Formula:**

```
Sharpe Ratio = (R_p − R_f) / σ_p

Where:
  R_p = Portfolio return (annualized)
  R_f = Risk-free rate (typically US Treasury rate ≈ 4-5%)
  σ_p = Portfolio volatility (annualized)
```

**Example:**
```
Portfolio return = 12%
Risk-free rate = 4.5%
Portfolio volatility = 15%

Sharpe Ratio = (12% − 4.5%) / 15% = 0.50
```

**Interpretation:**
| Sharpe Ratio | Quality         | Meaning                              |
|--------------|-----------------|--------------------------------------|
| < 0          | Poor            | Losing money relative to risk-free   |
| 0 – 0.5      | Below Average   | Low return for the risk taken        |
| 0.5 – 1.0    | Average         | Reasonable risk-adjusted return      |
| 1.0 – 2.0    | Good            | Strong risk-adjusted return          |
| > 2.0        | Excellent       | Exceptional (rare for long periods)  |

**Note:** A negative Sharpe Ratio (like -13.83) means the portfolio is losing money compared to just holding risk-free assets like Treasury bonds.

---

### 3. Value at Risk (VaR) — 95% Confidence

**What it measures:** The maximum expected loss over one trading day, with 95% confidence. In other words: "On 95% of trading days, you won't lose more than this amount."

**Why it matters:** VaR gives a concrete dollar amount for potential daily loss. Portfolio managers use it to ensure they can handle worst-case scenarios.

**Formula:**

```
VaR (95%) = Portfolio Value × (μ − 1.645 × σ)

Where:
  Portfolio Value = Total current market value
  μ = Mean daily return
  σ = Daily standard deviation of returns
  1.645 = Z-score for 95% confidence level
```

**Example:**
```
Portfolio Value = $50,000
Mean daily return = 0.05%
Daily volatility = 1.2%

VaR = $50,000 × (0.0005 − 1.645 × 0.012)
VaR = $50,000 × (0.0005 − 0.01974)
VaR = $50,000 × (−0.01924)
VaR = −$962

Interpretation: On 95% of days, you won't lose more than $962.
On the remaining 5% of days, losses could exceed $962.
```

**Confidence Levels:**
| Confidence | Z-Score | Meaning                                    |
|------------|---------|---------------------------------------------|
| 90%        | 1.282   | 1 in 10 days could exceed this loss         |
| 95%        | 1.645   | 1 in 20 days could exceed this loss         |
| 99%        | 2.326   | 1 in 100 days could exceed this loss        |

---

### 4. Portfolio Beta (β)

**What it measures:** How sensitive the portfolio is to overall market movements (measured against S&P 500).

**Why it matters:** If the market drops 10%, a portfolio with β = 1.5 would be expected to drop 15%. Understanding beta helps investors know how their portfolio reacts to market swings.

**Formula:**

```
β = Covariance(Portfolio Returns, Market Returns) / Variance(Market Returns)

Simplified for our platform:
β_portfolio = Σ (w_i × β_i)

Where:
  w_i = Weight of stock i in the portfolio (by value)
  β_i = Individual stock's beta
```

**Example:**
```
Portfolio: 60% AAPL (β=1.2) + 40% JNJ (β=0.6)
Portfolio β = (0.60 × 1.2) + (0.40 × 0.6)
Portfolio β = 0.72 + 0.24 = 0.96
```

**Interpretation:**
| Beta    | Meaning                                            |
|---------|----------------------------------------------------|
| β < 0   | Moves opposite to market (very rare for stocks)    |
| β = 0   | No correlation with market (e.g., cash)            |
| 0 < β < 1 | Less volatile than market (defensive stocks)    |
| β = 1   | Moves exactly with the market                      |
| β > 1   | More volatile than market (growth/tech stocks)     |
| β > 2   | Highly volatile (leveraged positions)              |

---

### 5. Daily Return

**What it measures:** The percentage change in portfolio value from the previous trading day.

**Formula:**

```
Daily Return = (Today's Value − Yesterday's Value) / Yesterday's Value × 100

Example:
Yesterday's value = $50,000
Today's value = $50,250
Daily Return = ($50,250 − $50,000) / $50,000 × 100 = +0.50%
```

---

## Market Data Terms

### Finnhub API
A financial data provider that supplies real-time stock quotes, company fundamentals, and market data. Our platform uses the free tier which provides:
- Real-time US stock prices
- Previous close prices
- Daily change percentages

### Previous Close
The stock's closing price from the previous trading day. Used as the baseline for calculating today's change.

### Change Percent
How much the stock's price has changed compared to the previous close.

```
Change % = ((Current Price − Previous Close) / Previous Close) × 100

Example:
Previous Close = $258.86
Current Price = $252.18
Change % = (($252.18 − $258.86) / $258.86) × 100 = −2.58%
```

### Market Hours
US stock markets (NYSE, NASDAQ) operate Monday–Friday, 9:30 AM – 4:00 PM Eastern Time. Outside these hours, prices don't change (the API returns the last known price).

### Trading Days
There are approximately 252 trading days per year (365 days minus weekends and holidays). This number is used to annualize daily metrics.

---

## Alert System Terms

### Alert Rule
A user-defined condition that triggers a notification when met. Each rule has:
- **Portfolio** — which portfolio to monitor
- **Metric Type** — which risk metric to watch (Volatility, VaR, Sharpe, Beta)
- **Threshold Value** — the trigger point
- **Direction** — ABOVE or BELOW the threshold

### Threshold
The value at which an alert should fire.

```
Example Rule: "Alert me when Tech Growth volatility goes ABOVE 0.05"
Current volatility: 0.028 → No alert
If volatility rises to 0.052 → Alert triggered!
```

### Direction
- **ABOVE** — Alert when the metric exceeds the threshold (e.g., volatility too high)
- **BELOW** — Alert when the metric drops below the threshold (e.g., Sharpe ratio too low)

---

## Architecture Terms

### Microservices
An architectural style where the application is composed of small, independently deployable services. Each service handles a specific business capability:
- **Portfolio Service** — User management, portfolio CRUD
- **Risk Engine** — Price fetching, risk calculations
- **Notification Service** — Alert evaluation, notifications

### Apache Kafka
A distributed streaming platform used for real-time data pipelines. In Finlytics:
- **Producer:** Risk Engine publishes stock prices to Kafka topic `stock-price-updates`
- **Consumer:** Risk Engine and Notification Service consume prices and trigger calculations

### RabbitMQ
A message broker for reliable task-based messaging. In Finlytics:
- Risk Engine publishes alert messages to RabbitMQ when risk thresholds are exceeded
- Notification Service consumes these messages and creates user notifications

### Redis
An in-memory data store used for caching. In Finlytics:
- Caches current stock prices for fast dashboard reads
- Caches risk metrics to avoid recalculating on every page load

### JWT (JSON Web Token)
A compact, URL-safe token used for authentication. After login, the server issues a JWT containing the user's identity. The frontend sends this token with every API request to prove authentication.

### OTP (One-Time Password)
A 6-digit code sent to the user's email during registration. Valid for 5 minutes. Used to verify that the user owns the email address they registered with.

### CORS (Cross-Origin Resource Sharing)
A security mechanism that allows the frontend (localhost:5173) to make API calls to backend services (localhost:8081, 8082, 8083) running on different ports.

### CI/CD (Continuous Integration / Continuous Deployment)
Automated pipeline that builds and tests the code on every push to GitHub. Our GitHub Actions pipeline:
1. Builds all 3 Java services with Maven
2. Builds the React frontend with npm
3. Reports success/failure on every commit

---

## Further Reading

- [Investopedia: Portfolio Volatility](https://www.investopedia.com/terms/v/volatility.asp)
- [Investopedia: Sharpe Ratio](https://www.investopedia.com/terms/s/sharperatio.asp)
- [Investopedia: Value at Risk](https://www.investopedia.com/terms/v/var.asp)
- [Investopedia: Beta](https://www.investopedia.com/terms/b/beta.asp)
- [Apache Kafka Documentation](https://kafka.apache.org/documentation/)
- [RabbitMQ Documentation](https://www.rabbitmq.com/documentation.html)
- [Spring Boot Documentation](https://spring.io/projects/spring-boot)
