# Portfolio Risk Analytics Platform

A real-time portfolio risk analytics platform built with a microservices architecture. Users create investment portfolios, and the system continuously fetches live market data, computes risk metrics, and displays everything on an interactive dashboard with real-time updates.

---

## Features

- **User Authentication** — JWT-based auth with email OTP verification, password strength validation, and email alias normalization
- **Portfolio Management** — Create portfolios, add/remove stock holdings, track buy/sell transactions
- **Real-Time Market Data** — Live stock prices streamed via Kafka from the Finnhub API
- **Risk Analytics** — Automated calculation of Volatility, Sharpe Ratio, Value at Risk (VaR), and Portfolio Beta
- **Role-Based Access** — Clients see their own portfolios; Advisors manage multiple client portfolios
- **Real-Time Dashboard** — WebSocket-powered updates with interactive charts and live metrics
- **Threshold Alerts** — Automated notifications when risk metrics exceed user-defined limits
- **AI-Powered Insights** — Natural language portfolio analysis using LLM integration

---

## Architecture Overview

The platform follows an event-driven microservices architecture with three independently deployable services communicating through Kafka (real-time price streaming) and RabbitMQ (task-based messaging), with Redis as a caching layer for low-latency dashboard reads.

```
[Finnhub API] → [Risk Engine] → [Kafka] → [Risk Calculator] → [Redis + PostgreSQL]
                                                  ↓
                                            [RabbitMQ] → [Notification Service]
                                                  ↓
[React Dashboard] ← WebSocket ← [Portfolio Service] ← [Redis Cache]
```

---

## Tech Stack

| Layer        | Technology                                                  |
|--------------|-------------------------------------------------------------|
| Backend      | Java 21, Spring Boot 3.5, Spring Security, Spring Data JPA |
| Streaming    | Apache Kafka (real-time price feeds)                        |
| Messaging    | RabbitMQ (alerts & task queues)                             |
| Caching      | Redis (current prices & risk metrics)                       |
| Database     | PostgreSQL 15                                               |
| Frontend     | React 18, Vite, Recharts, Tailwind CSS, SockJS/STOMP        |
| Real-Time    | Spring WebSocket + STOMP protocol                           |
| Containers   | Docker + Docker Compose                                     |
| CI/CD        | GitHub Actions                                              |
| API Docs     | Springdoc OpenAPI (Swagger UI)                              |
| Testing      | JUnit 5, Mockito                                            |
| External API | Finnhub (real-time stock data)                              |

---

## Microservices

| Service                  | Port | Responsibility                                                                 |
|--------------------------|------|--------------------------------------------------------------------------------|
| **Portfolio Service**    | 8081 | User auth (JWT+OTP), portfolio CRUD, holdings management, WebSocket broadcaster    |
| **Risk Engine Service**  | 8082 | Price fetching (Finnhub), Kafka streaming, risk calculations, alert evaluation |
| **Notification Service** | 8083 | RabbitMQ consumer, alert processing, notification storage & delivery           |

---

## API Endpoints

### Portfolio Service (Port 8081)

#### Authentication
| Method | Endpoint             | Description              | Auth Required |
|--------|----------------------|--------------------------|---------------|
| POST   | `/api/auth/register` | Register new user(sends OTP)        | No            |
| POST   | `/api/auth/login`    | Login (requires verified email) | No            |
| POST   | `/api/auth/verify`    | Verify email with OTP code | No            |
| POST   | `/api/auth/resend-otp`    | Resend OTP to email | No            |
| GET    | `/api/auth/me`       | Get current user profile | Yes           |

#### Portfolios
| Method | Endpoint               | Description                                    | Auth Required |
|--------|------------------------|------------------------------------------------|---------------|
| GET    | `/api/portfolios`      | Get all portfolios for current user            | Yes           |
| GET    | `/api/portfolios/{id}` | Get portfolio with holdings and current values | Yes           |
| POST   | `/api/portfolios`      | Create new portfolio                           | Yes           |
| PUT    | `/api/portfolios/{id}` | Update portfolio name/description              | Yes           |
| DELETE | `/api/portfolios/{id}` | Delete portfolio and all holdings              | Yes           |

