const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const Agent = require('../models/Agent');
const Player = require('../models/Player');
const { protectAgent } = require('../middleware/auth');

// Agent login page
router.get('/login', (req, res) => {
    if (req.session.agent) {
        return res.redirect('/agent/dashboard');
    }
    res.render('agent/login');
});

// Agent login API
router.post('/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Find agent
        const agent = await Agent.findOne({ username }).select('+password');
        if (!agent) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        // Check password
        const isMatch = await agent.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        // Check if agent is active
        if (agent.status !== 'active') {
            return res.status(401).json({
                success: false,
                error: 'Account is not active'
            });
        }

        // Update last login
        agent.lastLogin = new Date();
        await agent.save();

        // Create session
        req.session.agent = {
            id: agent._id,
            username: agent.username,
            role: 'agent'
        };

        res.json({
            success: true,
            data: {
                id: agent._id,
                username: agent.username,
                balance: agent.balance
            }
        });
    } catch (error) {
        console.error('Agent login error:', error);
        res.status(500).json({
            success: false,
            error: 'Error logging in'
        });
    }
});

// Agent logout
router.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Logout error:', err);
        }
        res.redirect('/agent/login');
    });
});

// Agent dashboard
router.get('/dashboard', protectAgent, async (req, res) => {
    try {
        const agent = await Agent.findById(req.session.agent.id);
        if (!agent) {
            return res.redirect('/agent/login');
        }

        // Calculate daily revenue
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayRevenue = agent.transactions
            .filter(t => new Date(t.createdAt) >= today)
            .reduce((sum, t) => sum + (t.type === 'credit' ? t.amount : 0), 0);

        const stats = {
            totalPlayers: await Player.countDocuments({ agent: agent._id }),
            onlinePlayers: await Player.countDocuments({ agent: agent._id, status: 'online' }),
            todayTransactions: agent.transactions.filter(t => 
                new Date(t.createdAt).toDateString() === new Date().toDateString()
            ).length,
            todayRevenue
        };

        res.render('agent/dashboard', { agent, stats });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.redirect('/agent/login');
    }
});

// Get agent's players
router.get('/api/players', protectAgent, async (req, res) => {
    try {
        const players = await Player.find({ agent: req.session.agent.id })
            .select('-password')
            .sort('-createdAt')
            .lean();

        res.json({
            success: true,
            data: players
        });
    } catch (error) {
        console.error('Error fetching players:', error);
        res.status(500).json({
            success: false,
            error: 'Error fetching players'
        });
    }
});

// Create new player
router.post('/api/players', protectAgent, async (req, res) => {
    try {
        const { username, password, balance } = req.body;

        // Validate required fields
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: 'Username and password are required'
            });
        }

        // Check if username exists
        const existingPlayer = await Player.findOne({ username });
        if (existingPlayer) {
            return res.status(400).json({
                success: false,
                error: 'Username already exists'
            });
        }

        // Check agent's balance
        const agent = await Agent.findById(req.session.agent.id);
        if (balance && balance > agent.balance) {
            return res.status(400).json({
                success: false,
                error: 'Insufficient balance'
            });
        }

        // Create player
        const player = await Player.create({
            username,
            password,
            balance: parseFloat(balance) || 0,
            agent: req.session.agent.id,
            status: 'offline'
        });

        // If initial balance > 0, create transactions
        if (balance > 0) {
            // Deduct from agent's balance
            agent.balance -= balance;
            agent.transactions.push({
                type: 'debit',
                amount: balance,
                description: `Initial balance for player ${username}`
            });
            await agent.save();
        }

        res.status(201).json({
            success: true,
            data: {
                _id: player._id,
                username: player.username,
                balance: player.balance,
                status: player.status,
                createdAt: player.createdAt
            }
        });
    } catch (error) {
        console.error('Error creating player:', error);
        res.status(500).json({
            success: false,
            error: 'Error creating player'
        });
    }
});

// Update player balance
router.post('/api/players/:id/balance', protectAgent, async (req, res) => {
    try {
        const { amount, type, description } = req.body;
        const player = await Player.findOne({ 
            _id: req.params.id,
            agent: req.session.agent.id
        });

        if (!player) {
            return res.status(404).json({
                success: false,
                error: 'Player not found'
            });
        }

        const agent = await Agent.findById(req.session.agent.id);
        const parsedAmount = parseFloat(amount);

        // Validate amount
        if (!parsedAmount || parsedAmount <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid amount'
            });
        }

        // Check balances
        if (type === 'credit') {
            if (parsedAmount > agent.balance) {
                return res.status(400).json({
                    success: false,
                    error: 'Insufficient agent balance'
                });
            }
            player.balance += parsedAmount;
            agent.balance -= parsedAmount;
            agent.transactions.push({
                type: 'debit',
                amount: parsedAmount,
                description: `Credit to player ${player.username}: ${description || ''}`
            });
        } else {
            if (parsedAmount > player.balance) {
                return res.status(400).json({
                    success: false,
                    error: 'Insufficient player balance'
                });
            }
            player.balance -= parsedAmount;
            agent.balance += parsedAmount;
            agent.transactions.push({
                type: 'credit',
                amount: parsedAmount,
                description: `Debit from player ${player.username}: ${description || ''}`
            });
        }

        // Save changes
        await Promise.all([
            player.save(),
            agent.save()
        ]);

        res.json({
            success: true,
            data: {
                player: {
                    _id: player._id,
                    username: player.username,
                    balance: player.balance
                },
                agent: {
                    balance: agent.balance
                }
            }
        });
    } catch (error) {
        console.error('Error updating balance:', error);
        res.status(500).json({
            success: false,
            error: 'Error updating balance'
        });
    }
});

// Update player status
router.put('/api/players/:id/status', protectAgent, async (req, res) => {
    try {
        const { status } = req.body;
        const player = await Player.findOne({
            _id: req.params.id,
            agent: req.session.agent.id
        });

        if (!player) {
            return res.status(404).json({
                success: false,
                error: 'Player not found'
            });
        }

        player.status = status;
        await player.save();

        res.json({
            success: true,
            data: {
                _id: player._id,
                username: player.username,
                status: player.status
            }
        });
    } catch (error) {
        console.error('Error updating status:', error);
        res.status(500).json({
            success: false,
            error: 'Error updating status'
        });
    }
});

// Get agent's transactions
router.get('/api/transactions', protectAgent, async (req, res) => {
    try {
        const agent = await Agent.findById(req.session.agent.id)
            .select('transactions')
            .lean();

        res.json({
            success: true,
            data: agent.transactions.sort((a, b) => b.createdAt - a.createdAt)
        });
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({
            success: false,
            error: 'Error fetching transactions'
        });
    }
});

module.exports = router;
