const assert = require('assert');
const request = require('supertest');
const express = require('express');
const { initDatabase } = require('../lib/database/db');
const apiRouter = require('../lib/api/router');

describe('Public Access Mode', function() {
    let app;
    let db;

    before(async function() {
        // Initialize test database
        db = await initDatabase(':memory:');
        
        // Setup Express app
        app = express();
        app.use(express.json());
        
        // Simulate Node-RED without auth (public mode)
        app.set('nodeRedAuthConfigured', false);
        
        // Add db to request
        app.use((req, res, next) => {
            req.db = db;
            next();
        });
        
        app.use('/api', apiRouter);
    });

    after(async function() {
        if (db) {
            await db.close();
        }
    });

    describe('When Node-RED auth is NOT configured (public mode)', function() {
        it('should allow access to collections without authentication', async function() {
            const response = await request(app)
                .get('/api/collections')
                .expect(200);
                
            assert(Array.isArray(response.body));
        });

        it('should allow creating collections without authentication', async function() {
            const response = await request(app)
                .post('/api/collections')
                .send({
                    name: 'test_collection',
                    fields: [
                        { name: 'title', type: 'text', required: true }
                    ]
                })
                .expect(201);
                
            assert.equal(response.body.name, 'test_collection');
        });

        it('should allow API key management without authentication', async function() {
            // Create an API key
            const createResponse = await request(app)
                .post('/api/api-keys')
                .send({
                    name: 'Public Test Key',
                    permissions: {
                        read: true,
                        write: false,
                        collections: ['*']
                    }
                })
                .expect(201);
                
            assert(createResponse.body.api_key);
            
            // List API keys
            const listResponse = await request(app)
                .get('/api/api-keys')
                .expect(200);
                
            assert(Array.isArray(listResponse.body));
            assert(listResponse.body.length > 0);
        });

        it('should still respect API key authentication if provided', async function() {
            // Create an API key
            const keyResponse = await request(app)
                .post('/api/api-keys')
                .send({
                    name: 'Restricted Key',
                    permissions: {
                        read: true,
                        write: false,
                        collections: ['*']
                    }
                });
            
            const apiKey = keyResponse.body.api_key;
            
            // Using the key with read permissions should work
            await request(app)
                .get('/api/collections')
                .set('X-API-Key', apiKey)
                .expect(200);
            
            // Using the key for write should be blocked (permissions enforced)
            await request(app)
                .delete('/api/collections/test_collection')
                .set('X-API-Key', apiKey)
                .expect(403);
        });
    });
});

describe('Private Access Mode', function() {
    let app;
    let db;

    before(async function() {
        // Initialize test database
        db = await initDatabase(':memory:');
        
        // Setup Express app
        app = express();
        app.use(express.json());
        
        // Simulate Node-RED WITH auth (private mode)
        app.set('nodeRedAuthConfigured', true);
        
        // Add db to request
        app.use((req, res, next) => {
            req.db = db;
            next();
        });
        
        app.use('/api', apiRouter);
    });

    after(async function() {
        if (db) {
            await db.close();
        }
    });

    describe('When Node-RED auth IS configured (private mode)', function() {
        it('should block access to collections without authentication', async function() {
            const response = await request(app)
                .get('/api/collections')
                .expect(401);
                
            assert(response.body.error);
        });

        it('should block creating collections without authentication', async function() {
            const response = await request(app)
                .post('/api/collections')
                .send({
                    name: 'test_collection',
                    fields: [
                        { name: 'title', type: 'text', required: true }
                    ]
                })
                .expect(401);
                
            assert(response.body.error);
        });
    });
});