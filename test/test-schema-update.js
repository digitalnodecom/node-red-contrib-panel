#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const { initDatabase } = require('./lib/database/db');
const { createCollection, updateCollection, getCollection } = require('./lib/database/schema');

console.log('🧪 Testing Schema Update Functionality');
console.log('======================================');

async function testSchemaUpdate() {
    const testDbPath = path.join(__dirname, 'test-schema.db');
    
    try {
        // Clean up any existing test database
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
        
        console.log('\n1. Creating test database...');
        const db = await initDatabase(testDbPath);
        
        console.log('\n2. Creating initial collection...');
        const initialFields = [
            { name: 'name', type: 'text', required: true },
            { name: 'email', type: 'email', required: true }
        ];
        
        await createCollection(db, 'test_users', initialFields);
        console.log('✅ Initial collection created');
        
        // Insert some test data
        await db.run(
            'INSERT INTO test_users (name, email) VALUES (?, ?)',
            ['John Doe', 'john@example.com']
        );
        console.log('✅ Test data inserted');
        
        console.log('\n3. Getting collection info...');
        const originalCollection = await getCollection(db, 'test_users');
        console.log('Original fields:', originalCollection.fields.map(f => `${f.name}:${f.type}`).join(', '));
        
        console.log('\n4. Updating collection schema (adding age field)...');
        const updatedFields = [
            { name: 'name', type: 'text', required: true },
            { name: 'email', type: 'email', required: true },
            { name: 'age', type: 'number', required: false, default: 0 },
            { name: 'active', type: 'boolean', required: false, default: true }
        ];
        
        await updateCollection(db, originalCollection.id, { 
            name: 'test_users', 
            schema: updatedFields 
        });
        console.log('✅ Collection schema updated');
        
        console.log('\n5. Verifying updated schema...');
        const updatedCollection = await getCollection(db, 'test_users');
        console.log('Updated fields:', updatedCollection.fields.map(f => `${f.name}:${f.type}`).join(', '));
        
        console.log('\n6. Testing table structure...');
        const tableInfo = await db.all('PRAGMA table_info(test_users)');
        console.log('Actual table columns:', tableInfo.map(col => `${col.name}:${col.type}`).join(', '));
        
        console.log('\n7. Testing data with new fields...');
        await db.run(
            'INSERT INTO test_users (name, email, age, active) VALUES (?, ?, ?, ?)',
            ['Jane Doe', 'jane@example.com', 25, 1]
        );
        
        const allUsers = await db.all('SELECT * FROM test_users');
        console.log('All users:', allUsers.length, 'records found');
        allUsers.forEach(user => {
            console.log(`  - ${user.name} (${user.email}) age: ${user.age || 'null'} active: ${user.active || 'null'}`);
        });
        
        await db.close();
        fs.unlinkSync(testDbPath);
        
        console.log('\n🎉 Schema update test completed successfully!');
        
    } catch (error) {
        console.error('\n❌ Schema update test failed:', error.message);
        console.error('Full error:', error);
        
        if (fs.existsSync(testDbPath)) {
            try {
                fs.unlinkSync(testDbPath);
            } catch (cleanupError) {
                console.error('Could not clean up test database:', cleanupError.message);
            }
        }
        
        process.exit(1);
    }
}

testSchemaUpdate();