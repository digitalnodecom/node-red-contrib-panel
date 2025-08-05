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
    // For now, we'll check if it's a browser request (has certain headers)
    const userAgent = req.headers['user-agent'];
    const accept = req.headers['accept'];
    
    // Allow if it looks like a browser request (admin UI)
    // This is a simplified check - in production you'd want proper session validation
    if (userAgent && userAgent.includes('Mozilla') && accept && accept.includes('html')) {
        return true;
    }
    
    // For API requests, require proper authentication
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
    validateApiKey
};