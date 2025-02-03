const Chat = require('../models/Chat');

module.exports = function(io) {
    // Store active connections
    const activeConnections = new Map();
    const adminConnections = new Map();

    io.on('connection', (socket) => {
        console.log('New chat connection established');
        
        // Handle authentication
        const userId = socket.handshake.auth.userId;
        const userName = socket.handshake.auth.userName;
        const isAdmin = socket.handshake.auth.isAdmin;
        const isGuest = socket.handshake.auth.isGuest;

        if (!userId || !userName) {
            socket.disconnect();
            return;
        }

        if (isAdmin) {
            console.log(`Admin connected: ${userName} (${userId})`);
            adminConnections.set(userId, socket);
            
            // Send list of active users to admin
            const activeUsers = Array.from(activeConnections.entries()).map(([id, s]) => ({
                userId: id,
                userName: s.handshake.auth.userName
            }));
            socket.emit('active_users', activeUsers);
        } else {
            console.log(`User connected: ${userName} (${userId}) - ${isGuest ? 'Guest' : 'User'}`);
            activeConnections.set(userId, socket);
            
            // Notify admins about new user
            adminConnections.forEach(adminSocket => {
                adminSocket.emit('user_connected', {
                    userId,
                    userName,
                    isGuest
                });
            });

            // Send welcome message
            socket.emit('message', {
                message: `Welcome ${userName}! How can we help you today?`,
                sender: 'system',
                timestamp: new Date()
            });
        }

        // Handle disconnect
        socket.on('disconnect', () => {
            if (isAdmin) {
                adminConnections.delete(userId);
                console.log(`Admin disconnected: ${userName}`);
            } else {
                activeConnections.delete(userId);
                console.log(`User disconnected: ${userName}`);
                
                // Notify admins about user disconnect
                adminConnections.forEach(adminSocket => {
                    adminSocket.emit('user_disconnected', userId);
                });
            }
        });

        // Handle messages
        socket.on('message', async (data) => {
            try {
                // Save message to database
                const chat = await Chat.findOneAndUpdate(
                    { userId: data.userId },
                    {
                        $push: { messages: {
                            sender: data.sender,
                            senderType: isGuest ? 'guest' : 'user',
                            content: data.message,
                            timestamp: new Date(),
                            read: false
                        }},
                        $setOnInsert: { userId: data.userId, userName: userName }
                    },
                    { upsert: true, new: true }
                );

                // Broadcast message to admins
                adminConnections.forEach(adminSocket => {
                    adminSocket.emit('message', {
                        ...data,
                        chatId: chat._id
                    });
                });
            } catch (error) {
                console.error('Error saving chat message:', error);
            }
        });

        // Handle admin messages
        socket.on('admin_message', async (data) => {
            try {
                if (!isAdmin) return;

                // Save message to database
                const chat = await Chat.findOneAndUpdate(
                    { userId: data.userId },
                    {
                        $push: { messages: {
                            sender: data.sender,
                            senderType: 'admin',
                            content: data.message,
                            timestamp: new Date(),
                            read: false
                        }}
                    },
                    { new: true }
                );

                // Send message to user if online
                const userSocket = activeConnections.get(data.userId);
                if (userSocket) {
                    userSocket.emit('message', {
                        ...data,
                        chatId: chat._id
                    });
                }
            } catch (error) {
                console.error('Error saving admin chat message:', error);
            }
        });
    });
};
