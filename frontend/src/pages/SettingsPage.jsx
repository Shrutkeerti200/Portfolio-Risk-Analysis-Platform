import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function SettingsPage() {
    const { user, logout } = useAuth();
    const [saved, setSaved] = useState(false);

    const handleSave = () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    return (
        <div>
            <h1 className="text-2xl font-bold text-white mb-8">Settings</h1>

            {saved && (
                <div className="bg-green-500/10 border border-green-500 text-green-400 px-4 py-3 rounded-lg mb-6 text-sm">
                    Settings saved successfully.
                </div>
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

            {/* Alert Preferences */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-6">
                <h2 className="text-lg font-semibold text-white mb-4">Alert Preferences</h2>
                <p className="text-gray-400 text-sm mb-4">Configure when you want to receive risk alerts.</p>
                <div className="space-y-4">
                    <div className="flex items-center justify-between py-3 border-b border-gray-700">
                        <div>
                            <p className="text-white font-medium">Volatility Alerts</p>
                            <p className="text-gray-400 text-sm">Notify when portfolio volatility exceeds threshold</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" defaultChecked className="sr-only peer" />
                            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>
                    <div className="flex items-center justify-between py-3 border-b border-gray-700">
                        <div>
                            <p className="text-white font-medium">Value at Risk (VaR) Alerts</p>
                            <p className="text-gray-400 text-sm">Notify when VaR exceeds your comfort level</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" defaultChecked className="sr-only peer" />
                            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>
                    <div className="flex items-center justify-between py-3 border-b border-gray-700">
                        <div>
                            <p className="text-white font-medium">Price Drop Alerts</p>
                            <p className="text-gray-400 text-sm">Notify when a stock drops more than 5% in a day</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" defaultChecked className="sr-only peer" />
                            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>
                    <div className="flex items-center justify-between py-3">
                        <div>
                            <p className="text-white font-medium">Email Notifications</p>
                            <p className="text-gray-400 text-sm">Receive alerts via email in addition to in-app</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" />
                            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>
                </div>
                <button
                    onClick={handleSave}
                    className="mt-6 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                >
                    Save Preferences
                </button>
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