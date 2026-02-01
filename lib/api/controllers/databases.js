const { getDatabaseManager } = require('../../database/dbManager');

// List all databases
const listDatabases = async (req, res) => {
    try {
        const dbManager = getDatabaseManager();
        const databases = await dbManager.listDatabases();
        
        // Enhance each database with additional info
        for (const db of databases) {
            try {
                // Get record count for each database (collections table)
                const dbConnection = await dbManager.getDatabase(db.name);
                const collectionsResult = await dbConnection.get('SELECT COUNT(*) as count FROM _collections');
                db.collection_count = collectionsResult.count;
                
                // Get total records across all collections
                let totalRecords = 0;
                const collections = await dbConnection.all('SELECT name FROM _collections');
                for (const collection of collections) {
                    try {
                        const recordsResult = await dbConnection.get(`SELECT COUNT(*) as count FROM ${collection.name}`);
                        totalRecords += recordsResult.count;
                    } catch (error) {
                        // Table might not exist, skip
                    }
                }
                db.total_records = totalRecords;
                
            } catch (error) {
                // If database can't be accessed, set defaults
                db.collection_count = 0;
                db.total_records = 0;
                db.error = 'Unable to access database';
            }
        }
        
        res.json(databases);
    } catch (error) {
        console.error('Error listing databases:', error);
        res.status(500).json({
            error: 'Failed to list databases',
            details: error.message
        });
    }
};

// Get specific database information
const getDatabase = async (req, res) => {
    try {
        const dbManager = getDatabaseManager();
        const { dbId } = req.params;

        const dbInfo = await dbManager.getDatabaseInfo(dbId);

        // Add additional statistics
        const dbConnection = await dbManager.getDatabase(dbId);
        const collectionsResult = await dbConnection.get('SELECT COUNT(*) as count FROM _collections');
        dbInfo.collection_count = collectionsResult.count;

        // Get current journal mode
        try {
            const journalResult = await dbConnection.get('PRAGMA journal_mode');
            dbInfo.journal_mode = journalResult.journal_mode;
        } catch (error) {
            console.warn('Could not retrieve journal mode for database:', dbId, error);
            dbInfo.journal_mode = 'unknown';
        }

        // Get collections list
        const collections = await dbConnection.all('SELECT name, created_at FROM _collections ORDER BY name');
        dbInfo.collections = collections;

        // Calculate total records
        let totalRecords = 0;
        for (const collection of collections) {
            try {
                const recordsResult = await dbConnection.get(`SELECT COUNT(*) as count FROM ${collection.name}`);
                totalRecords += recordsResult.count;
            } catch (error) {
                // Table might not exist, skip
            }
        }
        dbInfo.total_records = totalRecords;

        res.json(dbInfo);
    } catch (error) {
        console.error('Error getting database:', error);
        res.status(404).json({
            error: 'Database not found',
            details: error.message
        });
    }
};

// Create new database
const createDatabase = async (req, res) => {
    try {
        const dbManager = getDatabaseManager();
        const { name, display_name, description } = req.body;
        
        if (!name || !display_name) {
            return res.status(400).json({
                error: 'Validation error',
                details: 'Name and display_name are required'
            });
        }
        
        const dbInfo = await dbManager.createDatabase(name, display_name, description, req);
        
        res.status(201).json({
            message: 'Database created successfully',
            database: dbInfo
        });
    } catch (error) {
        console.error('Error creating database:', error);
        res.status(400).json({
            error: 'Failed to create database',
            details: error.message
        });
    }
};

// Update database information
const updateDatabase = async (req, res) => {
    try {
        const dbManager = getDatabaseManager();
        const { dbId } = req.params;
        const { display_name, description, is_default } = req.body;
        
        // Get current database info
        const dbInfo = await dbManager.getDatabaseInfo(dbId);
        
        // Cannot modify main database certain properties
        if (dbInfo.is_main && req.body.name) {
            return res.status(403).json({
                error: 'Cannot rename main database'
            });
        }
        
        // Update in main database
        const masterDb = dbManager.getMainDatabase();
        const updates = [];
        const values = [];
        
        if (display_name !== undefined) {
            updates.push('display_name = ?');
            values.push(display_name);
        }
        
        if (description !== undefined) {
            updates.push('description = ?');
            values.push(description);
        }
        
        if (updates.length > 0) {
            values.push(dbId);
            await masterDb.run(
                `UPDATE _databases SET ${updates.join(', ')} WHERE name = ?`,
                values
            );
        }
        
        // Handle default database change
        if (is_default === true) {
            await dbManager.setDefaultDatabase(dbId, req);
        } else {
            // Use the new updateDatabase method for other changes
            if (updates.length > 0) {
                const updateData = {};
                if (display_name !== undefined) updateData.display_name = display_name;
                if (description !== undefined) updateData.description = description;
                await dbManager.updateDatabase(dbId, updateData, req);
            }
        }
        
        // Return updated info
        const updatedInfo = await dbManager.getDatabaseInfo(dbId);
        res.json(updatedInfo);
        
    } catch (error) {
        console.error('Error updating database:', error);
        res.status(400).json({
            error: 'Failed to update database',
            details: error.message
        });
    }
};

