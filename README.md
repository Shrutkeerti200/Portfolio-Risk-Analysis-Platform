# Portfolio Risk Analytics Platform

A real-time portfolio risk analytics platform built with a microservices architecture. Users create investment portfolios, and the system continuously fetches live market data, computes risk metrics, and displays everything on an interactive dashboard with real-time updates.

---

## Features

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
| Backend      | Java 21, Spring Boot 3.2+, Spring Security, Spring Data JPA |
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
| **Portfolio Service**    | 8081 | User auth (JWT), portfolio CRUD, holdings management, WebSocket broadcaster    |
| **Risk Engine Service**  | 8082 | Price fetching (Finnhub), Kafka streaming, risk calculations, alert evaluation |
| **Notification Service** | 8083 | RabbitMQ consumer, alert processing, notification storage & delivery           |

---

## API Endpoints

### Portfolio Service (Port 8081)

#### Authentication
| Method | Endpoint             | Description              | Auth Required |
|--------|----------------------|--------------------------|---------------|
| POST   | `/api/auth/register` | Register new user        | No            |
| POST   | `/api/auth/login`    | Login, returns JWT token | No            |
| GET    | `/api/auth/me`       | Get current user profile | Yes           |

#### Portfolios
| Method | Endpoint               | Description                                    | Auth Required |
|--------|------------------------|------------------------------------------------|---------------|
| GET    | `/api/portfolios`      | Get all portfolios for current user            | Yes           |
| GET    | `/api/portfolios/{id}` | Get portfolio with holdings and current values | Yes           |
| POST   | `/api/portfolios`      | Create new portfolio                           | Yes           |
| PUT    | `/api/portfolios/{id}` | Update portfolio name/description              | Yes           |
| DELETE | `/api/portfolios/{id}` | Delete portfolio and all holdings              | Yes           |

---

## Project Status

🚧 **Under Active Development**

- [ ] Project setup & Docker Compose configuration
- [ ] Portfolio Service — Auth, Portfolio & Holdings APIs
- [ ] Risk Engine — Kafka integration & Finnhub price fetcher
- [ ] Risk Engine — Risk calculation engine (Volatility, Sharpe, VaR, Beta)
- [ ] RabbitMQ — Alert notifications pipeline
- [ ] Notification Service — Alert processing & REST API
- [ ] React Frontend — Dashboard, charts, real-time updates
- [ ] Integration testing & end-to-end flow
- [ ] Documentation, demo video & CI/CD pipeline

---

## Project Structure

```
Portfolio-Risk-Analysis-Platform/
├── docker-compose.yml
├── README.md
├── .gitignore
├── portfolio-service/                 # Microservice 1 (Java/Spring Boot)
│   ├── src/main/java/com/portfolio/service/
│   │   ├── config/                    # Security configuration
│   │   ├── controller/                # REST API controllers
│   │   ├── dto/                       # Request/Response objects
│   │   ├── model/                     # JPA entities
│   │   ├── repository/                # Data access layer
│   │   ├── security/                  # JWT token & auth filter
│   │   └── service/                   # Business logic
│   └── src/main/resources/
│       └── application.yml            # App configuration
├── risk-engine-service/               # Microservice 2 (Coming Soon)
├── notification-service/              # Microservice 3 (Coming Soon)
└── frontend/  
```                        

---

## Getting Started

> Full setup instructions will be added as development progresses.

### Prerequisites

- Java 21 LTS
- Node.js 18+ and npm
- Docker Desktop (6GB+ RAM allocated)
- Finnhub API key (free at [finnhub.io](https://finnhub.io))

### Running Locally

# 1. Clone the repository
git clone https://github.com/Shrutkeerti200/Portfolio-Risk-Analysis-Platform.git
cd Portfolio-Risk-Analysis-Platform

# 2. Start infrastructure (PostgreSQL & Redis)
docker compose up -d

# 3. Run Portfolio Service
cd portfolio-service
./mvnw clean spring-boot:run

# 4. Test the API
# Register: POST http://localhost:8081/api/auth/register
# Login:    POST http://localhost:8081/api/auth/login
# Profile:  GET  http://localhost:8081/api/auth/me (requires Bearer token)

### Stopping the Application

docker compose down          # Stop all containers
docker compose down -v       # Stop and remove all data volumes

---

