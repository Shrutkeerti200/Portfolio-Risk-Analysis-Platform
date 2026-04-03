import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import portfolioService from '../services/portfolioService';
import { PlusIcon, TrashIcon, BriefcaseIcon } from '@heroicons/react/24/outline';

export default function PortfoliosPage() {
    const [portfolios, setPortfolios] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newPortfolio, setNewPortfolio] = useState({ name: '', description: '' });
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        fetchPortfolios();
    }, []);

    const fetchPortfolios = async () => {
        try {
            const data = await portfolioService.getAllPortfolios();
            setPortfolios(Array.isArray(data) ? data : []);
        } catch (err) {
            if (err.response?.status !== 404) {
                setError('Failed to load portfolios.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!newPortfolio.name.trim()) return;
        setCreating(true);
        try {
            const created = await portfolioService.createPortfolio(newPortfolio);
            setPortfolios([...portfolios, created]);
            setNewPortfolio({ name: '', description: '' });
            setShowCreateForm(false);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create portfolio.');
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this portfolio and all its holdings?')) return;
        try {
            await portfolioService.deletePortfolio(id);
            setPortfolios(portfolios.filter((p) => p.id !== id));
        } catch (err) {
            setError('Failed to delete portfolio.');
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-2xl font-bold text-white">My Portfolios</h1>
                <button
                    onClick={() => setShowCreateForm(!showCreateForm)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                >
                    <PlusIcon className="h-5 w-5" />
                    New Portfolio
                </button>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-lg mb-6 text-sm">
                    {error}
                </div>
            )}

            {showCreateForm && (
                <div className="bg-gray-800 rounded-xl p-6 mb-6 border border-gray-700">
                    <h2 className="text-lg font-semibold text-white mb-4">Create New Portfolio</h2>
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Portfolio Name *</label>
                            <input
                                type="text"
                                value={newPortfolio.name}
                                onChange={(e) => setNewPortfolio({ ...newPortfolio, name: e.target.value })}
                                required
                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="e.g., Growth Portfolio, Retirement Fund"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                            <input
                                type="text"
                                value={newPortfolio.description}
                                onChange={(e) => setNewPortfolio({ ...newPortfolio, description: e.target.value })}
                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="e.g., Long-term tech-focused growth strategy"
                            />
                        </div>
                        <div className="flex gap-3">
                            <button
                                type="submit"
                                disabled={creating || !newPortfolio.name.trim()}
                                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition"
                            >
                                {creating ? 'Creating...' : 'Create Portfolio'}
                            </button>
                            <button
                                type="button"
                                onClick={() => { setShowCreateForm(false); setNewPortfolio({ name: '', description: '' }); }}
                                className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {portfolios.length === 0 ? (
                <div className="text-center py-20 bg-gray-800 rounded-xl border border-gray-700">
                    <BriefcaseIcon className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-white mb-2">No Portfolios Yet</h2>
                    <p className="text-gray-400 mb-6">Create your first portfolio to start tracking your investments.</p>
                    <button
                        onClick={() => setShowCreateForm(true)}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                    >
                        Create Your First Portfolio
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {portfolios.map((portfolio) => (
                        <div key={portfolio.id} className="bg-gray-800 rounded-xl border border-gray-700 p-6 hover:border-gray-600 transition">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <Link
                                        to={`/portfolios/${portfolio.id}`}
                                        className="text-lg font-semibold text-white hover:text-blue-400 transition"
                                    >
                                        {portfolio.name}
                                    </Link>
                                    {portfolio.description && (
                                        <p className="text-gray-400 text-sm mt-1">{portfolio.description}</p>
                                    )}
                                </div>
                                <button
                                    onClick={() => handleDelete(portfolio.id)}
                                    className="text-gray-500 hover:text-red-400 transition"
                                >
                                    <TrashIcon className="h-5 w-5" />
                                </button>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-400">
                                    {portfolio.holdings?.length || 0} holdings
                                </span>
                                <Link
                                    to={`/portfolios/${portfolio.id}`}
                                    className="text-blue-400 hover:text-blue-300 font-medium"
                                >
                                    View Details →
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}