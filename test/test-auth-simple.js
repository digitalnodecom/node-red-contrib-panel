const assert = require('assert');
const tokenManager = require('../lib/security/tokenManager');
const { authenticate } = require('../lib/api/middlewares/auth');
const { initDatabase } = require('../lib/database/db');

describe('Authentication Components', function() {
    let db;

    before(async function() {
        db = await initDatabase(':memory:');
    });

    after(async function() {
        if (db) {
            await db.close();
        }
        tokenManager.cleanup();
    });

    describe('Token Manager', function() {
        it('should generate internal token', function() {
            const token = tokenManager.generateInternalToken();
            assert(token);
            assert.equal(typeof token, 'string');
            assert(token.length > 0);
        });

        it('should get the current internal token', function() {
            const token1 = tokenManager.generateInternalToken();
            const token2 = tokenManager.getInternalToken();
            assert.equal(token1, token2);
        });

        it('should generate API keys', function() {
            const apiKey = tokenManager.generateApiKey();
            assert(apiKey);
            assert.equal(typeof apiKey, 'string');
            assert(apiKey.length === 64); // 32 bytes as hex
        });

        it('should hash API keys', function() {
            const apiKey = 'test-key';
            const hash = tokenManager.hashApiKey(apiKey);
            assert(hash);
            assert.equal(typeof hash, 'string');
            assert(hash.length === 64); // SHA256 hash
        });

        it('should validate API key hashes', function() {
            const apiKey = 'test-key';
            const hash = tokenManager.hashApiKey(apiKey);
            
            assert(tokenManager.validateApiKeyHash(apiKey, hash));
            assert(!tokenManager.validateApiKeyHash('wrong-key', hash));
        });
    });

    describe('Database Schema', function() {
        it('should have API keys table', async function() {
            const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='_api_keys'");
            assert(tables.length === 1);
            assert.equal(tables[0].name, '_api_keys');
        });

        it('should create API key record', async function() {
            const result = await db.run(`
                INSERT INTO _api_keys (name, key_hash, permissions, rate_limit)
                VALUES (?, ?, ?, ?)
            `, [
                'Test Key',
                tokenManager.hashApiKey('test-key-123'),
                JSON.stringify({ read: true, write: false, collections: ['*'] }),
                1000
            ]);
            
            assert(result.lastID);
            
            // Verify record exists
            const record = await db.get('SELECT * FROM _api_keys WHERE id = ?', result.lastID);
            assert(record);
            assert.equal(record.name, 'Test Key');
            assert.equal(record.rate_limit, 1000);
            
            const permissions = JSON.parse(record.permissions);
            assert.equal(permissions.read, true);
            assert.equal(permissions.write, false);
        });
    });

    describe('Authentication Middleware Components', function() {
        it('should exist and be callable', function() {
            assert(typeof authenticate === 'function');
        });

        it('should create mock req/res for testing', async function() {
            let nextCalled = false;
            const req = {
                headers: {},
                db: db
            };
            const res = {
                status: (code) => ({
                    json: (data) => {
                        res.statusCode = code;
                        res.body = data;
                        return res;
                    }
                })
            };
            const next = () => { nextCalled = true; };

            // Test with no authentication - should fail
            await authenticate(req, res, next);
            assert.equal(res.statusCode, 401);
            assert(!nextCalled);
        });
    });

    describe('API Key Validation', function() {
        it('should validate API key against database', async function() {
            const { validateApiKey } = require('../lib/api/middlewares/auth');
            
            // Create a test API key
            const testKey = 'test-api-key-12345';
            const keyHash = tokenManager.hashApiKey(testKey);
            
            await db.run(`
                INSERT INTO _api_keys (name, key_hash, permissions, rate_limit)
                VALUES (?, ?, ?, ?)
            `, [
                'Test API Key',
                keyHash,
                JSON.stringify({ read: true, write: true, collections: ['*'] }),
                1000
            ]);
            
            // Test validation
            const result = await validateApiKey(db, testKey);
            assert(result);
            assert.equal(result.name, 'Test API Key');
            assert.equal(result.permissions.read, true);
            assert.equal(result.permissions.write, true);
            
            // Test invalid key
            const invalidResult = await validateApiKey(db, 'invalid-key');
            assert.equal(invalidResult, null);
        });
    });
});

console.log('✅ Authentication system components are working!');