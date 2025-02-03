const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Agent = require('../models/Agent');
require('dotenv').config();

const createTestAgent = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/shan_dashboard', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        // Create test agent
        const testAgent = new Agent({
            username: 'testagent',
            password: 'test123',
            status: 'active',
            createdBy: 'system',
            balance: 1000
        });

        // Save agent
        await testAgent.save();
        console.log('Test agent created successfully:', testAgent.username);
        
        // Disconnect from MongoDB
        await mongoose.disconnect();
    } catch (error) {
        console.error('Error creating test agent:', error);
        process.exit(1);
    }
};

createTestAgent();
