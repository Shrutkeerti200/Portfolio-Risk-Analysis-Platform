import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import portfolioService from '../services/portfolioService';
import riskService from '../services/riskService';
import { useAuth } from '../context/AuthContext';
import {
    PieChart, Pie, Cell, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    LineChart, Line,
} from 'recharts';
import { BriefcaseIcon, CurrencyDollarIcon, ChartBarIcon, ScaleIcon } from '@heroicons/react/24/outline';
import AiAssistant from '../components/dashboard/AiAssistant';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

export default function DashboardPage() {
    const { user } = useAuth();
    const [portfolios, setPortfolios] = useState([]);
    const [allHoldings, setAllHoldings] = useState([]);
    const [riskData, setRiskData] = useState({});
    const [riskHistory, setRiskHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchDashboardData();
        const interval = setInterval(fetchRiskData, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchDashboardData = async () => {
        try {
            const portfolioData = await portfolioService.getAllPortfolios();
            setPortfolios(portfolioData);

            const holdingsArrays = portfolioData.map((p) => {
                const holdings = p.holdings || [];
                return holdings.map((h) => ({ ...h, portfolioName: p.name, portfolioId: p.id }));
            });
            setAllHoldings(holdingsArrays.flat());

            const ids = portfolioData.map((p) => p.id);
            const risks = await riskService.getRiskForAllPortfolios(ids);
            setRiskData(risks);

            if (ids.length > 0) {
                const history = await riskService.getPortfolioRiskHistory(ids[0]);
                setRiskHistory(Array.isArray(history) ? history.slice(0, 20).reverse() : []);
            }
        } catch (err) {
            setError('Failed to load dashboard data.');
        } finally {
            setLoading(false);
        }
    };

    const fetchRiskData = async () => {
        try {
            const ids = portfolios.map((p) => p.id);
            if (ids.length > 0) {
                const risks = await riskService.getRiskForAllPortfolios(ids);
                setRiskData(risks);
            }
        } catch { }
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value);
    };

    const formatCurrencyFull = (value) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(value);
    };

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

    // Calculate total current value from risk data
    const totalCurrentValue = Object.values(riskData).reduce((sum, r) => sum + (r?.totalValue || 0), 0);
    const totalPL = totalCurrentValue > 0 ? totalCurrentValue - totalInvested : 0;
    const totalPLPercent = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;

    // Aggregate risk metrics
    const avgVolatility = Object.values(riskData).filter(r => r).reduce((sum, r, _, arr) => sum + (r.volatility || 0) / arr.length, 0);
    const avgSharpe = Object.values(riskData).filter(r => r).reduce((sum, r, _, arr) => sum + (r.sharpeRatio || 0) / arr.length, 0);
    const totalVaR = Object.values(riskData).filter(r => r).reduce((sum, r) => sum + (r.valueAtRisk || 0), 0);
    const avgBeta = Object.values(riskData).filter(r => r).reduce((sum, r, _, arr) => sum + (r.portfolioBeta || 0) / arr.length, 0);

    const mergedAllocation = allHoldings.reduce((acc, h) => {
        const existing = acc.find((a) => a.name === h.stockSymbol);
        const value = h.quantity * h.avgBuyPrice;
        if (existing) {
            existing.value += value;
        } else {
            acc.push({ name: h.stockSymbol, value });
        }
        return acc;
    }, []);

    const portfolioBarData = portfolios.map((p) => {
        const risk = riskData[p.id];
        const holdings = p.holdings || [];
        const invested = holdings.reduce((sum, h) => sum + (h.quantity * h.avgBuyPrice), 0);
        return {
            name: p.name,
            invested,
            currentValue: risk?.totalValue || invested,
        };
    });

    const topHoldings = [...allHoldings]
        .map((h) => ({ ...h, totalValue: h.quantity * h.avgBuyPrice }))
        .sort((a, b) => b.totalValue - a.totalValue);

    const buildPortfolioContext = () => {
        let context = `Total Portfolios: ${totalPortfolios}\n`;
        context += `Total Invested: $${totalInvested.toFixed(2)}\n`;
        context += `Total Current Value: $${totalCurrentValue.toFixed(2)}\n`;
        context += `Total P/L: $${totalPL.toFixed(2)} (${totalPLPercent.toFixed(1)}%)\n`;
        context += `Total Holdings: ${totalHoldings}\n`;
        context += `Unique Stocks: ${uniqueStocks}\n`;
        context += `Avg Volatility: ${(avgVolatility * 100).toFixed(2)}%\n`;
        context += `Avg Sharpe Ratio: ${avgSharpe.toFixed(2)}\n`;
        context += `Total VaR (95%): $${totalVaR.toFixed(2)}\n`;
        context += `Avg Beta: ${avgBeta.toFixed(2)}\n\n`;
        context += `Portfolios:\n`;
        portfolios.forEach((p) => {
            const h = p.holdings || [];
            const inv = h.reduce((s, x) => s + x.quantity * x.avgBuyPrice, 0);
            const risk = riskData[p.id];
            const cv = risk?.totalValue || inv;
            const pl = cv - inv;
            context += `- ${p.name}: Invested $${inv.toFixed(2)}, Current $${cv.toFixed(2)}, P/L $${pl.toFixed(2)}, Volatility ${((risk?.volatility || 0) * 100).toFixed(2)}%, Beta ${(risk?.portfolioBeta || 0).toFixed(2)}\n`;
        });
        context += `\nAll Holdings:\n`;
        topHoldings.forEach((h) => {
            const pct = ((h.totalValue / totalInvested) * 100).toFixed(1);
            context += `- ${h.stockSymbol} (${h.portfolioName}): ${h.quantity} shares at $${h.avgBuyPrice} avg, total $${h.totalValue.toFixed(2)}, ${pct}% allocation\n`;
        });
        return context;
    };

    if (totalPortfolios === 0) {
        return (
            <div className="text-center py-20 bg-gray-800 rounded-xl border border-gray-700">
                <BriefcaseIcon className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-white mb-2">Welcome, {user?.firstName}!</h2>
                <p className="text-gray-400 mb-6">Create your first portfolio to see your dashboard come to life.</p>
                <Link to="/portfolios" className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition inline-block">
                    Go to Portfolios
                </Link>
            </div>
        );
    }

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-white">Dashboard</h1>
                <p className="text-gray-400 mt-1">Welcome back, {user?.firstName}. Here's your portfolio overview.</p>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-lg mb-6 text-sm">{error}</div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-400 text-sm">Current Value</p>
                            <p className="text-2xl font-bold text-white mt-1">
                                {totalCurrentValue > 0 ? formatCurrency(totalCurrentValue) : formatCurrency(totalInvested)}
                            </p>
                            {totalCurrentValue > 0 && (
                                <p className={`text-sm mt-1 ${totalPL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {totalPL >= 0 ? '▲' : '▼'} {formatCurrencyFull(Math.abs(totalPL))} ({totalPLPercent.toFixed(1)}%)
                                </p>
                            )}
                        </div>
                        <div className="bg-blue-600/20 p-3 rounded-lg">
                            <CurrencyDollarIcon className="h-6 w-6 text-blue-400" />
                        </div>
                    </div>
                </div>

                <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-400 text-sm">Total Invested</p>
                            <p className="text-2xl font-bold text-white mt-1">{formatCurrency(totalInvested)}</p>
                            <p className="text-gray-500 text-sm mt-1">{totalPortfolios} portfolios</p>
                        </div>
                        <div className="bg-green-600/20 p-3 rounded-lg">
                            <BriefcaseIcon className="h-6 w-6 text-green-400" />
                        </div>
                    </div>
                </div>

                <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-400 text-sm">Total Holdings</p>
                            <p className="text-2xl font-bold text-white mt-1">{totalHoldings}</p>
                            <p className="text-gray-500 text-sm mt-1">{uniqueStocks} unique stocks</p>
                        </div>
                        <div className="bg-yellow-600/20 p-3 rounded-lg">
                            <ChartBarIcon className="h-6 w-6 text-yellow-400" />
                        </div>
                    </div>
                </div>

                <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-400 text-sm">Daily VaR (95%)</p>
                            <p className="text-2xl font-bold text-red-400 mt-1">{formatCurrencyFull(totalVaR)}</p>
                            <p className="text-gray-500 text-sm mt-1">Max daily loss</p>
                        </div>
                        <div className="bg-red-600/20 p-3 rounded-lg">
                            <ScaleIcon className="h-6 w-6 text-red-400" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Risk Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                    <p className="text-gray-400 text-xs uppercase tracking-wide">Volatility</p>
                    <p className="text-xl font-bold text-white mt-1">{(avgVolatility * 100).toFixed(2)}%</p>
                    <p className="text-gray-500 text-xs mt-1">Annualized portfolio risk</p>
                </div>
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                    <p className="text-gray-400 text-xs uppercase tracking-wide">Sharpe Ratio</p>
                    <p className={`text-xl font-bold mt-1 ${avgSharpe >= 0 ? 'text-green-400' : 'text-yellow-400'}`}>
                        {avgSharpe.toFixed(2)}
                    </p>
                    <p className="text-gray-500 text-xs mt-1">Risk-adjusted return</p>
                </div>
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                    <p className="text-gray-400 text-xs uppercase tracking-wide">Portfolio Beta</p>
                    <p className="text-xl font-bold text-white mt-1">{avgBeta.toFixed(2)}</p>
                    <p className="text-gray-500 text-xs mt-1">Market sensitivity</p>
                </div>
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                    <p className="text-gray-400 text-xs uppercase tracking-wide">Daily Return</p>
                    <p className={`text-xl font-bold mt-1 ${Object.values(riskData)[0]?.dailyReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {((Object.values(riskData)[0]?.dailyReturn || 0) * 100).toFixed(3)}%
                    </p>
                    <p className="text-gray-500 text-xs mt-1">Latest daily change</p>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Allocation Pie Chart */}
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
                    <h2 className="text-lg font-semibold text-white mb-4">Asset Allocation</h2>
                    {mergedAllocation.length > 0 ? (
                        <div className="flex items-center">
                            <ResponsiveContainer width="60%" height={250}>
                                <PieChart>
                                    <Pie data={mergedAllocation} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" stroke="none">
                                        {mergedAllocation.map((_, i) => (
                                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} itemStyle={{ color: '#e5e7eb' }} formatter={(v) => formatCurrency(v)} />
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

                {/* Portfolio Value Comparison */}
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
                    <h2 className="text-lg font-semibold text-white mb-4">Invested vs Current Value</h2>
                    {portfolioBarData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={portfolioBarData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} itemStyle={{ color: '#e5e7eb' }} formatter={(v) => formatCurrency(v)} />
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

            {/* Risk History Chart */}
            {riskHistory.length > 1 && (
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-8">
                    <h2 className="text-lg font-semibold text-white mb-4">Portfolio Value Over Time</h2>
                    <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={riskHistory.map((r) => ({
                            time: new Date(r.calculatedAt).toLocaleTimeString(),
                            value: r.totalValue,
                            var: r.valueAtRisk,
                        }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="time" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} />
                            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} itemStyle={{ color: '#e5e7eb' }} formatter={(v) => formatCurrencyFull(v)} />
                            <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} name="Portfolio Value" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Holdings Table */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
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
                                <th className="text-right text-sm font-medium text-gray-400 px-6 py-3">Invested</th>
                                <th className="text-right text-sm font-medium text-gray-400 px-6 py-3">Allocation</th>
                            </tr>
                        </thead>
                        <tbody>
                            {topHoldings.map((h) => (
                                <tr key={h.id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition">
                                    <td className="px-6 py-4"><span className="text-white font-semibold">{h.stockSymbol}</span></td>
                                    <td className="px-6 py-4">
                                        <Link to={`/portfolios/${h.portfolioId}`} className="text-blue-400 hover:text-blue-300 text-sm">{h.portfolioName}</Link>
                                    </td>
                                    <td className="text-right px-6 py-4 text-gray-300">{h.quantity}</td>
                                    <td className="text-right px-6 py-4 text-gray-300">{formatCurrencyFull(h.avgBuyPrice)}</td>
                                    <td className="text-right px-6 py-4 text-white font-medium">{formatCurrency(h.totalValue)}</td>
                                    <td className="text-right px-6 py-4">
                                        <div className="flex items-center justify-end gap-2">
                                            <div className="w-16 bg-gray-700 rounded-full h-2">
                                                <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${(h.totalValue / totalInvested) * 100}%` }}></div>
                                            </div>
                                            <span className="text-gray-400 text-sm w-12 text-right">{((h.totalValue / totalInvested) * 100).toFixed(1)}%</span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <p className="text-gray-400 text-center py-10">No holdings.</p>
                )}
            </div>

            <AiAssistant portfolioContext={buildPortfolioContext()} />
        </div>
    );
}