const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const { initSchema } = require('./schema');

let db = null;

async function initDatabase(dbPath) {
    if (db) return db;
    
    try {
        // Open database with sqlite wrapper
        db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });
        
        // Enable foreign keys
        await db.run('PRAGMA foreign_keys = ON');
        
        // Check SQLite version for ON CONFLICT support (requires 3.24.0+)
        const versionResult = await db.get('SELECT sqlite_version() as version');
        const version = versionResult.version;
        console.log(`SQLite version: ${version}`);
        
        // Parse version numbers for comparison
        const versionParts = version.split('.').map(Number);
        const [major, minor, patch] = versionParts;
        
        // Check if version supports ON CONFLICT (3.24.0+)
        const supportsOnConflict = major > 3 || 
                                  (major === 3 && minor > 24) || 
                                  (major === 3 && minor === 24 && patch >= 0);
        
        if (!supportsOnConflict) {
            console.warn(`WARNING: SQLite version ${version} may not fully support ON CONFLICT clause. Recommended version: 3.24.0+`);
            console.warn('Upsert functionality may be limited or cause errors.');
        } else {
            console.log(`SQLite version ${version} supports ON CONFLICT - upsert functionality enabled`);
        }
        
        // Store version info for later use
        db._sqliteVersion = version;
        db._supportsOnConflict = supportsOnConflict;
        
        // Initialize schema
        await initSchema(db);
        
        console.log('Database initialized successfully');
        return db;
    } catch (error) {
        console.error('Database initialization error:', error);
        throw error;
    }
}

function getDatabase() {
    if (!db) {
        throw new Error('Database not initialized. Call initDatabase first.');
    }
    return db;
}

async function closeDatabase() {
    if (db) {
        await db.close();
        db = null;
    }
}

// Helper functions to maintain compatibility
function prepare(sql) {
    return {
        run: async (...params) => {
            const result = await db.run(sql, ...params);
            return {
                lastInsertRowid: result.lastID,
                changes: result.changes
            };
        },
        get: async (...params) => {
            return await db.get(sql, ...params);
        },
        all: async (...params) => {
            return await db.all(sql, ...params);
        }
    };
}

module.exports = {
    initDatabase,
    getDatabase,
    closeDatabase,
    prepare
};