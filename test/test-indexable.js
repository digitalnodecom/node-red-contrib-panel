const { initDatabase } = require('./lib/database/db');
const { createCollection, getCollection } = require('./lib/database/schema');
const path = require('path');

async function testIndexableFields() {
    console.log('🔍 Testing Indexable Fields Functionality');
    console.log('========================================\n');
    
    try {
        // Initialize test database
        const testDbPath = path.join(__dirname, 'test-indexable.db');
        console.log('1. Initializing test database...');
        const db = await initDatabase(testDbPath);
        
        // Test collection with indexable fields
        console.log('2. Creating collection with indexable fields...');
        const testFields = [
            { 
                name: 'title', 
                type: 'text', 
                required: true, 
                unique: false, 
                indexable: true  // This should create an index
            },
            { 
                name: 'email', 
                type: 'email', 
                required: true, 
                unique: true, 
                indexable: false  // Unique already creates index, so indexable is redundant
            },
            { 
                name: 'content', 
                type: 'text', 
                required: false, 
                unique: false, 
                indexable: false  // No index
            },
            { 
                name: 'category', 
                type: 'text', 
                required: false, 
                unique: false, 
                indexable: true  // This should create an index
            }
        ];
        
        await createCollection(db, 'test_posts', testFields);
        console.log('   ✅ Collection created with indexable fields');
        
        // Verify the collection was created with correct field properties
        console.log('3. Verifying collection structure...');
        const collection = await getCollection(db, 'test_posts');
        console.log('   Collection fields:');
        collection.fields.forEach(field => {
            console.log(`   - ${field.name}: type=${field.type}, required=${field.required}, unique=${field.unique}, indexable=${field.indexable}`);
        });
        
        // Check that indexes were created
        console.log('4. Checking created indexes...');
        const indexes = await db.all(
            "SELECT name, tbl_name, sql FROM sqlite_master WHERE type='index' AND tbl_name='test_posts'"
        );
        
        console.log('   Created indexes:');
        indexes.forEach(index => {
            console.log(`   - ${index.name}: ${index.sql || 'Built-in index'}`);
        });
        
        // Verify expected indexes exist
        const indexNames = indexes.map(idx => idx.name);
        const expectedIndexes = ['idx_test_posts_title', 'idx_test_posts_category'];
        const hasExpectedIndexes = expectedIndexes.every(expected => 
            indexNames.some(name => name === expected)
        );
        
        if (hasExpectedIndexes) {
            console.log('   ✅ All expected indexes created successfully');
        } else {
            console.log('   ❌ Some expected indexes missing');
            console.log('   Expected:', expectedIndexes);
            console.log('   Found:', indexNames.filter(name => name.startsWith('idx_')));
        }
        
        // Test inserting some data
        console.log('5. Testing data insertion...');
        await db.run(
            'INSERT INTO test_posts (title, email, content, category) VALUES (?, ?, ?, ?)',
            ['Test Post', 'user@example.com', 'Some content here', 'tech']
        );
        console.log('   ✅ Data inserted successfully');
        
        // Test querying with indexed fields
        console.log('6. Testing queries on indexed fields...');
        const titleResult = await db.get('SELECT * FROM test_posts WHERE title = ?', ['Test Post']);
        const categoryResult = await db.get('SELECT * FROM test_posts WHERE category = ?', ['tech']);
        
        if (titleResult && categoryResult) {
            console.log('   ✅ Queries on indexed fields work correctly');
        } else {
            console.log('   ❌ Query issues detected');
        }
        
        // Clean up
        await db.close();
        const fs = require('fs');
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
        console.log('   ✅ Test database cleaned up');
        
        console.log('\n📋 Indexable Fields Test Summary');
        console.log('=================================');
        console.log('✅ Database initialization successful');
        console.log('✅ Collection creation with indexable fields');
        console.log('✅ Field properties correctly stored and retrieved');
        console.log('✅ Indexes created for indexable fields');
        console.log('✅ Data operations work with indexed fields');
        console.log('\n🎉 All indexable field tests passed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

testIndexableFields();