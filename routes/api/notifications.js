const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../../middleware/auth');
const Notification = require('../../models/Notification');

// @route   GET api/notifications
// @desc    Get user's notifications
// @access  Private
router.get('/', isAuthenticated, async (req, res) => {
    try {
        const notifications = await Notification.find({ userId: req.session.user.id })
            .sort({ createdAt: -1 });
        res.json(notifications);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT api/notifications/read/:id
// @desc    Mark notification as read
// @access  Private
router.put('/read/:id', isAuthenticated, async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.id);
        
        if (!notification) {
            return res.status(404).json({ msg: 'Notification not found' });
        }

        // Make sure user owns notification
        if (notification.userId.toString() !== req.session.user.id) {
            return res.status(401).json({ msg: 'User not authorized' });
        }

        notification.read = true;
        await notification.save();

        res.json(notification);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT api/notifications/read-all
// @desc    Mark all notifications as read
// @access  Private
router.put('/read-all', isAuthenticated, async (req, res) => {
    try {
        await Notification.updateMany(
            { userId: req.session.user.id, read: false },
            { $set: { read: true } }
        );
        res.json({ msg: 'All notifications marked as read' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   DELETE api/notifications/:id
// @desc    Delete a notification
// @access  Private
router.delete('/:id', isAuthenticated, async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.id);
        
        if (!notification) {
            return res.status(404).json({ msg: 'Notification not found' });
        }

        // Make sure user owns notification
        if (notification.userId.toString() !== req.session.user.id) {
            return res.status(401).json({ msg: 'User not authorized' });
        }

        await notification.deleteOne();
        res.json({ msg: 'Notification removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
