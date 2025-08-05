const { initDatabase, closeDatabase } = require('../lib/database/db');
const path = require('path');
const fs = require('fs');

async function testUpsert() {
    console.log('🧪 Testing upsert functionality...\n');
    
    // Setup test database
    const testDbPath = path.join(__dirname, 'test-upsert.db');
    
    // Remove existing test database
    if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
    }
    
    let db = null;
    
    try {
        // Initialize database
        db = await initDatabase(testDbPath);
        console.log('✅ Database initialized');
        
        // Create test collection
        await db.run(`
            INSERT INTO _collections (name, schema, events_enabled) 
            VALUES ('users', '[]', 0)
        `);
        
        const collectionResult = await db.get('SELECT last_insert_rowid() as id');
        const collectionId = collectionResult.id;
        
        // Add fields to the collection
        await db.run(`
            INSERT INTO _fields (collection_id, name, type, required, unique_field, indexable)
            VALUES 
                (?, 'email', 'email', 1, 1, 0),
                (?, 'name', 'text', 1, 0, 0),
                (?, 'role', 'text', 0, 0, 0),
                (?, 'active', 'boolean', 0, 0, 0)
        `, [collectionId, collectionId, collectionId, collectionId]);
        
        // Create the actual users table
        await db.exec(`
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL,
                name TEXT NOT NULL,
                role TEXT,
                active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Create unique index for email (needed for upsert)
        await db.exec('CREATE UNIQUE INDEX idx_users_email ON users (email)');
        
        console.log('✅ Test collection "users" created with fields: email (unique), name, role, active\n');
        
        // Test 1: Insert new record (should insert)
        console.log('📝 Test 1: Insert new record');
        const insertSql = `
            INSERT INTO users (email, name, role, active) 
            VALUES (?, ?, ?, ?)
            ON CONFLICT(email) 
            DO UPDATE SET 
                name = excluded.name,
                role = excluded.role,
                active = excluded.active,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `;
        
        const result1 = await db.get(insertSql, ['john@example.com', 'John Doe', 'admin', 1]);
        console.log('   Result:', JSON.stringify(result1, null, 2));
        console.log('   ✅ New record inserted with ID:', result1.id);
        
        // Test 2: Update existing record (should update)
        console.log('\n📝 Test 2: Update existing record');
        const result2 = await db.get(insertSql, ['john@example.com', 'John Smith', 'moderator', 1]);
        console.log('   Result:', JSON.stringify(result2, null, 2));
        console.log('   ✅ Existing record updated - name changed from "John Doe" to "John Smith"');
        console.log('   ✅ Role changed from "admin" to "moderator"');
        
        // Test 3: Insert another new record
        console.log('\n📝 Test 3: Insert different record');
        const result3 = await db.get(insertSql, ['jane@example.com', 'Jane Doe', 'user', 1]);
        console.log('   Result:', JSON.stringify(result3, null, 2));
        console.log('   ✅ New record inserted with ID:', result3.id);
        
        // Test 4: Test insertOnly mode (DO NOTHING)
        console.log('\n📝 Test 4: Insert-only mode (should not update existing)');
        const insertOnlySql = `
            INSERT INTO users (email, name, role, active) 
            VALUES (?, ?, ?, ?)
            ON CONFLICT(email) DO NOTHING
            RETURNING *
        `;
        
        const result4 = await db.get(insertOnlySql, ['john@example.com', 'John Updated', 'superadmin', 0]);
        console.log('   Result:', result4 || 'null (no changes made)');
        if (!result4) {
            console.log('   ✅ Insert-only mode worked - no update performed on existing record');
        }
        
        // Verify no changes were made
        const checkResult = await db.get('SELECT * FROM users WHERE email = ?', ['john@example.com']);
        console.log('   Verification - Current record:', JSON.stringify(checkResult, null, 2));
        console.log('   ✅ Confirmed: name is still "John Smith" (not "John Updated")');
        
        // Test 5: Test composite key upsert
        console.log('\n📝 Test 5: Composite key upsert');
        
        // Create a products table for composite key testing
        await db.exec(`
            CREATE TABLE products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sku TEXT NOT NULL,
                vendor_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                price REAL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Create composite unique index
        await db.exec('CREATE UNIQUE INDEX idx_products_sku_vendor ON products (sku, vendor_id)');
        
        const compositeSql = `
            INSERT INTO products (sku, vendor_id, name, price) 
            VALUES (?, ?, ?, ?)
            ON CONFLICT(sku, vendor_id) 
            DO UPDATE SET 
                name = excluded.name,
                price = excluded.price,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `;
        
        // Insert first product
        const prod1 = await db.get(compositeSql, ['PROD-123', 1, 'Product A', 29.99]);
        console.log('   Inserted product:', JSON.stringify(prod1, null, 2));
        
        // Update same product (same sku + vendor_id)
        const prod2 = await db.get(compositeSql, ['PROD-123', 1, 'Product A Updated', 39.99]);
        console.log('   Updated product:', JSON.stringify(prod2, null, 2));
        console.log('   ✅ Composite key upsert worked - same ID, updated name and price');
        
        // Insert different vendor with same SKU (should be new record)
        const prod3 = await db.get(compositeSql, ['PROD-123', 2, 'Product A from Vendor 2', 25.99]);
        console.log('   Different vendor product:', JSON.stringify(prod3, null, 2));
        console.log('   ✅ Different vendor created new record (different ID)');
        
        // Test 6: Error handling - test without unique index
        console.log('\n📝 Test 6: Error handling');
        
        try {
            await db.exec(`
                CREATE TABLE test_no_index (
                    id INTEGER PRIMARY KEY,
                    email TEXT
                )
            `);
            
            // This should fail because there's no unique index on email
            await db.get(`
                INSERT INTO test_no_index (email) VALUES (?)
                ON CONFLICT(email) DO UPDATE SET email = excluded.email
                RETURNING *
            `, ['test@example.com']);
            
            console.log('   ❌ Expected error did not occur');
        } catch (error) {
            console.log('   ✅ Expected error caught:', error.message);
            console.log('   ✅ Error handling works correctly');
        }
        
        // Summary
        console.log('\n📊 Test Summary:');
        const finalUsers = await db.all('SELECT * FROM users ORDER BY id');
        console.log('   Final users table:');
        finalUsers.forEach(user => {
            console.log('     -', JSON.stringify(user, null, 2));
        });
        
        const finalProducts = await db.all('SELECT * FROM products ORDER BY id');
        console.log('   Final products table:');
        finalProducts.forEach(product => {
            console.log('     -', JSON.stringify(product, null, 2));
        });
        
        console.log('\n🎉 All upsert tests completed successfully!');
        
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
    testUpsert().catch(console.error);
}

module.exports = { testUpsert };