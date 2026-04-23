import { useState, useRef, useEffect } from 'react';
import config from '../../config';

export default function AiAssistant({ portfolioContext }) {
    const [isOpen, setIsOpen] = useState(false);
    const [showTooltip, setShowTooltip] = useState(true);
    const [chatMessages, setChatMessages] = useState([
        {
            role: 'assistant',
            content: "Hi! I'm your AI Portfolio Analyst. Ask me anything about your portfolio — allocation, risk, performance, or any insights you'd like.",
        },
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    // Auto-hide tooltip after 8 seconds
    useEffect(() => {
        const timer = setTimeout(() => setShowTooltip(false), 8000);
        return () => clearTimeout(timer);
    }, []);

    const suggestedQuestions = [
        "How diversified is my portfolio?",
        "What are the risks in my portfolio?",
        "How should I rebalance my portfolio?",
        "Explain my Sharpe Ratio and VaR",
        "Which holdings are dragging performance?",
        "Am I too concentrated in any sector?",
    ];

    const handleSend = async (question) => {
        const q = question || input.trim();
        if (!q) return;

        setChatMessages((prev) => [...prev, { role: 'user', content: q }]);
        setInput('');
        setLoading(true);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${config.PORTFOLIO_API_URL}/ai/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + token,
                },
                body: JSON.stringify({
                    question: q,
                    portfolioContext: portfolioContext,
                }),
            });

            const data = await response.json();
            setChatMessages((prev) => [
                ...prev,
                { role: 'assistant', content: data.response || 'Sorry, I could not generate a response.' },
            ]);
        } catch (err) {
            setChatMessages((prev) => [
                ...prev,
                { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' },
            ]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleOpen = () => {
        setIsOpen(!isOpen);
        setShowTooltip(false);
    };

    return (
        <>
            {/* Tooltip bubble */}
            {showTooltip && !isOpen && (
                <div className="fixed bottom-24 right-4 z-50">
                    <div className="bg-gray-800 border border-blue-500/30 rounded-2xl p-6 shadow-2xl w-80 relative">
                        <button
                            onClick={() => setShowTooltip(false)}
                            className="absolute top-3 right-3 text-gray-500 hover:text-gray-300"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-white text-base font-semibold">AI Portfolio Analyst</p>
                                <p className="text-gray-300 text-sm mt-2 leading-relaxed">
                                    Hi! I can analyze your portfolio, explain risk metrics, and suggest improvements.
                                </p>
                                <button
                                    onClick={handleOpen}
                                    className="mt-3 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition"
                                >
                                    Start Chatting →
                                </button>
                            </div>
                        </div>
                        <div className="absolute -bottom-2 right-8 w-4 h-4 bg-gray-800 border-r border-b border-blue-500/30 transform rotate-45"></div>
                    </div>
                </div>
            )}

            {/* Floating Button with pulse animation */}
            <button
                onClick={handleOpen}
                className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all z-50 group"
            >
                {!isOpen && showTooltip && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full animate-ping"></span>
                )}
                {!isOpen && showTooltip && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full"></span>
                )}
                {isOpen ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                )}
            </button>

            {/* Chat Window */}
            {isOpen && (
                <div className="fixed bottom-24 right-6 w-[90vw] max-w-96 h-[70vh] max-h-[500px] bg-gray-800 border border-gray-700 rounded-xl shadow-2xl flex flex-col z-50">
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-gray-700 flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <p className="text-white font-semibold text-sm">AI Portfolio Analyst</p>
                            <p className="text-green-400 text-xs">Powered by AI</p>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {chatMessages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div
                                    className={`max-w-[85%] px-3 py-2 rounded-lg text-sm whitespace-pre-wrap ${msg.role === 'user'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-700 text-gray-200'
                                        }`}
                                >
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex justify-start">
                                <div className="bg-gray-700 px-3 py-2 rounded-lg text-sm text-gray-400">
                                    <div className="flex items-center gap-1">
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Suggested Questions */}
                    {chatMessages.length <= 1 && (
                        <div className="px-4 pb-2">
                            <p className="text-gray-500 text-xs mb-2">Try asking:</p>
                            <div className="flex flex-wrap gap-1">
                                {suggestedQuestions.map((q, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleSend(q)}
                                        className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-1 rounded-md transition"
                                    >
                                        {q}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Input */}
                    <div className="p-3 border-t border-gray-700">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Ask about your portfolio..."
                                disabled={loading}
                                className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                            />
                            <button
                                onClick={() => handleSend()}
                                disabled={loading || !input.trim()}
                                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}