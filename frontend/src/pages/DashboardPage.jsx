import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import portfolioService from '../services/portfolioService';
import riskService from '../services/riskService';
import { useAuth } from '../context/AuthContext';
import {
    PieChart, Pie, Cell, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    LineChart, Line, Area, AreaChart, ReferenceLine, ComposedChart,
} from 'recharts';
import { BriefcaseIcon, CurrencyDollarIcon, ChartBarIcon, ScaleIcon, BoltIcon, ArrowTrendingUpIcon, ChartPieIcon, ArrowPathIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import AiAssistant from '../components/dashboard/AiAssistant';
import MetricTooltip from '../components/dashboard/MetricTooltip';
import * as XLSX from 'xlsx';
import config from '../config';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
const STOCK_COLORS = {
    AAPL: '#3b82f6', GOOGL: '#10b981', TSLA: '#ef4444', NVDA: '#8b5cf6',
    MSFT: '#06b6d4', JNJ: '#f59e0b', KO: '#ec4899', PG: '#f97316', META: '#6366f1',
    IBM: '#6b7280',
};

// ─── Technical Indicator Helpers ───────────────────────────────────────────────

function computeSMA(data, key, window) {
    const result = [];
    for (let i = 0; i < data.length; i++) {
        if (i < window - 1 || data[i][key] == null) {
            result.push(null);
        } else {
            let sum = 0;
            let count = 0;
            for (let j = i - window + 1; j <= i; j++) {
                if (data[j][key] != null) {
                    sum += data[j][key];
                    count++;
                }
            }
            result.push(count > 0 ? sum / count : null);
        }
    }
    return result;
}

function computeRSI(data, key, period = 14) {
    const result = [];
    let avgGain = 0;
    let avgLoss = 0;

    for (let i = 0; i < data.length; i++) {
        if (i === 0 || data[i][key] == null || data[i - 1][key] == null) {
            result.push(null);
            continue;
        }

        const change = data[i][key] - data[i - 1][key];
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? Math.abs(change) : 0;

        if (i <= period) {
            avgGain += gain;
            avgLoss += loss;

            if (i === period) {
                avgGain /= period;
                avgLoss /= period;
                if (avgLoss === 0) {
                    result.push(100);
                } else {
                    const rs = avgGain / avgLoss;
                    result.push(100 - (100 / (1 + rs)));
                }
            } else {
                result.push(null);
            }
        } else {
            avgGain = (avgGain * (period - 1) + gain) / period;
            avgLoss = (avgLoss * (period - 1) + loss) / period;

            if (avgLoss === 0) {
                result.push(100);
            } else {
                const rs = avgGain / avgLoss;
                result.push(100 - (100 / (1 + rs)));
            }
        }
    }
    return result;
}

function computeMomentum(data, key) {
    const result = [];
    for (let i = 0; i < data.length; i++) {
        if (i === 0 || data[i][key] == null || data[i - 1][key] == null || data[i - 1][key] === 0) {
            result.push(null);
        } else {
            const pctChange = ((data[i][key] - data[i - 1][key]) / data[i - 1][key]) * 100;
            result.push(parseFloat(pctChange.toFixed(3)));
        }
    }
    return result;
}

// ─── Custom Tooltip for Indicators ────────────────────────────────────────────

function IndicatorTooltip({ active, payload, label, type }) {
    if (!active || !payload || payload.length === 0) return null;
    const point = payload[0]?.payload;
    const time = point?.fullTime || label;

    return (
        <div style={{
            backgroundColor: '#1f2937', border: '1px solid #374151',
            borderRadius: '8px', padding: '10px 14px', fontSize: '12px',
        }}>
            <p style={{ color: '#9ca3af', marginBottom: '6px' }}>{time}</p>
            {payload.map((entry, i) => (
                entry.value != null && (
                    <p key={i} style={{ color: entry.color || entry.stroke || '#e5e7eb', margin: '2px 0' }}>
                        {entry.name}: {type === 'rsi' ? entry.value.toFixed(1) :
                            type === 'momentum' ? `${entry.value >= 0 ? '+' : ''}${entry.value.toFixed(3)}%` :
                                `$${entry.value.toFixed(2)}`}
                    </p>
                )
            ))}
        </div>
    );
}

// ─── Stock Selector ───────────────────────────────────────────────────────────

function StockSelector({ symbols, activeStock, onSelect }) {
    return (
        <div className="flex flex-wrap gap-1.5">
            {symbols.map(symbol => (
                <button
                    key={symbol}
                    onClick={() => onSelect(symbol)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                        activeStock === symbol
                            ? 'text-white shadow-md'
                            : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-gray-200'
                    }`}
                    style={activeStock === symbol ? {
                        backgroundColor: STOCK_COLORS[symbol] || '#6b7280',
                    } : {}}
                >
                    {symbol}
                </button>
            ))}
        </div>
    );
}


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
    const [digestLoading, setDigestLoading] = useState(false);
    const [digestContent, setDigestContent] = useState(null);
    const [showDigest, setShowDigest] = useState(false);

    // Technical indicator state
    const [activeIndicatorStock, setActiveIndicatorStock] = useState(null);
    const [indicatorData, setIndicatorData] = useState([]);

    // Tab state for Stock Price Movement vs Technical Indicators
    const [activeChartTab, setActiveChartTab] = useState('price');

    // AI Explain state
    const [aiExplainLoading, setAiExplainLoading] = useState(false);
    const [aiExplainContent, setAiExplainContent] = useState(null);
    const [showAiExplain, setShowAiExplain] = useState(false);
    const [aiExplainStock, setAiExplainStock] = useState(null);

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

    // Recompute indicators when priceHistory or activeIndicatorStock changes
    useEffect(() => {
        if (priceHistory.length > 0 && activeIndicatorStock) {
            const sma10 = computeSMA(priceHistory, activeIndicatorStock, 10);
            const sma20 = computeSMA(priceHistory, activeIndicatorStock, 20);
            const rsi = computeRSI(priceHistory, activeIndicatorStock, 14);
            const momentum = computeMomentum(priceHistory, activeIndicatorStock);

            const enriched = priceHistory.map((point, i) => ({
                ...point,
                sma10: sma10[i],
                sma20: sma20[i],
                rsi: rsi[i],
                momentum: momentum[i],
                price: point[activeIndicatorStock] ?? null,
                momentumPos: momentum[i] != null && momentum[i] >= 0 ? momentum[i] : null,
                momentumNeg: momentum[i] != null && momentum[i] < 0 ? momentum[i] : null,
            }));

            setIndicatorData(enriched);
        } else {
            setIndicatorData([]);
        }
    }, [priceHistory, activeIndicatorStock]);

    const fetchMarketStatus = async () => {
        try {
            const response = await fetch(`${config.RISK_API_URL}/risk/market-status`);
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
                setActiveIndicatorStock(symbols[0]);
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
                '24H': 1, '1W': 7, '1M': 30, '6M': 180, '1Y': 365, '2Y': 730, '5Y': 1825,
            };
            const days = rangeMap[range] || 30;
            const from = now - days * 86400;

            const historyData = {};
            for (const symbol of symbols) {
                try {
                    const response = await fetch(
                        `${config.RISK_API_URL}/risk/prices/${symbol}/candles?from=${from}&to=${now}`
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

            if (Object.keys(historyData).length === 0) {
                for (const symbol of symbols) {
                    try {
                        const response = await fetch(
                            `${config.RISK_API_URL}/risk/prices/${symbol}/history?limit=2000`
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

            const allTimestamps = new Set();
            for (const candles of Object.values(historyData)) {
                for (const c of candles) {
                    allTimestamps.add(c.timestamp);
                }
            }
            const sortedTimestamps = [...allTimestamps].sort((a, b) => a - b);

            const priceLookup = {};
            for (const [symbol, candles] of Object.entries(historyData)) {
                priceLookup[symbol] = {};
                for (const c of candles) {
                    priceLookup[symbol][c.timestamp] = parseFloat(c.close);
                }
            }

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

            const step = Math.max(1, Math.floor(chartData.length / 100));
            const sampled = chartData.filter((_, i) => i % step === 0 || i === chartData.length - 1);

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

    const exportToExcel = async () => {
        const wb = XLSX.utils.book_new();

        const summaryData = portfolios.map(p => {
            const risk = riskData[p.id];
            const holdings = p.holdings || [];
            const invested = holdings.reduce((sum, h) => sum + (h.quantity * h.avgBuyPrice), 0);
            const currentVal = risk?.totalValue || invested;
            const pl = currentVal - invested;
            return {
                'Portfolio': p.name,
                'Description': p.description || '',
                'Holdings Count': holdings.length,
                'Total Invested ($)': parseFloat(invested.toFixed(2)),
                'Current Value ($)': parseFloat(currentVal.toFixed(2)),
                'P/L ($)': parseFloat(pl.toFixed(2)),
                'P/L (%)': invested > 0 ? parseFloat(((pl / invested) * 100).toFixed(2)) : 0,
                'Volatility (%)': risk ? parseFloat((risk.volatility * 100).toFixed(2)) : 0,
                'Sharpe Ratio': risk ? parseFloat(risk.sharpeRatio.toFixed(2)) : 0,
                'VaR ($)': risk ? parseFloat(risk.valueAtRisk.toFixed(2)) : 0,
                'Beta': risk ? parseFloat(risk.portfolioBeta.toFixed(2)) : 0,
            };
        });
        const ws1 = XLSX.utils.json_to_sheet(summaryData);
        ws1['!cols'] = summaryData.length > 0 ? Object.keys(summaryData[0]).map(() => ({ wch: 18 })) : [];
        XLSX.utils.book_append_sheet(wb, ws1, 'Portfolio Summary');

        const holdingsData = topHoldings.map(h => ({
            'Symbol': h.stockSymbol,
            'Portfolio': h.portfolioName,
            'Quantity': h.quantity,
            'Avg Cost ($)': parseFloat(h.avgBuyPrice.toFixed(2)),
            'Current Price ($)': parseFloat(h.currentPrice.toFixed(2)),
            'Invested ($)': parseFloat(h.invested.toFixed(2)),
            'Current Value ($)': parseFloat(h.currentValue.toFixed(2)),
            'P/L ($)': parseFloat(h.pl.toFixed(2)),
            'P/L (%)': parseFloat(h.plPercent.toFixed(2)),
        }));
        const ws2 = XLSX.utils.json_to_sheet(holdingsData);
        ws2['!cols'] = holdingsData.length > 0 ? Object.keys(holdingsData[0]).map(() => ({ wch: 18 })) : [];
        XLSX.utils.book_append_sheet(wb, ws2, 'All Holdings');

        try {
            const allTransactions = [];
            for (const p of portfolios) {
                const response = await fetch(`${config.PORTFOLIO_API_URL}/portfolios/${p.id}/transactions`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                });
                if (response.ok) {
                    const txns = await response.json();
                    txns.forEach(tx => {
                        allTransactions.push({
                            'Date': new Date(tx.executedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
                            'Portfolio': p.name,
                            'Symbol': tx.stockSymbol,
                            'Type': tx.type,
                            'Quantity': parseFloat(tx.quantity),
                            'Price ($)': parseFloat(tx.pricePerUnit),
                            'Total ($)': parseFloat(tx.totalAmount),
                        });
                    });
                }
            }
            if (allTransactions.length > 0) {
                const ws3 = XLSX.utils.json_to_sheet(allTransactions);
                ws3['!cols'] = Object.keys(allTransactions[0]).map(() => ({ wch: 16 }));
                XLSX.utils.book_append_sheet(wb, ws3, 'Transactions');
            }
        } catch (err) {
            console.error('Error fetching transactions for export:', err);
        }

        const riskMetrics = [{
            'Date': new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
            'Total Invested ($)': parseFloat(totalInvested.toFixed(2)),
            'Total Current Value ($)': parseFloat(totalCurrentValue.toFixed(2)),
            'Total P/L ($)': parseFloat(totalPL.toFixed(2)),
            'Total P/L (%)': parseFloat(totalPLPercent.toFixed(2)),
            'Avg Volatility (%)': parseFloat((avgVolatility * 100).toFixed(2)),
            'Avg Sharpe Ratio': parseFloat(avgSharpe.toFixed(2)),
            'Total VaR ($)': parseFloat(totalVaR.toFixed(2)),
            'Avg Beta': parseFloat(avgBeta.toFixed(2)),
        }];
        const ws4 = XLSX.utils.json_to_sheet(riskMetrics);
        ws4['!cols'] = Object.keys(riskMetrics[0]).map(() => ({ wch: 22 }));
        XLSX.utils.book_append_sheet(wb, ws4, 'Risk Snapshot');

        const date = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `Riskient_Portfolio_Report_${date}.xlsx`);
    };

    const generateDailyDigest = async () => {
        setDigestLoading(true);
        setShowDigest(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${config.PORTFOLIO_API_URL}/ai/digest`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + token,
                },
                body: JSON.stringify({ portfolioContext: buildPortfolioContext() }),
            });
            const data = await response.json();
            setDigestContent(data.response || 'Could not generate digest.');
        } catch {
            setDigestContent('Failed to generate daily digest. Please try again.');
        } finally {
            setDigestLoading(false);
        }
    };

    // ─── AI Explain Technical Indicators ───────────────────────────────────────
    const generateAiExplanation = async () => {
        if (!activeIndicatorStock || indicatorData.length === 0) return;

        setAiExplainLoading(true);
        setShowAiExplain(true);
        setAiExplainStock(activeIndicatorStock);

        // Build context from the indicator data
        const latestPoint = indicatorData[indicatorData.length - 1];
        const firstPoint = indicatorData.find(p => p.price != null);
        const latestPrice = latestPoint?.price;
        const firstPrice = firstPoint?.price;
        const priceChange = latestPrice && firstPrice ? ((latestPrice - firstPrice) / firstPrice * 100).toFixed(2) : null;

        const latestSMA10 = latestPoint?.sma10;
        const latestSMA20 = latestPoint?.sma20;
        const latestRSIVal = latestPoint?.rsi;

        const bullishDays = indicatorData.filter(d => d.momentumPos != null).length;
        const bearishDays = indicatorData.filter(d => d.momentumNeg != null).length;
        const maxGain = Math.max(...indicatorData.map(d => d.momentumPos || 0));
        const maxLoss = Math.min(...indicatorData.map(d => d.momentumNeg || 0));

        const holding = topHoldings.find(h => h.stockSymbol === activeIndicatorStock);

        let indicatorContext = `Stock: ${activeIndicatorStock}\n`;
        indicatorContext += `Time Period: ${indicatorData[0]?.dateKey || 'N/A'} to ${latestPoint?.dateKey || 'N/A'}\n`;
        indicatorContext += `Current Price: $${latestPrice?.toFixed(2) || 'N/A'}\n`;
        if (priceChange) indicatorContext += `Price Change over period: ${priceChange}%\n`;
        if (latestSMA10) indicatorContext += `SMA 10: $${latestSMA10.toFixed(2)} (Price is ${latestPrice > latestSMA10 ? 'ABOVE' : 'BELOW'} SMA 10)\n`;
        if (latestSMA20) indicatorContext += `SMA 20: $${latestSMA20.toFixed(2)} (Price is ${latestPrice > latestSMA20 ? 'ABOVE' : 'BELOW'} SMA 20)\n`;
        if (latestRSIVal) indicatorContext += `RSI (14): ${latestRSIVal.toFixed(1)} (${latestRSIVal >= 70 ? 'Overbought' : latestRSIVal <= 30 ? 'Oversold' : 'Neutral'})\n`;
        indicatorContext += `Momentum: ${bullishDays} bullish days, ${bearishDays} bearish days\n`;
        indicatorContext += `Max single-day gain: +${maxGain.toFixed(3)}%, Max single-day loss: ${maxLoss.toFixed(3)}%\n`;
        if (holding) {
            indicatorContext += `\nUser's Position:\n`;
            indicatorContext += `- Quantity: ${holding.quantity} shares\n`;
            indicatorContext += `- Avg Cost: $${holding.avgBuyPrice}\n`;
            indicatorContext += `- Current Value: $${holding.currentValue.toFixed(2)}\n`;
            indicatorContext += `- P/L: $${holding.pl.toFixed(2)} (${holding.plPercent.toFixed(1)}%)\n`;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${config.PORTFOLIO_API_URL}/ai/explain-indicators`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + token,
                },
                body: JSON.stringify({ indicatorData: indicatorContext }),
            });
            const data = await response.json();
            setAiExplainContent(data.response || 'Could not generate explanation.');
        } catch {
            setAiExplainContent('Failed to generate explanation. Please try again.');
        } finally {
            setAiExplainLoading(false);
        }
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

    const allSymbols = [...new Set(allHoldings.map(h => h.stockSymbol))];

    const latestRSI = indicatorData.length > 0 ? indicatorData[indicatorData.length - 1]?.rsi : null;
    const getRSILabel = (rsi) => {
        if (rsi == null) return { text: '—', color: 'text-gray-400' };
        if (rsi >= 70) return { text: 'Overbought', color: 'text-red-400' };
        if (rsi <= 30) return { text: 'Oversold', color: 'text-green-400' };
        return { text: 'Neutral', color: 'text-gray-300' };
    };
    const rsiLabel = getRSILabel(latestRSI);

    return (
        <div>
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white">Dashboard</h1>
                    <p className="text-gray-400 mt-1">Welcome back, {user?.firstName}. Here's your portfolio overview.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={generateDailyDigest}
                        disabled={digestLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 rounded-lg transition text-sm disabled:opacity-50"
                    >
                        <BoltIcon className="h-4 w-4" />
                        {digestLoading ? 'Generating...' : 'AI Daily Digest'}
                    </button>
                    <button
                        onClick={exportToExcel}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition text-sm"
                    >
                        <ArrowDownTrayIcon className="h-4 w-4" />
                        Export to Excel
                    </button>
                </div>
            </div>

            {/* AI Daily Digest Modal */}
            {showDigest && (
                <div className="bg-gray-800 rounded-xl border border-purple-500/30 p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <div className="bg-purple-600/20 p-2 rounded-lg"><BoltIcon className="h-5 w-5 text-purple-400" /></div>
                            <div>
                                <h2 className="text-white font-semibold text-sm">AI Daily Digest</h2>
                                <p className="text-gray-500 text-xs">Generated {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                            </div>
                        </div>
                        <button onClick={() => setShowDigest(false)} className="text-gray-400 hover:text-white transition">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    {digestLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
                            <span className="ml-3 text-gray-400 text-sm">Analyzing your portfolio...</span>
                        </div>
                    ) : (
                        <div
                            className="text-gray-300 text-sm leading-relaxed"
                            dangerouslySetInnerHTML={{
                                __html: (digestContent || '')
                                    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
                                    .replace(/(Remember,.*?(?:investment|financial) advice\.?)/gi, '<strong class="text-yellow-400 font-semibold mt-2 block">⚠️ $1</strong>')
                                    .replace(/\n/g, '<br />')
                            }}
                        />
                    )}
                </div>
            )}

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

            {/* Summary Cards — Row 1 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <MetricTooltip tooltip="The total market value of all your holdings right now. Calculated as the sum of (current price × quantity) for every stock across all portfolios.">
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
                </MetricTooltip>
                <MetricTooltip tooltip="The total amount you originally spent to buy all holdings. Calculated as the sum of (average buy price × quantity) for every position across all portfolios.">
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
                </MetricTooltip>
                <MetricTooltip tooltip="The total number of individual stock positions across all your portfolios, and how many distinct ticker symbols you hold.">
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
                </MetricTooltip>
                <MetricTooltip tooltip="Value at Risk at 95% confidence level. Estimates the maximum dollar loss your combined portfolio could experience in a single trading day under normal market conditions. Calculated using historical price volatility and a normal distribution model.">
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
                </MetricTooltip>
            </div>

            {/* Risk Metrics — Row 2 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <MetricTooltip tooltip="Annualized portfolio volatility measures how much your portfolio's returns fluctuate over time. Calculated as the standard deviation of daily returns, annualized by multiplying by √252 (trading days). Higher values mean more price swings and greater risk.">
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
                </MetricTooltip>
                <MetricTooltip tooltip="The Sharpe Ratio measures risk-adjusted return — how much excess return you earn per unit of risk. Calculated as (portfolio return − risk-free rate) ÷ portfolio volatility. Above 1.0 is good, above 2.0 is very good, and negative means the portfolio underperformed the risk-free rate.">
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
                </MetricTooltip>
                <MetricTooltip tooltip="Portfolio Beta measures how sensitive your portfolio is to overall market movements (S&P 500). A beta of 1.0 means it moves with the market. Above 1.0 means more volatile than the market, below 1.0 means less volatile. Calculated as the covariance of portfolio returns with market returns divided by market variance.">
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
                </MetricTooltip>
                <MetricTooltip tooltip="The latest single-day percentage change in your portfolio's total value. Calculated as (today's portfolio value − previous day's value) ÷ previous day's value. Shows how your portfolio performed in the most recent trading session.">
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
                </MetricTooltip>
            </div>

            {/* ═══════════════════ TABBED: STOCK PRICE MOVEMENT + TECHNICAL INDICATORS ═══════════════════ */}
            {(priceHistory.length > 1 || chartLoading) && allSymbols.length > 0 && (
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-8">
                    {/* Tab Header Row */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            {/* Pill-style Tab Toggle */}
                            <div className="flex bg-gray-900 rounded-lg p-1">
                                <button
                                    onClick={() => setActiveChartTab('price')}
                                    className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${
                                        activeChartTab === 'price'
                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                                            : 'text-gray-400 hover:text-gray-200'
                                    }`}
                                >
                                    Stock Price Movement
                                </button>
                                <button
                                    onClick={() => setActiveChartTab('technical')}
                                    className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${
                                        activeChartTab === 'technical'
                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                                            : 'text-gray-400 hover:text-gray-200'
                                    }`}
                                >
                                    Technical Indicators
                                </button>
                            </div>
                        </div>

                        {/* Right-side controls change based on active tab */}
                        {activeChartTab === 'price' ? (
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
                        ) : (
                            <StockSelector
                                symbols={allSymbols}
                                activeStock={activeIndicatorStock}
                                onSelect={setActiveIndicatorStock}
                            />
                        )}
                    </div>

                    {/* Subtitle */}
                    <p className="text-gray-500 text-sm mb-4">
                        {activeChartTab === 'price'
                            ? (marketStatus && !marketStatus.isOpen
                                ? 'Showing last recorded prices before market close'
                                : 'Market prices for all holdings')
                            : 'Moving averages, RSI & momentum — select a stock to analyze'}
                    </p>

                    {/* ─── PRICE TAB CONTENT ─── */}
                    {activeChartTab === 'price' && (
                        <>
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
                                        {allSymbols.map((symbol) => (
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
                        </>
                    )}

                    {/* ─── TECHNICAL INDICATORS TAB CONTENT ─── */}
                    {activeChartTab === 'technical' && (
                        <>
                            {indicatorData.length > 0 && activeIndicatorStock ? (
                                <div className="space-y-6">
                                    {/* ── Price + SMA Chart ── */}
                                    <div>
                                        <div className="flex items-center gap-4 mb-3">
                                            <h3 className="text-sm font-medium text-gray-300">
                                                {activeIndicatorStock} — Price with Moving Averages
                                            </h3>
                                            <div className="flex items-center gap-3 text-xs text-gray-500">
                                                <span className="flex items-center gap-1.5">
                                                    <span className="w-5 h-0.5 rounded" style={{ backgroundColor: STOCK_COLORS[activeIndicatorStock] || '#6b7280' }}></span>
                                                    Price
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                    <span className="w-5 h-0.5 bg-yellow-400 rounded"></span>
                                                    SMA 10
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                    <span className="w-5 h-0.5 bg-orange-400 rounded"></span>
                                                    SMA 20
                                                </span>
                                            </div>
                                        </div>
                                        <ResponsiveContainer width="100%" height={250}>
                                            <LineChart data={indicatorData}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                                <XAxis
                                                    dataKey="index"
                                                    tick={{ fill: '#9ca3af', fontSize: 10 }}
                                                    ticks={priceHistory._uniqueTicks || []}
                                                    tickFormatter={(idx) => indicatorData[idx]?.dateKey || ''}
                                                />
                                                <YAxis
                                                    tick={{ fill: '#9ca3af', fontSize: 11 }}
                                                    tickFormatter={(v) => `$${v}`}
                                                    domain={['auto', 'auto']}
                                                />
                                                <Tooltip content={<IndicatorTooltip type="price" />} />
                                                <Line
                                                    type="monotone"
                                                    dataKey="price"
                                                    name={`${activeIndicatorStock} Price`}
                                                    stroke={STOCK_COLORS[activeIndicatorStock] || '#6b7280'}
                                                    strokeWidth={2}
                                                    dot={false}
                                                    connectNulls
                                                />
                                                <Line
                                                    type="monotone"
                                                    dataKey="sma10"
                                                    name="SMA 10"
                                                    stroke="#facc15"
                                                    strokeWidth={1.5}
                                                    strokeDasharray="4 2"
                                                    dot={false}
                                                    connectNulls
                                                />
                                                <Line
                                                    type="monotone"
                                                    dataKey="sma20"
                                                    name="SMA 20"
                                                    stroke="#fb923c"
                                                    strokeWidth={1.5}
                                                    strokeDasharray="6 3"
                                                    dot={false}
                                                    connectNulls
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                        <p className="text-gray-600 text-xs mt-2 text-center italic">
                                            When the price crosses above the SMA, it may signal upward momentum. When it crosses below, it may suggest a downtrend.
                                        </p>
                                    </div>

                                    {/* ── RSI Chart ── */}
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <h3 className="text-sm font-medium text-gray-300">
                                                    RSI (14-period)
                                                </h3>
                                                {latestRSI != null && (
                                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                                        latestRSI >= 70 ? 'bg-red-500/20 text-red-400' :
                                                        latestRSI <= 30 ? 'bg-green-500/20 text-green-400' :
                                                        'bg-gray-700 text-gray-300'
                                                    }`}>
                                                        {latestRSI.toFixed(1)} — {rsiLabel.text}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-gray-500">
                                                <span className="flex items-center gap-1.5">
                                                    <span className="w-3 h-0.5 bg-red-400/50 rounded"></span>
                                                    Overbought (70)
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                    <span className="w-3 h-0.5 bg-green-400/50 rounded"></span>
                                                    Oversold (30)
                                                </span>
                                            </div>
                                        </div>
                                        <ResponsiveContainer width="100%" height={180}>
                                            <AreaChart data={indicatorData}>
                                                <defs>
                                                    <linearGradient id="rsiGradient" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.02} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                                <XAxis
                                                    dataKey="index"
                                                    tick={{ fill: '#9ca3af', fontSize: 10 }}
                                                    ticks={priceHistory._uniqueTicks || []}
                                                    tickFormatter={(idx) => indicatorData[idx]?.dateKey || ''}
                                                />
                                                <YAxis
                                                    tick={{ fill: '#9ca3af', fontSize: 11 }}
                                                    domain={[0, 100]}
                                                    ticks={[0, 30, 50, 70, 100]}
                                                />
                                                <Tooltip content={<IndicatorTooltip type="rsi" />} />
                                                <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="4 3" strokeOpacity={0.5} />
                                                <ReferenceLine y={30} stroke="#22c55e" strokeDasharray="4 3" strokeOpacity={0.5} />
                                                <ReferenceLine y={50} stroke="#6b7280" strokeDasharray="2 4" strokeOpacity={0.3} />
                                                <Area
                                                    type="monotone"
                                                    dataKey="rsi"
                                                    name="RSI"
                                                    stroke="#8b5cf6"
                                                    strokeWidth={2}
                                                    fill="url(#rsiGradient)"
                                                    dot={false}
                                                    connectNulls
                                                />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                        <p className="text-gray-600 text-xs mt-2 text-center italic">
                                            RSI above 70 suggests the stock may be overbought; below 30 suggests it may be oversold. This is not financial advice.
                                        </p>
                                    </div>

                                    {/* ── Momentum (Daily % Change) Chart ── */}
                                    <div>
                                        <div className="flex items-center gap-3 mb-3">
                                            <h3 className="text-sm font-medium text-gray-300">
                                                Daily Momentum (% Change)
                                            </h3>
                                            <div className="flex items-center gap-3 text-xs text-gray-500">
                                                <span className="flex items-center gap-1.5">
                                                    <span className="w-2.5 h-2.5 bg-emerald-500 rounded-sm"></span>
                                                    Bullish
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                    <span className="w-2.5 h-2.5 bg-red-500 rounded-sm"></span>
                                                    Bearish
                                                </span>
                                            </div>
                                        </div>
                                        <ResponsiveContainer width="100%" height={160}>
                                            <ComposedChart data={indicatorData}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                                <XAxis
                                                    dataKey="index"
                                                    tick={{ fill: '#9ca3af', fontSize: 10 }}
                                                    ticks={priceHistory._uniqueTicks || []}
                                                    tickFormatter={(idx) => indicatorData[idx]?.dateKey || ''}
                                                />
                                                <YAxis
                                                    tick={{ fill: '#9ca3af', fontSize: 11 }}
                                                    tickFormatter={(v) => `${v}%`}
                                                    domain={['auto', 'auto']}
                                                />
                                                <Tooltip content={<IndicatorTooltip type="momentum" />} />
                                                <ReferenceLine y={0} stroke="#6b7280" strokeOpacity={0.5} />
                                                <Bar dataKey="momentumPos" name="Gain" fill="#10b981" radius={[2, 2, 0, 0]} />
                                                <Bar dataKey="momentumNeg" name="Loss" fill="#ef4444" radius={[0, 0, 2, 2]} />
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                        <p className="text-gray-600 text-xs mt-2 text-center italic">
                                            Shows the percentage price change between data points. Large swings may indicate increased volatility.
                                        </p>
                                    </div>

                                    {/* ── AI Explain Button & Panel ── */}
                                    <div className="pt-2">
                                        <button
                                            onClick={generateAiExplanation}
                                            disabled={aiExplainLoading}
                                            className="flex items-center gap-2 px-4 py-2.5 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 rounded-lg transition text-sm font-medium disabled:opacity-50 w-full justify-center"
                                        >
                                            <BoltIcon className="h-4 w-4" />
                                            {aiExplainLoading
                                                ? 'Analyzing...'
                                                : showAiExplain && aiExplainStock === activeIndicatorStock && aiExplainContent
                                                    ? `Refresh AI Analysis for ${activeIndicatorStock}`
                                                    : `Explain ${activeIndicatorStock} Indicators with AI`}
                                        </button>

                                        {showAiExplain && aiExplainStock === activeIndicatorStock && (
                                            <div className="mt-4 bg-purple-500/5 border border-purple-500/20 rounded-xl p-5">
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="bg-purple-600/20 p-1.5 rounded-md">
                                                            <BoltIcon className="h-4 w-4 text-purple-400" />
                                                        </div>
                                                        <span className="text-purple-300 text-sm font-semibold">
                                                            AI Analysis — {aiExplainStock}
                                                        </span>
                                                    </div>
                                                    <button
                                                        onClick={() => setShowAiExplain(false)}
                                                        className="text-gray-500 hover:text-gray-300 transition"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                    </button>
                                                </div>
                                                {aiExplainLoading ? (
                                                    <div className="flex items-center justify-center py-6">
                                                        <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-purple-500"></div>
                                                        <span className="ml-3 text-gray-400 text-sm">Reading the charts for you...</span>
                                                    </div>
                                                ) : (
                                                    <div
                                                        className="text-gray-300 text-sm leading-relaxed ai-explain-content"
                                                        dangerouslySetInnerHTML={{
                                                            __html: aiExplainContent
                                                                .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
                                                                .replace(/(Remember,.*?(?:investment|financial) advice\.?)/gi, '<strong class="text-yellow-400 font-semibold mt-2 block">⚠️ $1</strong>')
                                                                .replace(/\n/g, '<br />')
                                                        }}
                                                    />
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-[200px] text-gray-500 text-sm">
                                    Select a stock above to view technical indicators
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
            {/* ═══════════════════ END TABBED SECTION ═══════════════════ */}

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