import { useState } from 'react';
import { BellIcon } from '@heroicons/react/24/outline';

export default function NotificationsPage() {
    const [notifications] = useState([]);

    return (
        <div>
            <h1 className="text-2xl font-bold text-white mb-8">Notifications & Alerts</h1>

            {notifications.length === 0 ? (
                <div className="text-center py-20 bg-gray-800 rounded-xl border border-gray-700">
                    <BellIcon className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-white mb-2">No Notifications Yet</h2>
                    <p className="text-gray-400 mb-2">Alerts will appear here when:</p>
                    <ul className="text-gray-400 text-sm space-y-1">
                        <li>• Portfolio volatility exceeds your threshold</li>
                        <li>• Value at Risk (VaR) reaches critical levels</li>
                        <li>• A stock drops more than 5% in a day</li>
                        <li>• Risk metrics change significantly</li>
                    </ul>
                    <p className="text-gray-500 text-sm mt-6">Start the Risk Engine service to enable real-time monitoring.</p>
                </div>
            ) : null}
        </div>
    );
}