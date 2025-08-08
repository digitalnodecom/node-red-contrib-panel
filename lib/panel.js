module.exports = function(RED) {
    // Setup Express middleware for /panel route
    const app = RED.httpAdmin;
    
    // Check if Node-RED has authentication configured
    const authConfigured = !!(RED.settings && RED.settings.adminAuth);
    console.log(`Panel: Node-RED authentication ${authConfigured ? 'enabled' : 'disabled (public mode)'}`);
    
    // Helper function to apply auth only if configured
    const needsPermission = (permission) => {
        if (authConfigured) {
            return RED.auth.needsPermission(permission);
        } else {
            // If no auth configured, allow all requests
            return (req, res, next) => next();
        }
    };
    
    
    const path = require('path');
    const express = require('express');
    const cors = require('cors');
    const { initDatabase } = require('./database/db');
    const { createDatabaseManager, getDatabaseManager } = require('./database/dbManager');
    const apiRouter = require('./api/router');
    
    // Initialize database manager on Node-RED startup
    let dbManager = null;
    
    // Initialize database manager and security on startup
    (async () => {
        if (!dbManager) {
            const userDir = RED.settings.userDir || process.cwd();
            try {
                // Create and initialize database manager
                dbManager = createDatabaseManager(userDir);
                await dbManager.initialize();
                console.log('Panel: DatabaseManager initialized successfully');
                
            } catch (error) {
                console.error('Failed to initialize Panel DatabaseManager:', error);
            }
        }
    })();
    
    // Basic CORS configuration
    app.use('/panel/api', cors());
    
    // Node-RED specific API endpoint to fetch databases for dropdowns
    app.get(
        '/panel/node-databases', needsPermission("*"), async (req, res) => {
        try {
            
            // Ensure database manager is initialized
            if (!dbManager) {
                return res.status(500).json({ error: 'DatabaseManager not initialized' });
            }
            
            const databases = await dbManager.listDatabases();
            res.json(databases.map(db => ({
                id: db.name,
                name: db.display_name,
                is_default: db.is_default === 1
            })));
        } catch (error) {
            console.error('Error fetching databases:', error);
            res.status(500).json({ error: 'Failed to fetch databases' });
        }
    });

    // Node-RED specific API endpoint to fetch collections for dropdowns (with database context)
    app.get('/panel/node-collections', needsPermission("*"), async (req, res) => {
        try {
            // Ensure database manager is initialized
            if (!dbManager) {
                return res.status(500).json({ error: 'DatabaseManager not initialized' });
            }
            
            const dbName = req.query.database || 'master';
            const db = await dbManager.getDatabase(dbName);
            const collections = await db.all('SELECT name FROM _collections ORDER BY name');
            res.json(collections.map(c => c.name));
        } catch (error) {
            console.error('Error fetching collections:', error);
            res.status(500).json({ error: 'Failed to fetch collections' });
        }
    });
    
    // Node-RED specific API endpoint to fetch event-enabled collections (with database context)
    app.get('/panel/event-collections', needsPermission("*"), async (req, res) => {
        try {
            // Ensure database manager is initialized
            if (!dbManager) {
                return res.status(500).json({ error: 'DatabaseManager not initialized' });
            }
            
            const dbName = req.query.database || 'master';
            const db = await dbManager.getDatabase(dbName);
            const collections = await db.all('SELECT name FROM _collections WHERE events_enabled = 1 ORDER BY name');
            res.json(collections.map(c => c.name));
        } catch (error) {
            console.error('Error fetching event-enabled collections:', error);
            res.status(500).json({ error: 'Failed to fetch event-enabled collections' });
        }
    });
    
    // API routes with database manager check and authentication
    app.use('/panel/api', needsPermission("flows.read"), async (req, res, next) => {
        // Ensure database manager is initialized
        if (!dbManager) {
            return res.status(500).json({ error: 'DatabaseManager not initialized' });
        }
        
        // For backward compatibility, default to master database for non-database-specific routes
        req.dbManager = dbManager;
        req.db = dbManager.getMasterDatabase(); // Default to master for existing routes
        next();
    });
    
    // Apply the API router
    app.use('/panel/api', apiRouter);
    
    // Serve Vue admin UI
    const adminPath = path.join(__dirname, 'admin', 'dist');
    
    // Serve the panel admin UI (static files served publicly)
    app.use('/panel', express.static(adminPath));
    
    // Catch-all route for Vue SPA (HTML served publicly, auth handled by client-side)
    app.get('/panel/*', (req, res) => {
        res.sendFile(path.join(adminPath, 'index.html'));
    });
    
    // Register Panel Query Node
    function PanelQueryNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        node.collection = config.collection;
        node.operation = config.operation;
        node.database = config.database || 'master'; // Default to master database
        
        node.on('input', async function(msg, send, done) {
            // Ensure database manager is initialized
            if (!dbManager) {
                node.error('DatabaseManager not initialized');
                done(new Error('DatabaseManager not initialized'));
                return;
            }
            
            try {
                // Use msg parameters if useMsg is enabled, otherwise use config
                const collection = config.useMsg ? (msg.collection || node.collection) : node.collection;
                const operation = config.useMsg ? (msg.operation || node.operation) : node.operation;
                const database = config.useMsg ? (msg.database || node.database) : node.database;
                const query = msg.query || JSON.parse(config.query || '{}');
                
                if (!collection) {
                    throw new Error('Collection name is required');
                }
                
                // Get database connection
                const db = await dbManager.getDatabase(database);
                let result;
                
                switch (operation) {
                    case 'find':
                        if (Object.keys(query).length > 0) {
                            const whereClause = Object.keys(query).map(key => `${key} = ?`).join(' AND ');
                            const values = Object.values(query);
                            result = await db.all(`SELECT * FROM ${collection} WHERE ${whereClause}`, values);
                        } else {
                            result = await db.all(`SELECT * FROM ${collection}`);
                        }
                        break;
                    case 'findOne':
                        if (query.id) {
                            result = await db.get(`SELECT * FROM ${collection} WHERE id = ?`, query.id);
                        } else if (Object.keys(query).length > 0) {
                            const whereClause = Object.keys(query).map(key => `${key} = ?`).join(' AND ');
                            const values = Object.values(query);
                            result = await db.get(`SELECT * FROM ${collection} WHERE ${whereClause}`, values);
                        } else {
                            result = await db.get(`SELECT * FROM ${collection} LIMIT 1`);
                        }
                        break;
                    case 'count':
                        if (Object.keys(query).length > 0) {
                            const whereClause = Object.keys(query).map(key => `${key} = ?`).join(' AND ');
                            const values = Object.values(query);
                            result = await db.get(`SELECT COUNT(*) as count FROM ${collection} WHERE ${whereClause}`, values);
                        } else {
                            result = await db.get(`SELECT COUNT(*) as count FROM ${collection}`);
                        }
                        break;
                    default:
                        throw new Error(`Unknown operation: ${operation}`);
                }
                
                msg.payload = result;
                send(msg);
                done();
            } catch (err) {
                node.error(err.message);
                done(err);
            }
        });
    }
    
    // Register Panel Insert Node
    function PanelInsertNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        node.collection = config.collection;
        node.database = config.database || 'master'; // Default to master database
        
        node.on('input', async function(msg, send, done) {
            // Ensure database manager is initialized
            if (!dbManager) {
                node.error('DatabaseManager not initialized');
                done(new Error('DatabaseManager not initialized'));
                return;
            }
            
            try {
                // Use msg parameters if useMsg is enabled, otherwise use config
                const collection = config.useMsg ? (msg.collection || node.collection) : node.collection;
                const database = config.useMsg ? (msg.database || node.database) : node.database;
                
                if (!collection) {
                    throw new Error('Collection name is required');
                }
                
                // Get database connection
                const db = await dbManager.getDatabase(database);
                
                // Use msg.payload or fallback to config data
                let data = msg.payload;
                if (!data && config.data) {
                    try {
                        data = JSON.parse(config.data);
                    } catch (e) {
                        throw new Error('Invalid JSON in static data configuration');
                    }
                }
                
                if (!data || typeof data !== 'object') {
                    throw new Error('Data is required either via msg.payload or static configuration');
                }
                
                const columns = Object.keys(data);
                const values = Object.values(data);
                const placeholders = columns.map(() => '?').join(', ');
                
                const result = await db.run(
                    `INSERT INTO ${collection} (${columns.join(', ')}) VALUES (${placeholders})`,
                    values
                );
                
                msg.payload = {
                    id: result.lastID,
                    changes: result.changes
                };
                
                send(msg);
                done();
            } catch (err) {
                node.error(err.message);
                done(err);
            }
        });
    }
    
    // Register Panel Update Node
    function PanelUpdateNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        node.collection = config.collection;
        node.database = config.database || 'master'; // Default to master database
        
        node.on('input', async function(msg, send, done) {
            // Ensure database manager is initialized
            if (!dbManager) {
                node.error('DatabaseManager not initialized');
                done(new Error('DatabaseManager not initialized'));
                return;
            }
            
            try {
                // Use msg parameters if useMsg is enabled, otherwise use config
                const collection = config.useMsg ? (msg.collection || node.collection) : node.collection;
                const database = config.useMsg ? (msg.database || node.database) : node.database;
                
                if (!collection) {
                    throw new Error('Collection name is required');
                }
                
                // Get database connection
                const db = await dbManager.getDatabase(database);
                
                // Use msg.payload or fallback to config data
                let payload = msg.payload;
                if (!payload && config.data) {
                    try {
                        payload = JSON.parse(config.data);
                    } catch (e) {
                        throw new Error('Invalid JSON in static data configuration');
                    }
                }
                
                if (!payload || typeof payload !== 'object') {
                    throw new Error('Data is required either via msg.payload or static configuration');
                }
                
                const { id, ...data } = payload;
                
                if (!id) {
                    throw new Error('Record id is required');
                }
                
                const columns = Object.keys(data);
                const values = Object.values(data);
                const setClause = columns.map(col => `${col} = ?`).join(', ');
                
                const result = await db.run(
                    `UPDATE ${collection} SET ${setClause} WHERE id = ?`,
                    [...values, id]
                );
                
                msg.payload = {
                    id: id,
                    changes: result.changes
                };
                
                send(msg);
                done();
            } catch (err) {
                node.error(err.message);
                done(err);
            }
        });
    }
    
    // Register Panel Delete Node
    function PanelDeleteNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        node.collection = config.collection;
        node.database = config.database || 'master'; // Default to master database
        
        node.on('input', async function(msg, send, done) {
            // Ensure database manager is initialized
            if (!dbManager) {
                node.error('DatabaseManager not initialized');
                done(new Error('DatabaseManager not initialized'));
                return;
            }
            
            try {
                // Use msg parameters if useMsg is enabled, otherwise use config
                const collection = config.useMsg ? (msg.collection || node.collection) : node.collection;
                const database = config.useMsg ? (msg.database || node.database) : node.database;
                
                if (!collection) {
                    throw new Error('Collection name is required');
                }
                
                // Get database connection
                const db = await dbManager.getDatabase(database);
                
                // Use msg.payload or fallback to config data
                let id;
                if (msg.payload !== undefined) {
                    id = msg.payload.id || msg.payload;
                } else if (config.data) {
                    // For delete, config.data should just be the ID as a string
                    id = parseInt(config.data) || config.data;
                }
                
                if (!id) {
                    throw new Error('Record ID is required either via msg.payload or static configuration');
                }
                
                const result = await db.run(`DELETE FROM ${collection} WHERE id = ?`, id);
                
                msg.payload = {
                    id: id,
                    changes: result.changes
                };
                
                send(msg);
                done();
            } catch (err) {
                node.error(err.message);
                done(err);
            }
        });
    }
    
    // Register Panel Upsert Node
    function PanelUpsertNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        node.collection = config.collection;
        node.database = config.database || 'master'; // Default to master database
        node.matchFields = config.matchFields || [];
        node.mode = config.mode || 'upsert';
        
        // Update node status based on configuration
        const updateNodeStatus = () => {
            if (node.matchFields && node.matchFields.length > 0) {
                const modeIcon = {
                    'upsert': '↕',
                    'updateOnly': '↑', 
                    'insertOnly': '↓'
                };
                node.status({
                    fill: "green", 
                    shape: "dot", 
                    text: `${modeIcon[node.mode]} ${node.matchFields.join(', ')}`
                });
            } else {
                node.status({fill: "yellow", shape: "ring", text: "configure match fields"});
            }
        };
        
        updateNodeStatus();
        
        node.on('input', async function(msg, send, done) {
            // Ensure database manager is initialized
            if (!dbManager) {
                node.error('DatabaseManager not initialized');
                done(new Error('DatabaseManager not initialized'));
                return;
            }
            
            try {
                // Use msg parameters if useMsg is enabled, otherwise use config
                const collection = config.useMsg ? (msg.collection || node.collection) : node.collection;
                const database = config.useMsg ? (msg.database || node.database) : node.database;
                const matchFields = config.useMsg ? (msg.matchFields || node.matchFields) : node.matchFields;
                const mode = config.useMsg ? (msg.mode || node.mode) : node.mode;
                
                if (!collection) {
                    throw new Error('Collection name is required');
                }
                
                if (!matchFields || matchFields.length === 0) {
                    throw new Error('At least one match field is required');
                }
                
                // Get database connection
                const db = await dbManager.getDatabase(database);
                
                // Use msg.payload or fallback to config data
                let data = msg.payload;
                if (!data && config.data) {
                    try {
                        data = JSON.parse(config.data);
                    } catch (e) {
                        throw new Error('Invalid JSON in static data configuration');
                    }
                }
                
                if (!data || typeof data !== 'object') {
                    throw new Error('Data is required either via msg.payload or static configuration');
                }
                
                // Perform upsert operation
                const result = await performUpsert(db, collection, data, matchFields, mode, node);
                
                msg.payload = result.record;
                msg.operation = result.operation;
                msg.recordId = result.record.id;
                msg.changes = result.changes || 1;
                
                send(msg);
                done();
                
            } catch (err) {
                node.error(err.message);
                done(err);
            }
        });
    }

    // Helper function to perform upsert operation
    async function performUpsert(db, collection, data, matchFields, mode, node) {
        // Build upsert SQL
        const columns = Object.keys(data);
        const values = Object.values(data);
        const placeholders = columns.map(() => '?').join(', ');
        
        let sql = `INSERT INTO ${collection} (${columns.join(', ')}) VALUES (${placeholders})`;
        
        if (mode !== 'insertOnly') {
            // Check if we need to create a unique index for the match fields
            const indexName = `idx_upsert_${collection}_${matchFields.join('_')}`;
            try {
                await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS ${indexName} ON ${collection} (${matchFields.join(', ')})`);
            } catch (indexError) {
                // Index might already exist or there might be duplicate data
                console.warn(`Could not create unique index ${indexName}:`, indexError.message);
                // Continue without the index - ON CONFLICT might still work if there are existing constraints
            }
            
            sql += ` ON CONFLICT(${matchFields.join(', ')}) `;
            
            if (mode === 'updateOnly') {
                // Only update if record exists
                const updateSet = columns
                    .filter(col => !matchFields.includes(col) && col !== 'id')
                    .map(col => `${col} = excluded.${col}`)
                    .join(', ');
                
                if (updateSet) {
                    sql += `DO UPDATE SET ${updateSet}, updated_at = CURRENT_TIMESTAMP`;
                } else {
                    sql += `DO UPDATE SET updated_at = CURRENT_TIMESTAMP`;
                }
            } else {
                // Standard upsert
                const updateSet = columns
                    .filter(col => !matchFields.includes(col) && col !== 'id')
                    .map(col => `${col} = excluded.${col}`)
                    .join(', ');
                
                if (updateSet) {
                    sql += `DO UPDATE SET ${updateSet}, updated_at = CURRENT_TIMESTAMP`;
                } else {
                    sql += `DO UPDATE SET updated_at = CURRENT_TIMESTAMP`;
                }
            }
        } else {
            // Insert only - do nothing on conflict
            sql += ` ON CONFLICT(${matchFields.join(', ')}) DO NOTHING`;
        }
        
        // Add RETURNING clause to get the result
        sql += ` RETURNING *`;
        
        // Execute the upsert
        const result = await db.get(sql, values);
        
        if (!result) {
            // This happens with insertOnly mode when record already exists
            throw new Error('Record already exists and insertOnly mode was specified');
        }
        
        // Determine operation type (simplified approach)
        let operation = 'insert';
        if (mode !== 'insertOnly') {
            // For now, we'll assume it's an update if the created_at and updated_at are different
            // This is a simplified approach - in a real scenario you might want more sophisticated detection
            if (result.created_at !== result.updated_at) {
                operation = 'update';
            }
        }
        
        return {
            record: result,
            operation: operation,
            changes: 1
        };
    }

    // Register Panel Event Listener Node
    function PanelEventListenerNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        node.collection = config.collection;
        node.database = config.database || 'master'; // Default to master database
        node.eventTypes = config.eventTypes || ["INSERT", "UPDATE", "DELETE"];
        node.pollingInterval = (config.pollingInterval || 10) * 1000; // Convert to milliseconds
        node.batchSize = config.batchSize || 10;
        node.autoAcknowledge = config.autoAcknowledge !== false;
        
        let pollingTimer = null;
        
        const pollForEvents = async () => {
            try {
                // Ensure database manager is initialized
                if (!dbManager) {
                    node.error('DatabaseManager not initialized');
                    return;
                }
                
                if (!node.collection) {
                    return; // No collection selected
                }
                
                // Get database connection
                if (!node.database) {
                    node.error(`No database selected. Config: database='${node.database}', collection='${node.collection}'`);
                    return;
                }
                
                const db = await dbManager.getDatabase(node.database);
                
                const { getUnprocessedEvents, markEventsProcessed } = require('./database/triggers');
                
                // Get unprocessed events for this collection
                const events = await getUnprocessedEvents(db, node.collection, node.batchSize);
                
                // Filter by event types
                const filteredEvents = events.filter(event => 
                    node.eventTypes.includes(event.event_type)
                );
                
                if (filteredEvents.length > 0) {
                    // Process each event
                    for (const event of filteredEvents) {
                        const msg = {
                            payload: {
                                eventType: event.event_type,
                                collection: event.collection,
                                recordId: event.record_id,
                                oldData: event.old_data ? JSON.parse(event.old_data) : null,
                                newData: event.new_data ? JSON.parse(event.new_data) : null,
                                timestamp: event.created_at
                            },
                            topic: `panel/events/${event.collection}`
                        };
                        
                        node.send(msg);
                    }
                    
                    // Auto-acknowledge processed events if enabled
                    if (node.autoAcknowledge) {
                        const eventIds = filteredEvents.map(e => e.id);
                        await markEventsProcessed(db, eventIds);
                    }
                }
                
            } catch (error) {
                node.error('Error polling for events: ' + error.message);
            }
        };
        
        // Start polling when node is deployed
        node.on('close', function() {
            if (pollingTimer) {
                clearInterval(pollingTimer);
                pollingTimer = null;
            }
        });
        
        // No input handling needed since this is a source node (inputs: 0)
        
        // Start automatic polling
        if (node.collection && node.pollingInterval > 0) {
            pollingTimer = setInterval(pollForEvents, node.pollingInterval);
            node.status({fill:"green", shape:"dot", text:`polling every ${node.pollingInterval/1000}s`});
        } else {
            node.status({fill:"yellow", shape:"ring", text:"no collection selected"});
        }
    }
    
    // Register nodes
    RED.nodes.registerType('query', PanelQueryNode);
    RED.nodes.registerType('insert', PanelInsertNode);
    RED.nodes.registerType('update', PanelUpdateNode);
    RED.nodes.registerType('upsert', PanelUpsertNode);
    RED.nodes.registerType('delete', PanelDeleteNode);
    RED.nodes.registerType('listen', PanelEventListenerNode);
}