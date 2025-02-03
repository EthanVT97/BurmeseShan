const mongoose = require('mongoose');
const Player = require('../models/Player');
const Game = require('../models/Game');
const Transaction = require('../models/Transaction');
require('dotenv').config();

const players = [
    { username: 'player1', balance: 1000, totalGamesPlayed: 50, totalWins: 20 },
    { username: 'player2', balance: 2000, totalGamesPlayed: 30, totalWins: 15 },
    { username: 'player3', balance: 1500, totalGamesPlayed: 40, totalWins: 25 },
    { username: 'player4', balance: 3000, totalGamesPlayed: 20, totalWins: 10 },
    { username: 'player5', balance: 500, totalGamesPlayed: 10, totalWins: 5 }
];

const games = [
    { type: 'cash', amount: 100, players: ['player1', 'player2'], winner: 'player1' },
    { type: 'practice', amount: 50, players: ['player3', 'player4'], winner: 'player3' },
    { type: 'cash', amount: 200, players: ['player2', 'player5'], winner: 'player2' },
    { type: 'cash', amount: 150, players: ['player1', 'player4'], winner: 'player4' },
    { type: 'practice', amount: 75, players: ['player3', 'player5'], winner: 'player3' }
];

const transactions = [
    { player: 'player1', type: 'deposit', amount: 500, status: 'completed' },
    { player: 'player2', type: 'withdrawal', amount: 200, status: 'pending' },
    { player: 'player3', type: 'deposit', amount: 1000, status: 'completed' },
    { player: 'player4', type: 'withdrawal', amount: 300, status: 'pending' },
    { player: 'player5', type: 'deposit', amount: 250, status: 'completed' }
];

async function dropDatabase() {
    try {
        await mongoose.connection.db.dropDatabase();
        console.log('✓ Dropped existing database');
    } catch (error) {
        console.error('Error dropping database:', error);
        throw error;
    }
}

async function seedPlayers() {
    try {
        for (const player of players) {
            await Player.create(player);
        }
        console.log('✓ Seeded players');
    } catch (error) {
        console.error('Error seeding players:', error);
        throw error;
    }
}

async function seedGames() {
    try {
        for (const game of games) {
            await Game.create(game);
        }
        console.log('✓ Seeded games');
    } catch (error) {
        console.error('Error seeding games:', error);
        throw error;
    }
}

async function seedTransactions() {
    try {
        for (const transaction of transactions) {
            await Transaction.create(transaction);
        }
        console.log('✓ Seeded transactions');
    } catch (error) {
        console.error('Error seeding transactions:', error);
        throw error;
    }
}

async function seedDatabase() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✓ Connected to MongoDB');

        // Drop existing database and seed new data
        await dropDatabase();
        await seedPlayers();
        await seedGames();
        await seedTransactions();

        // Create test transactions if none exist
        const transactionCount = await Transaction.countDocuments();
        if (transactionCount < 8) {
            console.log('Creating test transactions...');
            await Transaction.create([
                {
                    transactionId: 'TX' + Math.random().toString(36).substr(2, 9).toUpperCase(),
                    player: 'player1',
                    type: 'deposit',
                    amount: 500,
                    status: 'completed'
                },
                {
                    transactionId: 'TX' + Math.random().toString(36).substr(2, 9).toUpperCase(),
                    player: 'player1',
                    type: 'withdrawal',
                    amount: 200,
                    status: 'pending'
                },
                {
                    transactionId: 'TX' + Math.random().toString(36).substr(2, 9).toUpperCase(),
                    player: 'player2',
                    type: 'deposit',
                    amount: 1000,
                    status: 'completed'
                }
            ]);
            console.log('Test transactions created');
        }

        console.log('✓ Database seeded successfully');
        process.exit(0);
    } catch (error) {
        console.error('Database seeding failed:', error);
        process.exit(1);
    }
}

seedDatabase();
