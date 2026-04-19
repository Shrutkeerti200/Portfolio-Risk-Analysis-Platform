
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import portfolioService from '../services/portfolioService';
import riskService from '../services/riskService';
import { useAuth } from '../context/AuthContext';
import {
    PieChart, Pie, Cell, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    LineChart, Line, Area, AreaChart,
} from 'recharts';
import { BriefcaseIcon, CurrencyDollarIcon, ChartBarIcon, ScaleIcon, BoltIcon, ArrowTrendingUpIcon, ChartPieIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import AiAssistant from '../components/dashboard/AiAssistant';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
const STOCK_COLORS = {
    AAPL: '#3b82f6', GOOGL: '#10b981', TSLA: '#ef4444', NVDA: '#8b5cf6',
    MSFT: '#06b6d4', JNJ: '#f59e0b', KO: '#ec4899', PG: '#f97316', META: '#6366f1',
    IBM: '#6b7280',
};

export default function DashboardPage() {
    const { user } = useAuth();
    const [portfolios, setPortfolios] = useState([]);
    const [allHoldings, setAllHoldings] = useState([]);
    const [riskData, setRiskData] = useState({});
    const [prices, setPrices] = useState({});
    const [priceHistory, setPriceHistory] = useState([]);
    const [chartRange, setChartRange] = useState('1M');
    const [chartLoading, setChartLoading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [marketStatus, setMarketStatus] = useState(null);

    useEffect(() => {
        fetchDashboardData();
        fetchMarketStatus();
        const interval = setInterval(fetchLiveData, 30000);
        const marketInterval = setInterval(fetchMarketStatus, 60000);
        return () => {
            clearInterval(interval);
            clearInterval(marketInterval);
        };
    }, []);

    const fetchMarketStatus = async () => {
        try {
            const response = await fetch('http://localhost:8082/api/risk/market-status');
            if (response.ok) {
                const data = await response.json();
                setMarketStatus(data);
            }
        } catch (err) {
            console.error('Failed to fetch market status:', err);
        }
    };

    const fetchDashboardData = async () => {
        try {
            const portfolioData = await portfolioService.getAllPortfolios();
            setPortfolios(portfolioData);

            const holdingsArrays = portfolioData.map((p) => {
                const holdings = p.holdings || [];
                return holdings.map((h) => ({ ...h, portfolioName: p.name, portfolioId: p.id }));
            });
            const merged = holdingsArrays.flat();
            setAllHoldings(merged);

            const ids = portfolioData.map((p) => p.id);
            const risks = await riskService.getRiskForAllPortfolios(ids);
            setRiskData(risks);

            const symbols = [...new Set(merged.map(h => h.stockSymbol))];
            if (symbols.length > 0) {
                const priceData = await riskService.getStockPrices(symbols);
                setPrices(priceData);
                await fetchPriceHistory(symbols, '1M');
            }
        } catch (err) {
            setError('Failed to load dashboard data.');
        } finally {
            setLoading(false);
        }
    };

    const fetchLiveData = async () => {
        try {
            const ids = portfolios.map((p) => p.id);
            if (ids.length > 0) {
                const risks = await riskService.getRiskForAllPortfolios(ids);
                setRiskData(risks);
            }
            const symbols = [...new Set(allHoldings.map(h => h.stockSymbol))];
            if (symbols.length > 0) {
                const priceData = await riskService.getStockPrices(symbols);
                setPrices(priceData);
            }
        } catch { }
    };

    const fetchPriceHistory = async (symbols, range = '1M') => {
        try {
            setChartLoading(true);
            const now = Math.floor(Date.now() / 1000);

            const rangeMap = {
                '24H': 1,
                '1W': 7,
                '1M': 30,
                '6M': 180,
                '1Y': 365,
                '2Y': 730,
                '5Y': 1825,
            };
            const days = rangeMap[range] || 30;
            const from = now - days * 86400;

            // Fetch candle data from Yahoo Finance via backend
            const historyData = {};
            for (const symbol of symbols) {
                try {
                    const response = await fetch(
                        `http://localhost:8082/api/risk/prices/${symbol}/candles?from=${from}&to=${now}`
                    );
                    if (response.ok) {
                        const data = await response.json();
                        if (data.candles && data.candles.length > 0) {
                            historyData[symbol] = data.candles;
                        }
                    }
                } catch (err) {
                    console.error(`Failed to fetch candles for ${symbol}:`, err);
                }
            }

            // Fallback to DB history if Yahoo returned nothing
            if (Object.keys(historyData).length === 0) {
                for (const symbol of symbols) {
                    try {
                        const response = await fetch(
                            `http://localhost:8082/api/risk/prices/${symbol}/history?limit=2000`
                        );
                        if (response.ok) {
                            const data = await response.json();
                            const step = Math.max(1, Math.floor(data.length / 60));
                            const sampled = data.filter((_, i) => i % step === 0 || i === data.length - 1);
                            historyData[symbol] = sampled.map(p => ({
                                close: p.price,
                                timestamp: new Date(p.fetchedAt).getTime() / 1000,
                            }));
                        }
                    } catch { }
                }
            }

            if (Object.keys(historyData).length === 0) {
                setPriceHistory([]);
                return;
            }

            // Collect all unique timestamps and sort
            const allTimestamps = new Set();
            for (const candles of Object.values(historyData)) {
                for (const c of candles) {
                    allTimestamps.add(c.timestamp);
                }
            }
            const sortedTimestamps = [...allTimestamps].sort((a, b) => a - b);

            // Build lookup: symbol → { timestamp → close price }
            const priceLookup = {};
            for (const [symbol, candles] of Object.entries(historyData)) {
                priceLookup[symbol] = {};
                for (const c of candles) {
                    priceLookup[symbol][c.timestamp] = parseFloat(c.close);
                }
            }

            // Forward-fill prices and build chart data
            const lastKnown = {};
            const seenDates = new Set();
            const uniqueTicks = [];

            const chartData = sortedTimestamps.map((ts, i) => {
                const date = new Date(ts * 1000);
                const dateKey = formatDateLabel(date, days);
                const point = {
                    index: i,
                    dateKey,
                    fullTime: date.toLocaleString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                        hour: 'numeric', minute: '2-digit', hour12: true
                    }),
                };

                if (!seenDates.has(dateKey)) {
                    seenDates.add(dateKey);
                    uniqueTicks.push(i);
                }

                for (const symbol of symbols) {
                    if (priceLookup[symbol]?.[ts] != null) {
                        lastKnown[symbol] = priceLookup[symbol][ts];
                    }
                    if (lastKnown[symbol] != null) {
                        point[symbol] = lastKnown[symbol];
                    }
                }
                return point;
            });

            // Sample to ~100 points max for performance
            const step = Math.max(1, Math.floor(chartData.length / 100));
            const sampled = chartData.filter((_, i) => i % step === 0 || i === chartData.length - 1);

            // Rebuild unique ticks for sampled data
            const sampledSeenDates = new Set();
            const sampledTicks = [];
            sampled.forEach((point, i) => {
                point.index = i;
                if (!sampledSeenDates.has(point.dateKey)) {
                    sampledSeenDates.add(point.dateKey);
                    sampledTicks.push(i);
                }
            });
            sampled._uniqueTicks = sampledTicks;

            setPriceHistory(sampled);
        } catch (err) {
            console.error('Error fetching price history:', err);
        } finally {
            setChartLoading(false);
        }
    };

    const handleRangeChange = (range) => {
        setChartRange(range);
        const symbols = [...new Set(allHoldings.map(h => h.stockSymbol))];
        if (symbols.length > 0) {
            fetchPriceHistory(symbols, range);
        }
    };

    const formatDateLabel = (date, totalDays) => {
        if (totalDays <= 1) {
            return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        } else if (totalDays <= 90) {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } else {
            return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        }
    };

    const fmt = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
    const fmtShort = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    const totalInvested = allHoldings.reduce((sum, h) => sum + (h.quantity * h.avgBuyPrice), 0);
    const totalHoldings = allHoldings.length;
    const totalPortfolios = portfolios.length;
    const uniqueStocks = [...new Set(allHoldings.map((h) => h.stockSymbol))].length;

    const totalCurrentValue = Object.values(riskData).reduce((sum, r) => sum + (r?.totalValue || 0), 0);
    const totalPL = totalCurrentValue > 0 ? totalCurrentValue - totalInvested : 0;
    const totalPLPercent = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;

    const avgVolatility = Object.values(riskData).filter(r => r).reduce((sum, r, _, arr) => sum + (r.volatility || 0) / arr.length, 0);
    const avgSharpe = Object.values(riskData).filter(r => r).reduce((sum, r, _, arr) => sum + (r.sharpeRatio || 0) / arr.length, 0);
    const totalVaR = Object.values(riskData).filter(r => r).reduce((sum, r) => sum + (r.valueAtRisk || 0), 0);
    const avgBeta = Object.values(riskData).filter(r => r).reduce((sum, r, _, arr) => sum + (r.portfolioBeta || 0) / arr.length, 0);

    const mergedAllocation = allHoldings.reduce((acc, h) => {
        const existing = acc.find((a) => a.name === h.stockSymbol);
        const value = h.quantity * h.avgBuyPrice;
        if (existing) existing.value += value;
        else acc.push({ name: h.stockSymbol, value });
        return acc;
    }, []);

    const portfolioBarData = portfolios.map((p) => {
        const risk = riskData[p.id];
        const holdings = p.holdings || [];
        const invested = holdings.reduce((sum, h) => sum + (h.quantity * h.avgBuyPrice), 0);
        return { name: p.name, invested, currentValue: risk?.totalValue || invested };
    });

    const topHoldings = [...allHoldings]
        .map((h) => {
            const currentPrice = prices[h.stockSymbol]?.price || h.avgBuyPrice;
            const invested = h.quantity * h.avgBuyPrice;
            const currentValue = h.quantity * currentPrice;
            const pl = currentValue - invested;
            const plPercent = invested > 0 ? (pl / invested) * 100 : 0;
            return { ...h, invested, currentPrice, currentValue, pl, plPercent };
        })
        .sort((a, b) => b.invested - a.invested);

    const buildPortfolioContext = () => {
        let context = `Total Portfolios: ${totalPortfolios}\n`;
        context += `Total Invested: $${totalInvested.toFixed(2)}\n`;
        context += `Total Current Value: $${totalCurrentValue.toFixed(2)}\n`;
        context += `Total P/L: $${totalPL.toFixed(2)} (${totalPLPercent.toFixed(1)}%)\n`;
        context += `Avg Volatility: ${(avgVolatility * 100).toFixed(2)}%\n`;
        context += `Avg Sharpe Ratio: ${avgSharpe.toFixed(2)}\n`;
        context += `Total VaR (95%): $${totalVaR.toFixed(2)}\n`;
        context += `Avg Beta: ${avgBeta.toFixed(2)}\n\n`;
        context += `Holdings:\n`;
        topHoldings.forEach((h) => {
            context += `- ${h.stockSymbol}: ${h.quantity} shares, cost $${h.avgBuyPrice}, now $${h.currentPrice.toFixed(2)}, P/L $${h.pl.toFixed(2)} (${h.plPercent.toFixed(1)}%)\n`;
        });
        return context;
    };

    if (totalPortfolios === 0) {
        return (
            <div className="text-center py-20 bg-gray-800 rounded-xl border border-gray-700">
                <BriefcaseIcon className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-white mb-2">Welcome, {user?.firstName}!</h2>
                <p className="text-gray-400 mb-6">Create your first portfolio to see your dashboard come to life.</p>
                <Link to="/portfolios" className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition inline-block">Go to Portfolios</Link>
            </div>
        );
    }

    const latestCalculatedAt = Object.values(riskData)
        .filter(r => r?.calculatedAt)
        .map(r => new Date(r.calculatedAt))
        .sort((a, b) => b - a)[0];

    const formatCalculatedAt = (date) => {
        if (!date) return '';
        return date.toLocaleString('en-US', {
            month: 'short', day: 'numeric',
            hour: 'numeric', minute: '2-digit',
            hour12: true, timeZoneName: 'short'
        });
    };

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-white">Dashboard</h1>
                <p className="text-gray-400 mt-1">Welcome back, {user?.firstName}. Here's your portfolio overview.</p>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-lg mb-6 text-sm">{error}</div>
            )}

            {/* Market Status Banner */}
            {marketStatus && !marketStatus.isOpen && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-3 mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <span className="relative flex h-2.5 w-2.5">
                                <span className="absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-yellow-500"></span>
                            </span>
                            <span className="text-yellow-400 font-medium text-sm">Market Closed</span>
                        </div>
                        <span className="text-yellow-200/70 text-sm">
                            {latestCalculatedAt
                                ? `Showing data as of ${formatCalculatedAt(latestCalculatedAt)}`
                                : 'Showing last available data'}
                        </span>
                    </div>
                    <span className="text-yellow-200/50 text-xs">
                        Opens {marketStatus.opensAt}
                    </span>
                </div>
            )}

            {marketStatus && marketStatus.isOpen && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3 mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                            </span>
                            <span className="text-green-400 font-medium text-sm">Market Open</span>
                        </div>
                        <span className="text-green-200/70 text-sm">Live data — updating every 30s</span>
                    </div>
                    <span className="text-green-200/50 text-xs">
                        Closes {marketStatus.closesAt}
                    </span>
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-400 text-sm">Current Value</p>
                            <p className="text-2xl font-bold text-white mt-1">{totalCurrentValue > 0 ? fmtShort(totalCurrentValue) : fmtShort(totalInvested)}</p>
                            {totalCurrentValue > 0 && (
                                <p className={`text-sm mt-1 ${totalPL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {totalPL >= 0 ? '▲' : '▼'} {fmt(Math.abs(totalPL))} ({totalPLPercent.toFixed(1)}%)
                                </p>
                            )}
                        </div>
                        <div className="bg-blue-600/20 p-3 rounded-lg"><CurrencyDollarIcon className="h-6 w-6 text-blue-400" /></div>
                    </div>
                </div>
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-400 text-sm">Total Invested</p>
                            <p className="text-2xl font-bold text-white mt-1">{fmtShort(totalInvested)}</p>
                            <p className="text-gray-500 text-sm mt-1">{totalPortfolios} portfolios</p>
                        </div>
                        <div className="bg-green-600/20 p-3 rounded-lg"><BriefcaseIcon className="h-6 w-6 text-green-400" /></div>
                    </div>
                </div>
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-400 text-sm">Total Holdings</p>
                            <p className="text-2xl font-bold text-white mt-1">{totalHoldings}</p>
                            <p className="text-gray-500 text-sm mt-1">{uniqueStocks} unique stocks</p>
                        </div>
                        <div className="bg-yellow-600/20 p-3 rounded-lg"><ChartBarIcon className="h-6 w-6 text-yellow-400" /></div>
                    </div>
                </div>
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-400 text-sm">Daily VaR (95%)</p>
                            <p className="text-2xl font-bold text-red-400 mt-1">{fmt(totalVaR)}</p>
                            <p className="text-gray-500 text-sm mt-1">Max daily loss</p>
                        </div>
                        <div className="bg-red-600/20 p-3 rounded-lg"><ScaleIcon className="h-6 w-6 text-red-400" /></div>
                    </div>
                </div>
            </div>

            {/* Risk Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-400 text-xs uppercase tracking-wide">Volatility</p>
                            <p className="text-xl font-bold text-white mt-1">{(avgVolatility * 100).toFixed(2)}%</p>
                            <p className="text-gray-500 text-xs mt-1">Annualized portfolio risk</p>
                        </div>
                        <div className="bg-orange-600/20 p-2.5 rounded-lg"><BoltIcon className="h-5 w-5 text-orange-400" /></div>
                    </div>
                </div>
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-400 text-xs uppercase tracking-wide">Sharpe Ratio</p>
                            <p className={`text-xl font-bold mt-1 ${avgSharpe >= 0 ? 'text-green-400' : 'text-yellow-400'}`}>{avgSharpe.toFixed(2)}</p>
                            <p className="text-gray-500 text-xs mt-1">Risk-adjusted return</p>
                        </div>
                        <div className="bg-purple-600/20 p-2.5 rounded-lg"><ArrowTrendingUpIcon className="h-5 w-5 text-purple-400" /></div>
                    </div>
                </div>
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-400 text-xs uppercase tracking-wide">Portfolio Beta</p>
                            <p className="text-xl font-bold text-white mt-1">{avgBeta.toFixed(2)}</p>
                            <p className="text-gray-500 text-xs mt-1">Market sensitivity</p>
                        </div>
                        <div className="bg-cyan-600/20 p-2.5 rounded-lg"><ChartPieIcon className="h-5 w-5 text-cyan-400" /></div>
                    </div>
                </div>
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-400 text-xs uppercase tracking-wide">Daily Return</p>
                            <p className={`text-xl font-bold mt-1 ${(Object.values(riskData)[0]?.dailyReturn || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {((Object.values(riskData)[0]?.dailyReturn || 0) * 100).toFixed(3)}%
                            </p>
                            <p className="text-gray-500 text-xs mt-1">Latest daily change</p>
                        </div>
                        <div className="bg-emerald-600/20 p-2.5 rounded-lg"><ArrowPathIcon className="h-5 w-5 text-emerald-400" /></div>
                    </div>
                </div>
            </div>

            {/* Stock Price History Chart */}
            {(priceHistory.length > 1 || chartLoading) && (
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-lg font-semibold text-white">Stock Price Movement</h2>
                            <p className="text-gray-500 text-sm">
                                {marketStatus && !marketStatus.isOpen
                                    ? 'Showing last recorded prices before market close'
                                    : 'Market prices for all holdings'}
                            </p>
                        </div>
                        <div className="flex gap-1">
                            {['24H', '1W', '1M', '6M', '1Y', '2Y', '5Y'].map((range) => (
                                <button
                                    key={range}
                                    onClick={() => handleRangeChange(range)}
                                    disabled={chartLoading}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                                        chartRange === range
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-gray-200'
                                    } ${chartLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {range}
                                </button>
                            ))}
                        </div>
                    </div>
                    {chartLoading ? (
                        <div className="flex items-center justify-center h-[300px]">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={priceHistory}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                <XAxis
                                    dataKey="index"
                                    tick={{ fill: '#9ca3af', fontSize: 10 }}
                                    ticks={priceHistory._uniqueTicks || []}
                                    tickFormatter={(idx) => priceHistory[idx]?.dateKey || ''}
                                />
                                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => `$${v}`} domain={['auto', 'auto']} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                                    itemStyle={{ fontSize: '12px' }}
                                    labelFormatter={(label, payload) => payload?.[0]?.payload?.fullTime || label}
                                    formatter={(value, name) => [fmt(value), name]}
                                />
                                <Legend wrapperStyle={{ fontSize: '12px', color: '#9ca3af' }} />
                                {[...new Set(allHoldings.map(h => h.stockSymbol))].map((symbol) => (
                                    <Line
                                        key={symbol}
                                        type="monotone"
                                        dataKey={symbol}
                                        stroke={STOCK_COLORS[symbol] || '#6b7280'}
                                        strokeWidth={2}
                                        dot={false}
                                        connectNulls
                                    />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                    <p className="text-gray-600 text-xs mt-3 text-center italic">
                        Chart shows market prices from Yahoo Finance. Select a time range to view historical performance.
                    </p>
                </div>
            )}

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
                    <h2 className="text-lg font-semibold text-white mb-4">Asset Allocation</h2>
                    {mergedAllocation.length > 0 ? (
                        <div className="flex items-center">
                            <ResponsiveContainer width="60%" height={250}>
                                <PieChart>
                                    <Pie data={mergedAllocation} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" stroke="none">
                                        {mergedAllocation.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                                    </Pie>
                                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} itemStyle={{ color: '#e5e7eb' }} formatter={(v) => fmtShort(v)} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="w-[40%] space-y-2">
                                {mergedAllocation.map((item, i) => (
                                    <div key={item.name} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                                            <span className="text-sm text-gray-300">{item.name}</span>
                                        </div>
                                        <span className="text-sm text-gray-400">{((item.value / totalInvested) * 100).toFixed(1)}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <p className="text-gray-400 text-center py-10">No holdings to display.</p>
                    )}
                </div>

                <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
                    <h2 className="text-lg font-semibold text-white mb-4">Invested vs Current Value</h2>
                    {portfolioBarData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={portfolioBarData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} itemStyle={{ color: '#e5e7eb' }} formatter={(v) => fmtShort(v)} />
                                <Legend wrapperStyle={{ color: '#9ca3af', fontSize: '12px' }} />
                                <Bar dataKey="invested" fill="#6b7280" name="Invested" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="currentValue" fill="#3b82f6" name="Current Value" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-gray-400 text-center py-10">No data.</p>
                    )}
                </div>
            </div>

            {/* Enhanced Holdings Table */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-x-auto">
                <div className="px-6 py-4 border-b border-gray-700">
                    <h2 className="text-lg font-semibold text-white">All Holdings</h2>
                </div>
                {topHoldings.length > 0 ? (
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-700">
                                <th className="text-left text-sm font-medium text-gray-400 px-6 py-3">Symbol</th>
                                <th className="text-left text-sm font-medium text-gray-400 px-6 py-3">Portfolio</th>
                                <th className="text-right text-sm font-medium text-gray-400 px-6 py-3">Qty</th>
                                <th className="text-right text-sm font-medium text-gray-400 px-6 py-3">Avg Cost</th>
                                <th className="text-right text-sm font-medium text-gray-400 px-6 py-3">Current Price</th>
                                <th className="text-right text-sm font-medium text-gray-400 px-6 py-3">Invested</th>
                                <th className="text-right text-sm font-medium text-gray-400 px-6 py-3">Current Value</th>
                                <th className="text-right text-sm font-medium text-gray-400 px-6 py-3">P/L</th>
                            </tr>
                        </thead>
                        <tbody>
                            {topHoldings.map((h) => (
                                <tr key={h.id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-8 rounded-full" style={{ backgroundColor: STOCK_COLORS[h.stockSymbol] || '#6b7280' }}></div>
                                            <div>
                                                <span className="text-white font-semibold">{h.stockSymbol}</span>
                                                {prices[h.stockSymbol]?.changePercent != null && (
                                                    <span className={`text-xs ml-2 px-1.5 py-0.5 rounded ${prices[h.stockSymbol].changePercent >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                        {prices[h.stockSymbol].changePercent >= 0 ? '▲' : '▼'}
                                                        {Math.abs(prices[h.stockSymbol].changePercent).toFixed(2)}%
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <Link to={`/portfolios/${h.portfolioId}`} className="text-blue-400 hover:text-blue-300 text-sm">{h.portfolioName}</Link>
                                    </td>
                                    <td className="text-right px-6 py-4 text-gray-300">{h.quantity}</td>
                                    <td className="text-right px-6 py-4 text-gray-300">{fmt(h.avgBuyPrice)}</td>
                                    <td className="text-right px-6 py-4 text-white font-medium">{fmt(h.currentPrice)}</td>
                                    <td className="text-right px-6 py-4 text-gray-300">{fmtShort(h.invested)}</td>
                                    <td className="text-right px-6 py-4 text-white font-medium">{fmtShort(h.currentValue)}</td>
                                    <td className="text-right px-6 py-4">
                                        <div>
                                            <span className={`font-medium ${h.pl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {h.pl >= 0 ? '+' : ''}{fmt(h.pl)}
                                            </span>
                                            <div className="flex items-center justify-end gap-1 mt-0.5">
                                                <div className="w-12 bg-gray-700 rounded-full h-1.5">
                                                    <div
                                                        className={`h-1.5 rounded-full ${h.pl >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                                                        style={{ width: `${Math.min(Math.abs(h.plPercent), 100)}%` }}
                                                    ></div>
                                                </div>
                                                <span className={`text-xs ${h.pl >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>
                                                    {h.pl >= 0 ? '+' : ''}{h.plPercent.toFixed(1)}%
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="border-t border-gray-600 bg-gray-800/50">
                                <td className="px-6 py-4 text-white font-semibold" colSpan={5}>Total</td>
                                <td className="text-right px-6 py-4 text-gray-300 font-medium">{fmtShort(totalInvested)}</td>
                                <td className="text-right px-6 py-4 text-white font-bold">{fmtShort(totalCurrentValue > 0 ? totalCurrentValue : totalInvested)}</td>
                                <td className="text-right px-6 py-4">
                                    {totalCurrentValue > 0 && (
                                        <span className={`font-bold ${totalPL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {totalPL >= 0 ? '+' : ''}{fmt(totalPL)} ({totalPLPercent.toFixed(1)}%)
                                        </span>
                                    )}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                ) : (
                    <p className="text-gray-400 text-center py-10">No holdings.</p>
                )}
            </div>

            <AiAssistant portfolioContext={buildPortfolioContext()} />
        </div>
    );
}