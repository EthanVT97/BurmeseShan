const express = require('express');
const router = express.Router();
const DefaultMessage = require('../../models/DefaultMessage');
const { isAdmin } = require('../../middleware/auth');

// Get all default messages
router.get('/', isAdmin, async (req, res) => {
    try {
        const messages = await DefaultMessage.find().sort('-createdAt');
        res.json(messages);
    } catch (error) {
        console.error('Error getting default messages:', error);
        res.status(500).json({ message: 'Error getting default messages' });
    }
});

// Add new default message
router.post('/', isAdmin, async (req, res) => {
    try {
        const message = new DefaultMessage({
            message: req.body.message,
            createdBy: req.user.id
        });
        await message.save();
        res.json(message);
    } catch (error) {
        console.error('Error creating default message:', error);
        res.status(500).json({ message: 'Error creating default message' });
    }
});

// Toggle default message status
router.patch('/:id/toggle', isAdmin, async (req, res) => {
    try {
        const message = await DefaultMessage.findById(req.params.id);
        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }
        message.isActive = !message.isActive;
        await message.save();
        res.json(message);
    } catch (error) {
        console.error('Error toggling default message:', error);
        res.status(500).json({ message: 'Error toggling default message' });
    }
});

// Delete default message
router.delete('/:id', isAdmin, async (req, res) => {
    try {
        await DefaultMessage.findByIdAndDelete(req.params.id);
        res.json({ message: 'Message deleted successfully' });
    } catch (error) {
        console.error('Error deleting default message:', error);
        res.status(500).json({ message: 'Error deleting default message' });
    }
});

// Get active default messages
router.get('/active', async (req, res) => {
    try {
        const messages = await DefaultMessage.find({ isActive: true }).sort('-createdAt');
        res.json(messages);
    } catch (error) {
        console.error('Error getting active default messages:', error);
        res.status(500).json({ message: 'Error getting active default messages' });
    }
});

module.exports = router;
