const initSchema = async (db) => {
    try {
        // Create system tables one by one to avoid SQL parsing issues
        
        // Collections table
        await db.exec(`
            CREATE TABLE IF NOT EXISTS _collections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                schema TEXT NOT NULL,
                events_enabled INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Fields table - simplified to avoid syntax issues
        await db.exec(`
            CREATE TABLE IF NOT EXISTS _fields (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                collection_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                required INTEGER DEFAULT 0,
                unique_field INTEGER DEFAULT 0,
                indexable INTEGER DEFAULT 0,
                default_value TEXT,
                options TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Trigger events table for database change notifications
        await db.exec(`
            CREATE TABLE IF NOT EXISTS _trigger_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                collection TEXT NOT NULL,
                event_type TEXT NOT NULL,
                record_id INTEGER,
                old_data TEXT,
                new_data TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                processed INTEGER DEFAULT 0
            )
        `);
        
        // Migration: Add indexable column to existing _fields table if it doesn't exist
        try {
            const columns = await db.all("PRAGMA table_info(_fields)");
            const hasIndexable = columns.some(col => col.name === 'indexable');
            
            if (!hasIndexable) {
                console.log('Migrating database: adding indexable column to _fields table');
                await db.exec('ALTER TABLE _fields ADD COLUMN indexable INTEGER DEFAULT 0');
            }
        } catch (migrationError) {
            console.warn('Migration warning (may be safe to ignore):', migrationError.message);
        }
        
        // Migration: Add events_enabled column to existing _collections table if it doesn't exist
        try {
            const collectionsColumns = await db.all("PRAGMA table_info(_collections)");
            const hasEventsEnabled = collectionsColumns.some(col => col.name === 'events_enabled');
            
            if (!hasEventsEnabled) {
                console.log('Migrating database: adding events_enabled column to _collections table');
                await db.exec('ALTER TABLE _collections ADD COLUMN events_enabled INTEGER DEFAULT 0');
            }
        } catch (migrationError) {
            console.warn('Migration warning (may be safe to ignore):', migrationError.message);
        }
        
        // Create trigger to update updated_at
        await db.exec(`
            CREATE TRIGGER IF NOT EXISTS update_collections_timestamp 
            AFTER UPDATE ON _collections
            BEGIN
                UPDATE _collections SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
            END
        `);
        
    } catch (error) {
        throw error;
    }
};

const createCollection = async (db, name, fields, eventsEnabled = false) => {
    // Validate collection name - must be alphanumeric with underscores only
    if (!name || typeof name !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) {
        throw new Error(`Invalid collection name: '${name}'. Must start with a letter and contain only letters, numbers, and underscores.`);
    }
    
    // Validate fields array
    if (!Array.isArray(fields) || fields.length === 0) {
        throw new Error('Fields must be a non-empty array');
    }

    await db.run('BEGIN TRANSACTION');
    
    try {
        // Insert collection
        const collectionResult = await db.run(
            'INSERT INTO _collections (name, schema, events_enabled) VALUES (?, ?, ?)',
            [name, JSON.stringify(fields), eventsEnabled ? 1 : 0]
        );
        
        const collectionId = collectionResult.lastID;
        
        // Insert fields
        const insertFieldSQL = 'INSERT INTO _fields (collection_id, name, type, required, unique_field, indexable, default_value, options) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
        
        // Build CREATE TABLE statement
        let createTableSQL = `CREATE TABLE IF NOT EXISTS ${name} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,`;
        
        for (const field of fields) {
            // Validate field object
            if (!field || typeof field !== 'object') {
                throw new Error(`Invalid field object: ${JSON.stringify(field)}`);
            }
            if (!field.name || typeof field.name !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(field.name)) {
                throw new Error(`Field must have a valid name (alphanumeric with underscores, starting with letter): ${JSON.stringify(field)}`);
            }
            if (!field.type || typeof field.type !== 'string') {
                throw new Error(`Field '${field.name}' must have a valid type: ${JSON.stringify(field)}`);
            }

            await db.run(insertFieldSQL, [
                collectionId,
                field.name,
                field.type,
                field.required ? 1 : 0,
                field.unique ? 1 : 0,
                field.indexable ? 1 : 0,
                field.default || null,
                field.options ? JSON.stringify(field.options) : null
            ]);
            
            // Add field to CREATE TABLE (avoid UNIQUE constraints due to SQLite syntax issues)
            let fieldSQL = `\n            ${field.name} ${getSQLType(field.type)}`;
            
            if (field.required) fieldSQL += ' NOT NULL';
            // Note: UNIQUE constraints removed to avoid SQLite syntax errors
            if (field.default !== undefined) fieldSQL += ` DEFAULT '${field.default}'`;
            
            createTableSQL += fieldSQL + ',';
        }
        
        // Add timestamps
        createTableSQL += `
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`;
        
        // Create the actual table
        await db.exec(createTableSQL);
        
        // Add update trigger for the new table
        await db.exec(`
            CREATE TRIGGER IF NOT EXISTS update_${name}_timestamp 
            AFTER UPDATE ON ${name}
            BEGIN
                UPDATE ${name} SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
            END;
        `);
        
        // Create indexes for indexable fields
        for (const field of fields) {
            if (field.indexable && !field.unique) {  // Skip if unique (already has an index)
                const indexName = `idx_${name}_${field.name}`;
                try {
                    await db.exec(`CREATE INDEX IF NOT EXISTS ${indexName} ON ${name} (${field.name})`);
                    console.log(`Created index: ${indexName}`);
                } catch (indexError) {
                    console.warn(`Warning: Could not create index ${indexName}:`, indexError.message);
                }
            }
        }
        
        // Create event triggers if events are enabled
        if (eventsEnabled) {
            const { createEventTriggers } = require('./triggers');
            try {
                await createEventTriggers(db, name);
            } catch (triggerError) {
                console.warn(`Warning: Could not create event triggers for ${name}:`, triggerError.message);
            }
        }
        
        await db.run('COMMIT');
    } catch (error) {
        await db.run('ROLLBACK');
        throw error;
    }
};

const getSQLType = (type) => {
    const typeMap = {
        'text': 'TEXT',
        'number': 'REAL',
        'integer': 'INTEGER',
        'boolean': 'INTEGER',
        'date': 'DATETIME',
        'json': 'TEXT',
        'email': 'TEXT',
        'url': 'TEXT'
    };
    
    // Ensure we always return a valid SQL type
    const sqlType = typeMap[type];
    if (!sqlType) {
        console.warn(`Unknown field type '${type}', defaulting to TEXT`);
        return 'TEXT';
    }
    return sqlType;
};

const getCollections = async (db) => {
    const collections = await db.all('SELECT * FROM _collections ORDER BY name');
    
    // Enhance each collection with field count and record count
    for (const collection of collections) {
        try {
            // Get accurate field count from _fields table
            const fieldCountResult = await db.get(
                'SELECT COUNT(*) as count FROM _fields WHERE collection_id = ?',
                collection.id
            );
            collection.field_count = fieldCountResult.count;
            
            // Get record count from the actual table
            try {
                const recordCountResult = await db.get(`SELECT COUNT(*) as count FROM ${collection.name}`);
                collection.record_count = recordCountResult.count;
            } catch (tableError) {
                // Table might not exist yet
                collection.record_count = 0;
            }
            
        } catch (error) {
            console.warn(`Error getting counts for collection ${collection.name}:`, error.message);
            collection.field_count = 0;
            collection.record_count = 0;
        }
    }
    
    return collections;
};

const getAllTables = async (db) => {
    // Get all tables from SQLite master table
    const tables = await db.all(`
        SELECT 
            name,
            type,
            sql,
            'system' as table_type
        FROM sqlite_master 
        WHERE type = 'table' 
        AND name NOT LIKE 'sqlite_%'
        ORDER BY name
    `);
    
    // Enhance each table with additional info
    for (const table of tables) {
        try {
            // Determine if it's a system table (starts with _) or user table
            table.table_type = table.name.startsWith('_') ? 'system' : 'user';
            
            // Get record count
            try {
                const recordCountResult = await db.get(`SELECT COUNT(*) as count FROM "${table.name}"`);
                table.record_count = recordCountResult.count;
            } catch (tableError) {
                table.record_count = 0;
            }
            
            // Get column info
            try {
                const columns = await db.all(`PRAGMA table_info("${table.name}")`);
                table.field_count = columns.length;
                table.columns = columns;
            } catch (columnError) {
                table.field_count = 0;
                table.columns = [];
            }
            
            // For user collections, try to get events_enabled status
            if (table.table_type === 'user') {
                try {
                    const collectionInfo = await db.get('SELECT events_enabled, created_at FROM _collections WHERE name = ?', table.name);
                    if (collectionInfo) {
                        table.events_enabled = collectionInfo.events_enabled;
                        table.created_at = collectionInfo.created_at;
                    }
                } catch (error) {
                    // This might be a table not managed by the panel system
                }
            }
            
        } catch (error) {
            console.warn(`Error getting info for table ${table.name}:`, error.message);
            table.record_count = 0;
            table.field_count = 0;
            table.columns = [];
        }
    }
    
    return tables;
};

const getCollection = async (db, name) => {
    const collection = await db.get('SELECT * FROM _collections WHERE name = ?', name);
    if (collection) {
        const fields = await db.all(
            'SELECT * FROM _fields WHERE collection_id = ? ORDER BY id',
            collection.id
        );
        // Map unique_field back to unique for frontend compatibility and include indexable
        collection.fields = fields.map(field => ({
            ...field,
            unique: field.unique_field,
            indexable: Boolean(field.indexable),
            unique_field: undefined
        }));
    }
    return collection;
};

const updateCollection = async (db, id, updates) => {
    const { name, schema, events_enabled } = updates;
    
    await db.run('BEGIN TRANSACTION');
    
    try {
        // Get the current collection info
        const currentCollection = await db.get('SELECT * FROM _collections WHERE id = ?', id);
        if (!currentCollection) {
            throw new Error('Collection not found');
        }
        
        const currentFields = JSON.parse(currentCollection.schema || '[]');
        const newFields = schema || [];
        
        // Update the collection metadata
        await db.run(
            'UPDATE _collections SET name = ?, schema = ?, events_enabled = ? WHERE id = ?',
            [name || currentCollection.name, JSON.stringify(newFields), events_enabled !== undefined ? (events_enabled ? 1 : 0) : currentCollection.events_enabled, id]
        );
        
        // Clear existing field records and insert new ones
        await db.run('DELETE FROM _fields WHERE collection_id = ?', id);
        
        const insertFieldSQL = 'INSERT INTO _fields (collection_id, name, type, required, unique_field, indexable, default_value, options) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
        
        for (const field of newFields) {
            await db.run(insertFieldSQL, [
                id,
                field.name,
                field.type,
                field.required ? 1 : 0,
                field.unique ? 1 : 0,
                field.indexable ? 1 : 0,
                field.default || null,
                field.options ? JSON.stringify(field.options) : null
            ]);
        }
        
        // Try to alter the actual table structure if possible
        // This is a simplified approach - in production, you'd want more sophisticated migration logic
        const tableName = name || currentCollection.name;
        
        try {
            // Get current table info
            const tableInfo = await db.all(`PRAGMA table_info(${tableName})`);
            const existingColumns = tableInfo.map(col => col.name);
            
            // Add new columns that don't exist
            for (const field of newFields) {
                if (!existingColumns.includes(field.name) && field.name !== 'id' && field.name !== 'created_at' && field.name !== 'updated_at') {
                    const sqlType = getSQLType(field.type);
                    let alterSQL = `ALTER TABLE ${tableName} ADD COLUMN ${field.name} ${sqlType}`;
                    
                    if (field.default !== undefined) {
                        alterSQL += ` DEFAULT '${field.default}'`;
                    }
                    
                    await db.run(alterSQL);
                    console.log(`Added column ${field.name} to table ${tableName}`);
                }
            }
        } catch (alterError) {
            console.warn('Could not alter table structure:', alterError.message);
            // Continue without altering table - metadata will still be updated
        }
        
        // Manage indexes for indexable fields
        try {
            // Drop existing indexes for this table (except built-in ones)
            const existingIndexes = await db.all(
                "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name=? AND name LIKE 'idx_%'",
                [tableName]
            );
            
            for (const indexInfo of existingIndexes) {
                await db.exec(`DROP INDEX IF EXISTS ${indexInfo.name}`);
            }
            
            // Create new indexes for indexable fields
            for (const field of newFields) {
                if (field.indexable && !field.unique) {  // Skip if unique (already has an index)
                    const indexName = `idx_${tableName}_${field.name}`;
                    try {
                        await db.exec(`CREATE INDEX IF NOT EXISTS ${indexName} ON ${tableName} (${field.name})`);
                        console.log(`Created/updated index: ${indexName}`);
                    } catch (indexError) {
                        console.warn(`Warning: Could not create index ${indexName}:`, indexError.message);
                    }
                }
            }
        } catch (indexManagementError) {
            console.warn('Warning: Index management error:', indexManagementError.message);
        }
        
        // Handle event triggers based on events_enabled setting
        if (events_enabled !== undefined) {
            const { createEventTriggers, dropEventTriggers } = require('./triggers');
            try {
                if (events_enabled) {
                    // Create or recreate triggers
                    await dropEventTriggers(db, tableName);
                    await createEventTriggers(db, tableName);
                } else {
                    // Drop triggers
                    await dropEventTriggers(db, tableName);
                }
            } catch (triggerError) {
                console.warn(`Warning: Could not manage event triggers for ${tableName}:`, triggerError.message);
            }
        }
        
        await db.run('COMMIT');
        
        return { changes: 1 };
    } catch (error) {
        await db.run('ROLLBACK');
        throw error;
    }
};

const deleteCollection = async (db, name) => {
    await db.run('BEGIN TRANSACTION');
    
    try {
        // Drop event triggers if they exist
        const { dropEventTriggers } = require('./triggers');
        try {
            await dropEventTriggers(db, name);
        } catch (triggerError) {
            console.warn(`Warning: Could not drop event triggers for ${name}:`, triggerError.message);
        }
        
        // Drop the table
        await db.exec(`DROP TABLE IF EXISTS ${name}`);
        
        // Delete from collections (fields will cascade)
        await db.run('DELETE FROM _collections WHERE name = ?', name);
        
        await db.run('COMMIT');
    } catch (error) {
        await db.run('ROLLBACK');
        throw error;
    }
};

module.exports = {
    initSchema,
    createCollection,
    getCollections,
    getAllTables,
    getCollection,
    updateCollection,
    deleteCollection
};