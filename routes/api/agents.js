const express = require('express');
const router = express.Router();
const Agent = require('../../models/Agent');
const { protect, admin } = require('../../middleware/auth');

// Get all agents
router.get('/', protect, async (req, res) => {
    try {
        const agents = await Agent.find()
            .select('-password')
            .sort('-createdAt')
            .lean();

        // Format agent data
        const formattedAgents = agents.map(agent => ({
            _id: agent._id,
            username: agent.username,
            balance: parseFloat(agent.balance || 0),
            status: agent.status || 'inactive',
            lastLogin: agent.lastLogin,
            createdAt: agent.createdAt,
            transactions: agent.transactions || []
        }));

        res.json({
            success: true,
            data: formattedAgents
        });
    } catch (error) {
        console.error('Error fetching agents:', error);
        res.status(500).json({
            success: false,
            error: 'Error fetching agents: ' + error.message
        });
    }
});

// Create new agent
router.post('/', protect, admin, async (req, res) => {
    try {
        const { username, password, balance } = req.body;

        // Validate required fields
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: 'Username and password are required'
            });
        }

        // Check if agent already exists
        const existingAgent = await Agent.findOne({ username });
        if (existingAgent) {
            return res.status(400).json({
                success: false,
                error: 'Username already exists'
            });
        }

        // Create agent
        const agent = await Agent.create({
            username,
            password,
            balance: parseFloat(balance || 0),
            status: 'active',
            createdBy: req.user.username
        });

        res.status(201).json({
            success: true,
            data: {
                _id: agent._id,
                username: agent.username,
                balance: agent.balance,
                status: agent.status,
                createdAt: agent.createdAt
            }
        });
    } catch (error) {
        console.error('Error creating agent:', error);
        res.status(500).json({
            success: false,
            error: 'Error creating agent: ' + error.message
        });
    }
});

// Update agent status
router.put('/:id/status', protect, admin, async (req, res) => {
    try {
        const { status } = req.body;
        const agent = await Agent.findById(req.params.id);

        if (!agent) {
            return res.status(404).json({
                success: false,
                error: 'Agent not found'
            });
        }

        // Update status
        agent.status = status;
        await agent.save();

        res.json({
            success: true,
            data: {
                _id: agent._id,
                username: agent.username,
                status: agent.status
            }
        });
    } catch (error) {
        console.error('Error updating agent status:', error);
        res.status(500).json({
            success: false,
            error: 'Error updating agent status: ' + error.message
        });
    }
});

// Add/Remove balance
router.post('/:id/balance', protect, admin, async (req, res) => {
    try {
        const { amount, type, description } = req.body;
        const agent = await Agent.findById(req.params.id);

        if (!agent) {
            return res.status(404).json({
                success: false,
                error: 'Agent not found'
            });
        }

        // Validate amount
        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid amount'
            });
        }

        // Update balance
        if (type === 'credit') {
            agent.balance = (parseFloat(agent.balance) || 0) + parsedAmount;
        } else if (type === 'debit') {
            if (agent.balance < parsedAmount) {
                return res.status(400).json({
                    success: false,
                    error: 'Insufficient balance'
                });
            }
            agent.balance = (parseFloat(agent.balance) || 0) - parsedAmount;
        }

        // Add transaction record
        agent.transactions.push({
            type,
            amount: parsedAmount,
            description,
            createdAt: new Date()
        });

        await agent.save();

        res.json({
            success: true,
            data: {
                _id: agent._id,
                username: agent.username,
                balance: agent.balance,
                status: agent.status
            }
        });
    } catch (error) {
        console.error('Error updating agent balance:', error);
        res.status(500).json({
            success: false,
            error: 'Error updating agent balance: ' + error.message
        });
    }
});

module.exports = router;
