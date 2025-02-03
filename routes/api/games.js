const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Game = require('../../models/Game');
const Player = require('../../models/Player');
const { protect, admin } = require('../../middleware/auth');

// Configure multer for image upload
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        const uploadPath = 'public/images/games';
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function(req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'game-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    fileFilter: function(req, file, cb) {
        const filetypes = /jpeg|jpg|png|gif/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only image files are allowed!'));
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// Get all games
router.get('/', protect, async (req, res) => {
    try {
        const games = await Game.find()
            .select('title description imageUrl active createdAt updatedAt')
            .lean()
            .exec();

        // Get player count for each game and transform data
        const gamesWithStats = await Promise.all(games.map(async game => {
            const playerCount = await Player.countDocuments({ gameId: game._id });
            const gameData = {
                ...game,
                playerCount,
                imageUrlWithDefault: game.imageUrl || '/images/games/default-game.svg'
            };
            console.log('Game data:', gameData); // Debug log
            return gameData;
        }));

        console.log('Final response:', gamesWithStats); // Debug log

        res.json({
            success: true,
            data: gamesWithStats
        });
    } catch (error) {
        console.error('Error fetching games:', error);
        res.status(500).json({
            success: false,
            error: 'Error fetching games: ' + error.message
        });
    }
});

// Get single game
router.get('/:id', protect, async (req, res) => {
    try {
        const game = await Game.findById(req.params.id).lean();

        if (!game) {
            return res.status(404).json({
                success: false,
                error: 'Game not found'
            });
        }

        const playerCount = await Player.countDocuments({ gameId: game._id });

        res.json({
            success: true,
            data: {
                ...game,
                playerCount,
                imageUrlWithDefault: game.imageUrl || '/images/games/default-game.svg'
            }
        });
    } catch (error) {
        console.error('Error fetching game:', error);
        res.status(500).json({
            success: false,
            error: 'Error fetching game: ' + error.message
        });
    }
});

// Create new game
router.post('/', protect, admin, upload.single('image'), async (req, res) => {
    try {
        const { title, description } = req.body;

        // Validate required fields
        if (!title || !description) {
            return res.status(400).json({
                success: false,
                error: 'Title and description are required'
            });
        }

        // Create game
        const game = await Game.create({
            title,
            description,
            imageUrl: req.file ? '/images/games/' + req.file.filename : undefined
        });

        const gameObj = game.toObject();

        res.status(201).json({
            success: true,
            data: {
                ...gameObj,
                imageUrlWithDefault: gameObj.imageUrl || '/images/games/default-game.svg'
            }
        });
    } catch (error) {
        console.error('Error creating game:', error);
        res.status(500).json({
            success: false,
            error: 'Error creating game: ' + error.message
        });
    }
});

// Update game
router.put('/:id', protect, admin, upload.single('image'), async (req, res) => {
    try {
        const { title, description, active } = req.body;
        const game = await Game.findById(req.params.id);

        if (!game) {
            return res.status(404).json({
                success: false,
                error: 'Game not found'
            });
        }

        // Update fields
        if (title) game.title = title;
        if (description) game.description = description;
        if (active !== undefined) game.active = active === 'true';
        if (req.file) {
            // Delete old image if it exists
            if (game.imageUrl && game.imageUrl !== '/images/games/default-game.svg') {
                const oldImagePath = path.join('public', game.imageUrl);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            }
            game.imageUrl = '/images/games/' + req.file.filename;
        }

        await game.save();
        const gameObj = game.toObject();

        res.json({
            success: true,
            data: {
                ...gameObj,
                imageUrlWithDefault: gameObj.imageUrl || '/images/games/default-game.svg'
            }
        });
    } catch (error) {
        console.error('Error updating game:', error);
        res.status(500).json({
            success: false,
            error: 'Error updating game: ' + error.message
        });
    }
});

// Update game status
router.put('/:id/status', protect, admin, async (req, res) => {
    try {
        const { active } = req.body;
        const game = await Game.findById(req.params.id);

        if (!game) {
            return res.status(404).json({
                success: false,
                error: 'Game not found'
            });
        }

        game.active = active;
        await game.save();
        const gameObj = game.toObject();

        res.json({
            success: true,
            data: {
                ...gameObj,
                imageUrlWithDefault: gameObj.imageUrl || '/images/games/default-game.svg'
            }
        });
    } catch (error) {
        console.error('Error updating game status:', error);
        res.status(500).json({
            success: false,
            error: 'Error updating game status: ' + error.message
        });
    }
});

// Delete game
router.delete('/:id', protect, admin, async (req, res) => {
    try {
        const game = await Game.findById(req.params.id);

        if (!game) {
            return res.status(404).json({
                success: false,
                error: 'Game not found'
            });
        }

        // Check if game has players
        const playerCount = await Player.countDocuments({ gameId: game._id });
        if (playerCount > 0) {
            return res.status(400).json({
                success: false,
                error: 'Cannot delete game with active players'
            });
        }

        // Delete game image if it exists
        if (game.imageUrl && game.imageUrl !== '/images/games/default-game.svg') {
            const imagePath = path.join('public', game.imageUrl);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }

        await game.deleteOne();

        res.json({
            success: true,
            message: 'Game deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting game:', error);
        res.status(500).json({
            success: false,
            error: 'Error deleting game: ' + error.message
        });
    }
});

module.exports = router;
