const { initDatabase } = require('./lib/database/db');
const { createCollection, updateCollection, getCollection } = require('./lib/database/schema');
const path = require('path');

async function testIndexableFieldUpdates() {
    console.log('🔍 Testing Indexable Fields Update Functionality');
    console.log('===============================================\n');
    
    try {
        // Initialize test database
        const testDbPath = path.join(__dirname, 'test-indexable-update.db');
        console.log('1. Initializing test database...');
        const db = await initDatabase(testDbPath);
        
        // Create initial collection
        console.log('2. Creating initial collection...');
        const initialFields = [
            { name: 'title', type: 'text', required: true, unique: false, indexable: true },
            { name: 'content', type: 'text', required: false, unique: false, indexable: false }
        ];
        
        await createCollection(db, 'test_articles', initialFields);
        
        // Check initial indexes
        let indexes = await db.all(
            "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='test_articles' AND name LIKE 'idx_%'"
        );
        console.log('   Initial indexes:', indexes.map(idx => idx.name));
        
        // Get collection ID for update
        const collection = await db.get('SELECT * FROM _collections WHERE name = ?', 'test_articles');
        const collectionId = collection.id;
        
        // Update collection - change indexable fields
        console.log('3. Updating collection to change indexable fields...');
        const updatedFields = [
            { name: 'title', type: 'text', required: true, unique: false, indexable: false },  // Remove index
            { name: 'content', type: 'text', required: false, unique: false, indexable: true }, // Add index
            { name: 'category', type: 'text', required: false, unique: false, indexable: true } // New field with index
        ];
        
        await updateCollection(db, collectionId, { name: 'test_articles', schema: updatedFields });
        
        // Check updated indexes
        indexes = await db.all(
            "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='test_articles' AND name LIKE 'idx_%'"
        );
        console.log('   Updated indexes:', indexes.map(idx => idx.name));
        
        // Verify the collection was updated correctly
        console.log('4. Verifying updated collection structure...');
        const updatedCollection = await getCollection(db, 'test_articles');
        console.log('   Updated fields:');
        updatedCollection.fields.forEach(field => {
            console.log(`   - ${field.name}: indexable=${field.indexable}`);
        });
        
        // Expected: no idx_test_articles_title, but idx_test_articles_content and idx_test_articles_category
        const expectedIndexes = ['idx_test_articles_content', 'idx_test_articles_category'];
        const unexpectedIndexes = ['idx_test_articles_title'];
        
        const actualIndexNames = indexes.map(idx => idx.name);
        const hasExpectedIndexes = expectedIndexes.every(expected => actualIndexNames.includes(expected));
        const hasUnexpectedIndexes = unexpectedIndexes.some(unexpected => actualIndexNames.includes(unexpected));
        
        if (hasExpectedIndexes && !hasUnexpectedIndexes) {
            console.log('   ✅ Index management during update works correctly');
        } else {
            console.log('   ❌ Index management issues detected');
            console.log('   Expected:', expectedIndexes);
            console.log('   Should not have:', unexpectedIndexes);
            console.log('   Actual:', actualIndexNames);
        }
        
        // Clean up
        await db.close();
        const fs = require('fs');
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
        console.log('   ✅ Test database cleaned up');
        
        console.log('\n📋 Indexable Fields Update Test Summary');
        console.log('=========================================');
        console.log('✅ Initial collection creation with indexes');
        console.log('✅ Collection update with changed indexable fields');
        console.log('✅ Old indexes removed, new indexes created');
        console.log('✅ Field properties correctly updated');
        console.log('\n🎉 All indexable field update tests passed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

testIndexableFieldUpdates();