const express = require('express');
const router = express.Router();
const { protect, protectAgent } = require('../middleware/auth');
const Player = require('../models/Player');
const Game = require('../models/Game');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');

// Landing page
router.get('/', async (req, res) => {
    try {
        // If user is logged in, redirect to appropriate dashboard
        if (req.session.user) {
            if (req.session.user.role === 'admin') {
                return res.redirect('/dashboard/admin');
            } else if (req.session.user.role === 'agent') {
                return res.redirect('/dashboard/agent');
            }
        }

        // Otherwise show landing page
        const games = await Game.find({ active: true }).sort({ createdAt: -1 });
        res.render('landing', {
            title: 'Burmese SHAN',
            games,
            user: null
        });
    } catch (error) {
        console.error('Landing Page Error:', error);
        res.status(500).render('error', {
            message: 'Error loading landing page',
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
});

// Dashboard root - redirect based on role
router.get('/dashboard', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    if (req.session.user.role === 'admin') {
        return res.redirect('/dashboard/admin');
    } else if (req.session.user.role === 'agent') {
        return res.redirect('/dashboard/agent');
    }

    // If no valid role, redirect to home
    res.redirect('/');
});

// Login page
router.get('/login', (req, res) => {
    // Redirect if already logged in
    if (req.session.user) {
        if (req.session.user.role === 'admin') {
            return res.redirect('/dashboard/admin');
        } else if (req.session.user.role === 'agent') {
            return res.redirect('/dashboard/agent');
        }
    }
    const error = req.query.error;
    res.render('login', { error });
});

// Login handler
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        console.log('Login attempt for username:', username);
        
        // Find user
        const user = await User.findOne({ username });
        console.log('User found:', user ? 'Yes' : 'No');
        
        if (!user) {
            console.log('User not found');
            return res.redirect('/login?error=' + encodeURIComponent('Invalid username or password'));
        }
        
        // Check password
        const isMatch = await user.matchPassword(password);
        console.log('Password match:', isMatch ? 'Yes' : 'No');
        
        if (!isMatch) {
            console.log('Password does not match');
            return res.redirect('/login?error=' + encodeURIComponent('Invalid username or password'));
        }
        
        // Set session
        req.session.user = {
            id: user._id,
            username: user.username,
            role: user.role
        };
        console.log('Session set:', req.session.user);
        
        res.redirect('/dashboard');
    } catch (error) {
        console.error('Login error:', error);
        res.redirect('/login?error=' + encodeURIComponent('Server error occurred. Please try again.'));
    }
});

// Admin routes
router.get('/admin/login', (req, res) => {
    if (req.session.user) {
        return res.redirect('/dashboard');
    }
    res.render('admin/login');
});

// Dashboard page
router.get('/dashboard', protect, async (req, res) => {
    try {
        const stats = {
            onlinePlayers: await Player.countDocuments({ status: 'online' }),
            totalPlayers: await Player.countDocuments(),
            recentPlayers: await Player.find().sort({ lastLogin: -1 }).limit(5).lean()
        };
        
        res.render('dashboard/index', { stats, user: req.session.user });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).send('Server error');
    }
});

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// Create initial admin user
router.get('/setup', async (req, res) => {
    try {
        const adminExists = await User.findOne({ role: 'admin' });
        
        if (adminExists) {
            return res.json({ message: 'Admin user already exists' });
        }
        
        const admin = await User.create({
            username: 'admin',
            password: 'admin123',  // This will be hashed automatically
            role: 'admin'
        });
        
        res.json({ message: 'Admin user created successfully', admin });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Agents page
router.get('/agents', protect, (req, res) => {
    res.render('dashboard/agents', {
        title: 'Agents',
        subtitle: 'Agent Management',
        breadcrumb: 'Agents',
        user: req.session.user
    });
});

// Notifications page
router.get('/notifications', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    try {
        const notifications = await Notification.find({ userId: req.session.user.id })
            .sort({ createdAt: -1 });

        res.render('dashboard/notifications', {
            title: 'Notifications',
            subtitle: 'Notification Center',
            user: req.session.user,
            notifications: notifications,
            breadcrumb: 'Notifications'
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Players page
router.get('/players', protect, (req, res) => {
    res.render('dashboard/players', { user: req.session.user });
});

// Games page
router.get('/games', protect, (req, res) => {
    res.render('dashboard/games', {
        user: req.user,
        title: 'Games',
        subtitle: 'Game Management',
        breadcrumb: 'Games'
    });
});

// Transactions page
router.get('/transactions', protect, (req, res) => {
    res.render('dashboard/transactions', { user: req.session.user });
});

// Settings page
router.get('/settings', protect, (req, res) => {
    res.render('dashboard/settings', { user: req.session.user });
});

// Reports page
router.get('/reports', protect, (req, res) => {
    res.render('dashboard/reports', {
        user: req.user,
        title: 'Reports',
        subtitle: 'Analytics & Reports',
        breadcrumb: 'Reports'
    });
});

module.exports = router;
