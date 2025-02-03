const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const bcrypt = require('bcryptjs');
const { protect } = require('../../middleware/auth');
const User = require('../../models/User');

// Configure multer for profile image uploads
const storage = multer.diskStorage({
    destination: async function(req, file, cb) {
        const dir = path.join(__dirname, '../../public/uploads/profiles');
        try {
            await fs.mkdir(dir, { recursive: true });
            cb(null, dir);
        } catch (error) {
            cb(error);
        }
    },
    filename: function(req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: function(req, file, cb) {
        const filetypes = /jpeg|jpg|png/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only .png, .jpg and .jpeg format allowed!'));
    }
});

// Get current settings
router.get('/', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .select('-password')
            .lean();

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        res.json({
            success: true,
            data: {
                username: user.username,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                profileImage: user.profileImage,
                notifications: user.notifications,
                twoFactorEnabled: user.twoFactorEnabled,
                timezone: user.timezone,
                dateFormat: user.dateFormat,
                language: user.language,
                theme: user.theme,
                fontSize: user.fontSize
            }
        });
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({
            success: false,
            error: 'Error fetching settings'
        });
    }
});

// Update profile
router.put('/profile', protect, async (req, res) => {
    try {
        const { email, firstName, lastName } = req.body;

        // Validate email format
        if (email && !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid email format'
            });
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Check if email is already in use
        if (email && email !== user.email) {
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    error: 'Email is already in use'
                });
            }
            user.email = email;
        }

        if (firstName) user.firstName = firstName;
        if (lastName) user.lastName = lastName;

        await user.save();

        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: {
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName
            }
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({
            success: false,
            error: 'Error updating profile'
        });
    }
});

// Upload profile image
router.post('/profile-image', protect, upload.single('profileImage'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No image file provided'
            });
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            // Delete uploaded file if user not found
            await fs.unlink(req.file.path);
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Delete old profile image if it exists and it's not the default
        if (user.profileImage && !user.profileImage.includes('default-avatar')) {
            const oldImagePath = path.join(__dirname, '../../public', user.profileImage);
            try {
                await fs.access(oldImagePath);
                await fs.unlink(oldImagePath);
            } catch (error) {
                console.error('Error deleting old profile image:', error);
            }
        }

        // Update user profile image path
        user.profileImage = '/uploads/profiles/' + req.file.filename;
        await user.save();

        res.json({
            success: true,
            message: 'Profile image updated successfully',
            data: {
                profileImage: user.profileImage
            }
        });
    } catch (error) {
        console.error('Error uploading profile image:', error);
        // Try to delete uploaded file if there's an error
        if (req.file) {
            try {
                await fs.unlink(req.file.path);
            } catch (unlinkError) {
                console.error('Error deleting uploaded file:', unlinkError);
            }
        }
        res.status(500).json({
            success: false,
            error: 'Error uploading profile image'
        });
    }
});

// Update notification settings
router.put('/notifications', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Validate notification settings
        const validSettings = [
            'emailLoginAlert',
            'emailTransactionAlert',
            'emailSystemUpdates',
            'browserLoginAlert',
            'browserTransactionAlert'
        ];

        const notifications = {};
        validSettings.forEach(setting => {
            if (typeof req.body[setting] === 'boolean') {
                notifications[setting] = req.body[setting];
            }
        });

        user.notifications = { ...user.notifications, ...notifications };
        await user.save();

        res.json({
            success: true,
            message: 'Notification settings updated successfully',
            data: user.notifications
        });
    } catch (error) {
        console.error('Error updating notification settings:', error);
        res.status(500).json({
            success: false,
            error: 'Error updating notification settings'
        });
    }
});

// Update theme settings
router.put('/appearance', protect, async (req, res) => {
    try {
        const { theme, fontSize } = req.body;
        const user = await User.findById(req.user._id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Validate theme
        if (theme && !['light', 'dark', 'system'].includes(theme)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid theme selection'
            });
        }

        // Validate font size
        if (fontSize && !['small', 'medium', 'large'].includes(fontSize)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid font size selection'
            });
        }

        if (theme) user.theme = theme;
        if (fontSize) user.fontSize = fontSize;
        
        await user.save();

        res.json({
            success: true,
            message: 'Appearance settings updated successfully',
            data: {
                theme: user.theme,
                fontSize: user.fontSize
            }
        });
    } catch (error) {
        console.error('Error updating appearance settings:', error);
        res.status(500).json({
            success: false,
            error: 'Error updating appearance settings'
        });
    }
});

// Export user data
router.get('/export-data', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .select('-password -twoFactorSecret')
            .lean();

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Format the data for export
        const exportData = {
            profile: {
                username: user.username,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role
            },
            settings: {
                notifications: user.notifications,
                theme: user.theme,
                fontSize: user.fontSize,
                timezone: user.timezone,
                dateFormat: user.dateFormat,
                language: user.language
            },
            security: {
                twoFactorEnabled: user.twoFactorEnabled,
                lastLogin: user.lastLogin,
                status: user.status
            },
            timestamps: {
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            }
        };

        const fileName = `user-data-${user.username}-${Date.now()}.json`;
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        res.json(exportData);
    } catch (error) {
        console.error('Error exporting user data:', error);
        res.status(500).json({
            success: false,
            error: 'Error exporting user data'
        });
    }
});

module.exports = router;
