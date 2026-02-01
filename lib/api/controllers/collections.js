const { 
    getCollections, 
    getCollection, 
    createCollection, 
    updateCollection, 
    deleteCollection,
    getAllTables
} = require('../../database/schema');
const { auditCollection } = require('../../database/audit');
const { getDatabaseManager } = require('../../database/dbManager');

const list = async (req, res, next) => {
    try {
        const showSystemTables = req.query.system === 'true';
        
        if (showSystemTables) {
            // Get all tables including system tables
            const allTables = await getAllTables(req.db);
            res.json(allTables);
        } else {
            // Get only user collections
            const collections = await getCollections(req.db);
            res.json(collections);
        }
    } catch (error) {
        next(error);
    }
};

const get = async (req, res, next) => {
    try {
        const collection = await getCollection(req.db, req.params.name);
        if (!collection) {
            return res.status(404).json({ error: 'Collection not found' });
        }
        res.json(collection);
    } catch (error) {
        next(error);
    }
};

const create = async (req, res, next) => {
    try {
        const { name, fields, events_enabled } = req.body;
        
        // Check if collection already exists
        const existing = await getCollection(req.db, name);
        if (existing) {
            return res.status(409).json({ error: 'Collection already exists' });
        }
        
        // Validate collection name
        if (!isValidCollectionName(name)) {
            return res.status(400).json({ 
                error: 'Invalid collection name. Use only letters, numbers, and underscores.' 
            });
        }
        
        await createCollection(req.db, name, fields, events_enabled);
        const collection = await getCollection(req.db, name);

        // Log audit event
        try {
            const dbManager = getDatabaseManager();
            const masterDb = dbManager.getMainDatabase();
            const databaseContext = (req.currentDatabase && req.currentDatabase.name) || 'main';
            await auditCollection.created(masterDb, name, databaseContext, fields.length, req);
        } catch (auditError) {
            console.warn('Failed to log collection creation audit event:', auditError.message);
        }

        res.status(201).json(collection);
    } catch (error) {
        next(error);
    }
};

const update = async (req, res, next) => {
    try {
        const { name, fields, events_enabled } = req.body;
        
        // First, get the collection by name to find its ID
        const existingCollection = await req.db.get('SELECT * FROM _collections WHERE name = ?', req.params.name);
        if (!existingCollection) {
            return res.status(404).json({ error: 'Collection not found' });
        }
        
        // Convert fields array to schema for storage
        const schema = fields || [];
        const result = await updateCollection(req.db, existingCollection.id, { name, schema, events_enabled });
        
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Collection not found' });
        }
        
        // Get the updated collection - use the new name if it was changed, otherwise use the original name
        const finalName = name || req.params.name;
        const collection = await getCollection(req.db, finalName);
        
        // Log audit event
        try {
            const dbManager = getDatabaseManager();
            const masterDb = dbManager.getMainDatabase();
            const databaseContext = (req.currentDatabase && req.currentDatabase.name) || 'main';
            const changes = {
                name: name !== req.params.name ? { old: req.params.name, new: name } : undefined,
                schema_fields: fields ? { new: fields.length } : undefined,
                events_enabled: events_enabled !== undefined ? { new: events_enabled } : undefined
            };
            await auditCollection.updated(masterDb, finalName, databaseContext, changes, req);
        } catch (auditError) {
            console.warn('Failed to log collection update audit event:', auditError.message);
        }
        
        if (collection) {
            res.json(collection);
        } else {
            res.status(404).json({ error: 'Collection not found after update' });
        }
    } catch (error) {
        next(error);
    }
};

const remove = async (req, res, next) => {
    try {
        const { name } = req.params;
        
        // Check if collection exists
        const collection = await getCollection(req.db, name);
        if (!collection) {
            return res.status(404).json({ error: 'Collection not found' });
        }
        
        await deleteCollection(req.db, name);

        // Log audit event
        try {
            const dbManager = getDatabaseManager();
            const masterDb = dbManager.getMainDatabase();
            const databaseContext = (req.currentDatabase && req.currentDatabase.name) || 'main';
            await auditCollection.deleted(masterDb, name, databaseContext, req);
        } catch (auditError) {
            console.warn('Failed to log collection deletion audit event:', auditError.message);
        }

        res.status(204).send();
    } catch (error) {
        next(error);
    }
};

const isValidCollectionName = (name) => {
    return /^[a-zA-Z][a-zA-Z0-9_]*$/.test(name);
};

const truncate = async (req, res, next) => {
    try {
        const { name } = req.params;
        
        // Check if collection exists
        const collection = await getCollection(req.db, name);
        if (!collection) {
            return res.status(404).json({ error: 'Collection not found' });
        }
        
        // Delete all records from the collection
        const result = await req.db.run(`DELETE FROM ${name}`);
        
        // Reset the auto-increment counter
        await req.db.run(`DELETE FROM sqlite_sequence WHERE name = ?`, name);
        
        // Log audit event
        try {
            const dbManager = getDatabaseManager();
            const masterDb = dbManager.getMainDatabase();
            const databaseContext = (req.currentDatabase && req.currentDatabase.name) || 'main';
            await auditCollection.truncated(masterDb, name, databaseContext, result.changes, req);
        } catch (auditError) {
            console.warn('Failed to log collection truncate audit event:', auditError.message);
        }

        res.json({ 
            success: true, 
            message: `Truncated collection ${name}`,
            deletedRecords: result.changes 
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    list,
    get,
    create,
    update,
    delete: remove,
    truncate
};