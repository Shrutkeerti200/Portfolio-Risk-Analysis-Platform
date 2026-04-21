import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import portfolioService from '../services/portfolioService';
import notificationService from '../services/notificationService';
import { PlusIcon, TrashIcon, PencilIcon, XMarkIcon } from '@heroicons/react/24/outline';

export default function SettingsPage() {
    const { user, logout } = useAuth();
    const [portfolios, setPortfolios] = useState([]);
    const [alertRules, setAlertRules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddRule, setShowAddRule] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Edit state
    const [editingRuleId, setEditingRuleId] = useState(null);
    const [editForm, setEditForm] = useState({
        portfolioId: '',
        metricType: 'VOLATILITY',
        thresholdValue: '',
        direction: 'ABOVE',
    });
    const [editSaving, setEditSaving] = useState(false);

    const [newRule, setNewRule] = useState({
        portfolioId: '',
        metricType: 'VOLATILITY',
        thresholdValue: '',
        direction: 'ABOVE',
    });

    const metricOptions = [
        { value: 'VOLATILITY', label: 'Volatility', description: 'Portfolio price fluctuation', example: 'e.g., 0.05 = 5%' },
        { value: 'VAR', label: 'Value at Risk (VaR)', description: 'Maximum expected daily loss', example: 'e.g., 100 = $100' },
        { value: 'SHARPE_RATIO', label: 'Sharpe Ratio', description: 'Risk-adjusted return', example: 'e.g., -5 (alert if below -5)' },
        { value: 'BETA', label: 'Portfolio Beta', description: 'Market sensitivity', example: 'e.g., 1.5 (alert if above 1.5)' },
        { value: 'DAILY_RETURN', label: 'Daily Return', description: 'Daily portfolio return', example: 'e.g., -0.05 (alert if below -5%)' },
    ];

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const portfolioData = await portfolioService.getAllPortfolios();
            setPortfolios(portfolioData);

            if (user?.id) {
                const rules = await notificationService.getAlertRules(user.id);
                setAlertRules(Array.isArray(rules) ? rules : []);
            }
        } catch { }
        setLoading(false);
    };

    const handleCreateRule = async (e) => {
        e.preventDefault();
        setError('');
        setSaving(true);

        if (!newRule.portfolioId || !newRule.thresholdValue) {
            setError('Please fill in all fields.');
            setSaving(false);
            return;
        }

        try {
            const rule = await notificationService.createAlertRule({
                userId: user.id,
                portfolioId: newRule.portfolioId,
                metricType: newRule.metricType,
                thresholdValue: parseFloat(newRule.thresholdValue),
                direction: newRule.direction,
            });
            setAlertRules([...alertRules, rule]);
            setNewRule({ portfolioId: '', metricType: 'VOLATILITY', thresholdValue: '', direction: 'ABOVE' });
            setShowAddRule(false);
            setSuccess('Alert rule created successfully.');
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError('Failed to create alert rule.');
        } finally {
            setSaving(false);
        }
    };

    const startEditing = (rule) => {
        setEditingRuleId(rule.id);
        setEditForm({
            portfolioId: rule.portfolioId,
            metricType: rule.metricType,
            thresholdValue: rule.thresholdValue?.toString() || '',
            direction: rule.direction || 'ABOVE',
        });
        setError('');
    };

    const cancelEditing = () => {
        setEditingRuleId(null);
        setEditForm({ portfolioId: '', metricType: 'VOLATILITY', thresholdValue: '', direction: 'ABOVE' });
    };

    const handleUpdateRule = async (e) => {
        e.preventDefault();
        setError('');
        setEditSaving(true);

        if (!editForm.portfolioId || !editForm.thresholdValue) {
            setError('Please fill in all fields.');
            setEditSaving(false);
            return;
        }

        try {
            const updated = await notificationService.updateAlertRule(editingRuleId, {
                userId: user.id,
                portfolioId: editForm.portfolioId,
                metricType: editForm.metricType,
                thresholdValue: parseFloat(editForm.thresholdValue),
                direction: editForm.direction,
            });
            setAlertRules(alertRules.map(r => r.id === editingRuleId ? updated : r));
            setEditingRuleId(null);
            setSuccess('Alert rule updated successfully.');
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError('Failed to update alert rule. Make sure the notification service supports updates.');
        } finally {
            setEditSaving(false);
        }
    };

    const handleDeleteRule = async (ruleId) => {
        if (!window.confirm('Delete this alert rule?')) return;
        try {
            await notificationService.deleteAlertRule(ruleId);
            setAlertRules(alertRules.filter(r => r.id !== ruleId));
            if (editingRuleId === ruleId) cancelEditing();
            setSuccess('Alert rule deleted.');
            setTimeout(() => setSuccess(''), 3000);
        } catch {
            setError('Failed to delete rule.');
        }
    };

    const getPortfolioName = (portfolioId) => {
        const p = portfolios.find(p => p.id === portfolioId);
        return p?.name || 'Unknown';
    };

    const getMetricLabel = (type) => {
        const m = metricOptions.find(m => m.value === type);
        return m?.label || type;
    };

    const formatThreshold = (type, value) => {
        if (type === 'VOLATILITY' || type === 'BETA') return value?.toFixed(4);
        if (type === 'VAR') return `$${value?.toFixed(2)}`;
        if (type === 'SHARPE_RATIO' || type === 'DAILY_RETURN') return value?.toFixed(2);
        return value;
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
            <h1 className="text-2xl font-bold text-white mb-8">Settings</h1>

            {success && (
                <div className="bg-green-500/10 border border-green-500 text-green-400 px-4 py-3 rounded-lg mb-6 text-sm">{success}</div>
            )}
            {error && (
                <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-lg mb-6 text-sm">{error}</div>
            )}

            {/* Profile Section */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-6">
                <h2 className="text-lg font-semibold text-white mb-4">Profile Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">First Name</label>
                        <p className="text-white bg-gray-700 px-4 py-3 rounded-lg">{user?.firstName || '—'}</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Last Name</label>
                        <p className="text-white bg-gray-700 px-4 py-3 rounded-lg">{user?.lastName || '—'}</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
                        <p className="text-white bg-gray-700 px-4 py-3 rounded-lg">{user?.email || '—'}</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Phone</label>
                        <p className="text-white bg-gray-700 px-4 py-3 rounded-lg">{user?.phone || 'Not provided'}</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Role</label>
                        <p className="text-white bg-gray-700 px-4 py-3 rounded-lg capitalize">{user?.role?.toLowerCase() || '—'}</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Email Verified</label>
                        <p className="bg-gray-700 px-4 py-3 rounded-lg">
                            {user?.emailVerified ? (
                                <span className="text-green-400">✓ Verified</span>
                            ) : (
                                <span className="text-red-400">✗ Not Verified</span>
                            )}
                        </p>
                    </div>
                </div>
            </div>

            {/* Alert Rules Section */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-lg font-semibold text-white">Alert Rules</h2>
                        <p className="text-gray-400 text-sm mt-1">Set custom thresholds for risk metrics. You'll be notified when they're exceeded.</p>
                    </div>
                    <button
                        onClick={() => setShowAddRule(!showAddRule)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm"
                    >
                        <PlusIcon className="h-4 w-4" />
                        New Rule
                    </button>
                </div>

                {showAddRule && (
                    <div className="bg-gray-700/50 rounded-lg p-5 mb-6 border border-gray-600">
                        <h3 className="text-white font-medium mb-4">Create Alert Rule</h3>
                        <form onSubmit={handleCreateRule} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Portfolio *</label>
                                    <select
                                        value={newRule.portfolioId}
                                        onChange={(e) => setNewRule({ ...newRule, portfolioId: e.target.value })}
                                        required
                                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">Select a portfolio</option>
                                        {portfolios.map((p) => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Metric *</label>
                                    <select
                                        value={newRule.metricType}
                                        onChange={(e) => setNewRule({ ...newRule, metricType: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        {metricOptions.map((m) => (
                                            <option key={m.value} value={m.value}>{m.label}</option>
                                        ))}
                                    </select>
                                    <p className="text-gray-500 text-xs mt-1">
                                        {metricOptions.find(m => m.value === newRule.metricType)?.example}
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Threshold Value *</label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={newRule.thresholdValue}
                                        onChange={(e) => setNewRule({ ...newRule, thresholdValue: e.target.value })}
                                        required
                                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Enter threshold value"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Direction *</label>
                                    <select
                                        value={newRule.direction}
                                        onChange={(e) => setNewRule({ ...newRule, direction: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="ABOVE">Alert when ABOVE threshold</option>
                                        <option value="BELOW">Alert when BELOW threshold</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition"
                                >
                                    {saving ? 'Creating...' : 'Create Rule'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowAddRule(false)}
                                    className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {alertRules.length === 0 ? (
                    <div className="text-center py-10">
                        <p className="text-gray-400">No alert rules configured yet.</p>
                        <p className="text-gray-500 text-sm mt-1">Create a rule to get notified when risk metrics change.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {alertRules.map((rule) => (
                            <div key={rule.id}>
                                {editingRuleId === rule.id ? (
                                    /* ---- Inline Edit Form ---- */
                                    <div className="bg-gray-700/50 rounded-lg p-5 border border-blue-500/30">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-white font-medium text-sm">Edit Alert Rule</h3>
                                            <button
                                                onClick={cancelEditing}
                                                className="text-gray-400 hover:text-white transition"
                                            >
                                                <XMarkIcon className="h-5 w-5" />
                                            </button>
                                        </div>
                                        <form onSubmit={handleUpdateRule} className="space-y-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-300 mb-1">Portfolio *</label>
                                                    <select
                                                        value={editForm.portfolioId}
                                                        onChange={(e) => setEditForm({ ...editForm, portfolioId: e.target.value })}
                                                        required
                                                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    >
                                                        <option value="">Select a portfolio</option>
                                                        {portfolios.map((p) => (
                                                            <option key={p.id} value={p.id}>{p.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-300 mb-1">Metric *</label>
                                                    <select
                                                        value={editForm.metricType}
                                                        onChange={(e) => setEditForm({ ...editForm, metricType: e.target.value })}
                                                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    >
                                                        {metricOptions.map((m) => (
                                                            <option key={m.value} value={m.value}>{m.label}</option>
                                                        ))}
                                                    </select>
                                                    <p className="text-gray-500 text-xs mt-1">
                                                        {metricOptions.find(m => m.value === editForm.metricType)?.example}
                                                    </p>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-300 mb-1">Threshold Value *</label>
                                                    <input
                                                        type="number"
                                                        step="any"
                                                        value={editForm.thresholdValue}
                                                        onChange={(e) => setEditForm({ ...editForm, thresholdValue: e.target.value })}
                                                        required
                                                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        placeholder="Enter threshold value"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-300 mb-1">Direction *</label>
                                                    <select
                                                        value={editForm.direction}
                                                        onChange={(e) => setEditForm({ ...editForm, direction: e.target.value })}
                                                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    >
                                                        <option value="ABOVE">Alert when ABOVE threshold</option>
                                                        <option value="BELOW">Alert when BELOW threshold</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="flex gap-3">
                                                <button
                                                    type="submit"
                                                    disabled={editSaving}
                                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition text-sm"
                                                >
                                                    {editSaving ? 'Saving...' : 'Save Changes'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={cancelEditing}
                                                    className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition text-sm"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                ) : (
                                    /* ---- Normal Display ---- */
                                    <div className="flex items-center justify-between bg-gray-700/30 rounded-lg p-4 border border-gray-700">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-1">
                                                <span className="text-white font-medium">{getMetricLabel(rule.metricType)}</span>
                                                <span className={`text-xs px-2 py-0.5 rounded ${rule.direction === 'ABOVE' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                                    {rule.direction === 'ABOVE' ? '▲ Above' : '▼ Below'} {formatThreshold(rule.metricType, rule.thresholdValue)}
                                                </span>
                                                {rule.isActive !== false && (
                                                    <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400">Active</span>
                                                )}
                                            </div>
                                            <p className="text-gray-400 text-sm">
                                                Portfolio: {getPortfolioName(rule.portfolioId)}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 ml-4">
                                            <button
                                                onClick={() => startEditing(rule)}
                                                className="p-2 text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition"
                                                title="Edit rule"
                                            >
                                                <PencilIcon className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteRule(rule.id)}
                                                className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                                                title="Delete rule"
                                            >
                                                <TrashIcon className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Danger Zone */}
            <div className="bg-gray-800 rounded-xl border border-red-900/50 p-6">
                <h2 className="text-lg font-semibold text-red-400 mb-4">Danger Zone</h2>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-white font-medium">Sign Out</p>
                        <p className="text-gray-400 text-sm">Sign out of your account on this device</p>
                    </div>
                    <button
                        onClick={logout}
                        className="px-6 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/50 rounded-lg transition"
                    >
                        Sign Out
                    </button>
                </div>
            </div>
        </div>
    );
}