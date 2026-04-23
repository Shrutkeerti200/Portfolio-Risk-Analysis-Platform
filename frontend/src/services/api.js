import axios from 'axios';
import appConfig from '../config';

const api = axios.create({
    baseURL: appConfig.PORTFOLIO_API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Automatically attach JWT token to every request
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Handle 401 responses
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            const isAuthRoute = window.location.pathname.startsWith('/login') ||
                window.location.pathname.startsWith('/register') ||
                window.location.pathname.startsWith('/verify-email');
            if (!isAuthRoute) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;