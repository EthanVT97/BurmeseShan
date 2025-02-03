const { body, validationResult } = require('express-validator');

// Validation middleware
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

// User validation rules
const userValidationRules = {
    register: [
        body('username')
            .trim()
            .isLength({ min: 3 })
            .withMessage('Username must be at least 3 characters long')
            .matches(/^[a-zA-Z0-9_]+$/)
            .withMessage('Username can only contain letters, numbers and underscores'),
        body('password')
            .isLength({ min: 6 })
            .withMessage('Password must be at least 6 characters long')
            .matches(/\d/)
            .withMessage('Password must contain at least one number')
            .matches(/[A-Z]/)
            .withMessage('Password must contain at least one uppercase letter'),
        body('role')
            .optional()
            .isIn(['admin', 'moderator'])
            .withMessage('Invalid role specified')
    ],
    login: [
        body('username').trim().notEmpty().withMessage('Username is required'),
        body('password').notEmpty().withMessage('Password is required')
    ]
};

module.exports = {
    validate,
    userValidationRules
};