#### Holdings
| Method | Endpoint                               | Description           | Auth Required |
|--------|----------------------------------------|-----------------------|---------------|
| GET    | `/api/portfolios/{id}/holdings`        | Get all holdings      | Yes           |          
| POST   | `/api/portfolios/{id}/holdings`        | Add a stock holding   | Yes           |
| PUT    | `/api/portfolios/holdings/{holdingId}` | Update holding        | Yes           |
| DELETE | `/api/portfolios/holdings/{holdingId}` | Delete holding        | Yes           |

#### Transactions
| Method | Endpoint                            | Description              | Auth Required |
|--------|-------------------------------------|--------------------------|---------------|
| GET    | `/api/portfolios/{id}/transactions` | Get transaction history  | Yes           |

### Risk Engine Service (Port 8082)
| Method | Endpoint                                    | Description                       |
|--------|---------------------------------------------|-----------------------------------|
| GET    | `/api/risk/calculate/{portfolioId}`         | Manually trigger risk calculation |          
| GET    | `/api/risk/portfolio/{portfolioId}`         | Get latest risk metrics           | 
| GET    | `/api/risk/portfolio/{portfolioId}/history` | Get historical risk snapshots     | 
| GET    | `/api/risk/health`                          | Service health check              | 

### Notification Service (Port 8083)

#### Notifications
| Method | Endpoint                                    | Description                       |
|--------|---------------------------------------------|-----------------------------------|
| GET    | `/api/notifications/{userId}`               | Get all notifications for user    |          
| GET    | `/api/notifications/{userId}/unread/count`  | Get unread notification count     | 
| PUT    | `/api/notifications/{notificationId}/read`  | Mark notification as read         | 
| PUT    | `/api/notifications/{userId}/read-all`      | Mark all notifications as read    | 
| DELETE | `/api/notifications/{notificationId}`       | Delete a notification             | 

#### Alert Rules
| Method | Endpoint                     | Description                       |
|--------|------------------------------|-----------------------------------|
| GET    | `/api/alert/rules/{userId}`  | Get user's alert rules            |          
| POST   | `/api/alerts/rules`          | Create new alert rule             | 
| PUT    | `/api/alerts/rules/{ruleId}` | Update alert rule                 | 
| DELETE | `/api/alerts/rules/{ruleId}` | Delete alert rule                 | 

---

## Security Features
- **JWT Authentication** — Stateless token-based auth with configurable expiration
- **Email OTP Verification** — 6-digit code sent via Gmail SMTP during registration
- **Password Policy** — Minimum 10 characters with uppercase, lowercase, number, and special character
- **Email Alias Normalization** — Prevents duplicate accounts via Gmail dot tricks and + aliases
- **OTP Rate Limiting** — Maximum 5 OTP requests per 15 minutes per email
- **OTP Attempt Limiting** — Maximum 3 incorrect attempts per OTP code
- **Environment Variables** — All secrets stored in .env (gitignored), never hardcoded

---

## Risk Metrics
The Risk Engine calculates these financial metrics in real-time:

 | Metric              | Description                                   | Formula                                              |
 |---------------------|-----------------------------------------------|------------------------------------------------------| 
 | Volatility          | How much portfolio returns fluctuate          | Std Dev of daily returns × √252                      | 
 | Sharpe Ratio        | Risk-adjusted return measure                  | (Return - Risk-Free Rate) / Volatility               | 
 | Value at Risk (VaR) | Maximum expected daily loss at 95% confidence | Portfolio Value × (Mean Return - 1.645 × Volatility) | 
 | Portfolio Beta      | Sensitivity to market movements               |  Weighted average of stock volatilities              |

---

## Data Flow

1. Scheduled Price Fetcher calls Finnhub API every 30 seconds
2. Real stock prices (AAPL, GOOGL, etc.) are received
3. Prices are saved to PostgreSQL and cached in Redis
4. Price updates are published to Kafka topic: stock-price-updates
5. Kafka Consumer receives price updates
6. Risk Calculator recalculates metrics for affected portfolios
7. Risk snapshots are saved to PostgreSQL and cached in Redis
8. Frontend receives updates via WebSocket 

---

## Project Status

🚧 **Under Active Development**

 - Project setup & Docker Compose (PostgreSQL, Redis, Kafka, Zookeeper)
