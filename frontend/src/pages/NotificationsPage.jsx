import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import notificationService from '../services/notificationService';
import portfolioService from '../services/portfolioService';
import riskService from '../services/riskService';
import { BellIcon, TrashIcon, CheckIcon, ChevronDownIcon, ChevronUpIcon, BoltIcon } from '@heroicons/react/24/outline';
import config from '../config';

export default function NotificationsPage() {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState({});

    // AI Summary state
    const [aiSummaries, setAiSummaries] = useState({});       // { notificationId: "summary text" }
    const [aiSummaryLoading, setAiSummaryLoading] = useState({}); // { notificationId: true/false }
    const [portfolioContext, setPortfolioContext] = useState('');

    useEffect(() => {
        if (user?.id) {
            fetchNotifications();
            buildPortfolioContext();
            const interval = setInterval(fetchNotifications, 30000);
            return () => clearInterval(interval);
        }
    }, [user]);

    const buildPortfolioContext = async () => {
        try {
            const portfolios = await portfolioService.getAllPortfolios();
            const allHoldings = portfolios.flatMap(p =>
                (p.holdings || []).map(h => ({ ...h, portfolioName: p.name, portfolioId: p.id }))
            );

            const ids = portfolios.map(p => p.id);
            const riskData = await riskService.getRiskForAllPortfolios(ids);

            const symbols = [...new Set(allHoldings.map(h => h.stockSymbol))];
            let prices = {};
            if (symbols.length > 0) {
                prices = await riskService.getStockPrices(symbols);
            }

            const totalInvested = allHoldings.reduce((sum, h) => sum + (h.quantity * h.avgBuyPrice), 0);
            const totalCurrentValue = Object.values(riskData).reduce((sum, r) => sum + (r?.totalValue || 0), 0);
            const totalPL = totalCurrentValue > 0 ? totalCurrentValue - totalInvested : 0;
            const totalPLPercent = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;

            const avgVolatility = Object.values(riskData).filter(r => r).reduce((sum, r, _, arr) => sum + (r.volatility || 0) / arr.length, 0);
            const avgSharpe = Object.values(riskData).filter(r => r).reduce((sum, r, _, arr) => sum + (r.sharpeRatio || 0) / arr.length, 0);
            const totalVaR = Object.values(riskData).filter(r => r).reduce((sum, r) => sum + (r.valueAtRisk || 0), 0);
            const avgBeta = Object.values(riskData).filter(r => r).reduce((sum, r, _, arr) => sum + (r.portfolioBeta || 0) / arr.length, 0);

            let context = `Total Portfolios: ${portfolios.length}\n`;
            context += `Total Invested: $${totalInvested.toFixed(2)}\n`;
            context += `Total Current Value: $${(totalCurrentValue || totalInvested).toFixed(2)}\n`;
            context += `Total P/L: $${totalPL.toFixed(2)} (${totalPLPercent.toFixed(1)}%)\n`;
            context += `Avg Volatility: ${(avgVolatility * 100).toFixed(2)}%\n`;
            context += `Avg Sharpe Ratio: ${avgSharpe.toFixed(2)}\n`;
            context += `Total VaR (95%): $${totalVaR.toFixed(2)}\n`;
            context += `Avg Beta: ${avgBeta.toFixed(2)}\n\nHoldings:\n`;

            allHoldings.forEach(h => {
                const currentPrice = prices[h.stockSymbol]?.price || h.avgBuyPrice;
                const invested = h.quantity * h.avgBuyPrice;
                const pl = (h.quantity * currentPrice) - invested;
                const plPercent = invested > 0 ? (pl / invested) * 100 : 0;
                context += `- ${h.stockSymbol}: ${h.quantity} shares, cost $${h.avgBuyPrice}, now $${currentPrice.toFixed(2)}, P/L $${pl.toFixed(2)} (${plPercent.toFixed(1)}%)\n`;
            });

            setPortfolioContext(context);
        } catch (err) {
            console.error('Failed to build portfolio context for AI summaries:', err);
        }
    };

    const fetchNotifications = async () => {
        try {
            const data = await notificationService.getNotifications(user.id);
            setNotifications(Array.isArray(data) ? data : []);
        } catch { }
        setLoading(false);
    };

    const handleAiSummary = async (notification) => {
        const id = notification.id;

        // Toggle off if already shown
        if (aiSummaries[id]) {
            setAiSummaries(prev => {
                const copy = { ...prev };
                delete copy[id];
                return copy;
            });
            return;
        }

        setAiSummaryLoading(prev => ({ ...prev, [id]: true }));

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${config.PORTFOLIO_API_URL}/ai/summarize-alert`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + token,
                },
                body: JSON.stringify({
                    title: notification.title || '',
                    message: notification.message || '',
                    portfolioContext: portfolioContext,
                }),
            });

            const data = await response.json();
            setAiSummaries(prev => ({
                ...prev,
                [id]: data.response || 'Could not generate summary.',
            }));
        } catch {
            setAiSummaries(prev => ({
                ...prev,
                [id]: 'Failed to generate AI summary. Please try again.',
            }));
        } finally {
            setAiSummaryLoading(prev => ({ ...prev, [id]: false }));
        }
    };

    const handleMarkAsRead = async (id) => {
        await notificationService.markAsRead(id);
        setNotifications(notifications.map(n =>
            n.id === id ? { ...n, read: true } : n
        ));
    };

    const handleMarkAllRead = async () => {
        await notificationService.markAllAsRead(user.id);
        setNotifications(notifications.map(n => ({ ...n, read: true })));
    };

    const handleDelete = async (id) => {
        await notificationService.deleteNotification(id);
        setNotifications(notifications.filter(n => n.id !== id));
        // Clean up AI summary if exists
        setAiSummaries(prev => {
            const copy = { ...prev };
            delete copy[id];
            return copy;
        });
    };

    const handleDeleteAll = async () => {
        if (!window.confirm(`Delete all ${notifications.length} notifications? This cannot be undone.`)) return;
        setDeleting(true);
        try {
            for (const n of notifications) {
                await notificationService.deleteNotification(n.id);
            }
            setNotifications([]);
            setAiSummaries({});
        } catch {
            fetchNotifications();
        } finally {
            setDeleting(false);
        }
    };

    const toggleGroup = (groupKey) => {
        setExpandedGroups(prev => ({
            ...prev,
            [groupKey]: !prev[groupKey]
        }));
    };

    const getTypeColor = (type) => {
        switch (type?.toLowerCase()) {
            case 'volatility_alert': return 'border-yellow-500 bg-yellow-500/10';
            case 'var_alert': return 'border-red-500 bg-red-500/10';
            case 'price_drop': return 'border-red-500 bg-red-500/10';
            case 'price_surge': return 'border-green-500 bg-green-500/10';
            case 'beta_alert': return 'border-purple-500 bg-purple-500/10';
            default: return 'border-blue-500 bg-blue-500/10';
        }
    };

    const getTypeLabel = (type) => {
        switch (type?.toLowerCase()) {
            case 'volatility_alert': return 'Volatility';
            case 'var_alert': return 'Value at Risk';
            case 'price_drop': return 'Price Drop';
            case 'price_surge': return 'Price Surge';
            case 'beta_alert': return 'Beta Alert';
            default: return 'Alert';
        }
    };

    const groupNotifications = (notifications) => {
        const groups = [];
        const groupMap = {};

        for (const n of notifications) {
            const key = `${n.title}__${n.type}`;
            if (!groupMap[key]) {
                groupMap[key] = {
                    key,
                    latest: n,
                    all: [n],
                    unreadCount: n.read ? 0 : 1,
                };
                groups.push(groupMap[key]);
            } else {
                groupMap[key].all.push(n);
                if (!n.read) groupMap[key].unreadCount++;
            }
        }

        return groups;
    };

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    const unreadCount = notifications.filter(n => !n.read).length;
    const grouped = groupNotifications(notifications);

    return (
        <div>
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white">Notifications & Alerts</h1>
                    {unreadCount > 0 && (
                        <p className="text-gray-400 text-sm mt-1">{unreadCount} unread notification{unreadCount > 1 ? 's' : ''}</p>
                    )}
                </div>
                {notifications.length > 0 && (
                    <div className="flex items-center gap-2">
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllRead}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition text-sm"
                            >
                                <CheckIcon className="h-4 w-4" />
                                Mark all as read
                            </button>
                        )}
                        <button
                            onClick={handleDeleteAll}
                            disabled={deleting}
                            className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg transition text-sm disabled:opacity-50"
                        >
                            <TrashIcon className="h-4 w-4" />
                            {deleting ? 'Deleting...' : 'Delete all'}
                        </button>
                    </div>
                )}
            </div>

            {notifications.length === 0 ? (
                <div className="text-center py-20 bg-gray-800 rounded-xl border border-gray-700">
                    <BellIcon className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-white mb-2">No Notifications Yet</h2>
                    <p className="text-gray-400 mb-2">Alerts will appear here when:</p>
                    <div className="text-gray-400 text-sm space-y-1">
                        <p>Portfolio volatility exceeds your threshold</p>
                        <p>Value at Risk (VaR) reaches critical levels</p>
                        <p>A stock drops more than 5% in a day</p>
                        <p>Risk metrics change significantly</p>
                    </div>
                    <p className="text-gray-500 text-sm mt-6">
                        All three services (Portfolio, Risk Engine, Notification) must be running for alerts to generate.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {grouped.map((group) => {
                        const isExpanded = expandedGroups[group.key];
                        const hasMultiple = group.all.length > 1;
                        const latestId = group.latest.id;
                        const hasSummary = !!aiSummaries[latestId];
                        const isSummaryLoading = !!aiSummaryLoading[latestId];

                        return (
                            <div key={group.key}>
                                {/* Main notification (latest in group) */}
                                <div
                                    className={`bg-gray-800 rounded-xl border-l-4 p-4 ${getTypeColor(group.latest.type)
                                        } ${group.latest.read && group.unreadCount === 0 ? 'opacity-60' : ''}`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`text-xs px-2 py-0.5 rounded font-medium ${getTypeColor(group.latest.type)}`}>
                                                    {getTypeLabel(group.latest.type)}
                                                </span>
                                                {group.unreadCount > 0 && (
                                                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                                )}
                                                <span className="text-gray-500 text-xs">
                                                    {new Date(group.latest.createdAt + 'Z').toLocaleString()}
                                                </span>
                                                {hasMultiple && (
                                                    <button
                                                        onClick={() => toggleGroup(group.key)}
                                                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200 bg-gray-700 px-2 py-0.5 rounded-full transition"
                                                    >
                                                        {group.all.length - 1} more
                                                        {isExpanded
                                                            ? <ChevronUpIcon className="h-3 w-3" />
                                                            : <ChevronDownIcon className="h-3 w-3" />
                                                        }
                                                    </button>
                                                )}
                                            </div>
                                            <p className="text-white text-sm">{group.latest.title}</p>
                                            <p className="text-gray-400 text-xs mt-1">{group.latest.message}</p>
                                        </div>
                                        <div className="flex items-center gap-2 ml-4">
                                            {/* AI Summary Button */}
                                            <button
                                                onClick={() => handleAiSummary(group.latest)}
                                                disabled={isSummaryLoading}
                                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition text-xs font-medium disabled:opacity-50 ${hasSummary
                                                        ? 'bg-purple-600/30 text-purple-300 hover:bg-purple-600/10'
                                                        : 'bg-purple-600/20 text-purple-400 hover:bg-purple-600/40'
                                                    }`}
                                                title={hasSummary ? 'Hide AI summary' : 'Get AI summary'}
                                            >
                                                <BoltIcon className="h-3.5 w-3.5" />
                                                {isSummaryLoading ? 'Analyzing...' : hasSummary ? 'Hide AI' : 'AI Explain'}
                                            </button>
                                            {!group.latest.read && (
                                                <button
                                                    onClick={() => handleMarkAsRead(group.latest.id)}
                                                    className="text-gray-500 hover:text-blue-400 transition"
                                                    title="Mark as read"
                                                >
                                                    <CheckIcon className="h-4 w-4" />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleDelete(group.latest.id)}
                                                className="text-gray-500 hover:text-red-400 transition"
                                                title="Delete"
                                            >
                                                <TrashIcon className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* AI Summary Panel */}
                                    {(hasSummary || isSummaryLoading) && (
                                        <div className="mt-3 bg-purple-500/5 border border-purple-500/20 rounded-lg p-3">
                                            <div className="flex items-center gap-2 mb-2">
                                                <BoltIcon className="h-3.5 w-3.5 text-purple-400" />
                                                <span className="text-purple-400 text-xs font-medium">AI Summary</span>
                                            </div>
                                            {isSummaryLoading ? (
                                                <div className="flex items-center gap-2 py-1">
                                                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-t-2 border-b-2 border-purple-500"></div>
                                                    <span className="text-gray-400 text-xs">Analyzing this alert...</span>
                                                </div>
                                            ) : (
                                                <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                                                    {aiSummaries[latestId]}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Expanded older notifications in this group */}
                                {isExpanded && hasMultiple && (
                                    <div className="ml-4 mt-1 space-y-1.5">
                                        {group.all.slice(1, 11).map((n) => (
                                            <div
                                                key={n.id}
                                                className={`bg-gray-800/60 rounded-lg border-l-2 p-3 flex items-center justify-between ${getTypeColor(n.type)} ${n.read ? 'opacity-50' : ''}`}
                                            >
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        {!n.read && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>}
                                                        <span className="text-gray-500 text-xs">
                                                            {new Date(n.createdAt + 'Z').toLocaleString()}
                                                        </span>
                                                    </div>
                                                    <p className="text-gray-400 text-xs mt-0.5">{n.message}</p>
                                                </div>
                                                <div className="flex items-center gap-2 ml-4">
                                                    {/* AI Summary for individual older alerts */}
                                                    <button
                                                        onClick={() => handleAiSummary(n)}
                                                        disabled={!!aiSummaryLoading[n.id]}
                                                        className={`flex items-center gap-1 px-2 py-1 rounded-md transition text-xs disabled:opacity-50 ${aiSummaries[n.id]
                                                                ? 'bg-purple-600/30 text-purple-300 hover:bg-purple-600/10'
                                                                : 'bg-purple-600/20 text-purple-400 hover:bg-purple-600/40'
                                                            }`}
                                                        title={aiSummaries[n.id] ? 'Hide AI summary' : 'Get AI summary'}
                                                    >
                                                        <BoltIcon className="h-3 w-3" />
                                                        {aiSummaryLoading[n.id] ? '...' : aiSummaries[n.id] ? 'Hide' : 'AI'}
                                                    </button>
                                                    {!n.read && (
                                                        <button
                                                            onClick={() => handleMarkAsRead(n.id)}
                                                            className="text-gray-500 hover:text-blue-400 transition"
                                                        >
                                                            <CheckIcon className="h-3.5 w-3.5" />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleDelete(n.id)}
                                                        className="text-gray-500 hover:text-red-400 transition"
                                                    >
                                                        <TrashIcon className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                        {/* Show AI summary for expanded items */}
                                        {group.all.slice(1, 11).map((n) => (
                                            (aiSummaries[n.id] || aiSummaryLoading[n.id]) && (
                                                <div key={`ai-${n.id}`} className="ml-2 bg-purple-500/5 border border-purple-500/20 rounded-lg p-3">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <BoltIcon className="h-3 w-3 text-purple-400" />
                                                        <span className="text-purple-400 text-xs font-medium">AI Summary</span>
                                                        <span className="text-gray-500 text-xs">
                                                            {new Date(n.createdAt + 'Z').toLocaleString()}
                                                        </span>
                                                    </div>
                                                    {aiSummaryLoading[n.id] ? (
                                                        <div className="flex items-center gap-2 py-1">
                                                            <div className="animate-spin rounded-full h-3 w-3 border-t-2 border-b-2 border-purple-500"></div>
                                                            <span className="text-gray-400 text-xs">Analyzing...</span>
                                                        </div>
                                                    ) : (
                                                        <p className="text-gray-300 text-xs leading-relaxed whitespace-pre-wrap">
                                                            {aiSummaries[n.id]}
                                                        </p>
                                                    )}
                                                </div>
                                            )
                                        ))}
                                        {group.all.length > 11 && (
                                            <p className="text-gray-500 text-xs text-center py-1">
                                                + {group.all.length - 11} older notifications (use "Delete all" to clear)
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}