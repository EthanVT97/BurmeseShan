const session = require('express-session');
const MongoStore = require('connect-mongo');

const sessionConfig = {
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI || 'mongodb://localhost:27017/shan_dashboard',
        collectionName: 'sessions',
        ttl: 24 * 60 * 60 // Session TTL (1 day)
    }),
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 1 day
    },
    name: 'sessionId' // Change default cookie name for better security
};

// If in production, set additional security options
if (process.env.NODE_ENV === 'production') {
    sessionConfig.cookie.sameSite = 'strict';
}

module.exports = sessionConfig;
