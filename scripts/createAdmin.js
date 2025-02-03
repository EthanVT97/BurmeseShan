const mongoose = require('mongoose');
const Admin = require('../models/Admin');
require('dotenv').config();

const createAdmin = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/shan_dashboard', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✓ Connected to MongoDB');

        // Check if admin exists
        const adminExists = await Admin.findOne({ role: 'superadmin' });
        if (adminExists) {
            console.log('Admin user already exists');
            process.exit(0);
        }

        // Create admin user
        const admin = await Admin.create({
            username: 'admin',
            password: 'admin123',  // This will be hashed by the Admin model
            role: 'superadmin',
            status: 'active'
        });

        console.log('✓ Admin user created successfully');
        console.log('Username:', admin.username);
        console.log('Password: admin123');
        console.log('\nPlease change the password after first login!');
        
        process.exit(0);
    } catch (error) {
        console.error('Error creating admin:', error);
        process.exit(1);
    }
};

createAdmin();
