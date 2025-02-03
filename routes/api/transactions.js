const express = require('express');
const router = express.Router();
const Transaction = require('../../models/Transaction');
const Player = require('../../models/Player');
const { protect, admin } = require('../../middleware/auth');
const mongoose = require('mongoose');

// Get all transactions with pagination
router.get('/', protect, async (req, res) => {
    try {
        // Fetch transactions with populated player data
        const transactions = await Transaction.find()
            .populate('player', 'username')
            .sort({ createdAt: -1 })
            .lean();

        // Map each transaction to exactly match the table columns
        const formattedData = transactions.map(t => ({
            _id: t._id,
            transactionId: t._id.toString().substr(-8).toUpperCase(),
            playerName: t.player?.username || 'Unknown',
            transactionType: t.type,
            transactionAmount: t.amount,
            transactionStatus: t.status || 'pending',
            processedBy: t.updatedBy || t.processedBy || 'System',
            remark: t.remark || t.description || '-',
            transactionDate: t.createdAt ? new Date(t.createdAt).toLocaleString() : 'N/A',
            adjustmentType: t.adjustmentType
        }));

        res.json({
            success: true,
            data: formattedData
        });
    } catch (error) {
        console.error('Error in transactions route:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Error fetching transactions: ' + error.message 
        });
    }
});

// Get transaction details
router.get('/:id', protect, async (req, res) => {
    try {
        const transaction = await Transaction.findById(req.params.id)
            .populate('player', 'username')
            .lean();

        if (!transaction) {
            return res.status(404).json({
                success: false,
                error: 'Transaction not found'
            });
        }

        // Format the transaction data
        const formattedTransaction = {
            _id: transaction._id,
            transactionId: transaction._id.toString().substr(-8).toUpperCase(),
            playerName: transaction.player?.username || 'Unknown',
            transactionType: transaction.type,
            transactionAmount: transaction.amount,
            transactionStatus: transaction.status || 'pending',
            processedBy: transaction.updatedBy || transaction.processedBy || 'System',
            remark: transaction.remark || transaction.description || '-',
            transactionDate: transaction.createdAt ? new Date(transaction.createdAt).toLocaleString() : 'N/A',
            adjustmentType: transaction.adjustmentType,
            paymentMethod: transaction.paymentMethod,
            paymentDetails: transaction.paymentDetails
        };

        res.json({
            success: true,
            data: formattedTransaction
        });
    } catch (error) {
        console.error('Error fetching transaction details:', error);
        res.status(500).json({
            success: false,
            error: 'Error fetching transaction details'
        });
    }
});

// Get player transactions
router.get('/player/:playerId', protect, async (req, res) => {
    try {
        const transactions = await Transaction.find({ player: req.params.playerId })
            .populate('processedBy', 'username')
            .sort({ createdAt: -1 })
            .limit(5)
            .lean();
            
        res.json({
            success: true,
            transactions
        });
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: 'Error fetching player transactions'
        });
    }
});

// Get transaction summary for a player
router.get('/summary/:playerId', protect, async (req, res) => {
    try {
        const playerId = req.params.playerId;

        // Get total deposits
        const deposits = await Transaction.aggregate([
            { 
                $match: { 
                    player: mongoose.Types.ObjectId(playerId),
                    type: 'deposit',
                    status: 'completed'
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' }
                }
            }
        ]);

        // Get total withdrawals
        const withdrawals = await Transaction.aggregate([
            { 
                $match: { 
                    player: mongoose.Types.ObjectId(playerId),
                    type: 'withdrawal',
                    status: 'completed'
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' }
                }
            }
        ]);

        // Get total points added
        const pointsAdded = await Transaction.aggregate([
            { 
                $match: { 
                    player: mongoose.Types.ObjectId(playerId),
                    type: 'point_adjustment',
                    adjustmentType: 'add',
                    status: 'completed'
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' }
                }
            }
        ]);

        // Get total points deducted
        const pointsDeducted = await Transaction.aggregate([
            { 
                $match: { 
                    player: mongoose.Types.ObjectId(playerId),
                    type: 'point_adjustment',
                    adjustmentType: 'subtract',
                    status: 'completed'
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' }
                }
            }
        ]);

        res.json({
            success: true,
            summary: {
                totalDeposits: deposits[0]?.total || 0,
                totalWithdrawals: withdrawals[0]?.total || 0,
                totalPointsAdded: pointsAdded[0]?.total || 0,
                totalPointsDeducted: pointsDeducted[0]?.total || 0
            }
        });
    } catch (error) {
        console.error('Error getting transaction summary:', error);
        res.status(500).json({ 
            success: false,
            error: 'Error getting transaction summary'
        });
    }
});

