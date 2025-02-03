const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { protect } = require('../middleware/auth');
const Admin = require('../models/Admin');
const Game = require('../models/Game');
const Player = require('../models/Player');
const Transaction = require('../models/Transaction');
const upload = require('../middleware/upload');

// Admin login page
router.get('/login', (req, res) => {
    if (req.session.user && req.session.user.role === 'admin') {
        return res.redirect('/dashboard/admin');
    }
    res.render('admin/login', { error: req.query.error });
});

// Admin login process
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Check if admin exists
        const admin = await Admin.findOne({ username }).select('+password');
        if (!admin) {
            return res.redirect('/admin/login?error=Invalid+credentials');
        }

        // Check password
        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.redirect('/admin/login?error=Invalid+credentials');
        }

        // Check if admin is active
        if (admin.status !== 'active') {
            return res.redirect('/admin/login?error=Account+is+inactive');
        }

        // Create session
        req.session.user = {
            id: admin._id,
            username: admin.username,
            role: 'admin'
        };

        // Redirect to admin dashboard
        res.redirect('/dashboard/admin');
    } catch (error) {
        console.error('Admin Login Error:', error);
        res.redirect('/admin/login?error=Login+failed');
    }
});

// Admin logout
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout Error:', err);
        }
        res.redirect('/admin/login');
    });
});

// Admin Profile Page
router.get('/profile', protect, async (req, res) => {
    try {
        const admin = await Admin.findById(req.session.user.id);
        if (!admin) {
            return res.redirect('/admin/login');
        }
        
        res.render('admin/profile', {
            title: 'Profile Settings',
            subtitle: 'Update Your Profile',
            user: req.session.user,
            breadcrumb: 'Profile'
        });
    } catch (error) {
        console.error('Profile Page Error:', error);
        res.status(500).send('Server Error');
    }
});

// Update Admin Profile
router.post('/profile', protect, async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;
        
        // Get admin with password
        const admin = await Admin.findById(req.session.user.id).select('+password');
        if (!admin) {
            return res.render('admin/profile', {
                title: 'Profile Settings',
                subtitle: 'Update Your Profile',
                user: req.session.user,
                error: 'Admin not found',
                breadcrumb: 'Profile'
            });
        }

        // Check current password
        const isMatch = await bcrypt.compare(currentPassword, admin.password);
        if (!isMatch) {
            return res.render('admin/profile', {
                title: 'Profile Settings',
                subtitle: 'Update Your Profile',
                user: req.session.user,
                error: 'Current password is incorrect',
                breadcrumb: 'Profile'
            });
        }

        // Validate new password
        if (newPassword !== confirmPassword) {
            return res.render('admin/profile', {
                title: 'Profile Settings',
                subtitle: 'Update Your Profile',
                user: req.session.user,
                error: 'New passwords do not match',
                breadcrumb: 'Profile'
            });
        }

        if (newPassword.length < 8) {
            return res.render('admin/profile', {
                title: 'Profile Settings',
                subtitle: 'Update Your Profile',
                user: req.session.user,
                error: 'Password must be at least 8 characters long',
                breadcrumb: 'Profile'
            });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        admin.password = await bcrypt.hash(newPassword, salt);
        await admin.save();

        res.render('admin/profile', {
            title: 'Profile Settings',
            subtitle: 'Update Your Profile',
            user: req.session.user,
            success: 'Password updated successfully',
            breadcrumb: 'Profile'
        });
    } catch (error) {
        console.error('Profile Update Error:', error);
        res.render('admin/profile', {
            title: 'Profile Settings',
            subtitle: 'Update Your Profile',
            user: req.session.user,
            error: 'Server error occurred',
            breadcrumb: 'Profile'
        });
    }
});

// Admin Settings Page
router.get('/settings', protect, async (req, res) => {
    try {
        const admin = await Admin.findById(req.session.user.id);
        if (!admin) {
            return res.redirect('/admin/login');
        }
        
        res.render('admin/settings', {
            title: 'Settings',
            subtitle: 'System Settings',
            user: req.session.user,
            breadcrumb: 'Settings',
            settings: {
                emailNotifications: admin.settings?.emailNotifications ?? true,
                pushNotifications: admin.settings?.pushNotifications ?? true,
                theme: admin.settings?.theme ?? 'light',
                language: admin.settings?.language ?? 'en',
                timezone: admin.settings?.timezone ?? 'UTC'
            }
        });
    } catch (error) {
        console.error('Settings Page Error:', error);
        res.status(500).send('Server Error');
    }
});

// Update Admin Settings
router.post('/settings/update', protect, async (req, res) => {
    try {
        const { emailNotifications, pushNotifications, theme, language, timezone } = req.body;
        
        const admin = await Admin.findById(req.session.user.id);
        if (!admin) {
            return res.status(404).json({ success: false, message: 'Admin not found' });
        }

        // Update settings
        admin.settings = {
            ...admin.settings,
            emailNotifications: emailNotifications === 'true',
            pushNotifications: pushNotifications === 'true',
            theme,
            language,
            timezone
        };

        await admin.save();
        
        res.json({ 
            success: true, 
            message: 'Settings updated successfully',
            settings: admin.settings
        });
    } catch (error) {
        console.error('Settings Update Error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to update settings'
        });
    }
});

// Game management routes
router.post('/games', protect, upload.single('gameImage'), async (req, res) => {
    try {
        const { name, description } = req.body;
        const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

        const game = await Game.create({
            name,
            description,
            imageUrl,
            createdBy: req.user._id
        });

        res.json({
            success: true,
            data: game
        });
    } catch (error) {
        console.error('Add Game Error:', error);
        res.status(500).json({
            success: false,
            error: 'Error adding game'
        });
    }
});

router.put('/games/:id', protect, upload.single('gameImage'), async (req, res) => {
    try {
        const { name, description, active } = req.body;
        const updates = { name, description };
        
        if (typeof active !== 'undefined') {
            updates.active = active;
        }
        
        if (req.file) {
            updates.imageUrl = `/uploads/${req.file.filename}`;
            
            // Delete old image if it exists
            const game = await Game.findById(req.params.id);
            if (game && game.imageUrl) {
                const oldImagePath = path.join(__dirname, '..', 'public', game.imageUrl);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            }
        }

        const game = await Game.findByIdAndUpdate(
            req.params.id,
            updates,
            { new: true, runValidators: true }
        );

        if (!game) {
            return res.status(404).json({
                success: false,
                error: 'Game not found'
            });
        }

        res.json({
            success: true,
            data: game
        });
    } catch (error) {
        console.error('Update Game Error:', error);
        res.status(500).json({
            success: false,
            error: 'Error updating game'
        });
    }
});

router.delete('/games/:id', protect, async (req, res) => {
    try {
        const game = await Game.findById(req.params.id);
        
        if (!game) {
            return res.status(404).json({
                success: false,
                error: 'Game not found'
            });
        }

        // Delete game image if it exists
        if (game.imageUrl) {
            const imagePath = path.join(__dirname, '..', 'public', game.imageUrl);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }

        await game.remove();

        res.json({
            success: true,
            data: {}
        });
    } catch (error) {
        console.error('Delete Game Error:', error);
        res.status(500).json({
            success: false,
            error: 'Error deleting game'
        });
    }
});

module.exports = router;
