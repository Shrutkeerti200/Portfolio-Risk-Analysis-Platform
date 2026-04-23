// Centralized API configuration
// In development: uses localhost
// In production: uses environment variables set in Netlify

const config = {
    PORTFOLIO_API_URL: import.meta.env.VITE_PORTFOLIO_API_URL || 'http://localhost:8081/api',
    RISK_API_URL: import.meta.env.VITE_RISK_API_URL || 'http://localhost:8082/api',
    NOTIFICATION_API_URL: import.meta.env.VITE_NOTIFICATION_API_URL || 'http://localhost:8083/api',
};

export default config;