const assert = require('assert');
const request = require('supertest');
const express = require('express');
const { initDatabase } = require('../lib/database/db');
const apiRouter = require('../lib/api/router');
const tokenManager = require('../lib/security/tokenManager');

describe('Authentication System', function() {
    let app;
    let db;
    let apiKey;
    let internalToken;

    before(async function() {
        // Initialize test database
        db = await initDatabase(':memory:');
        
        // Generate internal token
        internalToken = tokenManager.generateInternalToken();
        
        // Setup Express app
        app = express();
        app.use(express.json());
        
        // Add db to request
        app.use((req, res, next) => {
            req.db = db;
            next();
        });
        
        app.use('/api', apiRouter);
        
        // Create test API key
        const response = await request(app)
            .post('/api/api-keys')
            .send({
                name: 'Test Key',
                permissions: {
                    read: true,
                    write: true,
                    collections: ['*']
                },
                rate_limit: 1000
            });
            
        apiKey = response.body.api_key;
    });

    after(async function() {
        if (db) {
            await db.close();
        }
        tokenManager.cleanup();
    });

    describe('API Key Authentication', function() {
        it('should reject requests without authentication', async function() {
            const response = await request(app)
                .get('/api/collections')
                .expect(401);
                
            assert(response.body.error);
        });

        it('should accept requests with valid API key in X-API-Key header', async function() {
            await request(app)
                .get('/api/collections')
                .set('X-API-Key', apiKey)
                .expect(200);
        });

        it('should accept requests with valid API key in Authorization header', async function() {
            await request(app)
                .get('/api/collections')
                .set('Authorization', `Bearer ${apiKey}`)
                .expect(200);
        });

        it('should reject requests with invalid API key', async function() {
            const response = await request(app)
                .get('/api/collections')
                .set('X-API-Key', 'invalid-key')
                .expect(401);
                
            assert(response.body.error);
        });
    });

    describe('Internal Token Authentication', function() {
        it('should accept requests with valid internal token', async function() {
            await request(app)
                .get('/api/collections')
                .set('X-Internal-Token', internalToken)
                .expect(200);
        });

        it('should reject requests with invalid internal token', async function() {
            const response = await request(app)
                .get('/api/collections')
                .set('X-Internal-Token', 'invalid-token')
                .expect(401);
                
            assert(response.body.error);
        });
    });

    describe('API Key Management', function() {
        it('should create new API key with authentication', async function() {
            const response = await request(app)
                .post('/api/api-keys')
                .set('X-API-Key', apiKey)
                .send({
                    name: 'Another Test Key',
                    permissions: {
                        read: true,
                        write: false,
                        collections: ['users']
                    },
                    rate_limit: 500
                })
                .expect(201);
                
            assert(response.body.api_key);
            assert.equal(response.body.name, 'Another Test Key');
            assert.equal(response.body.permissions.read, true);
            assert.equal(response.body.permissions.write, false);
        });

        it('should list API keys with authentication', async function() {
            const response = await request(app)
                .get('/api/api-keys')
                .set('X-API-Key', apiKey)
                .expect(200);
                
            assert(Array.isArray(response.body));
            assert(response.body.length >= 2);
        });

        it('should reject API key operations without authentication', async function() {
            await request(app)
                .get('/api/api-keys')
                .expect(401);
                
            await request(app)
                .post('/api/api-keys')
                .send({ name: 'Test' })
                .expect(401);
        });
    });

    describe('Permission System', function() {
        let readOnlyKey;

        before(async function() {
            // Create read-only API key
            const response = await request(app)
                .post('/api/api-keys')
                .set('X-API-Key', apiKey)
                .send({
                    name: 'Read Only Key',
                    permissions: {
                        read: true,
                        write: false,
                        collections: ['*']
                    }
                });
            readOnlyKey = response.body.api_key;
        });

        it('should allow read operations with read-only key', async function() {
            await request(app)
                .get('/api/collections')
                .set('X-API-Key', readOnlyKey)
                .expect(200);
                
            await request(app)
                .get('/api/system')
                .set('X-API-Key', readOnlyKey)
                .expect(200);
        });

        it('should reject write operations with read-only key', async function() {
            await request(app)
                .post('/api/collections')
                .set('X-API-Key', readOnlyKey)
                .send({
                    name: 'test_collection',
                    fields: [{ name: 'title', type: 'text' }]
                })
                .expect(403);
        });
    });
});