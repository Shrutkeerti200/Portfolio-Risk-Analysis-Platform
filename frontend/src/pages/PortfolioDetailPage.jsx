import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import portfolioService from '../services/portfolioService';
import riskService from '../services/riskService';
import { PlusIcon, TrashIcon, ArrowLeftIcon, ArrowUpIcon, ArrowDownIcon, ClockIcon, ChevronDownIcon, ChevronUpIcon, ArrowDownTrayIcon, BoltIcon } from '@heroicons/react/24/outline';
import * as XLSX from 'xlsx';

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
    const [newHolding, setNewHolding] = useState({ stockSymbol: '', quantity: '', buyPrice: '', purchaseDate: '' });

    const [txModal, setTxModal] = useState({ show: false, holdingId: null, symbol: '', type: 'BUY', maxQty: 0 });
    const [txForm, setTxForm] = useState({ quantity: '', pricePerUnit: '', executedAt: '' });
    const [txLoading, setTxLoading] = useState(false);

    const [expandedHolding, setExpandedHolding] = useState(null);
    const [holdingTransactions, setHoldingTransactions] = useState({});

    // AI Stock Research state
    const [researchResult, setResearchResult] = useState(null);
    const [researchLoading, setResearchLoading] = useState(false);

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
            if (symbols.length > 0) { const priceData = await riskService.getStockPrices(symbols); setPrices(priceData); }
            const risk = await riskService.getPortfolioRisk(id);
            setRiskData(risk);
        } catch { }
    };

    const handleAddHolding = async (e) => {
        e.preventDefault();
        setAdding(true);
        setError('');
        try {
            const payload = { stockSymbol: newHolding.stockSymbol.toUpperCase(), quantity: parseFloat(newHolding.quantity), buyPrice: parseFloat(newHolding.buyPrice) };
            if (newHolding.purchaseDate) { payload.purchaseDate = new Date(newHolding.purchaseDate).toISOString(); }

            const holding = await portfolioService.addHolding(id, payload);
            const existingIdx = holdings.findIndex(h => h.stockSymbol === holding.stockSymbol);
            if (existingIdx >= 0) { const updated = [...holdings]; updated[existingIdx] = holding; setHoldings(updated); }
            else { setHoldings([...holdings, holding]); }

            setNewHolding({ stockSymbol: '', quantity: '', buyPrice: '', purchaseDate: '' });
            setShowAddForm(false);
            setResearchResult(null);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to add holding.');
        } finally { setAdding(false); }
    };

    const handleTransaction = async (e) => {
        e.preventDefault();
        setTxLoading(true);
        setError('');
        try {
            const payload = { type: txModal.type, quantity: parseFloat(txForm.quantity), pricePerUnit: parseFloat(txForm.pricePerUnit) };
            if (txForm.executedAt) { payload.executedAt = new Date(txForm.executedAt).toISOString(); }

            const response = await fetch(`http://localhost:8081/api/portfolios/holdings/${txModal.holdingId}/transactions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify(payload),
            });

            if (!response.ok) { const err = await response.json(); throw new Error(err.error || 'Transaction failed'); }

            const updatedHolding = await response.json();
            if (parseFloat(updatedHolding.quantity) === 0) { setHoldings(holdings.filter(h => h.id !== txModal.holdingId)); }
            else { setHoldings(holdings.map(h => h.id === txModal.holdingId ? updatedHolding : h)); }

            setTxModal({ show: false, holdingId: null, symbol: '', type: 'BUY', maxQty: 0 });
            setTxForm({ quantity: '', pricePerUnit: '', executedAt: '' });
        } catch (err) { setError(err.message || 'Transaction failed.'); }
        finally { setTxLoading(false); }
    };

    const toggleTransactions = async (holdingId) => {
        if (expandedHolding === holdingId) { setExpandedHolding(null); return; }
        setExpandedHolding(holdingId);
        if (!holdingTransactions[holdingId]) {
            try {
                const response = await fetch(`http://localhost:8081/api/portfolios/holdings/${holdingId}/transactions`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
                if (response.ok) { const data = await response.json(); setHoldingTransactions(prev => ({ ...prev, [holdingId]: data })); }
            } catch { }
        }
    };

    const handleDeleteHolding = async (holdingId) => {
        if (!window.confirm('Remove this holding and all its transactions? This cannot be undone.')) return;
        try { await portfolioService.removeHolding(id, holdingId); setHoldings(holdings.filter((h) => h.id !== holdingId)); }
        catch (err) { setError('Failed to remove holding.'); }
    };

    const exportPortfolioToExcel = async () => {
        const wb = XLSX.utils.book_new();
        const portfolioName = portfolio?.name || 'Portfolio';

        const holdingsData = holdings.map(h => {
            const currentPrice = prices[h.stockSymbol]?.price || h.avgBuyPrice;
            const invested = h.quantity * h.avgBuyPrice; const currentValue = h.quantity * currentPrice;
            const pl = currentValue - invested; const plPercent = invested > 0 ? (pl / invested) * 100 : 0;
            return { 'Symbol': h.stockSymbol, 'Quantity': h.quantity, 'Avg Cost ($)': parseFloat(h.avgBuyPrice.toFixed(2)), 'Current Price ($)': parseFloat(currentPrice.toFixed(2)), 'Invested ($)': parseFloat(invested.toFixed(2)), 'Current Value ($)': parseFloat(currentValue.toFixed(2)), 'P/L ($)': parseFloat(pl.toFixed(2)), 'P/L (%)': parseFloat(plPercent.toFixed(2)) };
        });
        const ws1 = XLSX.utils.json_to_sheet(holdingsData);
        ws1['!cols'] = holdingsData.length > 0 ? Object.keys(holdingsData[0]).map(() => ({ wch: 18 })) : [];
        XLSX.utils.book_append_sheet(wb, ws1, 'Holdings');

        try {
            const response = await fetch(`http://localhost:8081/api/portfolios/${id}/transactions`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
            if (response.ok) {
                const txns = await response.json();
                if (txns.length > 0) {
                    const txnData = txns.map(tx => ({ 'Date': new Date(tx.executedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }), 'Symbol': tx.stockSymbol, 'Type': tx.type, 'Quantity': parseFloat(tx.quantity), 'Price ($)': parseFloat(tx.pricePerUnit), 'Total ($)': parseFloat(tx.totalAmount) }));
                    const ws2 = XLSX.utils.json_to_sheet(txnData); ws2['!cols'] = Object.keys(txnData[0]).map(() => ({ wch: 16 })); XLSX.utils.book_append_sheet(wb, ws2, 'Transactions');
                }
            }
        } catch (err) { console.error('Error fetching transactions for export:', err); }

        const summaryData = [{ 'Portfolio': portfolioName, 'Description': portfolio?.description || '', 'Total Holdings': holdings.length, 'Total Invested ($)': parseFloat(totalInvested.toFixed(2)), 'Current Value ($)': parseFloat(totalCurrentValue.toFixed(2)), 'P/L ($)': parseFloat(totalPL.toFixed(2)), 'P/L (%)': parseFloat(totalPLPercent.toFixed(2)), 'Volatility (%)': riskData ? parseFloat((riskData.volatility * 100).toFixed(2)) : 0, 'Beta': riskData ? parseFloat(riskData.portfolioBeta.toFixed(2)) : 0 }];
        const ws3 = XLSX.utils.json_to_sheet(summaryData); ws3['!cols'] = Object.keys(summaryData[0]).map(() => ({ wch: 20 })); XLSX.utils.book_append_sheet(wb, ws3, 'Summary');

        const date = new Date().toISOString().split('T')[0];
        const safeName = portfolioName.replace(/[^a-zA-Z0-9]/g, '_');
        XLSX.writeFile(wb, `Riskient_${safeName}_${date}.xlsx`);
    };

    const researchStock = async (symbol) => {
        setResearchLoading(true);
        setResearchResult(null);
        try {
            const portfolioContext = holdings.map(h => {
                const cp = prices[h.stockSymbol]?.price || h.avgBuyPrice;
                return `${h.stockSymbol}: ${h.quantity} shares, avg cost $${h.avgBuyPrice}, current $${cp.toFixed(2)}`;
            }).join('\n');

            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:8081/api/ai/research', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
                body: JSON.stringify({ symbol, portfolioContext }),
            });
            const data = await response.json();
            setResearchResult({ symbol, content: data.response || 'No research available.' });
        } catch {
            setResearchResult({ symbol, content: 'Failed to research stock. Please try again.' });
        } finally { setResearchLoading(false); }
    };

    const fmt = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
    const fmtShort = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

    if (loading) { return (<div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div></div>); }

    if (!portfolio) {
        return (<div className="text-center py-20"><p className="text-red-400">Portfolio not found.</p><Link to="/portfolios" className="text-blue-400 hover:text-blue-300 mt-4 inline-block">← Back to Portfolios</Link></div>);
    }

    const totalInvested = holdings.reduce((sum, h) => sum + (h.quantity * h.avgBuyPrice), 0);
    const totalCurrentValue = holdings.reduce((sum, h) => { const price = prices[h.stockSymbol]?.price || h.avgBuyPrice; return sum + (h.quantity * price); }, 0);
    const totalPL = totalCurrentValue - totalInvested;
    const totalPLPercent = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;

    return (
        <div>
            <Link to="/portfolios" className="flex items-center gap-1 text-gray-400 hover:text-white mb-6 transition">
                <ArrowLeftIcon className="h-4 w-4" /> Back to Portfolios
            </Link>

            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white">{portfolio.name}</h1>
                    {portfolio.description && <p className="text-gray-400 mt-1">{portfolio.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={exportPortfolioToExcel} className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition text-sm">
                        <ArrowDownTrayIcon className="h-4 w-4" /> Export
                    </button>
                    <button onClick={() => setShowAddForm(!showAddForm)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition">
                        <PlusIcon className="h-5 w-5" /> Add Stock
                    </button>
                </div>
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
                    <p className="text-2xl font-bold text-white mt-1">{riskData ? `${(riskData.volatility * 100).toFixed(2)}%` : '—'}</p>
                    <p className="text-gray-500 text-xs mt-1">Beta: {riskData ? riskData.portfolioBeta.toFixed(2) : '—'}</p>
                </div>
            </div>

            {error && (<div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-lg mb-6 text-sm">{error}</div>)}

            {/* Add Holding Form */}
            {showAddForm && (
                <div className="bg-gray-800 rounded-xl p-6 mb-6 border border-gray-700">
                    <h2 className="text-lg font-semibold text-white mb-4">Add Stock Holding</h2>
                    <form onSubmit={handleAddHolding} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                                {newHolding.stockSymbol.length >= 1 && (
                                    <button
                                        type="button"
                                        onClick={() => researchStock(newHolding.stockSymbol)}
                                        disabled={researchLoading}
                                        className="flex items-center gap-1.5 mt-2 px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 rounded-lg transition text-xs disabled:opacity-50"
                                    >
                                        <BoltIcon className="h-3.5 w-3.5" />
                                        {researchLoading ? 'Researching...' : `Research ${newHolding.stockSymbol}`}
                                    </button>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Quantity *</label>
                                <input type="number" step="0.01" min="0.01" value={newHolding.quantity} onChange={(e) => setNewHolding({ ...newHolding, quantity: e.target.value })} required className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g., 50" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Buy Price (per share) *</label>
                                <input type="number" step="0.01" min="0.01" value={newHolding.buyPrice} onChange={(e) => setNewHolding({ ...newHolding, buyPrice: e.target.value })} required className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g., 170.50" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Purchase Date</label>
                                <input type="date" value={newHolding.purchaseDate} onChange={(e) => setNewHolding({ ...newHolding, purchaseDate: e.target.value })} className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                <p className="text-gray-500 text-xs mt-1">Optional — defaults to today</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button type="submit" disabled={adding || !newHolding.stockSymbol || !newHolding.quantity || !newHolding.buyPrice} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition">
                                {adding ? 'Adding...' : 'Add Holding'}
                            </button>
                            <button type="button" onClick={() => { setShowAddForm(false); setNewHolding({ stockSymbol: '', quantity: '', buyPrice: '', purchaseDate: '' }); setResearchResult(null); }} className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition">
                                Cancel
                            </button>
                        </div>
                    </form>

                    {/* AI Stock Research Result */}
                    {(researchResult || researchLoading) && (
                        <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-4 mt-4">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <BoltIcon className="h-3.5 w-3.5 text-purple-400" />
                                    <span className="text-purple-400 text-xs font-medium">AI Research{researchResult ? ` — ${researchResult.symbol}` : ''}</span>
                                </div>
                                {researchResult && (
                                    <button onClick={() => setResearchResult(null)} className="text-gray-500 hover:text-gray-300 text-xs">Dismiss</button>
                                )}
                            </div>
                            {researchLoading ? (
                                <div className="flex items-center gap-2 py-2">
                                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-purple-500"></div>
                                    <span className="text-gray-400 text-sm">Researching {newHolding.stockSymbol}...</span>
                                </div>
                            ) : (
                                <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">{researchResult?.content}</p>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Buy/Sell Transaction Modal */}
            {txModal.show && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 w-full max-w-md">
                        <h2 className="text-lg font-semibold text-white mb-1">{txModal.type === 'BUY' ? 'Buy More' : 'Sell'} {txModal.symbol}</h2>
                        <p className="text-gray-400 text-sm mb-4">{txModal.type === 'SELL' ? `You currently hold ${txModal.maxQty} shares` : 'Add more shares to this holding'}</p>
                        <form onSubmit={handleTransaction} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Quantity *</label>
                                <input type="number" step="0.01" min="0.01" max={txModal.type === 'SELL' ? txModal.maxQty : undefined} value={txForm.quantity} onChange={(e) => setTxForm({ ...txForm, quantity: e.target.value })} required className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder={txModal.type === 'SELL' ? `Max ${txModal.maxQty}` : 'e.g., 10'} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">{txModal.type === 'BUY' ? 'Buy' : 'Sell'} Price (per share) *</label>
                                <input type="number" step="0.01" min="0.01" value={txForm.pricePerUnit} onChange={(e) => setTxForm({ ...txForm, pricePerUnit: e.target.value })} required className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g., 175.00" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Transaction Date</label>
                                <input type="date" value={txForm.executedAt} onChange={(e) => setTxForm({ ...txForm, executedAt: e.target.value })} className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                <p className="text-gray-500 text-xs mt-1">Optional — defaults to today</p>
                            </div>
                            {txForm.quantity && txForm.pricePerUnit && (
                                <div className="bg-gray-700/50 rounded-lg p-3">
                                    <p className="text-gray-400 text-sm">Total: <span className="text-white font-medium">{fmt(parseFloat(txForm.quantity) * parseFloat(txForm.pricePerUnit))}</span></p>
                                </div>
                            )}
                            <div className="flex gap-3">
                                <button type="submit" disabled={txLoading || !txForm.quantity || !txForm.pricePerUnit} className={`flex-1 px-4 py-2 rounded-lg text-white font-medium transition disabled:bg-gray-600 disabled:cursor-not-allowed ${txModal.type === 'BUY' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
                                    {txLoading ? 'Processing...' : `${txModal.type === 'BUY' ? 'Buy' : 'Sell'} ${txModal.symbol}`}
                                </button>
                                <button type="button" onClick={() => { setTxModal({ show: false, holdingId: null, symbol: '', type: 'BUY', maxQty: 0 }); setTxForm({ quantity: '', pricePerUnit: '', executedAt: '' }); }} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition">Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Holdings Table */}
            {holdings.length === 0 ? (
                <div className="text-center py-16 bg-gray-800 rounded-xl border border-gray-700">
                    <p className="text-gray-400 mb-4">No holdings yet. Add your first stock to this portfolio.</p>
                    <button onClick={() => setShowAddForm(true)} className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition">Add Your First Stock</button>
                </div>
            ) : (
                <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-x-auto">
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
                                <th className="text-center text-sm font-medium text-gray-400 px-6 py-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {holdings.map((holding) => {
                                const currentPrice = prices[holding.stockSymbol]?.price || null;
                                const invested = holding.quantity * holding.avgBuyPrice;
                                const currentValue = currentPrice ? holding.quantity * currentPrice : null;
                                const pl = currentValue ? currentValue - invested : null;
                                const plPercent = pl !== null && invested > 0 ? (pl / invested) * 100 : null;
                                const isExpanded = expandedHolding === holding.id;

                                return (
                                    <>
                                        <tr key={holding.id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div>
                                                        <span className="text-white font-semibold">{holding.stockSymbol}</span>
                                                        {prices[holding.stockSymbol]?.changePercent != null && (
                                                            <span className={`text-xs ml-2 ${prices[holding.stockSymbol].changePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                                {prices[holding.stockSymbol].changePercent >= 0 ? '▲' : '▼'}{Math.abs(prices[holding.stockSymbol].changePercent).toFixed(2)}%
                                                            </span>
                                                        )}
                                                    </div>
                                                    {holding.transactionCount > 1 && (
                                                        <button onClick={() => toggleTransactions(holding.id)} className="text-gray-500 hover:text-gray-300 transition" title="View transaction history">
                                                            {isExpanded ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="text-right px-6 py-4 text-gray-300">{holding.quantity}</td>
                                            <td className="text-right px-6 py-4 text-gray-300">{fmt(holding.avgBuyPrice)}</td>
                                            <td className="text-right px-6 py-4 text-gray-300">{fmt(invested)}</td>
                                            <td className="text-right px-6 py-4">{currentPrice ? <span className="text-white font-medium">{fmt(currentPrice)}</span> : <span className="text-gray-500">—</span>}</td>
                                            <td className="text-right px-6 py-4">{currentValue ? <span className="text-white font-medium">{fmt(currentValue)}</span> : <span className="text-gray-500">—</span>}</td>
                                            <td className="text-right px-6 py-4">
                                                {pl !== null ? (
                                                    <div>
                                                        <span className={`font-medium ${pl >= 0 ? 'text-green-400' : 'text-red-400'}`}>{pl >= 0 ? '+' : ''}{fmt(pl)}</span>
                                                        <span className={`text-xs block ${pl >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>{pl >= 0 ? '+' : ''}{plPercent.toFixed(1)}%</span>
                                                    </div>
                                                ) : <span className="text-gray-500">—</span>}
                                            </td>
                                            <td className="text-center px-6 py-4">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button onClick={() => { setTxModal({ show: true, holdingId: holding.id, symbol: holding.stockSymbol, type: 'BUY', maxQty: holding.quantity }); setTxForm({ quantity: '', pricePerUnit: '', executedAt: '' }); }} className="p-1.5 rounded-md bg-green-600/20 text-green-400 hover:bg-green-600/40 transition" title="Buy more"><ArrowUpIcon className="h-4 w-4" /></button>
                                                    <button onClick={() => { setTxModal({ show: true, holdingId: holding.id, symbol: holding.stockSymbol, type: 'SELL', maxQty: holding.quantity }); setTxForm({ quantity: '', pricePerUnit: '', executedAt: '' }); }} className="p-1.5 rounded-md bg-red-600/20 text-red-400 hover:bg-red-600/40 transition" title="Sell shares"><ArrowDownIcon className="h-4 w-4" /></button>
                                                    <button onClick={() => handleDeleteHolding(holding.id)} className="p-1.5 rounded-md text-gray-500 hover:text-red-400 hover:bg-red-600/10 transition" title="Delete holding"><TrashIcon className="h-4 w-4" /></button>
                                                </div>
                                            </td>
                                        </tr>

                                        {isExpanded && (
                                            <tr key={`${holding.id}-tx`}>
                                                <td colSpan={8} className="px-6 py-3 bg-gray-900/50">
                                                    <div className="ml-4">
                                                        <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-2 flex items-center gap-1"><ClockIcon className="h-3.5 w-3.5" /> Transaction History</p>
                                                        {holdingTransactions[holding.id] ? (
                                                            <div className="space-y-1.5">
                                                                {holdingTransactions[holding.id].map(tx => (
                                                                    <div key={tx.id} className="flex items-center justify-between text-sm py-1.5 px-3 rounded bg-gray-800/50">
                                                                        <div className="flex items-center gap-3">
                                                                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${tx.type === 'BUY' ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'}`}>{tx.type}</span>
                                                                            <span className="text-gray-300">{tx.quantity} shares @ {fmt(tx.pricePerUnit)}</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-4">
                                                                            <span className="text-gray-400">{fmt(tx.totalAmount)}</span>
                                                                            <span className="text-gray-500 text-xs">{new Date(tx.executedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : <p className="text-gray-500 text-sm">Loading...</p>}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr className="border-t border-gray-600">
                                <td className="px-6 py-4 text-white font-semibold">Total</td>
                                <td></td><td></td>
                                <td className="text-right px-6 py-4 text-gray-300 font-medium">{fmt(totalInvested)}</td>
                                <td></td>
                                <td className="text-right px-6 py-4 text-white font-bold">{fmt(totalCurrentValue)}</td>
                                <td className="text-right px-6 py-4">
                                    {Object.keys(prices).length > 0 && (
                                        <div>
                                            <span className={`font-bold ${totalPL >= 0 ? 'text-green-400' : 'text-red-400'}`}>{totalPL >= 0 ? '+' : ''}{fmt(totalPL)}</span>
                                            <span className={`text-xs block ${totalPL >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>{totalPL >= 0 ? '+' : ''}{totalPLPercent.toFixed(1)}%</span>
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