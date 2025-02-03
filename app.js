const express = require('express');
const session = require('express-session');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const MongoStore = require('connect-mongo');
const multer = require('multer');
const http = require('http');
const socketIO = require('socket.io');
const ChatManager = require('./socket/chatManager');
const NotificationService = require('./services/notificationService');

// Load environment variables
dotenv.config();

// Set Mongoose options
mongoose.set('strictQuery', true);

// MongoDB Connection
const connectDB = require('./config/database');

// Connect to MongoDB with retry logic
connectDB().catch(err => {
    console.error('Initial MongoDB connection failed:', err);
    process.exit(1);
});

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: process.env.NODE_ENV === 'development' ? '*' : undefined,
        methods: ['GET', 'POST']
    }
});

// Initialize services
const notificationService = new NotificationService(io);

// Make notification service available to routes
app.use((req, res, next) => {
    req.notificationService = notificationService;
    next();
});

// Initialize chat manager with notification service
const chatManager = new ChatManager(io, notificationService);

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 
                "https://code.jquery.com",
                "https://cdnjs.cloudflare.com",
                "https://stackpath.bootstrapcdn.com",
                "https://cdn.datatables.net",
                "https://cdn.jsdelivr.net"
            ],
            scriptSrcElem: ["'self'", "'unsafe-inline'", "'unsafe-eval'",
                "https://code.jquery.com",
                "https://cdnjs.cloudflare.com",
                "https://stackpath.bootstrapcdn.com",
                "https://cdn.datatables.net",
                "https://cdn.jsdelivr.net"
            ],
            styleSrc: ["'self'", "'unsafe-inline'",
                "https://stackpath.bootstrapcdn.com",
                "https://cdn.datatables.net",
                "https://cdnjs.cloudflare.com",
                "https://cdn.jsdelivr.net"
            ],
            styleSrcElem: ["'self'", "'unsafe-inline'",
                "https://stackpath.bootstrapcdn.com",
                "https://cdn.datatables.net",
                "https://cdnjs.cloudflare.com",
                "https://cdn.jsdelivr.net"
            ],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "wss:", "ws:"],
            fontSrc: ["'self'", "https:", "data:"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'self'"],
        }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS middleware
app.use(cors({
    origin: ['http://localhost:3000', 'https://cdn.datatables.net'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true
}));

// Request logging
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session management
const sessionConfig = {
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    },
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/shan_dashboard',
        collectionName: 'sessions'
    })
};

app.use(session(sessionConfig));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Global variables middleware
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

// Configure multer for game image uploads
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, 'public/images/games/');
    },
    filename: function(req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: function(req, file, cb) {
        const filetypes = /jpeg|jpg|png|gif/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb('Error: Images only!');
    }
});

// Routes
app.use('/', require('./routes/index'));
app.use('/api/auth', require('./routes/api/auth'));
app.use('/agent', require('./routes/agent'));
app.use('/admin', require('./routes/admin')); 
app.use('/api/notifications', require('./routes/api/notifications'));
app.use('/api/messages', require('./routes/api/defaultMessages'));
app.use('/api/players', require('./routes/api/players'));
app.use('/api/games', require('./routes/api/games'));
app.use('/api/agents', require('./routes/api/agents'));
app.use('/api/transactions', require('./routes/api/transactions'));
app.use('/api/reports', require('./routes/api/reports'));
app.use('/api/settings', require('./routes/api/settings'));
app.use('/dashboard', require('./routes/dashboard')); // Handles /dashboard/admin and /dashboard/agent

// Game Management Routes
app.post('/admin/games', upload.single('gameImage'), async (req, res) => {
    try {
        const game = new Game({
            name: req.body.gameName,
            description: req.body.gameDescription,
            image: req.file.filename,
            active: req.body.gameActive === 'true'
        });
        await game.save();
        res.json({ success: true, game });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/admin/games', async (req, res) => {
    try {
        const games = await Game.find().sort({ createdAt: -1 });
        res.json({ success: true, games });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/admin/games/:id', async (req, res) => {
    try {
        await Game.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 404 handler
app.use((req, res) => {
    res.status(404).render('error', {
        title: 'Error',
        message: 'Page not found',
        error: { status: 404 }
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error', {
        title: 'Error',
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err);
    process.exit(1);
});

module.exports = { app, server, io };
