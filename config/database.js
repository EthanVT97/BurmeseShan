const mongoose = require('mongoose');

const connectWithRetry = async () => {
    const maxRetries = 5;
    let retryCount = 0;

    const tryConnect = async () => {
        try {
            console.log('Attempting to connect to MongoDB...');
            const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/shan_dashboard';
            console.log('MongoDB URI:', mongoUri);
            
            await mongoose.connect(mongoUri, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
                connectTimeoutMS: 10000,
                keepAlive: true,
                keepAliveInitialDelay: 300000
            });

            console.log(`MongoDB Connected: ${mongoose.connection.host}`);
            
            // Set up connection error handler
            mongoose.connection.on('error', (err) => {
                console.error('MongoDB connection error:', err);
                retryConnection();
            });

            // Set up disconnection handler
            mongoose.connection.on('disconnected', () => {
                console.log('MongoDB disconnected. Attempting to reconnect...');
                retryConnection();
            });

            // Test the connection by counting users
            const User = require('../models/User');
            const userCount = await User.countDocuments();
            console.log(`Number of users in database: ${userCount}`);
            
        } catch (error) {
            console.error('MongoDB connection error:', error);
            await retryConnection();
        }
    };

    const retryConnection = async () => {
        if (retryCount < maxRetries) {
            retryCount++;
            const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Exponential backoff with max 10s
            console.log(`Retrying connection in ${retryDelay}ms... (Attempt ${retryCount} of ${maxRetries})`);
            setTimeout(tryConnect, retryDelay);
        } else {
            console.error('Failed to connect to MongoDB after maximum retry attempts');
            process.exit(1);
        }
    };

    await tryConnect();
};

module.exports = connectWithRetry;
