import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import notificationService from '../services/notificationService';
import { BellIcon, TrashIcon, CheckIcon } from '@heroicons/react/24/outline';

export default function NotificationsPage() {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user?.id) {
            fetchNotifications();
            const interval = setInterval(fetchNotifications, 30000);
            return () => clearInterval(interval);
        }
    }, [user]);

    const fetchNotifications = async () => {
        try {
            const data = await notificationService.getNotifications(user.id);
            setNotifications(Array.isArray(data) ? data : []);
        } catch { }
        setLoading(false);
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

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <div>
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white">Notifications & Alerts</h1>
                    {unreadCount > 0 && (
                        <p className="text-gray-400 text-sm mt-1">{unreadCount} unread notification{unreadCount > 1 ? 's' : ''}</p>
                    )}
                </div>
                {notifications.length > 0 && unreadCount > 0 && (
                    <button
                        onClick={handleMarkAllRead}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition text-sm"
                    >
                        <CheckIcon className="h-4 w-4" />
                        Mark all as read
                    </button>
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
                    {notifications.map((notification) => (
                        <div
                            key={notification.id}
                            className={`bg-gray-800 rounded-xl border-l-4 p-4 flex items-start justify-between ${getTypeColor(notification.type)
                                } ${notification.read ? 'opacity-60' : ''}`}
                        >
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${getTypeColor(notification.type)
                                        }`}>
                                        {getTypeLabel(notification.type)}
                                    </span>
                                    {!notification.read && (
                                        <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                    )}
                                    <span className="text-gray-500 text-xs">
                                        {new Date(notification.createdAt + 'Z').toLocaleString()}
                                    </span>
                                </div>
                                <p className="text-white text-sm">{notification.title}</p>
                                <p className="text-gray-400 text-xs mt-1">{notification.message}</p>
                            </div>
                            <div className="flex items-center gap-2 ml-4">
                                {!notification.read && (
                                    <button
                                        onClick={() => handleMarkAsRead(notification.id)}
                                        className="text-gray-500 hover:text-blue-400 transition"
                                        title="Mark as read"
                                    >
                                        <CheckIcon className="h-4 w-4" />
                                    </button>
                                )}
                                <button
                                    onClick={() => handleDelete(notification.id)}
                                    className="text-gray-500 hover:text-red-400 transition"
                                    title="Delete"
                                >
                                    <TrashIcon className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}