const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    transactionId: {
        type: String,
        default: () => Math.random().toString(36).substr(2, 9).toUpperCase()
    },
    player: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Player',
        required: true
    },
    agent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Agent'
    },
    game: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Game',
        required: function() {
            return this.type === 'commission';
        }
    },
    type: {
        type: String,
        enum: ['deposit', 'withdrawal', 'commission', 'point_adjustment'],
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'rejected'],
        default: 'pending'
    },
    description: {
        type: String,
        trim: true
    },
    remark: {
        type: String,
        trim: true
    },
    adjustmentType: {
        type: String,
        enum: ['add', 'subtract'],
        required: function() {
            return this.type === 'point_adjustment';
        }
    },
    paymentMethod: {
        type: String,
        trim: true
    },
    paymentDetails: {
        type: String,
        trim: true
    },
    processedBy: {
        type: mongoose.Schema.Types.Mixed,  // Can be either ObjectId or String
        ref: 'User'
    },
    updatedBy: {
        type: String
    },
    notes: {
        type: String,
        trim: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for player info
transactionSchema.virtual('playerInfo', {
    ref: 'Player',
    localField: 'player',
    foreignField: '_id',
    justOne: true
});

// Virtual for agent info
transactionSchema.virtual('agentInfo', {
    ref: 'Agent',
    localField: 'agent',
    foreignField: '_id',
    justOne: true
});

// Virtual for game info
transactionSchema.virtual('gameInfo', {
    ref: 'Game',
    localField: 'game',
    foreignField: '_id',
    justOne: true
});

// Virtual for player name
transactionSchema.virtual('playerName', {
    ref: 'Player',
    localField: 'player',
    foreignField: '_id',
    justOne: true,
    get: function(player) {
        return player ? player.username : 'Unknown';
    }
});

// Virtual for processed by info
transactionSchema.virtual('processedByInfo', {
    ref: 'User',
    localField: 'processedBy',
    foreignField: '_id',
    justOne: true
});

// Update timestamps before saving
transactionSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;
