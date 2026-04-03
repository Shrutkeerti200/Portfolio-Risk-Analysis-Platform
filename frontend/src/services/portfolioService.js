import api from './api';

const portfolioService = {
    async getPortfolios() {
        const response = await api.get('/portfolios');
        return response.data;
    },

    async getPortfolioById(id) {
        const response = await api.get(`/portfolios/${id}`);
        return response.data;
    },

    async createPortfolio(portfolioData) {
        const response = await api.post('/portfolios', portfolioData);
        return response.data;
    },

    async updatePortfolio(id, portfolioData) {
        const response = await api.put(`/portfolios/${id}`, portfolioData);
        return response.data;
    },

    async deletePortfolio(id) {
        const response = await api.delete(`/portfolios/${id}`);
        return response.data;
    },

    // Holdings
    async getHoldings(portfolioId) {
        const response = await api.get(`/portfolios/${portfolioId}/holdings`);
        return response.data;
    },

    async addHolding(portfolioId, holdingData) {
        const response = await api.post(`/portfolios/${portfolioId}/holdings`, holdingData);
        return response.data;
    },

    async removeHolding(portfolioId, holdingId) {
        const response = await api.delete(`/portfolios/${portfolioId}/holdings/${holdingId}`);
        return response.data;
    },

    // Transactions
    async getTransactions(portfolioId) {
        const response = await api.get(`/portfolios/${portfolioId}/transactions`);
        return response.data;
    }
};

export default portfolioService;