const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const Admin = require('../../models/Admin');
const Agent = require('../../models/Agent');
const { protect } = require('../../middleware/auth');

// Admin Login route
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Check if admin exists
        const admin = await Admin.findOne({ username }).select('+password');
        if (!admin) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        // Create session
        req.session.user = {
            id: admin._id,
            username: admin.username,
            role: 'admin'
        };

        // Set intended URL in session
        req.session.intendedUrl = '/dashboard/admin';

        res.json({
            success: true,
            data: {
                id: admin._id,
                username: admin.username,
                redirectUrl: '/dashboard/admin'
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Error logging in'
        });
    }
});

// Agent Login route
router.post('/agent/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Check if agent exists
        const agent = await Agent.findOne({ username }).select('+password');
        if (!agent) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        // Check if agent is active
        if (agent.status !== 'active') {
            return res.status(401).json({
                success: false,
                error: 'Account is inactive'
            });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, agent.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        // Create session
        req.session.user = {
            id: agent._id,
            username: agent.username,
            role: 'agent'
        };

        // Set intended URL in session
        req.session.intendedUrl = '/agent/dashboard';

        res.json({
            success: true,
            data: {
                id: agent._id,
                username: agent.username,
                redirectUrl: '/agent/dashboard'
            }
        });
    } catch (error) {
        console.error('Agent Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Error logging in'
        });
    }
});

// Check auth status
router.get('/status', (req, res) => {
    if (req.session.user) {
        res.json({
            success: true,
            data: {
                id: req.session.user.id,
                username: req.session.user.username,
                role: req.session.user.role
            }
        });
    } else {
        res.json({
            success: false,
            error: 'Not authenticated'
        });
    }
});

// Logout route
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({
                success: false,
                error: 'Error logging out'
            });
        }
        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    });
});

module.exports = router;
