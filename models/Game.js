const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    imageUrl: {
        type: String,
        trim: true,
        default: '/images/games/default-game.svg'
    },
    active: {
        type: Boolean,
        default: true
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

// Update the updatedAt timestamp before saving
gameSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Virtual for getting the full image URL
gameSchema.virtual('imageUrlWithDefault').get(function() {
    return this.imageUrl || '/images/games/default-game.svg';
});

module.exports = mongoose.model('Game', gameSchema);
