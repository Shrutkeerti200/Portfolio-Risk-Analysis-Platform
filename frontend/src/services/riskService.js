const RISK_API_URL = 'http://localhost:8082/api/risk';

const riskService = {
    async getPortfolioRisk(portfolioId) {
        try {
            const response = await fetch(`${RISK_API_URL}/portfolio/${portfolioId}`);
            if (!response.ok) {
                console.warn(`Risk API returned ${response.status} for portfolio ${portfolioId}`);
                return null;
            }
            return await response.json();
        } catch (err) {
            console.error(`Risk API error for portfolio ${portfolioId}:`, err);
            return null;
        }
    },

    async getPortfolioRiskHistory(portfolioId) {
        try {
            const response = await fetch(`${RISK_API_URL}/portfolio/${portfolioId}/history`);
            if (!response.ok) return [];
            return await response.json();
        } catch {
            return [];
        }
    },

    async getRiskForAllPortfolios(portfolioIds) {
        const results = {};
        for (const id of portfolioIds) {
            results[id] = await this.getPortfolioRisk(id);
        }
        console.log('Risk data loaded:', results);
        return results;
    },

    async getStockPrices(symbols) {
        try {
            const query = symbols.map(s => `symbols=${s}`).join('&');
            const response = await fetch(`${RISK_API_URL}/prices?${query}`);
            if (!response.ok) return {};
            return await response.json();
        } catch {
            return {};
        }
    },

    async getStockPrice(symbol) {
        try {
            const response = await fetch(`${RISK_API_URL}/prices/${symbol}`);
            if (!response.ok) return null;
            return await response.json();
        } catch {
            return null;
        }
    }
};

export default riskService;