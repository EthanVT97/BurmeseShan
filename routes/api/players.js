const express = require('express');
const router = express.Router();
const Player = require('../../models/Player');
const Transaction = require('../../models/Transaction');
const { protect, admin } = require('../../middleware/auth');

// Get all players
router.get('/', protect, async (req, res) => {
    try {
        const players = await Player.find().sort({ createdAt: -1 });
        // Format response for DataTables
        res.json({
            success: true,
            data: players.map(player => ({
                ...player.toObject(),
                lastLogin: player.lastLogin ? new Date(player.lastLogin).toLocaleDateString() : 'Never',
                createdAt: new Date(player.createdAt).toLocaleDateString()
            }))
        });
    } catch (error) {
        console.error('Error fetching players:', error);
        res.status(500).json({ 
            success: false,
            error: 'Error fetching players: ' + error.message 
        });
    }
});

// Create new player
router.post('/', protect, admin, async (req, res) => {
    try {
        const { username } = req.body;

        // Validate required fields
        if (!username) {
            return res.status(400).json({
                success: false,
                error: 'Username is required'
            });
        }

        // Check if player with same username exists
        const existingPlayer = await Player.findOne({ username });
        if (existingPlayer) {
            return res.status(400).json({
                success: false,
                error: 'A player with this username already exists'
            });
        }

        // Create new player
        const player = await Player.create({
            username,
            balance: 0,
            status: 'active'
        });

        res.status(201).json({
            success: true,
            message: 'Player created successfully',
            player: {
                ...player.toObject(),
                lastLogin: player.lastLogin ? new Date(player.lastLogin).toLocaleDateString() : 'Never',
                createdAt: new Date(player.createdAt).toLocaleDateString()
            }
        });
    } catch (error) {
        console.error('Error creating player:', error);
        res.status(500).json({
            success: false,
            error: 'Error creating player: ' + error.message
        });
    }
});

// Get player details
router.get('/:id', protect, async (req, res) => {
    try {
        const player = await Player.findById(req.params.id)
            .select('-password')
            .lean();

        if (!player) {
            return res.status(404).json({
                success: false,
                error: 'Player not found'
            });
        }

        res.json({
            success: true,
            player
        });
    } catch (error) {
        console.error('Error fetching player details:', error);
        res.status(500).json({
            success: false,
            error: 'Error fetching player details'
        });
    }
});

// Get single player
router.get('/:id/single', protect, async (req, res) => {
    try {
        const player = await Player.findById(req.params.id);
        if (!player) {
            return res.status(404).json({ 
                success: false,
                error: 'Player not found' 
            });
        }
        res.json({
            success: true,
            player
        });
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: 'Error fetching player: ' + error.message 
        });
    }
});

// Update player status
router.put('/:id/status', protect, admin, async (req, res) => {
    try {
        const { status } = req.body;
        
        if (!['active', 'inactive'].includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid status. Must be either "active" or "inactive"'
            });
        }

        const player = await Player.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        );

        if (!player) {
            return res.status(404).json({ 
                success: false,
                error: 'Player not found' 
            });
        }

        res.json({
            success: true,
            message: 'Player status updated successfully',
            player
        });
    } catch (error) {
        console.error('Error updating player status:', error);
        res.status(500).json({ 
            success: false,
            error: 'Error updating player status: ' + error.message 
        });
    }
});

// Update player balance
router.put('/:id/balance', protect, admin, async (req, res) => {
    try {
        const { amount, type } = req.body;
        const player = await Player.findById(req.params.id);

        if (!player) {
            return res.status(404).json({
                success: false,
                error: 'Player not found'
            });
        }

        // Update balance based on type
        if (type === 'add') {
            player.balance += parseFloat(amount);
        } else if (type === 'subtract') {
            if (player.balance < amount) {
                return res.status(400).json({
                    success: false,
                    error: 'Insufficient balance'
                });
            }
            player.balance -= parseFloat(amount);
        }

        // Track who updated the balance
        player.balanceUpdatedBy = req.user.username;
        player.balanceUpdatedAt = new Date();

        await player.save();

        // Create a transaction record
        await Transaction.create({
            player: player._id,
            amount: parseFloat(amount),
            type: type === 'add' ? 'deposit' : 'withdrawal',
            status: 'completed',
            updatedBy: req.user.username
        });

        res.json({
            success: true,
            message: 'Balance updated successfully',
            newBalance: player.balance
        });
    } catch (error) {
        console.error('Error updating player balance:', error);
        res.status(500).json({ 
            success: false,
            error: 'Error updating player balance: ' + error.message 
        });
    }
});

module.exports = router;
