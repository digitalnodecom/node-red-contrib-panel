#!/usr/bin/env node

const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./lib/database/db');
const apiRouter = require('./lib/api/router');

console.log('🧪 Testing Panel API Endpoints');
console.log('===============================');

async function testAPI() {
    // Setup express app like in the main module
    const app = express();
    app.use(express.json());
    app.use(cors());
    
    // Initialize database
    const testDbPath = path.join(__dirname, 'test-api.db');
    const db = await initDatabase(testDbPath);
    console.log('✅ Database initialized');
    
    // Add database to request
    app.use((req, res, next) => {
        req.db = db;
        next();
    });
    
    // Add API routes
    app.use('/api', apiRouter);
    
    // Start server
    const server = app.listen(3001, () => {
        console.log('✅ Test server started on port 3001');
        runTests();
    });
    
    async function runTests() {
        const axios = require('axios');
        const baseURL = 'http://localhost:3001/api';
        
        try {
            console.log('\n📋 Running API Tests');
            console.log('====================');
            
            // Test 1: Create collection
            console.log('\n1. Testing collection creation...');
            const createResponse = await axios.post(`${baseURL}/collections`, {
                name: 'test_users',
                fields: [
                    { name: 'name', type: 'text', required: true },
                    { name: 'email', type: 'email', required: true, unique: true },
                    { name: 'age', type: 'number', required: false }
                ]
            });
            console.log('✅ Collection created successfully');
            console.log('   Response:', createResponse.data);
            
            // Test 2: List collections
            console.log('\n2. Testing collections list...');
            const listResponse = await axios.get(`${baseURL}/collections`);
            console.log('✅ Collections retrieved:', listResponse.data.length, 'found');
            
            // Test 3: Get specific collection
            console.log('\n3. Testing get collection...');
            const getResponse = await axios.get(`${baseURL}/collections/test_users`);
            console.log('✅ Collection details retrieved');
            console.log('   Fields:', getResponse.data.fields.map(f => `${f.name}:${f.type}`).join(', '));
            
            // Test 4: Create record
            console.log('\n4. Testing record creation...');
            const recordResponse = await axios.post(`${baseURL}/test_users`, {
                name: 'John Doe',
                email: 'john@example.com',
                age: 30
            });
            console.log('✅ Record created with ID:', recordResponse.data.id);
            
            // Test 5: List records
            console.log('\n5. Testing records list...');
            const recordsResponse = await axios.get(`${baseURL}/test_users`);
            console.log('✅ Records retrieved:', recordsResponse.data.data.length, 'found');
            
            console.log('\n🎉 All API tests passed!');
            
        } catch (error) {
            console.error('\n❌ API test failed:', error.response?.data || error.message);
        } finally {
            server.close();
            await db.close();
            
            // Clean up test database
            const fs = require('fs');
            if (fs.existsSync(testDbPath)) {
                fs.unlinkSync(testDbPath);
            }
            
            console.log('✅ Test cleanup completed');
            process.exit(0);
        }
    }
}

// Check if axios is available
try {
    require('axios');
    testAPI();
} catch (error) {
    console.log('⚠️  Axios not available, installing...');
    const { spawn } = require('child_process');
    const install = spawn('npm', ['install', 'axios', '--no-save'], { stdio: 'inherit' });
    install.on('close', (code) => {
        if (code === 0) {
            console.log('✅ Axios installed, running tests...');
            // Clear require cache and retry
            delete require.cache[require.resolve('axios')];
            testAPI();
        } else {
            console.error('❌ Failed to install axios');
            process.exit(1);
        }
    });
}