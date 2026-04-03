import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import portfolioService from '../services/portfolioService';
import { useAuth } from '../context/AuthContext';
import {
    PieChart, Pie, Cell, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { BriefcaseIcon, CurrencyDollarIcon, ChartBarIcon, ScaleIcon } from '@heroicons/react/24/outline';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

export default function DashboardPage() {
    const { user } = useAuth();
    const [portfolios, setPortfolios] = useState([]);
    const [allHoldings, setAllHoldings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            const portfolioData = await portfolioService.getAllPortfolios();
            setPortfolios(portfolioData);

            const holdingsPromises = portfolioData.map(async (p) => {
                try {
                    const holdings = p.holdings || [];
                    return holdings.map((h) => ({ ...h, portfolioName: p.name, portfolioId: p.id }));
                } catch {
                    return [];
                }
            });

            const holdingsArrays = await Promise.all(holdingsPromises);
            const merged = holdingsArrays.flat();
            setAllHoldings(merged);
        } catch (err) {
            setError('Failed to load dashboard data.');
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
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

    // Pie chart data — allocation by stock
    const allocationData = allHoldings.map((h) => ({
        name: h.stockSymbol,
        value: h.quantity * h.avgBuyPrice,
    }));

    // Merge duplicates across portfolios
    const mergedAllocation = allocationData.reduce((acc, item) => {
        const existing = acc.find((a) => a.name === item.name);
        if (existing) {
            existing.value += item.value;
        } else {
            acc.push({ ...item });
        }
        return acc;
    }, []);

    // Bar chart data — investment per portfolio
    const portfolioBarData = portfolios.map((p) => {
        const holdings = p.holdings || [];
        const invested = holdings.reduce((sum, h) => sum + (h.quantity * h.avgBuyPrice), 0);
        return { name: p.name, invested };
    });

    // Top holdings sorted by value
    const topHoldings = [...allHoldings]
        .map((h) => ({ ...h, totalValue: h.quantity * h.avgBuyPrice }))
        .sort((a, b) => b.totalValue - a.totalValue);

    if (totalPortfolios === 0) {
        return (
            <div className="text-center py-20 bg-gray-800 rounded-xl border border-gray-700">
                <BriefcaseIcon className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-white mb-2">Welcome, {user?.firstName}!</h2>
                <p className="text-gray-400 mb-6">Create your first portfolio to see your dashboard come to life.</p>
                <Link
                    to="/portfolios"
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition inline-block"
                >
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
                <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-lg mb-6 text-sm">
                    {error}
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-400 text-sm">Total Invested</p>
                            <p className="text-2xl font-bold text-white mt-1">{formatCurrency(totalInvested)}</p>
                        </div>
                        <div className="bg-blue-600/20 p-3 rounded-lg">
                            <CurrencyDollarIcon className="h-6 w-6 text-blue-400" />
                        </div>
                    </div>
                </div>

                <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-400 text-sm">Portfolios</p>
                            <p className="text-2xl font-bold text-white mt-1">{totalPortfolios}</p>
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
                        </div>
                        <div className="bg-yellow-600/20 p-3 rounded-lg">
                            <ChartBarIcon className="h-6 w-6 text-yellow-400" />
                        </div>
                    </div>
                </div>

                <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-400 text-sm">Unique Stocks</p>
                            <p className="text-2xl font-bold text-white mt-1">{uniqueStocks}</p>
                        </div>
                        <div className="bg-purple-600/20 p-3 rounded-lg">
                            <ScaleIcon className="h-6 w-6 text-purple-400" />
                        </div>
                    </div>
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
                                    <Pie
                                        data={mergedAllocation}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {mergedAllocation.map((_, index) => (
                                            <Cell key={index} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                                        itemStyle={{ color: '#e5e7eb' }}
                                        formatter={(value) => formatCurrency(value)}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="w-[40%] space-y-2">
                                {mergedAllocation.map((item, index) => (
                                    <div key={item.name} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="w-3 h-3 rounded-full"
                                                style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                            ></div>
                                            <span className="text-sm text-gray-300">{item.name}</span>
                                        </div>
                                        <span className="text-sm text-gray-400">
                                            {((item.value / totalInvested) * 100).toFixed(1)}%
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <p className="text-gray-400 text-center py-10">No holdings to display.</p>
                    )}
                </div>

                {/* Investment by Portfolio Bar Chart */}
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
                    <h2 className="text-lg font-semibold text-white mb-4">Investment by Portfolio</h2>
                    {portfolioBarData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={portfolioBarData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                                <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                                    itemStyle={{ color: '#e5e7eb' }}
                                    formatter={(value) => formatCurrency(value)}
                                />
                                <Bar dataKey="invested" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-gray-400 text-center py-10">No data to display.</p>
                    )}
                </div>
            </div>

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
                                <th className="text-right text-sm font-medium text-gray-400 px-6 py-3">Quantity</th>
                                <th className="text-right text-sm font-medium text-gray-400 px-6 py-3">Avg Price</th>
                                <th className="text-right text-sm font-medium text-gray-400 px-6 py-3">Total Value</th>
                                <th className="text-right text-sm font-medium text-gray-400 px-6 py-3">Allocation</th>
                            </tr>
                        </thead>
                        <tbody>
                            {topHoldings.map((holding) => (
                                <tr key={holding.id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition">
                                    <td className="px-6 py-4">
                                        <span className="text-white font-semibold">{holding.stockSymbol}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <Link
                                            to={`/portfolios/${holding.portfolioId}`}
                                            className="text-blue-400 hover:text-blue-300 text-sm"
                                        >
                                            {holding.portfolioName}
                                        </Link>
                                    </td>
                                    <td className="text-right px-6 py-4 text-gray-300">{holding.quantity}</td>
                                    <td className="text-right px-6 py-4 text-gray-300">
                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(holding.avgBuyPrice)}
                                    </td>
                                    <td className="text-right px-6 py-4 text-white font-medium">
                                        {formatCurrency(holding.totalValue)}
                                    </td>
                                    <td className="text-right px-6 py-4">
                                        <div className="flex items-center justify-end gap-2">
                                            <div className="w-16 bg-gray-700 rounded-full h-2">
                                                <div
                                                    className="bg-blue-500 h-2 rounded-full"
                                                    style={{ width: `${(holding.totalValue / totalInvested) * 100}%` }}
                                                ></div>
                                            </div>
                                            <span className="text-gray-400 text-sm w-12 text-right">
                                                {((holding.totalValue / totalInvested) * 100).toFixed(1)}%
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <p className="text-gray-400 text-center py-10">No holdings across any portfolio.</p>
                )}
            </div>
        </div>
    );
}