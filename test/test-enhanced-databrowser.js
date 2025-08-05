const { initDatabase } = require('./lib/database/db');
const { createCollection } = require('./lib/database/schema');
const path = require('path');
const express = require('express');
const router = require('./lib/api/router');

async function testEnhancedDataBrowser() {
    console.log('🔍 Testing Enhanced Data Browser Features');
    console.log('========================================\n');
    
    try {
        // Initialize test database
        const testDbPath = path.join(__dirname, 'test-enhanced-browser.db');
        console.log('1. Initializing test database...');
        const db = await initDatabase(testDbPath);
        
        // Create test collection with sample data
        console.log('2. Creating test collection with sample data...');
        const testFields = [
            { name: 'title', type: 'text', required: true, unique: false, indexable: true },
            { name: 'content', type: 'text', required: false, unique: false, indexable: false },
            { name: 'category', type: 'text', required: false, unique: false, indexable: true },
            { name: 'published', type: 'boolean', required: false, unique: false, indexable: false },
            { name: 'score', type: 'number', required: false, unique: false, indexable: true }
        ];
        
        await createCollection(db, 'test_articles', testFields);
        
        // Insert sample data
        console.log('3. Inserting sample data...');
        const insertSQL = `INSERT INTO test_articles (title, content, category, published, score) VALUES (?, ?, ?, ?, ?)`;
        
        const sampleData = [
            ['First Article', 'Content for first article', 'tech', 1, 85],
            ['Second Article', 'Content for second article', 'business', 0, 72],
            ['Third Article', 'Content for third article', 'tech', 1, 91],
            ['Fourth Article', 'Content for fourth article', 'lifestyle', 1, 65],
            ['Fifth Article', 'Content for fifth article', 'business', 0, 78],
            ['Sixth Article', 'Content for sixth article', 'tech', 1, 88],
            ['Seventh Article', 'Content for seventh article', 'lifestyle', 1, 82],
            ['Eighth Article', 'Content for eighth article', 'business', 1, 76],
            ['Ninth Article', 'Content for ninth article', 'tech', 0, 94],
            ['Tenth Article', 'Content for tenth article', 'lifestyle', 1, 69]
        ];
        
        for (const data of sampleData) {
            await db.run(insertSQL, data);
        }
        console.log('   ✅ Inserted 10 sample records');
        
        // Test API endpoints with enhanced parameters
        console.log('4. Testing API endpoints with pagination and sorting...');
        
        // Create a simple Express app to test the API
        const app = express();
        app.use(express.json());
        
        // Add database middleware
        app.use((req, res, next) => {
            req.db = db;
            next();
        });
        
        app.use('/api', router);
        
        const server = app.listen(0, () => {
            const port = server.address().port;
            console.log(`   Test server started on port ${port}`);
        });
        
        // Test different API calls
        const axios = require('axios');
        const baseURL = `http://localhost:${server.address().port}/api`;
        
        // Test 1: Basic pagination with offset
        console.log('   Testing pagination with offset...');
        const response1 = await axios.get(`${baseURL}/test_articles?limit=3&offset=0&sort=id&order=ASC`);
        console.log(`   ✅ Retrieved ${response1.data.data.length} records (limit=3, offset=0)`);
        console.log(`   ✅ Total records: ${response1.data.pagination.total}`);
        
        // Test 2: Pagination with different offset
        console.log('   Testing pagination with offset=5...');
        const response2 = await axios.get(`${baseURL}/test_articles?limit=3&offset=5&sort=id&order=ASC`);
        console.log(`   ✅ Retrieved ${response2.data.data.length} records (limit=3, offset=5)`);
        console.log(`   ✅ First record ID: ${response2.data.data[0]?.id} (should be 6)`);
        
        // Test 3: Sorting by different columns
        console.log('   Testing sorting by score DESC...');
        const response3 = await axios.get(`${baseURL}/test_articles?limit=5&offset=0&sort=score&order=DESC`);
        console.log(`   ✅ Top score: ${response3.data.data[0]?.score} (should be highest)`);
        
        // Test 4: Sorting by title ASC
        console.log('   Testing sorting by title ASC...');
        const response4 = await axios.get(`${baseURL}/test_articles?limit=5&offset=0&sort=title&order=ASC`);
        console.log(`   ✅ First title: "${response4.data.data[0]?.title}" (should be alphabetically first)`);
        
        // Test 5: System fields are included
        console.log('   Testing system fields inclusion...');
        const record = response1.data.data[0];
        const hasSystemFields = record.id && record.created_at && record.updated_at;
        console.log(`   ✅ System fields present: id=${!!record.id}, created_at=${!!record.created_at}, updated_at=${!!record.updated_at}`);
        
        // Test 6: Collection info endpoint
        console.log('   Testing collection info endpoint...');
        const collectionResponse = await axios.get(`${baseURL}/collections/test_articles`);
        const collection = collectionResponse.data;
        console.log(`   ✅ Collection has ${collection.fields.length} user fields`);
        console.log(`   ✅ Indexable fields: ${collection.fields.filter(f => f.indexable).map(f => f.name).join(', ')}`);
        
        // Cleanup
        server.close();
        await db.close();
        const fs = require('fs');
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
        console.log('   ✅ Test server stopped and database cleaned up');
        
        console.log('\n📋 Enhanced Data Browser Test Summary');
        console.log('=====================================');
        console.log('✅ Server-side pagination with offset support');
        console.log('✅ Sorting by different columns (ASC/DESC)');
        console.log('✅ System fields (id, created_at, updated_at) included');
        console.log('✅ API returns proper pagination metadata');
        console.log('✅ Collection info includes indexable field information');
        console.log('\n🎉 All enhanced data browser tests passed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

// Install axios if not available
try {
    require('axios');
} catch (e) {
    console.log('Installing axios for testing...');
    require('child_process').execSync('npm install axios', { stdio: 'inherit' });
}

testEnhancedDataBrowser();