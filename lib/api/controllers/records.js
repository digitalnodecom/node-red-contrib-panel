const { getCollection } = require('../../database/schema');

const list = async (req, res, next) => {
    try {
        const { collection } = req.params;
        
        // Extract known parameters first
        const { 
            page, 
            limit = 50, 
            offset: queryOffset, 
            sort = 'id', 
            order = 'ASC',
            ...remainingParams 
        } = req.query;

        // Filter out any remaining pagination/sorting params that might have been missed
        const filters = {};
        Object.entries(remainingParams).forEach(([key, value]) => {
            // Only add actual data filters, not pagination/sorting params
            if (!['page', 'limit', 'offset', 'sort', 'order'].includes(key)) {
                filters[key] = value;
            }
        });
        
        // Check if it's a system table (starts with _) or regular collection
        const isSystemTable = collection.startsWith('_');
        let collectionInfo = null;
        
        if (isSystemTable) {
            // For system tables, check if table exists in sqlite_master
            const tableExists = await req.db.get(
                'SELECT name FROM sqlite_master WHERE type = "table" AND name = ?',
                collection
            );
            if (!tableExists) {
                return res.status(404).json({ error: 'System table not found' });
            }
            
            // Get table structure for system tables
            const columns = await req.db.all(`PRAGMA table_info("${collection}")`);
            collectionInfo = {
                name: collection,
                system: true,
                columns: columns
            };
        } else {
            // Check if collection exists (regular collections)
            collectionInfo = await getCollection(req.db, collection);
            if (!collectionInfo) {
                return res.status(404).json({ error: 'Collection not found' });
            }
        }
        
        // Build query
        let query = `SELECT * FROM ${collection}`;
        const params = [];
        
        // Add filters
        const whereConditions = [];
        Object.entries(filters).forEach(([key, value]) => {
            whereConditions.push(`${key} = ?`);
            params.push(value);
        });
        
        if (whereConditions.length > 0) {
            query += ` WHERE ${whereConditions.join(' AND ')}`;
        }
        
        // Add sorting - validate sort field exists for system tables
        let sortField = sort;
        if (isSystemTable && collectionInfo.columns) {
            const columnExists = collectionInfo.columns.some(col => col.name === sort);
            if (!columnExists) {
                // Default to first column if specified sort field doesn't exist
                sortField = collectionInfo.columns[0]?.name || 'rowid';
            }
        }
        query += ` ORDER BY ${sortField} ${order}`;
        
        // Add pagination - support both offset and page-based
        let offset;
        if (queryOffset !== undefined) {
            offset = parseInt(queryOffset);
        } else if (page !== undefined) {
            offset = (parseInt(page) - 1) * parseInt(limit);
        } else {
            offset = 0;
        }
        
        query += ` LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), offset);
        
        // Execute query
        const records = await req.db.all(query, params);
        
        // Get total count
        let countQuery = `SELECT COUNT(*) as total FROM ${collection}`;
        if (whereConditions.length > 0) {
            countQuery += ` WHERE ${whereConditions.join(' AND ')}`;
        }
        const { total } = await req.db.get(countQuery, params.slice(0, whereConditions.length));
        
        res.json({
            data: records,
            pagination: {
                page: page ? parseInt(page) : Math.floor(offset / parseInt(limit)) + 1,
                limit: parseInt(limit),
                offset: offset,
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        next(error);
    }
};

const get = async (req, res, next) => {
    try {
        const { collection, id } = req.params;
        
        // Check if collection exists
        const collectionInfo = await getCollection(req.db, collection);
        if (!collectionInfo) {
            return res.status(404).json({ error: 'Collection not found' });
        }
        
        const record = await req.db.get(`SELECT * FROM ${collection} WHERE id = ?`, id);
        
        if (!record) {
            return res.status(404).json({ error: 'Record not found' });
        }
        
        res.json(record);
    } catch (error) {
        next(error);
    }
};

const create = async (req, res, next) => {
    try {
        const { collection } = req.params;
        const data = req.body;
        
        // Check if collection exists
        const collectionInfo = await getCollection(req.db, collection);
        if (!collectionInfo) {
            return res.status(404).json({ error: 'Collection not found' });
        }
        
        // Validate required fields
        const errors = validateRequiredFields(collectionInfo.fields, data);
        if (errors.length > 0) {
            return res.status(400).json({ error: 'Validation error', details: errors });
        }
        
        // Build insert query
        const columns = Object.keys(data);
        const values = Object.values(data);
        const placeholders = columns.map(() => '?').join(', ');
        
        const result = await req.db.run(
            `INSERT INTO ${collection} (${columns.join(', ')}) VALUES (${placeholders})`,
            values
        );
        
        // Return the created record
        const newRecord = await req.db.get(`SELECT * FROM ${collection} WHERE id = ?`, result.lastID);
        res.status(201).json(newRecord);
    } catch (error) {
        next(error);
    }
};

const update = async (req, res, next) => {
    try {
        const { collection, id } = req.params;
        const data = req.body;
        
        // Check if collection exists
        const collectionInfo = await getCollection(req.db, collection);
        if (!collectionInfo) {
            return res.status(404).json({ error: 'Collection not found' });
        }
        
        // Check if record exists
        const existing = await req.db.get(`SELECT * FROM ${collection} WHERE id = ?`, id);
        if (!existing) {
            return res.status(404).json({ error: 'Record not found' });
        }
        
        // Build update query
        const columns = Object.keys(data);
        const values = Object.values(data);
        const setClause = columns.map(col => `${col} = ?`).join(', ');
        
        await req.db.run(
            `UPDATE ${collection} SET ${setClause} WHERE id = ?`,
            [...values, id]
        );
        
        // Return the updated record
        const updatedRecord = await req.db.get(`SELECT * FROM ${collection} WHERE id = ?`, id);
        res.json(updatedRecord);
    } catch (error) {
        next(error);
    }
};

const remove = async (req, res, next) => {
    try {
        const { collection, id } = req.params;
        
        // Check if collection exists
        const collectionInfo = await getCollection(req.db, collection);
        if (!collectionInfo) {
            return res.status(404).json({ error: 'Collection not found' });
        }
        
        const result = await req.db.run(`DELETE FROM ${collection} WHERE id = ?`, id);
        
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Record not found' });
        }
        
        res.status(204).send();
    } catch (error) {
        next(error);
    }
};

const validateRequiredFields = (fields, data) => {
    const errors = [];
    
    fields.forEach(field => {
        if (field.required && !data.hasOwnProperty(field.name)) {
            errors.push(`Field '${field.name}' is required`);
        }
    });
    
    return errors;
};

module.exports = {
    list,
    get,
    create,
    update,
    delete: remove
};