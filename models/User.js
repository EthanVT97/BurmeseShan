const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true
    },
    firstName: {
        type: String,
        trim: true
    },
    lastName: {
        type: String,
        trim: true
    },
    role: {
        type: String,
        enum: ['admin', 'user'],
        default: 'user'
    },
    profileImage: {
        type: String,
        default: '/images/default-avatar.png'
    },
    twoFactorEnabled: {
        type: Boolean,
        default: false
    },
    twoFactorSecret: String,
    notifications: {
        emailLoginAlert: { type: Boolean, default: true },
        emailTransactionAlert: { type: Boolean, default: true },
        emailSystemUpdates: { type: Boolean, default: true },
        browserLoginAlert: { type: Boolean, default: true },
        browserTransactionAlert: { type: Boolean, default: true }
    },
    theme: {
        type: String,
        enum: ['light', 'dark', 'system'],
        default: 'light'
    },
    fontSize: {
        type: String,
        enum: ['small', 'medium', 'large'],
        default: 'medium'
    },
    timezone: {
        type: String,
        default: 'UTC'
    },
    dateFormat: {
        type: String,
        enum: ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'],
        default: 'MM/DD/YYYY'
    },
    language: {
        type: String,
        enum: ['en', 'my'],
        default: 'en'
    },
    lastLogin: Date,
    status: {
        type: String,
        enum: ['active', 'inactive', 'suspended'],
        default: 'active'
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
    timestamps: true
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) {
        return next();
    }

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw error;
    }
};

// Virtual for full name
userSchema.virtual('fullName').get(function() {
    return [this.firstName, this.lastName].filter(Boolean).join(' ');
});

module.exports = mongoose.model('User', userSchema);
