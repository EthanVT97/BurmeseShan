const Notification = require('../models/Notification');

class NotificationService {
    constructor(io) {
        this.io = io;
    }

    /**
     * Create a new notification
     * @param {Object} data Notification data
     * @param {string} data.userId User ID to send notification to
     * @param {string} data.title Notification title
     * @param {string} data.message Notification message
     * @param {string} data.type Notification type (info, success, warning, error)
     * @param {boolean} data.isGuest Whether the user is a guest
     */
    async createNotification(data) {
        try {
            // Check if it's a guest user
            const isGuest = data.isGuest || 
                          (typeof data.userId === 'string' && data.userId.startsWith('guest_'));
            
            const notification = await Notification.create({
                userId: data.userId.toString(), // Convert ObjectId to string if needed
                title: data.title,
                message: data.message,
                type: data.type || 'info',
                isGuest
            });

            // Emit real-time notification
            this.io.to(data.userId.toString()).emit('new_notification', notification);

            return notification;
        } catch (error) {
            console.error('Error creating notification:', error);
            throw error;
        }
    }

    /**
     * Get unread notifications count for a user
     * @param {string} userId User ID
     */
    async getUnreadCount(userId) {
        try {
            return await Notification.countDocuments({ 
                userId: userId.toString(),
                read: false 
            });
        } catch (error) {
            console.error('Error getting unread count:', error);
            throw error;
        }
    }

    /**
     * Mark a notification as read
     * @param {string} notificationId Notification ID
     * @param {string} userId User ID
     */
    async markAsRead(notificationId, userId) {
        try {
            const notification = await Notification.findOneAndUpdate(
                { 
                    _id: notificationId,
                    userId: userId.toString()
                },
                { read: true },
                { new: true }
            );

            if (notification) {
                this.io.to(userId.toString()).emit('notification_read', notificationId);
            }

            return notification;
        } catch (error) {
            console.error('Error marking notification as read:', error);
            throw error;
        }
    }

    /**
     * Mark all notifications as read for a user
     * @param {string} userId User ID
     */
    async markAllAsRead(userId) {
        try {
            await Notification.updateMany(
                { 
                    userId: userId.toString(),
                    read: false 
                },
                { read: true }
            );

            this.io.to(userId.toString()).emit('all_notifications_read');
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
            throw error;
        }
    }

    /**
     * Delete a notification
     * @param {string} notificationId Notification ID
     * @param {string} userId User ID
     */
    async deleteNotification(notificationId, userId) {
        try {
            const notification = await Notification.findOneAndDelete({
                _id: notificationId,
                userId: userId.toString()
            });

            if (notification) {
                this.io.to(userId.toString()).emit('notification_deleted', notificationId);
            }

            return notification;
        } catch (error) {
            console.error('Error deleting notification:', error);
            throw error;
        }
    }

    /**
     * Create a system notification for admins
     * @param {string} title Notification title
     * @param {string} message Notification message
     * @param {string} type Notification type
     */
    async createSystemNotification(title, message, type = 'info') {
        try {
            // Get all admin users
            const adminUsers = await User.find({ role: 'admin' });
            
            // Create notifications for each admin
            const notifications = await Promise.all(
                adminUsers.map(admin => 
                    this.createNotification({
                        userId: admin._id,
                        title,
                        message,
                        type,
                        isGuest: false
                    })
                )
            );

            return notifications;
        } catch (error) {
            console.error('Error creating system notification:', error);
            throw error;
        }
    }

    /**
     * Create a chat notification
     * @param {string} userId User ID to notify
     * @param {string} senderName Name of the message sender
     * @param {string} message Message content
     * @param {boolean} isGuest Whether the recipient is a guest
     */
    async createChatNotification(userId, senderName, message, isGuest = false) {
        return this.createNotification({
            userId,
            title: `New message from ${senderName}`,
            message: message.length > 50 ? message.substring(0, 47) + '...' : message,
            type: 'info',
            isGuest
        });
    }

    /**
     * Create a transaction notification
     * @param {string} userId User ID to notify
     * @param {Object} transaction Transaction details
     */
    async createTransactionNotification(userId, transaction) {
        return this.createNotification({
            userId,
            title: 'Transaction Update',
            message: `Transaction ${transaction.id} status: ${transaction.status}`,
            type: transaction.status === 'completed' ? 'success' : 
                  transaction.status === 'failed' ? 'error' : 'info'
        });
    }
}

module.exports = NotificationService;
