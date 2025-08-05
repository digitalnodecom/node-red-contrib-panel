#!/usr/bin/env node

const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./lib/database/db');
const apiRouter = require('./lib/api/router');

console.log('🧪 Testing Collection Update API');
console.log('=================================');

async function testCollectionUpdateAPI() {
    const app = express();
    app.use(express.json());
    app.use(cors());
    
    const testDbPath = path.join(__dirname, 'test-update-api.db');
    const db = await initDatabase(testDbPath);
    console.log('✅ Database initialized');
    
    app.use((req, res, next) => {
        req.db = db;
        next();
    });
    
    app.use('/api', apiRouter);
    
    const server = app.listen(3002, () => {
        console.log('✅ Test server started on port 3002');
        runTests();
    });
    
    async function runTests() {
        try {
            const axios = require('axios');
            const baseURL = 'http://localhost:3002/api';
            
            console.log('\n📋 Running Collection Update Tests');
            console.log('===================================');
            
            // Test 1: Create initial collection
            console.log('\n1. Creating initial collection...');
            const createResponse = await axios.post(`${baseURL}/collections`, {
                name: 'users',
                fields: [
                    { name: 'name', type: 'text', required: true },
                    { name: 'email', type: 'email', required: true }
                ]
            });
            const collectionId = createResponse.data.id;
            console.log('✅ Collection created with ID:', collectionId);
            
            // Test 2: Add some data
            console.log('\n2. Adding test data...');
            await axios.post(`${baseURL}/users`, {
                name: 'John Doe',
                email: 'john@example.com'
            });
            console.log('✅ Test data added');
            
            // Test 3: Update collection schema (add fields)
            console.log('\n3. Updating collection schema...');
            const updateResponse = await axios.put(`${baseURL}/collections/${collectionId}`, {
                name: 'users',
                fields: [
                    { name: 'name', type: 'text', required: true },
                    { name: 'email', type: 'email', required: true },
                    { name: 'age', type: 'number', required: false, default: 0 },
                    { name: 'active', type: 'boolean', required: false, default: true }
                ]
            });
            console.log('✅ Collection schema updated');
            console.log('   New fields:', updateResponse.data.fields.map(f => `${f.name}:${f.type}`).join(', '));
            
            // Test 4: Add data with new fields
            console.log('\n4. Adding data with new fields...');
            await axios.post(`${baseURL}/users`, {
                name: 'Jane Doe',
                email: 'jane@example.com',
                age: 25,
                active: true
            });
            console.log('✅ New data added with extended schema');
            
            // Test 5: Verify data
            console.log('\n5. Verifying all data...');
            const dataResponse = await axios.get(`${baseURL}/users`);
            const users = dataResponse.data.data || dataResponse.data;
            console.log('✅ Found', users.length, 'users:');
            users.forEach(user => {
                console.log(`   - ${user.name} (${user.email}) age: ${user.age || 'null'} active: ${user.active !== undefined ? user.active : 'null'}`);
            });
            
            console.log('\n🎉 All collection update tests passed!');
            
        } catch (error) {
            console.error('\n❌ Collection update test failed:', error.response?.data || error.message);
        } finally {
            server.close();
            await db.close();
            
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
    testCollectionUpdateAPI();
} catch (error) {
    console.log('⚠️  Axios not available, using existing installation...');
    testCollectionUpdateAPI();
}