// Create deposit transaction
router.post('/deposit', protect, admin, async (req, res) => {
    try {
        const { playerId, amount, paymentMethod, paymentDetails } = req.body;
        
        // Create transaction
        const transaction = await Transaction.create({
            transactionId: `D${Date.now()}${playerId}`,
            player: playerId,
            type: 'deposit',
            amount: Number(amount),
            status: 'completed',
            paymentMethod,
            paymentDetails,
            processedBy: req.user._id
        });
        
        // Update player balance
        const player = await Player.findById(playerId);
        if (player) {
            player.balance += Number(amount);
            await player.save();
        }
        
        res.status(201).json(transaction);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Create withdrawal request
router.post('/withdraw', protect, async (req, res) => {
    try {
        const { playerId, amount, paymentMethod, paymentDetails } = req.body;
        
        if (!playerId || !amount) {
            return res.status(400).json({ 
                success: false,
                error: 'Player ID and amount are required' 
            });
        }

        // Check player balance
        const player = await Player.findById(playerId);
        if (!player) {
            return res.status(404).json({ 
                success: false,
                error: 'Player not found' 
            });
        }

        if (player.balance < amount) {
            return res.status(400).json({ 
                success: false,
                error: 'Insufficient balance' 
            });
        }
        
        // Create pending withdrawal transaction
        const transaction = await Transaction.create({
            transactionId: `W${Date.now()}${playerId.substr(-4)}`,
            player: playerId,
            type: 'withdrawal',
            amount: Number(amount),
            status: 'pending',
            paymentMethod,
            paymentDetails
        });
        
        res.status(201).json({
            success: true,
            message: 'Withdrawal request created successfully',
            transaction
        });
    } catch (error) {
        console.error('Error creating withdrawal:', error);
        res.status(500).json({ 
            success: false,
            error: 'Error creating withdrawal request: ' + error.message 
        });
    }
});

// Update transaction status
router.put('/:id/status', protect, admin, async (req, res) => {
    try {
        const { status } = req.body;
        const transactionId = req.params.id;
        
        console.log('Updating transaction status:', { transactionId, status });
        
        if (!mongoose.Types.ObjectId.isValid(transactionId)) {
            return res.status(400).json({ 
                success: false,
                error: 'Invalid transaction ID format' 
            });
        }

        // First, find and verify the transaction
        const transaction = await Transaction.findById(transactionId);
        console.log('Found transaction:', transaction);
        
        if (!transaction) {
            return res.status(404).json({ 
                success: false,
                error: 'Transaction not found' 
            });
        }

        // Don't process already completed or rejected transactions
        if (transaction.status !== 'pending') {
            return res.status(400).json({ 
                success: false,
                error: 'Transaction has already been processed' 
            });
        }

        // If it's a withdrawal and being completed, verify and update player balance first
        if (status === 'completed' && transaction.type === 'withdrawal') {
            console.log('Processing withdrawal completion...');
            
            const player = await Player.findById(transaction.player);
            console.log('Found player:', player);
            
            if (!player) {
                return res.status(404).json({
                    success: false,
                    error: 'Player not found'
                });
            }

            // Verify sufficient balance
            if (player.balance < transaction.amount) {
                return res.status(400).json({
                    success: false,
                    error: 'Insufficient balance'
                });
            }

            console.log('Updating player balance:', {
                currentBalance: player.balance,
                deductAmount: transaction.amount,
                newBalance: player.balance - transaction.amount
            });

            // Update player balance
            player.balance = player.balance - transaction.amount;
            await player.save();
        }

        console.log('Updating transaction status to:', status);

        // Update transaction status
        transaction.status = status;
        transaction.processedBy = req.user._id;
        await transaction.save();

        // Fetch updated transaction with populated data
        const updatedTransaction = await Transaction.findById(transaction._id)
            .populate('player', 'username')
            .populate('processedBy', 'username')
            .lean();

        console.log('Successfully updated transaction:', updatedTransaction);

        res.json({
            success: true,
            message: `Transaction ${status} successfully`,
            transaction: updatedTransaction
        });

    } catch (error) {
        console.error('Error updating transaction status:', {
            error: error.message,
            stack: error.stack,
            transactionId: req.params.id,
            status: req.body.status
        });
        
        res.status(500).json({ 
            success: false,
            error: error.message || 'Error updating transaction status'
        });
    }
});

// Get transaction statistics
router.get('/stats/summary', protect, admin, async (req, res) => {
    try {
        const totalDeposits = await Transaction.aggregate([
            { $match: { type: 'deposit', status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        
        const totalWithdrawals = await Transaction.aggregate([
            { $match: { type: 'withdrawal', status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        
        const pendingWithdrawals = await Transaction.countDocuments({
            type: 'withdrawal',
            status: 'pending'
        });
        
        res.json({
            totalDeposits: totalDeposits[0]?.total || 0,
            totalWithdrawals: totalWithdrawals[0]?.total || 0,
            pendingWithdrawals
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
