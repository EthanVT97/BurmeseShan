const mongoose = require('mongoose');

const lobbySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['cash', 'practice'],
        required: true
    },
    entryFee: {
        type: Number,
        required: true
    },
    minPlayers: {
        type: Number,
        default: 2
    },
    maxPlayers: {
        type: Number,
        default: 5
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    },
    currentPlayers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Player'
    }],
    rules: {
        type: Object
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Lobby', lobbySchema);
