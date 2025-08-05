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