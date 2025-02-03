class AdminChatManager {
    constructor(userId, userName) {
        this.userId = userId;
        this.userName = userName;
        this.activeChats = new Map();
        this.currentChatUserId = null;
        
        // DOM Elements
        this.usersList = document.getElementById('usersList');
        this.messagesContainer = document.getElementById('messagesContainer');
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendButton');
        this.chatForm = document.getElementById('chatForm');
        this.currentChatUser = document.getElementById('currentChatUser');
        this.userStatus = document.getElementById('userStatus');
        
        // Initialize Socket.IO connection
        this.socket = io({
            auth: {
                userId,
                userName,
                isAdmin: true
            }
        });
        
        this.setupEventListeners();
        console.log('AdminChatManager initialized:', { userId, userName });
    }
    
    setupEventListeners() {
        // Socket events
        this.socket.on('connect', () => {
            console.log('Connected to chat server as admin');
            this.addSystemMessage('Connected to chat server');
        });
        
        this.socket.on('disconnect', () => {
            console.log('Disconnected from chat server');
            this.addSystemMessage('Disconnected from chat server');
        });
        
        this.socket.on('error', (error) => {
            console.error('Chat error:', error);
            this.addSystemMessage('Error: ' + (error.message || 'Unknown error'));
            iziToast.error({
                title: 'Error',
                message: error.message || 'An error occurred',
                position: 'topRight'
            });
        });

        // Handle new messages
        this.socket.on('new_message', (data) => {
            console.log('Message received:', data);
            
            // For guest messages, use the sender as chatId
            const chatId = data.chatId || data.sender;
            
            // Create chat if it doesn't exist
            if (!this.activeChats.has(chatId)) {
                console.log('Creating new chat for:', chatId);
                this.addUserToList({
                    id: chatId,
                    name: data.senderName || 'Guest',
                    isGuest: true
                });
            }
            
            // Store message
            const chat = this.activeChats.get(chatId);
            chat.messages.push(data);
            
            // Update unread count if not current chat
            if (chatId !== this.currentChatUserId) {
                chat.unreadCount = (chat.unreadCount || 0) + 1;
                this.updateUnreadCount(chatId, chat.unreadCount);
            }
            
            // Display message if this is the current chat
            if (chatId === this.currentChatUserId) {
                this.displayMessage(data);
            }
        });
        
        // Handle chat history
        this.socket.on('chat_history', (data) => {
            console.log('Received chat history:', data);
            const { userId, userName, messages } = data;
            
            // Create chat if it doesn't exist
            if (!this.activeChats.has(userId)) {
                this.addUserToList({
                    id: userId,
                    name: userName || 'Guest',
                    isGuest: true
                });
            }
            
            // Store messages
            const chat = this.activeChats.get(userId);
            chat.messages = messages;
            
            // Display messages if this is the current chat
            if (userId === this.currentChatUserId) {
                // Clear messages container
                if (this.messagesContainer) {
                    this.messagesContainer.innerHTML = '';
                }
                
                // Display all messages
                messages.forEach(msg => this.displayMessage(msg));
            }
        });
        
        // Handle user connections
        this.socket.on('user_connected', (user) => {
            console.log('User connected:', user);
            this.addUserToList(user);
            this.addSystemMessage(`${user.name} connected`);
        });
        
        this.socket.on('user_disconnected', (user) => {
            console.log('User disconnected:', user);
            this.updateUserStatus(user.id, false);
            this.addSystemMessage(`${user.name} disconnected`);
        });
        
        this.socket.on('user_typing', (data) => {
            console.log('User typing:', data);
            this.updateTypingStatus(data.userId, data.isTyping);
        });
        
        // Handle active users list
        this.socket.on('active_users', (users) => {
            console.log('Active users received:', users);
            users.forEach(user => this.addUserToList(user));
        });
        
        // Default message events
        this.socket.on('default_message_added', (message) => {
            this.addDefaultMessageToTable(message);
            iziToast.success({
                title: 'Success',
                message: 'Default message added successfully',
                position: 'topRight'
            });
        });

        this.socket.on('default_message_updated', (message) => {
            this.updateDefaultMessageInTable(message);
        });

        this.socket.on('default_message_deleted', (data) => {
            this.removeDefaultMessageFromTable(data.messageId);
        });

        // Default message form
        document.getElementById('saveDefaultMessage')?.addEventListener('click', () => {
            const messageInput = document.getElementById('defaultMessage');
            const message = messageInput.value.trim();
            
            if (message) {
                this.socket.emit('add_default_message', { message });
                messageInput.value = '';
                $('#addDefaultMessageModal').modal('hide');
            } else {
                iziToast.error({
                    title: 'Error',
                    message: 'Please enter a message',
                    position: 'topRight'
                });
            }
        });

        // Load existing default messages
        this.loadDefaultMessages();

        // UI events
        this.chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.sendMessage();
        });
        
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        this.usersList.addEventListener('click', (e) => {
            const userItem = e.target.closest('.list-group-item');
            if (userItem) {
                const userId = userItem.dataset.userId;
                this.switchToChat(userId);
            }
        });
    }
    
    addSystemMessage(content) {
        if (!this.messagesContainer) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message system';
        messageDiv.textContent = content;
        this.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }
    
    displayMessage(data) {
        if (!this.messagesContainer) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${data.sender === this.userId ? 'admin' : 'user'}`;
        
        const contentSpan = document.createElement('span');
        contentSpan.className = 'message-content';
        contentSpan.textContent = data.content;
        messageDiv.appendChild(contentSpan);
        
        const timeSpan = document.createElement('small');
        timeSpan.className = 'message-time';
        timeSpan.textContent = new Date(data.timestamp).toLocaleTimeString();
        messageDiv.appendChild(document.createElement('br'));
        messageDiv.appendChild(timeSpan);
        
        this.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }
    
    scrollToBottom() {
        if (this.messagesContainer) {
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        }
    }
    
    sendMessage() {
        if (!this.currentChatUserId || !this.messageInput) return;
        
        const content = this.messageInput.value.trim();
        if (!content) return;
        
        console.log('Sending message:', { recipientId: this.currentChatUserId, content });
        
        this.socket.emit('send_message', {
            recipientId: this.currentChatUserId,
            content
        });
        
        // Clear input
        this.messageInput.value = '';
        this.messageInput.focus();
    }
    
    switchToChat(userId) {
        console.log('Switching to chat:', userId);
        
        // Update UI
        this.currentChatUserId = userId;
        const chat = this.activeChats.get(userId);
        
        // Clear messages container
        if (this.messagesContainer) {
            this.messagesContainer.innerHTML = '';
        }
        
        // Display chat history
        if (chat && chat.messages) {
            chat.messages.forEach(msg => this.displayMessage(msg));
        }
        
        // Reset unread count
        if (chat) {
            chat.unreadCount = 0;
            this.updateUnreadCount(userId, 0);
        }
        
        // Update current chat user display
        if (this.currentChatUser) {
            const user = this.usersList.querySelector(`[data-user-id="${userId}"]`);
            this.currentChatUser.textContent = user ? user.querySelector('.user-name').textContent : 'Unknown User';
        }
        
        // Enable input
        if (this.messageInput) {
            this.messageInput.disabled = false;
            this.messageInput.focus();
        }
        if (this.sendButton) {
            this.sendButton.disabled = false;
        }
        
        // Update active chat
        const items = this.usersList.querySelectorAll('.list-group-item');
        items.forEach(item => {
            if (item.dataset.userId === userId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }
    
    updateUnreadCount(userId, count) {
        const userItem = this.usersList.querySelector(`[data-user-id="${userId}"]`);
        if (!userItem) return;
        
        const badge = userItem.querySelector('.unread-count');
        if (badge) {
            if (count > 0) {
                badge.textContent = count;
                badge.classList.remove('d-none');
            } else {
                badge.classList.add('d-none');
            }
        }
    }
    
    updateTypingStatus(userId, isTyping) {
        if (userId !== this.currentChatUserId) return;
        
        if (this.userStatus) {
            if (isTyping) {
                this.userStatus.textContent = 'typing...';
                this.userStatus.classList.remove('d-none');
            } else {
                this.userStatus.classList.add('d-none');
            }
        }
    }
    
    addUserToList(user) {
        const existingUser = this.usersList.querySelector(`[data-user-id="${user.id}"]`);
        if (existingUser) {
            this.updateUserStatus(user.id, true);
            return;
        }
        
        const userItem = document.createElement('div');
        userItem.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';
        userItem.dataset.userId = user.id;
        
        const userInfo = document.createElement('div');
        userInfo.className = 'd-flex align-items-center';
        
        const userIcon = document.createElement('i');
        userIcon.className = 'bi bi-person-circle me-2';
        
        const userName = document.createElement('span');
        userName.className = 'user-name';
        userName.textContent = user.name;
        
        const badge = document.createElement('span');
        badge.className = 'badge bg-primary rounded-pill unread-count d-none';
        badge.textContent = '0';
        
        userInfo.appendChild(userIcon);
        userInfo.appendChild(userName);
        userItem.appendChild(userInfo);
        userItem.appendChild(badge);
        
        this.usersList.appendChild(userItem);
        this.updateUserStatus(user.id, true);
        
        // Initialize chat data
        this.activeChats.set(user.id, {
            messages: [],
            unreadCount: 0
        });
    }
    
    updateUserStatus(userId, isOnline) {
        const userItem = this.usersList.querySelector(`[data-user-id="${userId}"]`);
        if (!userItem) return;
        
        if (isOnline) {
            userItem.classList.remove('offline');
        } else {
            userItem.classList.add('offline');
        }
    }

    loadDefaultMessages() {
        this.socket.emit('get_default_messages');
    }
    
    addDefaultMessageToTable(message) {
        const tbody = document.getElementById('defaultMessagesTable');
        if (!tbody) return;
        
        const tr = document.createElement('tr');
        tr.dataset.messageId = message._id;
        
        tr.innerHTML = `
            <td>${message.message}</td>
            <td>
                <div class="custom-control custom-switch">
                    <input type="checkbox" class="custom-control-input" id="status_${message._id}" 
                           ${message.isActive ? 'checked' : ''}>
                    <label class="custom-control-label" for="status_${message._id}">
                        ${message.isActive ? 'Active' : 'Inactive'}
                    </label>
                </div>
            </td>
            <td>${new Date(message.createdAt).toLocaleString()}</td>
            <td>
                <button class="btn btn-danger btn-sm delete-message">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        
        // Add event listeners
        const statusSwitch = tr.querySelector('.custom-control-input');
        statusSwitch.addEventListener('change', () => {
            this.socket.emit('toggle_default_message', { messageId: message._id });
        });
        
        const deleteBtn = tr.querySelector('.delete-message');
        deleteBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to delete this default message?')) {
                this.socket.emit('delete_default_message', { messageId: message._id });
            }
        });
        
        tbody.appendChild(tr);
    }
    
    updateDefaultMessageInTable(message) {
        const tr = document.querySelector(`tr[data-message-id="${message._id}"]`);
        if (!tr) return;
        
        const statusSwitch = tr.querySelector('.custom-control-input');
        const statusLabel = tr.querySelector('.custom-control-label');
        
        statusSwitch.checked = message.isActive;
        statusLabel.textContent = message.isActive ? 'Active' : 'Inactive';
    }
    
    removeDefaultMessageFromTable(messageId) {
        const tr = document.querySelector(`tr[data-message-id="${messageId}"]`);
        if (tr) {
            tr.remove();
        }
    }
}

// Initialize admin chat when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    const userId = document.querySelector('meta[name="current-user"]').content;
    const adminChatManager = new AdminChatManager(userId, 'Admin');
});
