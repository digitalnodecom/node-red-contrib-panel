const crypto = require('crypto');
const tokenManager = require('../../security/tokenManager');

// Get current internal token from token manager
const getInternalToken = () => {
    return tokenManager.getInternalToken();
};

// Validate API key against database
const validateApiKey = async (db, keyString) => {
    try {
        // Hash the provided key to compare with stored hash
        const keyHash = crypto.createHash('sha256').update(keyString).digest('hex');
        
        // Find API key in database
        const apiKey = await db.get(
            'SELECT * FROM _api_keys WHERE key_hash = ? AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)',
            keyHash
        );
        
        if (!apiKey) {
            return null;
        }
        
        // Update last_used_at timestamp
        await db.run(
            'UPDATE _api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?',
            apiKey.id
        );
        
        // Parse permissions
        try {
            apiKey.permissions = JSON.parse(apiKey.permissions);
        } catch (e) {
            apiKey.permissions = { read: false, write: false, collections: [] };
        }
        
        // Parse database permissions
        try {
            apiKey.database_permissions = JSON.parse(apiKey.database_permissions || '{}');
        } catch (e) {
            apiKey.database_permissions = {};
        }
        
        return apiKey;
    } catch (error) {
        console.error('Error validating API key:', error);
        return null;
    }
};

// Check if Node-RED has authentication configured
const isNodeRedAuthConfigured = (req) => {
    // Check if Node-RED settings indicate auth is configured
    // This would be set by panel.js when initializing
    return req.app && req.app.get && req.app.get('nodeRedAuthConfigured');
};

// Check if Node-RED session is authenticated or if public access is allowed
const isNodeRedAuthenticated = (req) => {
    // If Node-RED doesn't have authentication configured, allow public access
    if (!isNodeRedAuthConfigured(req)) {
        return true; // Public access mode
    }
    
    // If Node-RED has auth configured, check for valid session
    // Node-RED sets req.user when a user is authenticated
    if (req.user) {
        return true;
    }
    
    // Check for Node-RED session cookie
    // Node-RED typically uses express-session with a connect.sid cookie
    if (req.session && req.session.user) {
        return true;
    }
    
    // For API requests from the admin UI with credentials
    // Check if the request includes session cookies
    const cookie = req.headers.cookie;
    if (cookie && cookie.includes('connect.sid')) {
        // The presence of a session cookie suggests potential authentication
        // but we need to verify it's valid - Node-RED will have set req.user if valid
        return false; // Cookie exists but not validated by Node-RED
    }
    
    // No valid authentication found
    return false;
};

// Main authentication middleware
const authenticate = async (req, res, next) => {
    try {
        // Skip authentication for some endpoints (like login)
        if (req.path === '/auth/login' || req.path === '/auth/token') {
            return next();
        }
        
        // Check for internal token (Node-RED editor requests)
        const internalTokenHeader = req.headers['x-internal-token'];
        const currentInternalToken = getInternalToken();
        if (internalTokenHeader && currentInternalToken && internalTokenHeader === currentInternalToken) {
            req.authType = 'internal';
            req.permissions = { read: true, write: true, collections: ['*'] };
            return next();
        }
        
        // Check for Node-RED session authentication (admin UI)
        if (isNodeRedAuthenticated(req)) {
            req.authType = 'session';
            req.permissions = { read: true, write: true, collections: ['*'] };
            return next();
        }
        
        // Check for API key (external clients)
        const apiKeyHeader = req.headers['x-api-key'] || req.headers['authorization'];
        let apiKeyString = null;
        
        if (apiKeyHeader) {
            if (apiKeyHeader.startsWith('Bearer ')) {
                apiKeyString = apiKeyHeader.substring(7);
            } else {
                apiKeyString = apiKeyHeader;
            }
        }
        
        if (apiKeyString) {
            const apiKey = await validateApiKey(req.db, apiKeyString);
            if (apiKey) {
                req.authType = 'api-key';
                req.apiKey = apiKey;
                req.permissions = apiKey.permissions;
                return next();
            }
        }
        
        // No valid authentication found
        return res.status(401).json({
            error: 'Authentication required',
            details: 'Provide a valid API key via X-API-Key header, Bearer token, or authenticate via Node-RED session'
        });
        
    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(500).json({
            error: 'Authentication system error',
            details: 'Internal server error during authentication'
        });
    }
};

