const NOTIFICATION_API_URL = 'http://localhost:8083/api';

const notificationService = {
    async getNotifications(userId) {
        try {
            const response = await fetch(`${NOTIFICATION_API_URL}/notifications/${userId}`);
            if (!response.ok) return [];
            return await response.json();
        } catch {
            return [];
        }
    },

    async getUnreadCount(userId) {
        try {
            const response = await fetch(`${NOTIFICATION_API_URL}/notifications/${userId}/unread/count`);
            if (!response.ok) return 0;
            const data = await response.json();
            return data.unreadCount || 0;
        } catch {
            return 0;
        }
    },

    async markAsRead(notificationId) {
        try {
            await fetch(`${NOTIFICATION_API_URL}/notifications/${notificationId}/read`, { method: 'PUT' });
        } catch { }
    },

    async markAllAsRead(userId) {
        try {
            await fetch(`${NOTIFICATION_API_URL}/notifications/${userId}/read-all`, { method: 'PUT' });
        } catch { }
    },

    async deleteNotification(notificationId) {
        try {
            await fetch(`${NOTIFICATION_API_URL}/notifications/${notificationId}`, { method: 'DELETE' });
        } catch { }
    },

    async getAlertRules(userId) {
        try {
            const response = await fetch(`${NOTIFICATION_API_URL}/alert/rules/${userId}`);
            if (!response.ok) return [];
            return await response.json();
        } catch {
            return [];
        }
    },

    async createAlertRule(ruleData) {
        try {
            const response = await fetch(`${NOTIFICATION_API_URL}/alerts/rules`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(ruleData),
            });
            if (!response.ok) throw new Error('Failed to create rule');
            return await response.json();
        } catch (err) {
            throw err;
        }
    },

    async updateAlertRule(ruleId, ruleData) {
        try {
            const response = await fetch(`${NOTIFICATION_API_URL}/alerts/rules/${ruleId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(ruleData),
            });
            if (!response.ok) throw new Error('Failed to update rule');
            return await response.json();
        } catch (err) {
            throw err;
        }
    },

    async deleteAlertRule(ruleId) {
        try {
            await fetch(`${NOTIFICATION_API_URL}/alerts/rules/${ruleId}`, { method: 'DELETE' });
        } catch { }
    },
};

export default notificationService;