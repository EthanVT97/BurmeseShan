const express = require('express');
const router = express.Router();
const Player = require('../../models/Player');
const Agent = require('../../models/Agent');
const Game = require('../../models/Game');
const Transaction = require('../../models/Transaction');
const { protect, admin } = require('../../middleware/auth');
const excel = require('exceljs');

// Get system statistics
router.get('/stats', protect, async (req, res) => {
    try {
        // Get counts
        const [
            totalPlayers,
            totalAgents,
            totalGames,
            totalTransactions
        ] = await Promise.all([
            Player.countDocuments(),
            Agent.countDocuments(),
            Game.countDocuments(),
            Transaction.countDocuments()
        ]);

        // Get chart data for the last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // Daily players data
        const dailyPlayersData = await Player.aggregate([
            {
                $match: {
                    createdAt: { $gte: sevenDaysAgo }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { _id: 1 }
            }
        ]);

        // Transaction volume data
        const transactionVolumeData = await Transaction.aggregate([
            {
                $match: {
                    createdAt: { $gte: sevenDaysAgo }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
                    },
                    total: { $sum: "$amount" }
                }
            },
            {
                $sort: { _id: 1 }
            }
        ]);

        // Format chart data
        const labels = [];
        const dailyPlayersValues = [];
        const transactionValues = [];

        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            
            labels.push(dateStr);
            
            const playerData = dailyPlayersData.find(d => d._id === dateStr);
            dailyPlayersValues.push(playerData ? playerData.count : 0);
            
            const transactionData = transactionVolumeData.find(d => d._id === dateStr);
            transactionValues.push(transactionData ? transactionData.total : 0);
        }

        res.json({
            success: true,
            data: {
                totalPlayers,
                totalAgents,
                totalGames,
                totalTransactions,
                charts: {
                    dailyPlayers: {
                        labels,
                        data: dailyPlayersValues
                    },
                    transactionVolume: {
                        labels,
                        data: transactionValues
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error fetching statistics:', error);
        res.status(500).json({
            success: false,
            error: 'Error fetching statistics: ' + error.message
        });
    }
});

// Get recent activity
router.get('/activity', protect, async (req, res) => {
    try {
        const activities = await Transaction.aggregate([
            {
                $sort: { createdAt: -1 }
            },
            {
                $limit: 50
            },
            {
                $lookup: {
                    from: 'players',
                    localField: 'player',
                    foreignField: '_id',
                    as: 'playerInfo'
                }
            },
            {
                $unwind: '$playerInfo'
            },
            {
                $project: {
                    timestamp: '$createdAt',
                    type: 'transaction',
                    user: '$playerInfo.username',
                    details: {
                        $concat: [
                            { $toString: '$amount' },
                            ' - ',
                            '$type'
                        ]
                    },
                    status: '$status'
                }
            }
        ]);

        res.json({
            success: true,
            data: activities
        });
    } catch (error) {
        console.error('Error fetching activity:', error);
        res.status(500).json({
            success: false,
            error: 'Error fetching activity: ' + error.message
        });
    }
});

// Get chart data for specific range
router.get('/chart-data/:chartType/:range', protect, async (req, res) => {
    try {
        const { chartType, range } = req.params;
        const days = parseInt(range);
        
        if (isNaN(days) || days <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid range'
            });
        }

        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - days);

        let data;
        if (chartType === 'dailyPlayersChart') {
            data = await Player.aggregate([
                {
                    $match: {
                        createdAt: { $gte: daysAgo }
                    }
                },
                {
                    $group: {
                        _id: {
                            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
                        },
                        count: { $sum: 1 }
                    }
                },
                {
                    $sort: { _id: 1 }
                }
            ]);
        } else if (chartType === 'transactionVolumeChart') {
            data = await Transaction.aggregate([
                {
                    $match: {
                        createdAt: { $gte: daysAgo }
                    }
                },
                {
                    $group: {
                        _id: {
                            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
                        },
                        total: { $sum: "$amount" }
                    }
                },
                {
                    $sort: { _id: 1 }
                }
            ]);
        } else {
            return res.status(400).json({
                success: false,
                error: 'Invalid chart type'
            });
        }

        // Format data
        const labels = [];
        const values = [];

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            
            labels.push(dateStr);
            
            const dayData = data.find(d => d._id === dateStr);
            values.push(dayData ? (chartType === 'dailyPlayersChart' ? dayData.count : dayData.total) : 0);
        }

        res.json({
            success: true,
            data: {
                labels,
                data: values
            }
        });
    } catch (error) {
        console.error('Error fetching chart data:', error);
        res.status(500).json({
            success: false,
            error: 'Error fetching chart data: ' + error.message
        });
    }
});

// Export report
router.get('/export', protect, admin, async (req, res) => {
    try {
        // Create workbook
        const workbook = new excel.Workbook();
        
        // Add Players worksheet
        const playersSheet = workbook.addWorksheet('Players');
        playersSheet.columns = [
            { header: 'Username', key: 'username', width: 20 },
            { header: 'Balance', key: 'balance', width: 15 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Created At', key: 'createdAt', width: 20 }
        ];
        
        const players = await Player.find().lean();
        playersSheet.addRows(players.map(player => ({
            ...player,
            createdAt: new Date(player.createdAt).toLocaleString()
        })));

        // Add Agents worksheet
        const agentsSheet = workbook.addWorksheet('Agents');
        agentsSheet.columns = [
            { header: 'Username', key: 'username', width: 20 },
            { header: 'Balance', key: 'balance', width: 15 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Created At', key: 'createdAt', width: 20 }
        ];
        
        const agents = await Agent.find().select('-password').lean();
        agentsSheet.addRows(agents.map(agent => ({
            ...agent,
            createdAt: new Date(agent.createdAt).toLocaleString()
        })));

        // Add Transactions worksheet
        const transactionsSheet = workbook.addWorksheet('Transactions');
        transactionsSheet.columns = [
            { header: 'Transaction ID', key: 'transactionId', width: 25 },
            { header: 'Type', key: 'type', width: 15 },
            { header: 'Amount', key: 'amount', width: 15 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Created At', key: 'createdAt', width: 20 }
        ];
        
        const transactions = await Transaction.find().lean();
        transactionsSheet.addRows(transactions.map(transaction => ({
            ...transaction,
            createdAt: new Date(transaction.createdAt).toLocaleString()
        })));

        // Set response headers
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            `attachment; filename=report-${new Date().toISOString().split('T')[0]}.xlsx`
        );

        // Write to response
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Error exporting report:', error);
        res.status(500).json({
            success: false,
            error: 'Error exporting report: ' + error.message
        });
    }
});

module.exports = router;
