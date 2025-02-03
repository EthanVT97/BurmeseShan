class NotificationService {
    constructor() {
        this.notifications = [];
        this.unreadCount = 0;
        this.notificationBadge = document.querySelector('.notification-badge');
        this.notificationList = document.querySelector('.notification-list');
        this.notificationListPage = document.querySelector('.notification-list-page');
        this.isNotificationPage = !!this.notificationListPage;
        
        this.initialize();
    }

    async initialize() {
        await this.fetchNotifications();
        this.setupEventListeners();
        this.startPolling();
    }

    async fetchNotifications() {
        try {
            const response = await fetch('/api/notifications');
            if (!response.ok) throw new Error('Failed to fetch notifications');
            
            this.notifications = await response.json();
            this.updateUnreadCount();
            this.renderNotifications();
        } catch (error) {
            console.error('Error fetching notifications:', error);
        }
    }

    updateUnreadCount() {
        this.unreadCount = this.notifications.filter(n => !n.read).length;
        if (this.notificationBadge) {
            this.notificationBadge.textContent = this.unreadCount;
            this.notificationBadge.style.display = this.unreadCount > 0 ? 'block' : 'none';
        }
    }

    renderNotifications() {
        const notificationsHtml = this.notifications.length === 0 
            ? '<div class="text-center p-3">No notifications</div>'
            : this.notifications.map(notification => this.createNotificationElement(notification)).join('');

        // Update dropdown if it exists
        if (this.notificationList) {
            this.notificationList.innerHTML = notificationsHtml;
        }

        // Update page view if it exists
        if (this.notificationListPage) {
            this.notificationListPage.innerHTML = notificationsHtml;
        }
    }

    createNotificationElement(notification) {
        const timeAgo = this.getTimeAgo(notification.createdAt);
        const typeClass = this.getTypeClass(notification.type);
        
        return `
            <div class="notification-item ${notification.read ? 'read' : 'unread'}" data-id="${notification._id}">
                <div class="notification-content">
                    <div class="notification-header">
                        <span class="notification-title ${typeClass}">${notification.title}</span>
                        <small class="notification-time">${timeAgo}</small>
                    </div>
                    <div class="notification-message">${notification.message}</div>
                </div>
                <div class="notification-actions">
                    ${!notification.read ? 
                        `<button class="btn btn-sm btn-primary mark-read-btn">Mark as Read</button>` : 
                        ''}
                    <button class="btn btn-sm btn-danger delete-btn">Delete</button>
                </div>
            </div>
        `;
    }

    getTypeClass(type) {
        const typeClasses = {
            info: 'text-info',
            success: 'text-success',
            warning: 'text-warning',
            error: 'text-danger'
        };
        return typeClasses[type] || typeClasses.info;
    }

    getTimeAgo(date) {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000);
        
        const intervals = {
            year: 31536000,
            month: 2592000,
            week: 604800,
            day: 86400,
            hour: 3600,
            minute: 60
        };

        for (const [unit, secondsInUnit] of Object.entries(intervals)) {
            const interval = Math.floor(seconds / secondsInUnit);
            if (interval >= 1) {
                return interval === 1 ? `1 ${unit} ago` : `${interval} ${unit}s ago`;
            }
        }
        
        return 'Just now';
    }

    setupEventListeners() {
        // Handle notification list events (both dropdown and page)
        const lists = [this.notificationList, this.notificationListPage].filter(Boolean);
        
        lists.forEach(list => {
            if (!list) return;

            list.addEventListener('click', async (e) => {
                const notificationItem = e.target.closest('.notification-item');
                if (!notificationItem) return;

                const notificationId = notificationItem.dataset.id;

                if (e.target.classList.contains('mark-read-btn')) {
                    await this.markAsRead(notificationId);
                } else if (e.target.classList.contains('delete-btn')) {
                    await this.deleteNotification(notificationId);
                }
            });
        });

        // Add mark all as read button listener
        const markAllReadBtns = document.querySelectorAll('.mark-all-read-btn');
        markAllReadBtns.forEach(btn => {
            if (btn) {
                btn.addEventListener('click', () => this.markAllAsRead());
            }
        });
    }

    async markAsRead(notificationId) {
        try {
            const response = await fetch(`/api/notifications/read/${notificationId}`, {
                method: 'PUT'
            });
            if (!response.ok) throw new Error('Failed to mark notification as read');
            
            await this.fetchNotifications();
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    }

    async markAllAsRead() {
        try {
            const response = await fetch('/api/notifications/read-all', {
                method: 'PUT'
            });
            if (!response.ok) throw new Error('Failed to mark all notifications as read');
            
            await this.fetchNotifications();
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
        }
    }

    async deleteNotification(notificationId) {
        try {
            const response = await fetch(`/api/notifications/${notificationId}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error('Failed to delete notification');
            
            await this.fetchNotifications();
        } catch (error) {
            console.error('Error deleting notification:', error);
        }
    }

    startPolling() {
        // Poll for new notifications every minute
        setInterval(() => this.fetchNotifications(), 60000);
    }
}

// Initialize the notification service when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.notificationService = new NotificationService();
});
