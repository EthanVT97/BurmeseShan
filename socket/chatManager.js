const Chat = require('../models/Chat');
const User = require('../models/User');
const DefaultMessage = require('../models/DefaultMessage');
const mongoose = require('mongoose'); // Add this line

class ChatManager {
    constructor(io, notificationService) {
        this.io = io;
        this.activeUsers = new Map();
        this.notificationService = notificationService;
        console.log('ChatManager initialized');
        this.setupSocketHandlers();
    }

    async getMessageHistory(userId) {
        try {
            const chat = await Chat.findOne({ userId });
            return chat ? chat.messages : [];
        } catch (error) {
            console.error('Error getting message history:', error);
            return [];
        }
    }

    async saveMessage(message) {
        try {
            const { sender, senderType, content, chatId } = message;
            await Chat.findOneAndUpdate(
                { userId: chatId },
                { 
                    $push: { messages: message },
                    $setOnInsert: { 
                        userId: chatId,
                        userName: message.senderName || 'Guest User',
                        status: 'active'
                    },
                    $set: { lastMessage: new Date() }
                },
                { upsert: true, new: true }
            );
        } catch (error) {
            console.error('Error saving message:', error);
        }
    }

    async setupSocketHandlers() {
        console.log('Setting up socket handlers');
        
        this.io.on('connection', async (socket) => {
            console.log('New socket connection, handshake:', socket.handshake.auth);
            
            const { userId, userName, isAdmin, isGuest } = socket.handshake.auth;
            
            if (!userId || !userName) {
                console.log('Missing user info, disconnecting socket');
                socket.disconnect();
                return;
            }

            console.log(`User connected: ${userName} (${userId})${isGuest ? ' (Guest)' : ''}, isAdmin: ${isAdmin}`);

            // Store user info
            this.activeUsers.set(userId, {
                id: userId,
                name: userName,
                isAdmin,
                isGuest,
                socketId: socket.id,
                lastSeen: new Date()
            });

            // Join user's room
            socket.join(userId);
            console.log(`User ${userId} joined their room`);

            // Join admin room if admin
            if (isAdmin) {
                console.log(`Admin ${userId} joining admin room`);
                socket.join('admins');
                
                // Send active chats to admin
                try {
                    // Get recent chats
                    const recentChats = await Chat.find()
                        .sort({ lastMessage: -1 })
                        .limit(50);
                    
                    // Get active users
                    const activeUsers = Array.from(this.activeUsers.values())
                        .filter(user => !user.isAdmin)
                        .map(user => ({
                            id: user.id,
                            name: user.name,
                            isGuest: user.isGuest,
                            lastSeen: user.lastSeen,
                            hasHistory: recentChats.some(chat => 
                                chat.userId === user.id || 
                                (user.isGuest && chat.userId === `guest_${user.id}`)
                            )
                        }));
                    
                    console.log('Sending active users to admin:', activeUsers);
                    socket.emit('active_users', activeUsers);
                    
                    // Send chat histories
                    for (const chat of recentChats) {
                        socket.emit('chat_history', {
                            userId: chat.userId,
                            userName: chat.userName || 'Guest User',
                            messages: chat.messages.map(msg => ({
                                ...msg.toObject(),
                                isAdmin: msg.senderType === 'admin',
                                timestamp: msg.timestamp
                            }))
                        });
                    }
                } catch (error) {
                    console.error('Error sending chat histories:', error);
                    socket.emit('error', { message: 'Failed to load chat history' });
                }
            }

            // If guest user, send default messages
            if (isGuest) {
                try {
                    const defaultMessages = await DefaultMessage.find({ isActive: true });
                    if (defaultMessages.length > 0) {
                        // Send each default message as a system message
                        for (const msg of defaultMessages) {
                            socket.emit('new_message', {
                                sender: 'system',
                                senderName: 'System',
                                senderType: 'system',
                                content: msg.message,
                                timestamp: new Date(),
                                isSystemMessage: true
                            });
                        }
                    }
                } catch (error) {
                    console.error('Error sending default messages:', error);
                }
            }

            // Handle default message management (admin only)
            if (isAdmin) {
                socket.on('get_default_messages', async () => {
                    try {
                        const messages = await DefaultMessage.find().sort({ createdAt: -1 });
                        socket.emit('default_messages', messages);
                    } catch (error) {
                        console.error('Error getting default messages:', error);
                        socket.emit('error', { message: 'Failed to get default messages' });
                    }
                });

                socket.on('add_default_message', async (data) => {
                    try {
                        // Validate that userId is a valid ObjectId
                        if (!mongoose.Types.ObjectId.isValid(userId)) {
                            throw new Error('Invalid user ID');
                        }

                        const message = new DefaultMessage({
                            message: data.message,
                            createdBy: mongoose.Types.ObjectId(userId)
                        });
                        await message.save();
                        this.io.to('admins').emit('default_message_added', message);
                    } catch (error) {
                        console.error('Error adding default message:', error);
                        socket.emit('error', { message: 'Failed to add default message' });
                    }
                });

                socket.on('toggle_default_message', async (data) => {
                    try {
                        const message = await DefaultMessage.findById(data.messageId);
                        if (message) {
                            message.isActive = !message.isActive;
                            await message.save();
                            this.io.to('admins').emit('default_message_updated', message);
                        }
                    } catch (error) {
                        console.error('Error toggling default message:', error);
                        socket.emit('error', { message: 'Failed to toggle default message' });
                    }
                });

                socket.on('delete_default_message', async (data) => {
                    try {
                        await DefaultMessage.findByIdAndDelete(data.messageId);
                        this.io.to('admins').emit('default_message_deleted', { messageId: data.messageId });
                    } catch (error) {
                        console.error('Error deleting default message:', error);
                        socket.emit('error', { message: 'Failed to delete default message' });
                    }
                });
            }

            // Handle get chat history request
            socket.on('get_chat_history', async (data) => {
                try {
                    console.log('Getting chat history for:', data.userId);
                    const chat = await Chat.findOne({ userId: data.userId });
                    
                    if (chat) {
                        socket.emit('chat_history', {
                            userId: chat.userId,
                            userName: chat.userName || 'Guest User',
                            messages: chat.messages.map(msg => ({
                                ...msg.toObject(),
                                isAdmin: msg.senderType === 'admin',
                                timestamp: msg.timestamp
                            }))
                        });
                    } else {
                        socket.emit('chat_history', {
                            userId: data.userId,
                            userName: 'Guest User',
                            messages: []
                        });
                    }
                } catch (error) {
                    console.error('Error getting chat history:', error);
                    socket.emit('error', { message: 'Failed to get chat history' });
                }
            });

            // Handle messages
            socket.on('send_message', async (data) => {
                console.log('Received message:', { sender: userId, ...data });
                try {
                    const { recipientId, content } = data;
                    
                    // Create message object
                    const message = {
                        sender: userId,
                        senderName: userName,
                        senderType: isAdmin ? 'admin' : 'user',
                        content,
                        timestamp: new Date(),
                        chatId: isAdmin ? recipientId : userId
                    };

                    console.log('Processed message:', message);

                    // For guest users or landing page chat
                    if (isGuest || !recipientId || recipientId === 'admin') {
                        console.log('Broadcasting guest/user message to all admins');
                        // Save message
                        await this.saveMessage(message);
                        
                        // Create notifications for all admins
                        const adminUsers = await User.find({ role: 'admin' });
                        await Promise.all(adminUsers.map(admin => 
                            this.notificationService.createChatNotification(
                                admin._id,
                                message.senderName || 'Guest',
                                message.content,
                                false  // Admin is not a guest
                            )
                        ));
                        
                        // Broadcast to all admin sockets
                        this.io.to('admins').emit('new_message', message);
                        
                        // Send confirmation back to sender
                        socket.emit('new_message', message);
                        return;
                    }

                    // For registered users, save and broadcast
                    await this.saveMessage(message);

                    // Send to recipient
                    const recipientSocketId = this.activeUsers.get(recipientId)?.socketId;
                    if (recipientSocketId) {
                        console.log(`Sending message to recipient ${recipientId}`);
                        this.io.to(recipientSocketId).emit('new_message', message);
                        
                        // Create notification for recipient if they're not currently viewing the chat
                        const recipient = this.activeUsers.get(recipientId);
                        if (!recipient?.currentChatId || recipient.currentChatId !== userId) {
                            await this.notificationService.createChatNotification(
                                recipientId,
                                userName,
                                message.content,
                                recipient?.isGuest || recipientId.startsWith('guest_')
                            );
                        }
                    }

                    // Send to all admins if message is from user
                    if (!isAdmin) {
                        console.log('Broadcasting user message to admins');
                        this.io.to('admins').emit('new_message', message);
                    }

                    // Send confirmation back to sender
                    socket.emit('new_message', message);
                } catch (error) {
                    console.error('Error sending message:', error);
                    socket.emit('error', { message: 'Failed to send message', error: error.message });
                }
            });

            // Handle typing status
            socket.on('typing', (data) => {
                console.log('Typing status:', { userId, ...data });
                const { recipientId, isTyping } = data;
                
                // For guest users, broadcast typing status to all admins
                if (isGuest || !recipientId || recipientId === 'admin') {
                    this.io.to('admins').emit('user_typing', {
                        userId,
                        userName,
                        isTyping
                    });
                    return;
                }

                // For registered users, send to specific recipient
                const recipientSocketId = this.activeUsers.get(recipientId)?.socketId;
                if (recipientSocketId) {
                    this.io.to(recipientSocketId).emit('user_typing', {
                        userId,
                        userName,
                        isTyping
                    });
                }
            });

            // Handle disconnect
            socket.on('disconnect', () => {
                console.log(`User disconnected: ${userName} (${userId})`);
                const user = this.activeUsers.get(userId);
                this.activeUsers.delete(userId);
                
                // Notify admins about user disconnect
                if (!isAdmin && user) {
                    this.io.to('admins').emit('user_disconnected', {
                        id: userId,
                        name: userName
                    });
                }
            });
        });
    }
}

module.exports = ChatManager;
