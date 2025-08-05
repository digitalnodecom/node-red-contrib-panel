const { initDatabase } = require('./lib/database/db');
const { createCollection } = require('./lib/database/schema');
const path = require('path');
const express = require('express');
const router = require('./lib/api/router');
const axios = require('axios');

async function testDebugOffset() {
    console.log('🔍 Debugging OFFSET Parameter Issue');
    console.log('===================================\n');
    
    try {
        // Initialize test database
        const testDbPath = path.join(__dirname, 'test-debug-offset.db');
        console.log('1. Setting up test environment...');
        const db = await initDatabase(testDbPath);
        
        // Create test collection
        const testFields = [
            { name: 'title', type: 'text', required: true, unique: false, indexable: false },
            { name: 'content', type: 'text', required: false, unique: false, indexable: false }
        ];
        
        await createCollection(db, 'test', testFields);
        
        // Insert test data
        const insertSQL = `INSERT INTO test (title, content) VALUES (?, ?)`;
        for (let i = 1; i <= 10; i++) {
            await db.run(insertSQL, [`Test ${i}`, `Content for test ${i}`]);
        }
        
        // Create Express server for testing
        const app = express();
        app.use(express.json());
        app.use((req, res, next) => {
            req.db = db;
            next();
        });
        
        // Add the API router
        app.use('/panel/api', router);
        
        const server = app.listen(0);
        const port = server.address().port;
        const baseURL = `http://localhost:${port}/panel/api`;
        
        console.log(`2. Testing the exact same request that's failing...`);
        console.log(`   URL: ${baseURL}/test?limit=25&offset=0&sort=id&order=DESC`);
        
        try {
            const response = await axios.get(`${baseURL}/test?limit=25&offset=0&sort=id&order=DESC`);
            console.log('   ✅ Request succeeded!');
            console.log(`   ✅ Got ${response.data.data?.length || 0} records`);
            console.log(`   ✅ Pagination:`, response.data.pagination);
        } catch (error) {
            console.log('   ❌ Request failed with error:');
            console.log('   Error message:', error.response?.data?.error || error.message);
            console.log('   Full response:', error.response?.data);
        }
        
        // Cleanup
        server.close();
        await db.close();
        const fs = require('fs');
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
        
    } catch (error) {
        console.error('❌ Setup failed:', error.message);
    }
}

testDebugOffset();