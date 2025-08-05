const { initDatabase, closeDatabase } = require('../lib/database/db');
const { createCollection } = require('../lib/database/schema');
const recordsController = require('../lib/api/controllers/records');
const path = require('path');
const fs = require('fs');

async function testUpsertAPI() {
    console.log('🧪 Testing upsert API endpoint...\n');
    
    // Setup test database
    const testDbPath = path.join(__dirname, 'test-upsert-api.db');
    
    // Remove existing test database
    if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
    }
    
    let db = null;
    
    try {
        // Initialize database
        db = await initDatabase(testDbPath);
        console.log('✅ Database initialized');
        
        // Create test collection using the schema function
        const fields = [
            { name: 'email', type: 'email', required: true, unique: true },
            { name: 'name', type: 'text', required: true },
            { name: 'role', type: 'text', required: false },
            { name: 'age', type: 'integer', required: false }
        ];
        
        await createCollection(db, 'users', fields);
        console.log('✅ Test collection "users" created\n');
        
        // Mock request and response objects
        function createMockReq(collection, body) {
            return {
                params: { collection },
                body,
                db
            };
        }
        
        function createMockRes() {
            const res = {
                statusCode: 200,
                jsonData: null,
                status: function(code) {
                    this.statusCode = code;
                    return this;
                },
                json: function(data) {
                    this.jsonData = data;
                    return this;
                }
            };
            return res;
        }
        
        // Test 1: Upsert new record (should insert)
        console.log('📝 Test 1: Upsert new record');
        const req1 = createMockReq('users', {
            data: {
                email: 'john@example.com',
                name: 'John Doe',
                role: 'admin',
                age: 30
            },
            matchFields: ['email'],
            mode: 'upsert'
        });
        const res1 = createMockRes();
        
        await recordsController.upsert(req1, res1, (err) => {
            if (err) throw err;
        });
        
        console.log('   Status:', res1.statusCode);
        console.log('   Response:', JSON.stringify(res1.jsonData, null, 2));
        console.log('   ✅ New record inserted');
        
        // Test 2: Upsert existing record (should update)
        console.log('\n📝 Test 2: Upsert existing record');
        const req2 = createMockReq('users', {
            data: {
                email: 'john@example.com',
                name: 'John Smith',
                role: 'moderator',
                age: 31
            },
            matchFields: ['email'],
            mode: 'upsert'
        });
        const res2 = createMockRes();
        
        await recordsController.upsert(req2, res2, (err) => {
            if (err) throw err;
        });
        
        console.log('   Status:', res2.statusCode);
        console.log('   Response:', JSON.stringify(res2.jsonData, null, 2));
        console.log('   ✅ Existing record updated');
        
        // Test 3: Update-only mode on existing record
        console.log('\n📝 Test 3: Update-only mode on existing record');
        const req3 = createMockReq('users', {
            data: {
                email: 'john@example.com',
                name: 'John Johnson',
                role: 'supervisor'
            },
            matchFields: ['email'],
            mode: 'updateOnly'
        });
        const res3 = createMockRes();
        
        await recordsController.upsert(req3, res3, (err) => {
            if (err) throw err;
        });
        
        console.log('   Status:', res3.statusCode);
        console.log('   Response:', JSON.stringify(res3.jsonData, null, 2));
        console.log('   ✅ Update-only mode worked on existing record');
        
        // Test 4: Update-only mode on non-existing record (should fail/skip)
        console.log('\n📝 Test 4: Update-only mode on non-existing record');
        const req4 = createMockReq('users', {
            data: {
                email: 'jane@example.com',
                name: 'Jane Doe',
                role: 'user'
            },
            matchFields: ['email'],
            mode: 'updateOnly'
        });
        const res4 = createMockRes();
        
        await recordsController.upsert(req4, res4, (err) => {
            if (err) throw err;
        });
        
        console.log('   Status:', res4.statusCode);
        console.log('   Response:', JSON.stringify(res4.jsonData, null, 2));
        console.log('   ✅ Update-only mode handled non-existing record');
        
        // Test 5: Insert-only mode on non-existing record
        console.log('\n📝 Test 5: Insert-only mode on non-existing record');
        const req5 = createMockReq('users', {
            data: {
                email: 'alice@example.com',
                name: 'Alice Cooper',
                role: 'user'
            },
            matchFields: ['email'],
            mode: 'insertOnly'
        });
        const res5 = createMockRes();
        
        await recordsController.upsert(req5, res5, (err) => {
            if (err) throw err;
        });
        
        console.log('   Status:', res5.statusCode);
        console.log('   Response:', JSON.stringify(res5.jsonData, null, 2));
        console.log('   ✅ Insert-only mode created new record');
        
        // Test 6: Insert-only mode on existing record (should fail)
        console.log('\n📝 Test 6: Insert-only mode on existing record');
        const req6 = createMockReq('users', {
            data: {
                email: 'alice@example.com',
                name: 'Alice Smith',
                role: 'admin'
            },
            matchFields: ['email'],
            mode: 'insertOnly'
        });
        const res6 = createMockRes();
        
        await recordsController.upsert(req6, res6, (err) => {
            if (err) throw err;
        });
        
        console.log('   Status:', res6.statusCode);
        console.log('   Response:', JSON.stringify(res6.jsonData, null, 2));
        console.log('   ✅ Insert-only mode correctly rejected existing record');
        
        // Test 7: Error handling - invalid match field
        console.log('\n📝 Test 7: Invalid match field');
        const req7 = createMockReq('users', {
            data: {
                email: 'test@example.com',
                name: 'Test User'
            },
            matchFields: ['invalid_field'],
            mode: 'upsert'
        });
        const res7 = createMockRes();
        
        await recordsController.upsert(req7, res7, (err) => {
            if (err) throw err;
        });
        
        console.log('   Status:', res7.statusCode);
        console.log('   Response:', JSON.stringify(res7.jsonData, null, 2));
        console.log('   ✅ Invalid match field error handled correctly');
        
        // Test 8: Error handling - missing required field
        console.log('\n📝 Test 8: Missing required field');
        const req8 = createMockReq('users', {
            data: {
                email: 'incomplete@example.com'
                // Missing required 'name' field
            },
            matchFields: ['email'],
            mode: 'upsert'
        });
        const res8 = createMockRes();
        
        await recordsController.upsert(req8, res8, (err) => {
            if (err) throw err;
        });
        
        console.log('   Status:', res8.statusCode);
        console.log('   Response:', JSON.stringify(res8.jsonData, null, 2));
        console.log('   ✅ Missing required field error handled correctly');
        
        // Summary
        console.log('\n📊 Final Database State:');
        const finalUsers = await db.all('SELECT * FROM users ORDER BY id');
        console.log('   Users table:');
        finalUsers.forEach(user => {
            console.log('     -', JSON.stringify(user, null, 2));
        });
        
        console.log('\n🎉 All upsert API tests completed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        throw error;
    } finally {
        // Cleanup
        if (db) {
            await closeDatabase();
        }
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
        console.log('🧹 Test database cleaned up');
    }
}

// Run the test
if (require.main === module) {
    testUpsertAPI().catch(console.error);
}

module.exports = { testUpsertAPI };