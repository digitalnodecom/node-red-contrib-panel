module.exports = function(RED) {
    const path = require('path');
    const express = require('express');
    const cors = require('cors');
    const { initDatabase } = require('./database/db');
    const apiRouter = require('./api/router');
    
    // Initialize database on Node-RED startup
    let db = null;
    
    // Initialize database on startup
    (async () => {
        if (!db) {
            const userDir = RED.settings.userDir || process.cwd();
            const dbPath = path.join(userDir, 'panel.db');
            try {
                db = await initDatabase(dbPath);
                console.log('Panel database initialized at:', dbPath);
            } catch (error) {
                console.error('Failed to initialize Panel database:', error);
            }
        }
    })();
    
    // Setup Express middleware for /panel route
    const app = RED.httpAdmin || RED.httpNode;
    
    // CORS configuration
    app.use('/panel/api', cors());
    
    // Node-RED specific API endpoint to fetch collections for dropdowns
    app.get('/panel/node-collections', async (req, res) => {
        try {
            // Ensure database is initialized
            if (!db) {
                const userDir = RED.settings.userDir || process.cwd();
                const dbPath = path.join(userDir, 'panel.db');
                try {
                    db = await initDatabase(dbPath);
                } catch (error) {
                    console.error('Failed to initialize Panel database:', error);
                    return res.status(500).json({ error: 'Database initialization failed' });
                }
            }
            
            const collections = await db.all('SELECT name FROM _collections ORDER BY name');
            res.json(collections.map(c => c.name));
        } catch (error) {
            console.error('Error fetching collections:', error);
            res.status(500).json({ error: 'Failed to fetch collections' });
        }
    });
    
    // Node-RED specific API endpoint to fetch event-enabled collections
    app.get('/panel/event-collections', async (req, res) => {
        try {
            // Ensure database is initialized
            if (!db) {
                const userDir = RED.settings.userDir || process.cwd();
                const dbPath = path.join(userDir, 'panel.db');
                try {
                    db = await initDatabase(dbPath);
                } catch (error) {
                    console.error('Failed to initialize Panel database:', error);
                    return res.status(500).json({ error: 'Database initialization failed' });
                }
            }
            
            const collections = await db.all('SELECT name FROM _collections WHERE events_enabled = 1 ORDER BY name');
            res.json(collections.map(c => c.name));
        } catch (error) {
            console.error('Error fetching event-enabled collections:', error);
            res.status(500).json({ error: 'Failed to fetch event-enabled collections' });
        }
    });
    
    // API routes with database check
    app.use('/panel/api', async (req, res, next) => {
        // Ensure database is initialized
        if (!db) {
            const userDir = RED.settings.userDir || process.cwd();
            const dbPath = path.join(userDir, 'panel.db');
            try {
                db = await initDatabase(dbPath);
                console.log('Panel database initialized at:', dbPath);
            } catch (error) {
                console.error('Failed to initialize Panel database:', error);
                return res.status(500).json({ error: 'Database initialization failed' });
            }
        }
        
        req.db = db;
        next();
    }, apiRouter);
    

    // Serve Vue admin UI
    const adminPath = path.join(__dirname, 'admin', 'dist');
    app.use('/panel', express.static(adminPath));
    
    // Catch-all route for Vue SPA
    app.get('/panel/*', (req, res) => {
        res.sendFile(path.join(adminPath, 'index.html'));
    });
    
    // Register Panel Query Node
    function PanelQueryNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        node.collection = config.collection;
        node.operation = config.operation;
        
        node.on('input', async function(msg, send, done) {
            // Ensure database is initialized
            if (!db) {
                const userDir = RED.settings.userDir || process.cwd();
                const dbPath = path.join(userDir, 'panel.db');
                try {
                    db = await initDatabase(dbPath);
                } catch (error) {
                    node.error('Failed to initialize database: ' + error.message);
                    done(error);
                    return;
                }
            }
            
            try {
                // Use msg parameters if useMsg is enabled, otherwise use config
                const collection = config.useMsg ? (msg.collection || node.collection) : node.collection;
                const operation = config.useMsg ? (msg.operation || node.operation) : node.operation;
                const query = msg.query || JSON.parse(config.query || '{}');
                
                if (!collection) {
                    throw new Error('Collection name is required');
                }
                
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
        
        node.on('input', async function(msg, send, done) {
            // Ensure database is initialized
            if (!db) {
                const userDir = RED.settings.userDir || process.cwd();
                const dbPath = path.join(userDir, 'panel.db');
                try {
                    db = await initDatabase(dbPath);
                } catch (error) {
                    node.error('Failed to initialize database: ' + error.message);
                    done(error);
                    return;
                }
            }
            
            try {
                // Use msg parameters if useMsg is enabled, otherwise use config
                const collection = config.useMsg ? (msg.collection || node.collection) : node.collection;
                
                if (!collection) {
                    throw new Error('Collection name is required');
                }
                
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
        
        node.on('input', async function(msg, send, done) {
            // Ensure database is initialized
            if (!db) {
                const userDir = RED.settings.userDir || process.cwd();
                const dbPath = path.join(userDir, 'panel.db');
                try {
                    db = await initDatabase(dbPath);
                } catch (error) {
                    node.error('Failed to initialize database: ' + error.message);
                    done(error);
                    return;
                }
            }
            
            try {
                // Use msg parameters if useMsg is enabled, otherwise use config
                const collection = config.useMsg ? (msg.collection || node.collection) : node.collection;
                
                if (!collection) {
                    throw new Error('Collection name is required');
                }
                
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
        
        node.on('input', async function(msg, send, done) {
            // Ensure database is initialized
            if (!db) {
                const userDir = RED.settings.userDir || process.cwd();
                const dbPath = path.join(userDir, 'panel.db');
                try {
                    db = await initDatabase(dbPath);
                } catch (error) {
                    node.error('Failed to initialize database: ' + error.message);
                    done(error);
                    return;
                }
            }
            
            try {
                // Use msg parameters if useMsg is enabled, otherwise use config
                const collection = config.useMsg ? (msg.collection || node.collection) : node.collection;
                
                if (!collection) {
                    throw new Error('Collection name is required');
                }
                
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
    
    // Register Panel Event Listener Node
    function PanelEventListenerNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        node.collection = config.collection;
        node.eventTypes = config.eventTypes || ["INSERT", "UPDATE", "DELETE"];
        node.pollingInterval = (config.pollingInterval || 10) * 1000; // Convert to milliseconds
        node.batchSize = config.batchSize || 10;
        node.autoAcknowledge = config.autoAcknowledge !== false;
        
        let pollingTimer = null;
        
        const pollForEvents = async () => {
            try {
                // Ensure database is initialized
                if (!db) {
                    const userDir = RED.settings.userDir || process.cwd();
                    const dbPath = path.join(userDir, 'panel.db');
                    try {
                        db = await initDatabase(dbPath);
                    } catch (error) {
                        node.error('Failed to initialize database: ' + error.message);
                        return;
                    }
                }
                
                if (!node.collection) {
                    return; // No collection selected
                }
                
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
    RED.nodes.registerType('panel-query', PanelQueryNode);
    RED.nodes.registerType('panel-insert', PanelInsertNode);
    RED.nodes.registerType('panel-update', PanelUpdateNode);
    RED.nodes.registerType('panel-delete', PanelDeleteNode);
    RED.nodes.registerType('panel-event-listener', PanelEventListenerNode);
}