#!/usr/bin/env node

const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./lib/database/db');
const apiRouter = require('./lib/api/router');

console.log('🧪 Testing Collection and Record Counts');
console.log('=======================================');

async function testCounts() {
    const app = express();
    app.use(express.json());
    app.use(cors());
    
    const testDbPath = path.join(__dirname, 'test-counts.db');
    const db = await initDatabase(testDbPath);
    console.log('✅ Database initialized');
    
    app.use((req, res, next) => {
        req.db = db;
        next();
    });
    
    app.use('/api', apiRouter);
    
    const server = app.listen(3003, () => {
        console.log('✅ Test server started on port 3003');
        runTests();
    });
    
    async function runTests() {
        try {
            const axios = require('axios');
            const baseURL = 'http://localhost:3003/api';
            
            console.log('\n📋 Running Count Tests');
            console.log('=======================');
            
            // Test 1: Create collections with different numbers of fields
            console.log('\n1. Creating collections...');
            
            // Collection 1: users (2 fields)
            await axios.post(`${baseURL}/collections`, {
                name: 'users',
                fields: [
                    { name: 'name', type: 'text', required: true },
                    { name: 'email', type: 'email', required: true }
                ]
            });
            
            // Collection 2: products (4 fields)
            await axios.post(`${baseURL}/collections`, {
                name: 'products',
                fields: [
                    { name: 'name', type: 'text', required: true },
                    { name: 'price', type: 'number', required: true },
                    { name: 'description', type: 'text', required: false },
                    { name: 'active', type: 'boolean', required: false, default: true }
                ]
            });
            
            console.log('✅ Collections created');
            
            // Test 2: Add records to collections
            console.log('\n2. Adding records...');
            
            // Add 3 users
            await axios.post(`${baseURL}/users`, { name: 'John Doe', email: 'john@example.com' });
            await axios.post(`${baseURL}/users`, { name: 'Jane Smith', email: 'jane@example.com' });
            await axios.post(`${baseURL}/users`, { name: 'Bob Wilson', email: 'bob@example.com' });
            
            // Add 2 products
            await axios.post(`${baseURL}/products`, { 
                name: 'Laptop', 
                price: 999.99, 
                description: 'Gaming laptop',
                active: true 
            });
            await axios.post(`${baseURL}/products`, { 
                name: 'Mouse', 
                price: 29.99, 
                description: 'Wireless mouse',
                active: true 
            });
            
            console.log('✅ Records added');
            
            // Test 3: Check counts in collections list
            console.log('\n3. Checking collection counts...');
            const collectionsResponse = await axios.get(`${baseURL}/collections`);
            const collections = collectionsResponse.data;
            
            console.log('📊 Collection Statistics:');
            collections.forEach(collection => {
                console.log(`   - ${collection.name}:`);
                console.log(`     • Fields: ${collection.field_count}`);
                console.log(`     • Records: ${collection.record_count}`);
            });
            
            // Test 4: Verify counts are accurate
            console.log('\n4. Verifying accuracy...');
            
            const usersCollection = collections.find(c => c.name === 'users');
            const productsCollection = collections.find(c => c.name === 'products');
            
            // Check users collection
            if (usersCollection.field_count === 2 && usersCollection.record_count === 3) {
                console.log('✅ Users collection counts correct');
            } else {
                console.log(`❌ Users collection counts incorrect: ${usersCollection.field_count} fields, ${usersCollection.record_count} records`);
            }
            
            // Check products collection
            if (productsCollection.field_count === 4 && productsCollection.record_count === 2) {
                console.log('✅ Products collection counts correct');
            } else {
                console.log(`❌ Products collection counts incorrect: ${productsCollection.field_count} fields, ${productsCollection.record_count} records`);
            }
            
            // Test 5: Add more fields and verify count update
            console.log('\n5. Testing field count updates...');
            const usersCollectionId = usersCollection.id;
            
            await axios.put(`${baseURL}/collections/${usersCollectionId}`, {
                name: 'users',
                fields: [
                    { name: 'name', type: 'text', required: true },
                    { name: 'email', type: 'email', required: true },
                    { name: 'age', type: 'number', required: false },
                    { name: 'city', type: 'text', required: false }
                ]
            });
            
            // Check updated counts
            const updatedCollectionsResponse = await axios.get(`${baseURL}/collections`);
            const updatedUsersCollection = updatedCollectionsResponse.data.find(c => c.name === 'users');
            
            if (updatedUsersCollection.field_count === 4) {
                console.log('✅ Field count updated correctly after schema change');
            } else {
                console.log(`❌ Field count not updated: ${updatedUsersCollection.field_count} (expected 4)`);
            }
            
            console.log('\n🎉 All count tests completed!');
            
        } catch (error) {
            console.error('\n❌ Count test failed:', error.response?.data || error.message);
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

testCounts();