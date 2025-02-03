// Chat functionality
class ChatManager {
    constructor(userId, userName, isAdmin = false) {
        this.userId = userId;
        this.userName = userName;
        this.isAdmin = isAdmin;
        this.messagesContainer = document.getElementById('messagesContainer');
        this.messageInput = document.getElementById('messageInput');
        this.unreadCount = 0;
        this.chatBadge = document.querySelector('.chat-badge');
        
        // Initialize socket with proper authentication
        this.socket = io({
            auth: {
                userId,
                userName,
                isAdmin,
                isGuest: userId.startsWith('guest_')
            }
        });

        this.setupEventListeners();
        console.log('ChatManager initialized:', { userId, userName, isAdmin });
    }

    setupEventListeners() {
        // Connection events
        this.socket.on('connect', () => {
            console.log('Connected to chat server');
            this.addSystemMessage('Connected successfully! You can start chatting.');
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from chat server');
            this.addSystemMessage('Connection lost. Trying to reconnect...');
        });

        this.socket.on('error', (error) => {
            console.error('Chat error:', error);
            this.addSystemMessage('Error: ' + (error.message || 'Failed to send message'));
        });

        // Message events
        this.socket.on('new_message', (data) => {
            console.log('Received message:', data);
            this.handleNewMessage(data);
            
            // Increment unread count if chat is not active
            if (!document.getElementById('chatInterface').classList.contains('active')) {
                this.incrementUnreadCount();
            }
        });

        // Focus handling for message input
        this.messageInput.addEventListener('focus', () => {
            this.resetUnreadCount();
        });

        // Handle typing status
        let typingTimeout;
        this.messageInput.addEventListener('input', () => {
            if (!typingTimeout) {
                this.socket.emit('typing', { recipientId: 'admin', isTyping: true });
            }
            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => {
                this.socket.emit('typing', { recipientId: 'admin', isTyping: false });
                typingTimeout = null;
            }, 1000);
        });
    }

    addSystemMessage(content) {
        this.handleNewMessage({
            content,
            senderType: 'system',
            timestamp: new Date()
        });
    }

    handleNewMessage(data) {
        if (!this.messagesContainer) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${data.senderType === 'system' ? 'system' : 
                                      (data.sender === this.userId ? 'user' : 'admin')}`;
        
        // Message content
        const contentSpan = document.createElement('span');
        contentSpan.className = 'message-content';
        contentSpan.textContent = data.content || data.message;
        messageDiv.appendChild(contentSpan);
        
        // Timestamp
        const timestamp = document.createElement('small');
        timestamp.className = 'message-time';
        timestamp.textContent = new Date(data.timestamp).toLocaleTimeString();
        messageDiv.appendChild(document.createElement('br'));
        messageDiv.appendChild(timestamp);
        
        this.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    sendMessage(content) {
        if (!content || !content.trim()) {
            console.log('Empty message, not sending');
            return;
        }

        console.log('Sending message:', content);
        
        // Emit the message event
        this.socket.emit('send_message', {
            recipientId: 'admin',
            content: content.trim()
        });

        // Clear input
        if (this.messageInput) {
            this.messageInput.value = '';
            this.messageInput.focus();
        }
    }

    incrementUnreadCount() {
        this.unreadCount++;
        if (this.chatBadge) {
            this.chatBadge.textContent = this.unreadCount;
            this.chatBadge.classList.remove('d-none');
        }
    }

    resetUnreadCount() {
        this.unreadCount = 0;
        if (this.chatBadge) {
            this.chatBadge.classList.add('d-none');
        }
    }
}

// Initialize chat when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing chat...');
    
    const chatButton = document.getElementById('chatButton');
    const chatInterface = document.getElementById('chatInterface');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendMessage');
    const guestNameModal = new bootstrap.Modal(document.getElementById('guestNameModal'));
    const closeChat = document.querySelector('.close-chat');
    
    let chatManager = null;

    // Initialize chat with guest name
    function initChat(guestName = null) {
        const userId = window.currentUser.id;
        const userName = guestName || window.currentUser.name;
        
        if (!userName) {
            guestNameModal.show();
            return;
        }

        chatManager = new ChatManager(userId, userName);
        chatInterface.classList.add('active');
        messageInput.disabled = false;
        sendButton.disabled = false;
        messageInput.focus();
    }

    // Chat button click handler
    chatButton.addEventListener('click', function() {
        console.log('Chat button clicked');
        if (!chatManager) {
            if (window.currentUser.name) {
                initChat();
            } else {
                guestNameModal.show();
            }
        } else {
            chatInterface.classList.toggle('active');
            if (chatInterface.classList.contains('active')) {
                messageInput.focus();
                chatManager.resetUnreadCount();
            }
        }
    });

    // Close chat handler
    closeChat.addEventListener('click', function() {
        chatInterface.classList.remove('active');
    });

    // Send message handlers
    function sendMessage() {
        if (!chatManager) return;
        
        const content = messageInput.value.trim();
        if (content) {
            chatManager.sendMessage(content);
        }
    }

    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            sendMessage();
        }
    });

    // Guest name modal handler
    document.getElementById('startChatBtn').addEventListener('click', function() {
        const guestNameInput = document.getElementById('guestNameInput');
        const guestName = guestNameInput.value.trim();
        
        if (guestName) {
            initChat(guestName);
            guestNameModal.hide();
            guestNameInput.value = '';
        }
    });

    // Handle window focus
    window.addEventListener('focus', function() {
        if (chatManager && chatInterface.classList.contains('active')) {
            chatManager.resetUnreadCount();
        }
    });
});