// Check if user has permission to access a specific database
const checkDatabasePermission = (req, dbId, action) => {
    // Internal tokens and sessions have access to all databases
    if (req.authType === 'internal' || req.authType === 'session') {
        return { allowed: true };
    }
    
    // For API keys, check database-specific permissions
    if (req.authType === 'api-key' && req.apiKey) {
        const dbPermissions = req.apiKey.database_permissions || {};
        
        // If no database permissions specified, fall back to global permissions for master database
        if (Object.keys(dbPermissions).length === 0) {
            if (dbId === 'master') {
                return { allowed: true, permissions: req.permissions };
            } else {
                return { 
                    allowed: false, 
                    error: 'Access denied', 
                    details: `API key does not have permission to access database '${dbId}'` 
                };
            }
        }
        
        // Check if database is explicitly allowed
        const dbPerm = dbPermissions[dbId];
        if (!dbPerm) {
            return { 
                allowed: false, 
                error: 'Access denied', 
                details: `API key does not have permission to access database '${dbId}'` 
            };
        }
        
        // Check action permission for this database
        if (action === 'read' && !dbPerm.read) {
            return { 
                allowed: false, 
                error: 'Access denied', 
                details: `API key does not have read permission for database '${dbId}'` 
            };
        }
        
        if (['write', 'create', 'update', 'delete'].includes(action) && !dbPerm.write) {
            return { 
                allowed: false, 
                error: 'Access denied', 
                details: `API key does not have write permission for database '${dbId}'` 
            };
        }
        
        return { allowed: true, permissions: dbPerm };
    }
    
    return { 
        allowed: false, 
        error: 'Access denied', 
        details: 'Authentication required' 
    };
};

// Permission validation middleware
const requirePermission = (action, collection = null) => {
    return (req, res, next) => {
        if (!req.permissions) {
            return res.status(403).json({
                error: 'Access denied',
                details: 'No permissions available'
            });
        }
        
        const permissions = req.permissions;
        
        // For database-scoped routes, check database permission first
        const dbId = req.params.dbId || req.currentDatabase;
        if (dbId && dbId !== 'master') {
            const dbCheck = checkDatabasePermission(req, dbId, action);
            if (!dbCheck.allowed) {
                return res.status(403).json({
                    error: dbCheck.error,
                    details: dbCheck.details
                });
            }
            // Use database-specific permissions if available
            if (dbCheck.permissions) {
                Object.assign(permissions, dbCheck.permissions);
            }
        }
        
        // Check basic permission
        if (action === 'read' && !permissions.read) {
            return res.status(403).json({
                error: 'Access denied',
                details: 'Read permission required'
            });
        }
        
        if (['write', 'create', 'update', 'delete'].includes(action) && !permissions.write) {
            return res.status(403).json({
                error: 'Access denied',
                details: 'Write permission required'
            });
        }
        
        // Check collection-specific permissions
        if (collection && permissions.collections) {
            const allowedCollections = permissions.collections;
            if (!allowedCollections.includes('*') && !allowedCollections.includes(collection)) {
                return res.status(403).json({
                    error: 'Access denied',
                    details: `Access to collection '${collection}' not permitted`
                });
            }
        }
        
        next();
    };
};

// Rate limiting middleware (simple implementation)
const rateLimit = async (req, res, next) => {
    // Only apply rate limiting to API key requests
    if (req.authType !== 'api-key' || !req.apiKey) {
        return next();
    }
    
    // Simple rate limiting based on API key
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    try {
        // Note: This is a simple implementation. In production, you'd want to use Redis or similar
        // For now, we'll just check the rate limit without enforcing it
        const rateLimit = req.apiKey.rate_limit || 1000;
        
        // You could implement actual rate limiting here by tracking requests
        // For now, we'll just log it
        console.log(`API Key ${req.apiKey.name} - Rate limit: ${rateLimit}/hour`);
        
        next();
    } catch (error) {
        console.error('Rate limiting error:', error);
        next(); // Continue even if rate limiting fails
    }
};

module.exports = {
    getInternalToken,
    authenticate,
    requirePermission,
    rateLimit,
    validateApiKey,
    checkDatabasePermission
};