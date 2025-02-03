const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const playerSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Username is required'],
        unique: true,
        trim: true
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: 6,
        select: false
    },
    agent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Agent',
        required: true
    },
    balance: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['online', 'offline', 'blocked'],
        default: 'offline'
    },
    lastLogin: {
        type: Date
    },
    transactions: [{
        type: {
            type: String,
            enum: ['credit', 'debit'],
            required: true
        },
        amount: {
            type: Number,
            required: true
        },
        description: String,
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    gameStats: {
        totalGamesPlayed: {
            type: Number,
            default: 0
        },
        totalWins: {
            type: Number,
            default: 0
        },
        totalLosses: {
            type: Number,
            default: 0
        },
        winRate: {
            type: Number,
            default: 0
        }
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Hash password before saving
playerSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Method to check password
playerSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Calculate win rate before saving
playerSchema.pre('save', function(next) {
    if (this.gameStats.totalGamesPlayed > 0) {
        this.gameStats.winRate = (this.gameStats.totalWins / this.gameStats.totalGamesPlayed) * 100;
    }
    next();
});

const Player = mongoose.model('Player', playerSchema);

module.exports = Player;
