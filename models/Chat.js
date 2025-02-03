const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    sender: {
        type: String,
        required: true
    },
    senderName: {
        type: String,
        required: true
    },
    senderType: {
        type: String,
        enum: ['user', 'admin', 'guest'],
        required: true
    },
    content: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

const chatSchema = new mongoose.Schema({
    userId: {
        type: String,  
        required: true,
        index: true
    },
    userName: {
        type: String,
        required: true
    },
    isGuest: {
        type: Boolean,
        default: false
    },
    messages: [messageSchema],
    lastMessage: {
        type: Date,
        default: Date.now
    }
});

// Update lastMessage timestamp when a new message is added
chatSchema.pre('save', function(next) {
    if (this.isModified('messages')) {
        this.lastMessage = Date.now();
    }
    next();
});

module.exports = mongoose.model('Chat', chatSchema);