// Delete database
const deleteDatabase = async (req, res) => {
    try {
        const dbManager = getDatabaseManager();
        const { dbId } = req.params;
        
        // Get database info to check if it's master
        const dbInfo = await dbManager.getDatabaseInfo(dbId);
        
        // Protect main database
        if (dbInfo.is_main) {
            return res.status(403).json({
                error: 'Cannot delete main database',
                details: 'The main database contains system data and cannot be deleted'
            });
        }
        
        await dbManager.deleteDatabase(dbId, req);
        
        res.json({
            message: 'Database deleted successfully',
            database_name: dbId
        });
        
    } catch (error) {
        console.error('Error deleting database:', error);
        res.status(400).json({
            error: 'Failed to delete database',
            details: error.message
        });
    }
};

// Set default database
const setDefaultDatabase = async (req, res) => {
    try {
        const dbManager = getDatabaseManager();
        const { dbId } = req.params;
        
        await dbManager.setDefaultDatabase(dbId, req);
        
        res.json({
            message: 'Default database updated',
            default_database: dbId
        });
        
    } catch (error) {
        console.error('Error setting default database:', error);
        res.status(400).json({
            error: 'Failed to set default database',
            details: error.message
        });
    }
};

// Get database statistics
const getDatabaseStats = async (req, res) => {
    try {
        const dbManager = getDatabaseManager();
        const databases = await dbManager.listDatabases();
        
        let totalDatabases = 0;
        let totalCollections = 0;
        let totalRecords = 0;
        
        for (const db of databases) {
            totalDatabases++;
            
            try {
                const dbConnection = await dbManager.getDatabase(db.name);
                
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
        
        res.json({
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
        });
        
    } catch (error) {
        console.error('Error getting database statistics:', error);
        res.status(500).json({
            error: 'Failed to get database statistics',
            details: error.message
        });
    }
};

// Change journal mode for a specific database
const changeJournalMode = async (req, res) => {
    try {
        const dbManager = getDatabaseManager();
        const { dbId } = req.params;
        const { mode } = req.body;

        const validModes = ['DELETE', 'TRUNCATE', 'PERSIST', 'MEMORY', 'WAL', 'OFF'];

        if (!mode || !validModes.includes(mode.toUpperCase())) {
            return res.status(400).json({
                error: 'Invalid journal mode',
                validModes: validModes
            });
        }

        const dbConnection = await dbManager.getDatabase(dbId);

        // Execute the journal mode change
        const result = await dbConnection.get(`PRAGMA journal_mode = ${mode.toUpperCase()}`);
        const newJournalMode = result.journal_mode;

        // Update the database registry with new journal mode
        const masterDb = dbManager.getMainDatabase();
        await masterDb.run(
            'UPDATE _databases SET journal_mode = ? WHERE name = ?',
            [newJournalMode, dbId]
        );

        res.json({
            success: true,
            journalMode: newJournalMode,
            database: dbId
        });

    } catch (error) {
        console.error('Error changing journal mode:', error);
        res.status(500).json({
            error: 'Failed to change journal mode',
            details: error.message
        });
    }
};

// Vacuum a specific database
const vacuumDatabase = async (req, res) => {
    try {
        const dbManager = getDatabaseManager();
        const { dbId } = req.params;

        const dbConnection = await dbManager.getDatabase(dbId);
        await dbConnection.run('VACUUM');

        res.json({
            success: true,
            message: `Database '${dbId}' vacuumed successfully`
        });

    } catch (error) {
        console.error('Error vacuuming database:', error);
        res.status(500).json({
            error: 'Failed to vacuum database',
            details: error.message
        });
    }
};

// Analyze a specific database
const analyzeDatabase = async (req, res) => {
    try {
        const dbManager = getDatabaseManager();
        const { dbId } = req.params;

        const dbConnection = await dbManager.getDatabase(dbId);
        await dbConnection.run('ANALYZE');

        res.json({
            success: true,
            message: `Database '${dbId}' analyzed successfully`
        });

    } catch (error) {
        console.error('Error analyzing database:', error);
        res.status(500).json({
            error: 'Failed to analyze database',
            details: error.message
        });
    }
};

module.exports = {
    listDatabases,
    getDatabase,
    createDatabase,
    updateDatabase,
    deleteDatabase,
    setDefaultDatabase,
    getDatabaseStats,
    changeJournalMode,
    vacuumDatabase,
    analyzeDatabase
};