import api from './api';

const aiService = {
  async askAboutPortfolio(question, portfolioContext) {
    const response = await api.post('/ai/chat', {
      question,
      portfolioContext,
    });
    return response.data;
  },
};

export default aiService;