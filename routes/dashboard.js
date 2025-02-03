const express = require('express');
const router = express.Router();
const { protect, protectAgent } = require('../middleware/auth');
const Game = require('../models/Game');
const Player = require('../models/Player');
const Transaction = require('../models/Transaction');
const Agent = require('../models/Agent');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Chat = require('../models/Chat'); // Assuming Chat model is defined in this file

// Admin dashboard
router.get('/admin', protect, async (req, res) => {
    try {
        // Fetch all required data
        const [games, players, recentTransactions, agents] = await Promise.all([
            Game.find().sort({ createdAt: -1 }),
            Player.find().sort({ createdAt: -1 }),
            Transaction.find()
                .sort({ createdAt: -1 })
                .limit(10)
                .populate('player')
                .populate('agent'),
            Agent.find().sort({ createdAt: -1 })
        ]);

        // Calculate statistics
        const [
            totalPlayers,
            activePlayers,
            totalGames,
            activeGames,
            totalAgents,
            activeAgents,
            totalRevenue
        ] = await Promise.all([
            Player.countDocuments(),
            Player.countDocuments({ status: 'active' }),
            Game.countDocuments(),
            Game.countDocuments({ active: true }),
            Agent.countDocuments(),
            Agent.countDocuments({ status: 'active' }),
            Transaction.aggregate([
                { $match: { status: 'completed' } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]).then(result => (result[0]?.total || 0))
        ]);

        // Calculate game-specific stats
        const gamesWithStats = await Promise.all(games.map(async game => {
            try {
                const [playerCount, revenue] = await Promise.all([
                    Player.countDocuments({ gameId: game._id }),
                    Transaction.aggregate([
                        { 
                            $match: { 
                                gameId: game._id, 
                                status: 'completed',
                                type: { $in: ['deposit', 'withdrawal'] }
                            } 
                        },
                        { $group: { _id: null, total: { $sum: '$amount' } } }
                    ]).then(result => (result[0]?.total || 0))
                ]);

                return {
                    ...game.toObject(),
                    playerCount,
                    revenue
                };
            } catch (error) {
                console.error(`Error calculating stats for game ${game._id}:`, error);
                return {
                    ...game.toObject(),
                    playerCount: 0,
                    revenue: 0
                };
            }
        }));

        res.render('dashboard/admin', {
            title: 'Admin Dashboard',
            subtitle: 'Overview',
            breadcrumb: 'Dashboard',
            user: req.session.user,
            stats: {
                totalPlayers,
                activePlayers,
                totalGames,
                activeGames,
                totalAgents,
                activeAgents,
                totalRevenue
            },
            games: gamesWithStats,
            recentTransactions
        });
    } catch (error) {
        console.error('Admin Dashboard Error:', error);
        res.status(500).render('error', {
            message: 'Error loading admin dashboard',
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
});

// Admin chat page
router.get('/admin-chat', protect, async (req, res) => {
    try {
        // Get recent chats
        const recentChats = await Chat.find()
            .sort({ updatedAt: -1 })
            .limit(50);

        res.render('dashboard/admin-chat', {
            title: 'Live Chat Support',
            user: req.session.user,
            breadcrumb: 'Live Chat Support',
            chats: recentChats
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Chat dashboard
router.get('/chat', protect, async (req, res) => {
    try {
        // Get user chats
        const chats = await Chat.find()
            .sort({ updatedAt: -1 })
            .limit(50);

        res.render('dashboard/chat', {
            title: 'Live Chat',
            subtitle: 'Chat Support',
            breadcrumb: 'Chat',
            user: req.session.user,
            chats
        });
    } catch (error) {
        console.error('Chat Dashboard Error:', error);
        res.status(500).render('error', {
            message: 'Error loading chat dashboard',
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
});

// Agent dashboard
router.get('/agent', protectAgent, async (req, res) => {
    try {
        // Get agent ID from session
        const agentId = req.session.user.id;
        
        // Fetch agent-specific data
        const [players, recentTransactions] = await Promise.all([
            Player.find({ agentId }).sort({ createdAt: -1 }),
            Transaction.find({ agentId })
                .sort({ createdAt: -1 })
                .limit(10)
                .populate('player')
        ]);

        // Calculate agent-specific statistics
        const [totalPlayers, activePlayers, totalTransactions, totalRevenue] = await Promise.all([
            Player.countDocuments({ agentId }),
            Player.countDocuments({ agentId, status: 'active' }),
            Transaction.countDocuments({ agentId }),
            Transaction.aggregate([
                { $match: { agentId, status: 'completed' } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]).then(result => (result[0]?.total || 0))
        ]);

        res.render('dashboard/agent', {
            title: 'Agent Dashboard',
            user: req.session.user,
            stats: {
                totalPlayers,
                activePlayers,
                totalTransactions,
                totalRevenue
            },
            players,
            recentTransactions
        });
    } catch (error) {
        console.error('Agent Dashboard Error:', error);
        res.status(500).render('error', {
            message: 'Error loading agent dashboard',
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
});

// Notifications page
router.get('/notifications', async (req, res) => {
    try {
        const notifications = await Notification.find({ userId: req.session.user.id })
            .sort({ createdAt: -1 });

        res.render('dashboard/notifications', {
            title: 'Notifications',
            user: req.session.user,
            notifications: notifications,
            breadcrumb: 'Notifications'
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Settings page
router.get('/settings', protect, async (req, res) => {
    try {
        const { theme } = req.query;
        const user = await User.findById(req.user._id);

        // If theme is provided in URL, update user's theme preference
        if (theme && ['light', 'dark', 'system'].includes(theme)) {
            user.theme = theme;
            await user.save();
        }

        res.render('dashboard/settings', {
            title: 'Settings',
            user: user,
            initialTheme: theme || user.theme || 'light'
        });
    } catch (error) {
        console.error('Error loading settings page:', error);
        res.status(500).render('error', {
            message: 'Error loading settings page',
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
});

module.exports = router;
