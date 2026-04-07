import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import portfolioService from '../services/portfolioService';
import riskService from '../services/riskService';
import { PlusIcon, TrashIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';

export default function PortfolioDetailPage() {
    const { id } = useParams();
    const [portfolio, setPortfolio] = useState(null);
    const [holdings, setHoldings] = useState([]);
    const [prices, setPrices] = useState({});
    const [riskData, setRiskData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [adding, setAdding] = useState(false);
    const [newHolding, setNewHolding] = useState({
        stockSymbol: '',
        quantity: '',
        buyPrice: '',
    });

    useEffect(() => {
        fetchPortfolioData();
        const interval = setInterval(fetchLiveData, 30000);
        return () => clearInterval(interval);
    }, [id]);

    const fetchPortfolioData = async () => {
        try {
            const portfolioData = await portfolioService.getPortfolioById(id);
            setPortfolio(portfolioData);
            setHoldings(portfolioData.holdings || []);

            const symbols = (portfolioData.holdings || []).map(h => h.stockSymbol);
            if (symbols.length > 0) {
                const priceData = await riskService.getStockPrices(symbols);
                setPrices(priceData);
            }

            const risk = await riskService.getPortfolioRisk(id);
            setRiskData(risk);
        } catch (err) {
            setError('Failed to load portfolio.');
        } finally {
            setLoading(false);
        }
    };

    const fetchLiveData = async () => {
        try {
            const symbols = holdings.map(h => h.stockSymbol);
            if (symbols.length > 0) {
                const priceData = await riskService.getStockPrices(symbols);
                setPrices(priceData);
            }
            const risk = await riskService.getPortfolioRisk(id);
            setRiskData(risk);
        } catch { }
    };

    const handleAddHolding = async (e) => {
        e.preventDefault();
        setAdding(true);
        setError('');
        try {
            const holding = await portfolioService.addHolding(id, {
                stockSymbol: newHolding.stockSymbol.toUpperCase(),
                quantity: parseFloat(newHolding.quantity),
                buyPrice: parseFloat(newHolding.buyPrice),
            });
            setHoldings([...holdings, holding]);
            setNewHolding({ stockSymbol: '', quantity: '', buyPrice: '' });
            setShowAddForm(false);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to add holding.');
        } finally {
            setAdding(false);
        }
    };

    const handleDeleteHolding = async (holdingId) => {
        if (!window.confirm('Remove this holding?')) return;
        try {
            await portfolioService.removeHolding(id, holdingId);
            setHoldings(holdings.filter((h) => h.id !== holdingId));
        } catch (err) {
            setError('Failed to remove holding.');
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

    if (!portfolio) {
        return (
            <div className="text-center py-20">
                <p className="text-red-400">Portfolio not found.</p>
                <Link to="/portfolios" className="text-blue-400 hover:text-blue-300 mt-4 inline-block">← Back to Portfolios</Link>
            </div>
        );
    }

    const totalInvested = holdings.reduce((sum, h) => sum + (h.quantity * h.avgBuyPrice), 0);
    const totalCurrentValue = holdings.reduce((sum, h) => {
        const price = prices[h.stockSymbol]?.price || h.avgBuyPrice;
        return sum + (h.quantity * price);
    }, 0);
    const totalPL = totalCurrentValue - totalInvested;
    const totalPLPercent = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;

    return (
        <div>
            <Link to="/portfolios" className="flex items-center gap-1 text-gray-400 hover:text-white mb-6 transition">
                <ArrowLeftIcon className="h-4 w-4" />
                Back to Portfolios
            </Link>

            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white">{portfolio.name}</h1>
                    {portfolio.description && <p className="text-gray-400 mt-1">{portfolio.description}</p>}
                </div>
                <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                >
                    <PlusIcon className="h-5 w-5" />
                    Add Stock
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
                    <p className="text-gray-400 text-sm">Total Invested</p>
                    <p className="text-2xl font-bold text-white mt-1">{fmtShort(totalInvested)}</p>
                </div>
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
                    <p className="text-gray-400 text-sm">Current Value</p>
                    <p className="text-2xl font-bold text-white mt-1">{fmtShort(totalCurrentValue)}</p>
                    {Object.keys(prices).length > 0 && (
                        <p className={`text-sm mt-1 ${totalPL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {totalPL >= 0 ? '▲' : '▼'} {fmt(Math.abs(totalPL))} ({totalPLPercent.toFixed(1)}%)
                        </p>
                    )}
                </div>
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
                    <p className="text-gray-400 text-sm">Holdings</p>
                    <p className="text-2xl font-bold text-white mt-1">{holdings.length}</p>
                </div>
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
                    <p className="text-gray-400 text-sm">Volatility</p>
                    <p className="text-2xl font-bold text-white mt-1">
                        {riskData ? `${(riskData.volatility * 100).toFixed(2)}%` : '—'}
                    </p>
                    <p className="text-gray-500 text-xs mt-1">
                        Beta: {riskData ? riskData.portfolioBeta.toFixed(2) : '—'}
                    </p>
                </div>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-lg mb-6 text-sm">{error}</div>
            )}

            {showAddForm && (
                <div className="bg-gray-800 rounded-xl p-6 mb-6 border border-gray-700">
                    <h2 className="text-lg font-semibold text-white mb-4">Add Stock Holding</h2>
                    <form onSubmit={handleAddHolding} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Stock Symbol *</label>
                                <input
                                    type="text"
                                    value={newHolding.stockSymbol}
                                    onChange={(e) => setNewHolding({ ...newHolding, stockSymbol: e.target.value.toUpperCase() })}
                                    required
                                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="e.g., AAPL"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Quantity *</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    value={newHolding.quantity}
                                    onChange={(e) => setNewHolding({ ...newHolding, quantity: e.target.value })}
                                    required
                                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="e.g., 50"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Buy Price (per share) *</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    value={newHolding.buyPrice}
                                    onChange={(e) => setNewHolding({ ...newHolding, buyPrice: e.target.value })}
                                    required
                                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="e.g., 170.50"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                type="submit"
                                disabled={adding || !newHolding.stockSymbol || !newHolding.quantity || !newHolding.buyPrice}
                                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition"
                            >
                                {adding ? 'Adding...' : 'Add Holding'}
                            </button>
                            <button
                                type="button"
                                onClick={() => { setShowAddForm(false); setNewHolding({ stockSymbol: '', quantity: '', buyPrice: '' }); }}
                                className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Holdings Table */}
            {holdings.length === 0 ? (
                <div className="text-center py-16 bg-gray-800 rounded-xl border border-gray-700">
                    <p className="text-gray-400 mb-4">No holdings yet. Add your first stock to this portfolio.</p>
                    <button
                        onClick={() => setShowAddForm(true)}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                    >
                        Add Your First Stock
                    </button>
                </div>
            ) : (
                <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-700">
                                <th className="text-left text-sm font-medium text-gray-400 px-6 py-4">Symbol</th>
                                <th className="text-right text-sm font-medium text-gray-400 px-6 py-4">Qty</th>
                                <th className="text-right text-sm font-medium text-gray-400 px-6 py-4">Avg Cost</th>
                                <th className="text-right text-sm font-medium text-gray-400 px-6 py-4">Invested</th>
                                <th className="text-right text-sm font-medium text-gray-400 px-6 py-4">Current Price</th>
                                <th className="text-right text-sm font-medium text-gray-400 px-6 py-4">Current Value</th>
                                <th className="text-right text-sm font-medium text-gray-400 px-6 py-4">P/L</th>
                                <th className="text-right text-sm font-medium text-gray-400 px-6 py-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {holdings.map((holding) => {
                                const currentPrice = prices[holding.stockSymbol]?.price || null;
                                const invested = holding.quantity * holding.avgBuyPrice;
                                const currentValue = currentPrice ? holding.quantity * currentPrice : null;
                                const pl = currentValue ? currentValue - invested : null;
                                const plPercent = pl !== null && invested > 0 ? (pl / invested) * 100 : null;

                                return (
                                    <tr key={holding.id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition">
                                        <td className="px-6 py-4">
                                            <span className="text-white font-semibold">{holding.stockSymbol}</span>
                                            {prices[holding.stockSymbol]?.changePercent != null && (
                                                <span className={`text-xs ml-2 ${prices[holding.stockSymbol].changePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {prices[holding.stockSymbol].changePercent >= 0 ? '▲' : '▼'}
                                                    {Math.abs(prices[holding.stockSymbol].changePercent).toFixed(2)}%
                                                </span>
                                            )}
                                        </td>
                                        <td className="text-right px-6 py-4 text-gray-300">{holding.quantity}</td>
                                        <td className="text-right px-6 py-4 text-gray-300">{fmt(holding.avgBuyPrice)}</td>
                                        <td className="text-right px-6 py-4 text-gray-300">{fmt(invested)}</td>
                                        <td className="text-right px-6 py-4">
                                            {currentPrice ? (
                                                <span className="text-white font-medium">{fmt(currentPrice)}</span>
                                            ) : (
                                                <span className="text-gray-500">—</span>
                                            )}
                                        </td>
                                        <td className="text-right px-6 py-4">
                                            {currentValue ? (
                                                <span className="text-white font-medium">{fmt(currentValue)}</span>
                                            ) : (
                                                <span className="text-gray-500">—</span>
                                            )}
                                        </td>
                                        <td className="text-right px-6 py-4">
                                            {pl !== null ? (
                                                <div>
                                                    <span className={`font-medium ${pl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                        {pl >= 0 ? '+' : ''}{fmt(pl)}
                                                    </span>
                                                    <span className={`text-xs block ${pl >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>
                                                        {pl >= 0 ? '+' : ''}{plPercent.toFixed(1)}%
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-gray-500">—</span>
                                            )}
                                        </td>
                                        <td className="text-right px-6 py-4">
                                            <button
                                                onClick={() => handleDeleteHolding(holding.id)}
                                                className="text-gray-500 hover:text-red-400 transition"
                                            >
                                                <TrashIcon className="h-5 w-5" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr className="border-t border-gray-600">
                                <td className="px-6 py-4 text-white font-semibold">Total</td>
                                <td></td>
                                <td></td>
                                <td className="text-right px-6 py-4 text-gray-300 font-medium">{fmt(totalInvested)}</td>
                                <td></td>
                                <td className="text-right px-6 py-4 text-white font-bold">{fmt(totalCurrentValue)}</td>
                                <td className="text-right px-6 py-4">
                                    {Object.keys(prices).length > 0 && (
                                        <div>
                                            <span className={`font-bold ${totalPL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {totalPL >= 0 ? '+' : ''}{fmt(totalPL)}
                                            </span>
                                            <span className={`text-xs block ${totalPL >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>
                                                {totalPL >= 0 ? '+' : ''}{totalPLPercent.toFixed(1)}%
                                            </span>
                                        </div>
                                    )}
                                </td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
        </div>
    );
}