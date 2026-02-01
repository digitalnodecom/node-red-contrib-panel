const path = require('path');
const fs = require('fs').promises;
const { initDatabase } = require('./db');
const { initSchema, initUserSchema } = require('./schema');
const { auditDatabase } = require('./audit');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

class DatabaseManager {
    constructor(nodeRedUserDir) {
        this.userDir = nodeRedUserDir;
        this.dbDir = path.join(nodeRedUserDir, 'db');
        this.mainDbPath = path.join(this.dbDir, 'main.db');
        this.mainDb = null;
        this.databases = new Map(); // dbId -> connection
        this.initialized = false;
    }

    async createDatabaseConnection(dbPath, isMain = false) {
        try {
            // Open database with sqlite wrapper (without global state)
            const db = await open({
                filename: dbPath,
                driver: sqlite3.Database
            });
            
            // Enable foreign keys
            await db.run('PRAGMA foreign_keys = ON');
            
            // Set WAL mode for all new databases (better performance and concurrency)
            await db.run('PRAGMA journal_mode = WAL');
            console.log(`Panel: Set WAL journal mode for database: ${dbPath}`);
            
            // Initialize schema - use full schema for main, user schema for user databases
            if (isMain) {
                await initSchema(db);
            } else {
                await initUserSchema(db);
            }
            
            return db;
            
        } catch (error) {
            console.error(`Panel: Failed to create database connection for ${dbPath}:`, error);
            throw error;
        }
    }

    async initialize() {
        if (this.initialized) return;

        try {
            // Ensure /db folder exists
            await fs.mkdir(this.dbDir, { recursive: true });
            console.log(`Panel: Created/verified database directory: ${this.dbDir}`);

            // Initialize main database
            this.mainDb = await initDatabase(this.mainDbPath);
            console.log(`Panel: Main database initialized at: ${this.mainDbPath}`);

            // Add databases table to main database schema
            await this.initializeMainSchema();

            // Register main database in its own registry
            await this.registerMainDatabase();

            // Load existing registered databases
            await this.loadRegisteredDatabases();

            this.initialized = true;
            console.log('Panel: DatabaseManager initialized successfully');
        } catch (error) {
            console.error('Panel: Failed to initialize DatabaseManager:', error);
            throw error;
        }
    }

    async initializeMainSchema() {
        // Add _databases table to track all databases
        await this.mainDb.exec(`
            CREATE TABLE IF NOT EXISTS _databases (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                display_name TEXT NOT NULL,
                file_path TEXT UNIQUE NOT NULL,
                description TEXT,
                is_active INTEGER DEFAULT 1,
                is_main INTEGER DEFAULT 0,
                is_default INTEGER DEFAULT 0,
                settings TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Add trigger for updated_at
        await this.mainDb.exec(`
            CREATE TRIGGER IF NOT EXISTS update_databases_timestamp
            AFTER UPDATE ON _databases
            BEGIN
                UPDATE _databases SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
            END
        `);

        console.log('Panel: Main database schema initialized');
    }

    async registerMainDatabase() {
        // Check if main database is already registered
        const mainRecord = await this.mainDb.get(
            'SELECT * FROM _databases WHERE is_main = 1'
        );

        if (!mainRecord) {
            // Self-register the main database
            await this.mainDb.run(`
                INSERT INTO _databases (name, display_name, file_path, is_main, is_active, is_default, description)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                'main',
                'Main Database',
                'main.db',
                1, // is_main
                1, // is_active
                1, // is_default (main is default initially)
                'System database containing API keys, settings, and database registry'
            ]);