- Portfolio Service — JWT Authentication (Register, Login, Me)
 - Portfolio Service — Portfolio, Holdings & Transaction CRUD APIs
 - Risk Engine — Finnhub API integration (real-time stock prices)
 - Risk Engine — Apache Kafka producer/consumer (price streaming)
 - Risk Engine — Risk calculation engine (Volatility, Sharpe, VaR, Beta)
 - Risk Engine — Redis caching & PostgreSQL storage
 - Notification Service — RabbitMQ alert pipeline
 - React Frontend — Auth pages (Login, Register, Email Verification)
 - React Frontend — Dashboard, charts, real-time updates
 - AI-Powered Portfolio Insight Assistant
 - Integration testing & end-to-end flow
 - Documentation, & CI/CD pipeline

---

## Project Structure

```
Portfolio-Risk-Analysis-Platform/
├── docker-compose.yml                      # PostgreSQL, Redis, Kafka, Zookeeper, RabbitMQ
├── .env.example                            # Environment variable template
├── README.md
│
├── portfolio-service/                      # Microservice 1 (Port 8081)
│   ├── pom.xml
│   └── src/main/java/com/portfolio/service/
│       ├── config/                         # SecurityConfig
│       ├── controller/                     # AuthController, PortfolioController, HoldingsController
│       ├── dto/                            # RegisterRequest, LoginRequest, OtpRequest, OtpVerifyRequest
│       ├── model/                          # User, Portfolio, Holding, Transaction, OtpVerification
│       ├── repository/                     # JPA repositories
│       ├── security/                       # JwtTokenProvider, JwtAuthFilter
│       └── service/                        # AuthService, OtpService, EmailService
│
├── risk-engine-service/                    # Microservice 2 (Port 8082)
│   ├── pom.xml
│   └── src/main/java/com/portfolio/risk/
│       ├── client/                         # Finnhub API client
│       ├── controller/                     # Risk data endpoints
│       ├── dto/                            # Kafka message objects
│       ├── kafka/                          # Producer & Consumer
│       ├── model/                          # StockPrice, RiskSnapshot
│       ├── repository/                     # Data access layer
│       └── service/                        # Price fetcher & Risk calculator
│
├── notification-service/                   # Microservice 3 (Port 8083)
│   ├── pom.xml
│   └── src/main/java/com/portfolio/notification/
│       ├── config/                         # RabbitMQ configuration
│       ├── controller/                     # Notification & Alert Rule endpoints
│       ├── dto/                            # Alert messages & request objects
│       ├── kafka/                          # Kafka consumer for price updates
│       ├── model/                          # Notification, AlertRule
│       ├── rabbitmq/                       # RabbitMQ alert consumer
│       ├── repository/                     # Data access layer
│       └── service/                        # Alert evaluator & notification logic
│
├── frontend/                               # React Application
│   ├── package.json
│   ├── tailwind.config.js
│   └── src/
│       ├── context/                        # AuthContext (JWT state management)
│       ├── services/                       # api.js, authService.js, portfolioService.js
│       ├── components/
│       │   ├── common/                     # Navbar, ProtectedRoute
│       │   ├── dashboard/                  # (coming soon)
│       │   ├── portfolio/                  # (coming soon)
│       │   └── notifications/              # (coming soon)
│       ├── pages/                          # LoginPage, RegisterPage, VerifyEmailPage

```                        

---

## Getting Started

> Full setup instructions will be added as development progresses.

### Prerequisites

- Java 21 LTS
- Node.js 18+ and npm
- Docker Desktop (6GB+ RAM allocated)
- Finnhub API key (free at [finnhub.io](https://finnhub.io))

### Environment Setup
# 1. Clone the repository
git clone https://github.com/Shrutkeerti200/Portfolio-Risk-Analysis-Platform.git
cd Portfolio-Risk-Analysis-Platform

# 2. Create environment file
cp .env.example .env
# Edit .env with your credentials

# 3. Start infrastructure (PostgreSQL, Redis, Kafka, Zookeeper, RabbitMQ)
docker compose up -d

### Running Backend Services

# Load environment variables (PowerShell)
Get-Content .\.env | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]*?)\s*=\s*(.*)\s*$') {
        [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
    }
}

# Start Portfolio Service (port 8081)
cd portfolio-service
./mvnw spring-boot:run

# Start Risk Engine Service (port 8082) — in a new terminal
cd risk-engine-service
./mvnw spring-boot:run

# Start Notification Service (port 8083) — in a new terminal
cd notification-service
./mvnw spring-boot:run

### Running Frontend
- cd frontend
-npm install
-npm run dev
# Opens at http://localhost:5173

### Stopping the Application

- docker compose down          # Stop all containers
- docker compose down -v       # Stop and remove all data volumes

---

