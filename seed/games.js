const mongoose = require('mongoose');
const Game = require('../models/Game');

const defaultGames = [
    {
        title: "Shan Koe Mee",
        description: "A traditional Burmese card game similar to poker. Players are dealt three cards and can draw additional cards to make the best hand.",
        imageUrl: "/images/games/shan-koe-mee.jpg",
        active: true
    },
    {
        title: "Thirteen Cards",
        description: "A popular card game where players must strategically play all their cards in valid combinations before their opponents.",
        imageUrl: "/images/games/thirteen-cards.jpg",
        active: true
    },
    {
        title: "Shan Ma Htout",
        description: "An exciting card game where players try to get rid of all their cards by matching numbers or sequences.",
        imageUrl: "/images/games/shan-ma-htout.jpg",
        active: true
    }
];

async function seedGames() {
    try {
        // Check if there are any existing games
        const existingGames = await Game.find();
        
        if (existingGames.length === 0) {
            console.log('No games found. Seeding default games...');
            await Game.insertMany(defaultGames);
            console.log('Successfully seeded default games!');
        } else {
            console.log('Games already exist. No seeding required.');
        }
    } catch (error) {
        console.error('Error seeding games:', error);
    }
}

module.exports = seedGames;