            console.log('Panel: Main database registered in registry');
        }
    }

    async loadRegisteredDatabases() {
        const registeredDatabases = await this.mainDb.all(
            'SELECT * FROM _databases WHERE is_active = 1'
        );

        for (const dbRecord of registeredDatabases) {
            try {
                const dbPath = path.join(this.dbDir, dbRecord.file_path);

                // Connect to database (check if it's main database)
                const isMain = dbRecord.is_main === 1;
                const db = await this.createDatabaseConnection(dbPath, isMain);
                
                // Store connection
                this.databases.set(dbRecord.name, {
                    connection: db,
                    info: dbRecord
                });

                console.log(`Panel: Loaded database: ${dbRecord.display_name} (${dbRecord.name})`);
            } catch (error) {
                console.error(`Panel: Failed to load database ${dbRecord.name}:`, error);
                // Mark database as inactive if it can't be loaded
                await this.mainDb.run(
                    'UPDATE _databases SET is_active = 0 WHERE id = ?',
                    dbRecord.id
                );
            }
        }
    }

    async createDatabase(name, displayName, description = null, req = null) {
        if (!this.initialized) {
            throw new Error('DatabaseManager not initialized');
        }

        // Validate name
        if (!name || typeof name !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) {
            throw new Error('Invalid database name. Must start with letter and contain only letters, numbers, and underscores.');
        }

        // Check if database already exists
        const existing = await this.mainDb.get(
            'SELECT * FROM _databases WHERE name = ?',
            name
        );
        if (existing) {
            throw new Error(`Database '${name}' already exists`);
        }

        const fileName = `${name}.db`;
        const dbPath = path.join(this.dbDir, fileName);

        try {
            // Ensure database directory exists
            await fs.mkdir(this.dbDir, { recursive: true });

            // Create new database file with separate connection (user database)
            const newDb = await this.createDatabaseConnection(dbPath, false);
            console.log(`Panel: Created new database: ${dbPath}`);

            // Register in main database with WAL mode default
            const result = await this.mainDb.run(`
                INSERT INTO _databases (name, display_name, file_path, description, is_main, is_active, journal_mode)
                VALUES (?, ?, ?, ?, 0, 1, 'WAL')
            `, [name, displayName, fileName, description]);

            // Store connection
            const dbInfo = {
                id: result.lastID,
                name,
                display_name: displayName,
                file_path: fileName,
                description,
                is_active: 1,
                is_main: 0,
                is_default: 0,
                journal_mode: 'WAL',
                created_at: new Date().toISOString()
            };

            this.databases.set(name, {
                connection: newDb,
                info: dbInfo
            });

            // Log audit event
            await auditDatabase.created(this.mainDb, name, displayName, req);

            console.log(`Panel: Database '${displayName}' created and registered`);
            return dbInfo;

        } catch (error) {
            console.error(`Panel: Failed to create database ${name}:`, error);
            
            // Cleanup: try to remove file if it was created
            try {
                await fs.unlink(dbPath);
            } catch (cleanupError) {
                // Ignore cleanup errors
            }
            
            throw error;
        }
    }

    async getDatabase(dbName) {
        if (!this.initialized) {
            throw new Error('DatabaseManager not initialized');
        }

        const dbEntry = this.databases.get(dbName);
        if (!dbEntry) {
            throw new Error(`Database '${dbName}' not found`);
        }

        return dbEntry.connection;
    }

    async getDatabaseInfo(dbName) {
        if (!this.initialized) {
            throw new Error('DatabaseManager not initialized');
        }

        const dbEntry = this.databases.get(dbName);
        if (!dbEntry) {
            throw new Error(`Database '${dbName}' not found`);
        }

        return dbEntry.info;
    }

    async listDatabases() {
        if (!this.initialized) {
            throw new Error('DatabaseManager not initialized');
        }

        return await this.mainDb.all(
            'SELECT * FROM _databases WHERE is_active = 1 ORDER BY is_main DESC, name ASC'
        );
    }

    async deleteDatabase(dbName, req = null) {
        if (!this.initialized) {
            throw new Error('DatabaseManager not initialized');
        }

        const dbEntry = this.databases.get(dbName);
        if (!dbEntry) {
            throw new Error(`Database '${dbName}' not found`);
        }

        // PROTECTION: Cannot delete main database
        if (dbEntry.info.is_main) {
            throw new Error('Cannot delete main database');
        }

        try {
            // Close connection
            await dbEntry.connection.close();

            // Remove from registry
            await this.mainDb.run(
                'DELETE FROM _databases WHERE name = ? AND is_main = 0',
                dbName
            );

            // Remove file
            const dbPath = path.join(this.dbDir, dbEntry.info.file_path);
            await fs.unlink(dbPath);

            // Remove from memory
            this.databases.delete(dbName);

            // Log audit event
            await auditDatabase.deleted(this.mainDb, dbName, dbEntry.info.display_name, req);

            console.log(`Panel: Database '${dbName}' deleted successfully`);
            return true;

        } catch (error) {
            console.error(`Panel: Failed to delete database ${dbName}:`, error);
            throw error;
        }
    }

    async updateDatabase(dbName, updates, req = null) {
        if (!this.initialized) {
            throw new Error('DatabaseManager not initialized');
        }

        const dbEntry = this.databases.get(dbName);
        if (!dbEntry) {
            throw new Error(`Database '${dbName}' not found`);
        }

        // Track changes for audit
        const changes = {};
        const allowedUpdates = ['display_name', 'description', 'is_default'];

        try {
            // Build update query
            const updateFields = [];
            const updateValues = [];

            for (const [key, value] of Object.entries(updates)) {
                if (allowedUpdates.includes(key)) {
                    updateFields.push(`${key} = ?`);
                    updateValues.push(value);
                    changes[key] = { old: dbEntry.info[key], new: value };
                }
            }

            if (updateFields.length === 0) {
                throw new Error('No valid fields to update');
            }

            // Handle is_default specially
            if (updates.is_default && updates.is_default !== dbEntry.info.is_default) {
                // Clear other defaults first
                await this.mainDb.run('UPDATE _databases SET is_default = 0');
            }

            updateValues.push(dbName);

            // Update in database
            const result = await this.mainDb.run(
                `UPDATE _databases SET ${updateFields.join(', ')} WHERE name = ?`,
                updateValues
            );

            if (result.changes === 0) {
                throw new Error(`Database '${dbName}' not found`);
            }

            // Update in memory
            Object.assign(dbEntry.info, updates);

            // Log audit event
            await auditDatabase.updated(this.mainDb, dbName, dbEntry.info.display_name, changes, req);

            console.log(`Panel: Database '${dbName}' updated successfully`);
            return dbEntry.info;

        } catch (error) {
            console.error(`Panel: Failed to update database ${dbName}:`, error);
            throw error;
        }
    }

    async setDefaultDatabase(dbName, req = null) {
        if (!this.initialized) {
            throw new Error('DatabaseManager not initialized');
        }

        // Get database info for audit
        const dbInfo = await this.getDatabaseInfo(dbName);

        // Clear current default
        await this.mainDb.run('UPDATE _databases SET is_default = 0');

        // Set new default
        const result = await this.mainDb.run(
            'UPDATE _databases SET is_default = 1 WHERE name = ? AND is_active = 1',
            dbName
        );

        if (result.changes === 0) {
            throw new Error(`Database '${dbName}' not found or not active`);
        }

        // Log audit event
        await auditDatabase.setDefault(this.mainDb, dbName, dbInfo.display_name, req);

        console.log(`Panel: Set '${dbName}' as default database`);
        return true;
    }

    async getDefaultDatabase() {
        if (!this.initialized) {
            throw new Error('DatabaseManager not initialized');
        }

        const defaultDb = await this.mainDb.get(
            'SELECT * FROM _databases WHERE is_default = 1 AND is_active = 1'
        );

        return defaultDb || null;
    }

    async getDatabaseStats() {
        if (!this.initialized) {
            throw new Error('DatabaseManager not initialized');
        }

        const databases = await this.listDatabases();
        
        let totalDatabases = 0;
        let totalCollections = 0;
        let totalRecords = 0;
        
        for (const db of databases) {
            totalDatabases++;
            
            try {
                const dbConnection = await this.getDatabase(db.name);
                
                // Count collections
                const collectionsResult = await dbConnection.get('SELECT COUNT(*) as count FROM _collections');
                totalCollections += collectionsResult.count;
                
                // Count total records
                const collections = await dbConnection.all('SELECT name FROM _collections');
                for (const collection of collections) {
                    try {
                        const recordsResult = await dbConnection.get(`SELECT COUNT(*) as count FROM ${collection.name}`);
                        totalRecords += recordsResult.count;
                    } catch (error) {
                        // Table might not exist, skip
                    }
                }
            } catch (error) {
                // Skip inaccessible databases
            }
        }
        
        return {
            total_databases: totalDatabases,
            total_collections: totalCollections,
            total_records: totalRecords,
            databases: databases.map(db => ({
                name: db.name,
                display_name: db.display_name,
                is_main: db.is_main === 1,
                is_default: db.is_default === 1,
                created_at: db.created_at
            }))
        };
    }

    getMainDatabase() {
        return this.mainDb;
    }

    getDbDirectory() {
        return this.dbDir;
    }

    async cleanup() {
        // Close all database connections
        for (const [name, dbEntry] of this.databases) {
            try {
                await dbEntry.connection.close();
                console.log(`Panel: Closed database connection: ${name}`);
            } catch (error) {
                console.error(`Panel: Error closing database ${name}:`, error);
            }
        }

        if (this.mainDb) {
            try {
                await this.mainDb.close();
                console.log('Panel: Closed main database connection');
            } catch (error) {
                console.error('Panel: Error closing main database:', error);
            }
        }

        this.databases.clear();
        this.initialized = false;
    }
}

// Singleton instance
let dbManager = null;

const createDatabaseManager = (nodeRedUserDir) => {
    if (!dbManager) {
        dbManager = new DatabaseManager(nodeRedUserDir);
    }
    return dbManager;
};

const getDatabaseManager = () => {
    if (!dbManager) {
        throw new Error('DatabaseManager not created. Call createDatabaseManager first.');
    }
    return dbManager;
};

module.exports = {
    DatabaseManager,
    createDatabaseManager,
    getDatabaseManager
};