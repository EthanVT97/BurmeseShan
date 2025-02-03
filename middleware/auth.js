const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Admin = require('../models/Admin');
const Agent = require('../models/Agent');

// Protect admin routes
exports.protect = async (req, res, next) => {
    try {
        // Check if user is logged in via session
        if (!req.session.user || req.session.user.role !== 'admin') {
            return res.redirect('/admin/login');
        }
        
        // Get admin from database
        const admin = await Admin.findById(req.session.user.id).select('-password');
        if (!admin) {
            req.session.destroy();
            return res.redirect('/admin/login');
        }

        // Check if admin is active
        if (admin.status !== 'active') {
            req.session.destroy();
            return res.redirect('/admin/login?error=Account+is+inactive');
        }

        // Add admin to request object
        req.user = admin;
        next();
    } catch (error) {
        console.error('Admin Auth Error:', error);
        req.session.destroy();
        res.redirect('/admin/login');
    }
};

// Protect agent routes
exports.protectAgent = async (req, res, next) => {
    try {
        // Check if agent is logged in via session
        if (!req.session.agent) {
            return res.redirect('/agent/login');
        }
        
        // Get agent from database
        const agent = await Agent.findById(req.session.agent.id).select('-password');
        if (!agent) {
            req.session.destroy();
            return res.redirect('/agent/login');
        }

        // Check if agent is active
        if (agent.status !== 'active') {
            req.session.destroy();
            return res.redirect('/agent/login?error=Account+is+inactive');
        }

        // Add agent to request object
        req.user = agent;
        next();
    } catch (error) {
        console.error('Agent Auth Error:', error);
        req.session.destroy();
        res.redirect('/agent/login');
    }
};

// Check for superadmin role
exports.superadmin = (req, res, next) => {
    if (req.user && req.user.role === 'superadmin') {
        next();
    } else {
        res.status(403).json({
            success: false,
            error: 'Access denied. Superadmin privileges required.'
        });
    }
};

// Check for admin role
exports.admin = (req, res, next) => {
    if (req.user && req.user.role && ['admin', 'superadmin'].includes(req.user.role)) {
        next();
    } else {
        res.status(403).json({
            success: false,
            error: 'Access denied. Admin privileges required.'
        });
    }
};

// Check if user is authenticated
exports.isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
};

// Check if user is admin
exports.isAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
        next();
    } else {
        res.redirect('/admin/login');
    }
};

// Check if user is agent
exports.isAgent = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'agent') {
        next();
    } else {
        res.redirect('/agent/login');
    }
};

// Check if user is player
exports.isPlayer = (req, res, next) => {
    if (req.isAuthenticated() && req.user.role === 'player') {
        return next();
    }
    res.redirect('/login');
};
