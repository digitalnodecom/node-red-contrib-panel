const crypto = require('crypto');

// Generate a secure API key
const generateApiKey = () => {
    return crypto.randomBytes(32).toString('hex');
};

// Hash an API key for storage
const hashApiKey = (key) => {
    return crypto.createHash('sha256').update(key).digest('hex');
};

// List all API keys
const listApiKeys = async (req, res) => {
    try {
        const apiKeys = await req.db.all(`
            SELECT 
                id, 
                name, 
                permissions, 
                database_permissions,
                rate_limit, 
                expires_at, 
                last_used_at, 
                created_at,
                updated_at
            FROM _api_keys 
            ORDER BY created_at DESC
        `);
        
        // Parse permissions for each key
        const keysWithParsedPermissions = apiKeys.map(key => ({
            ...key,
            permissions: JSON.parse(key.permissions || '{}'),
            database_permissions: JSON.parse(key.database_permissions || '{}'),
            is_expired: key.expires_at ? new Date(key.expires_at) < new Date() : false
        }));
        
        res.json(keysWithParsedPermissions);
    } catch (error) {
        console.error('Error listing API keys:', error);
        res.status(500).json({
            error: 'Failed to list API keys',
            details: error.message
        });
    }
};

// Create a new API key
const createApiKey = async (req, res) => {
    try {
        const { name, permissions, database_permissions, rate_limit, expires_at } = req.body;
        
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return res.status(400).json({
                error: 'Validation error',
                details: 'API key name is required'
            });
        }
        
        // Generate new API key
        const apiKey = generateApiKey();
        const keyHash = hashApiKey(apiKey);
        
        // Set default permissions if not provided
        const defaultPermissions = {
            read: true,
            write: false,
            collections: ['*']
        };
        
        const finalPermissions = permissions || defaultPermissions;
        const finalRateLimit = rate_limit || 1000;
        
        // Insert into database
        const result = await req.db.run(`
            INSERT INTO _api_keys (name, key_hash, permissions, database_permissions, rate_limit, expires_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [
            name.trim(),
            keyHash,
            JSON.stringify(finalPermissions),
            JSON.stringify(database_permissions || {}),
            finalRateLimit,
            expires_at || null
        ]);
        
        // Return the created key info (including the actual key - only shown once)
        res.status(201).json({
            id: result.lastID,
            name: name.trim(),
            api_key: apiKey, // Only returned on creation
            permissions: finalPermissions,
            database_permissions: database_permissions || {},
            rate_limit: finalRateLimit,
            expires_at: expires_at || null,
            created_at: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error creating API key:', error);
        res.status(500).json({
            error: 'Failed to create API key',
            details: error.message
        });
    }
};

// Get a specific API key (without the actual key)
const getApiKey = async (req, res) => {
    try {
        const { id } = req.params;
        
        const apiKey = await req.db.get(`
            SELECT 
                id, 
                name, 
                permissions, 
                database_permissions,
                rate_limit, 
                expires_at, 
                last_used_at, 
                created_at,
                updated_at
            FROM _api_keys 
            WHERE id = ?
        `, id);
        
        if (!apiKey) {
            return res.status(404).json({
                error: 'API key not found'
            });
        }
        
        // Parse permissions and add expiry status
        const keyWithParsedPermissions = {
            ...apiKey,
            permissions: JSON.parse(apiKey.permissions || '{}'),
            database_permissions: JSON.parse(apiKey.database_permissions || '{}'),
            is_expired: apiKey.expires_at ? new Date(apiKey.expires_at) < new Date() : false
        };
        
        res.json(keyWithParsedPermissions);
    } catch (error) {
        console.error('Error getting API key:', error);
        res.status(500).json({
            error: 'Failed to get API key',
            details: error.message
        });
    }
};

// Update an API key
const updateApiKey = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, permissions, database_permissions, rate_limit, expires_at } = req.body;
        
        // Build update query dynamically
        const updates = [];
        const values = [];
        
        if (name !== undefined) {
            if (!name || typeof name !== 'string' || name.trim().length === 0) {
                return res.status(400).json({
                    error: 'Validation error',
                    details: 'API key name cannot be empty'
                });
            }
            updates.push('name = ?');
            values.push(name.trim());
        }
        
        if (permissions !== undefined) {
            updates.push('permissions = ?');
            values.push(JSON.stringify(permissions));
        }
        
        if (database_permissions !== undefined) {
            updates.push('database_permissions = ?');
            values.push(JSON.stringify(database_permissions));
        }
        
        if (rate_limit !== undefined) {
            updates.push('rate_limit = ?');
            values.push(rate_limit);
        }
        
        if (expires_at !== undefined) {
            updates.push('expires_at = ?');
            values.push(expires_at);
        }
        
        if (updates.length === 0) {
            return res.status(400).json({
                error: 'Validation error',
                details: 'No valid fields to update'
            });
        }
        
        values.push(id);
        
        const result = await req.db.run(
            `UPDATE _api_keys SET ${updates.join(', ')} WHERE id = ?`,
            values
        );
        
        if (result.changes === 0) {
            return res.status(404).json({
                error: 'API key not found'
            });
        }
        
        // Return updated key info
        const updatedKey = await req.db.get(`
            SELECT 
                id, 
                name, 
                permissions, 
                database_permissions,
                rate_limit, 
                expires_at, 
                last_used_at, 
                created_at,
                updated_at
            FROM _api_keys 
            WHERE id = ?
        `, id);
        
        res.json({
            ...updatedKey,
            permissions: JSON.parse(updatedKey.permissions || '{}'),
            database_permissions: JSON.parse(updatedKey.database_permissions || '{}'),
            is_expired: updatedKey.expires_at ? new Date(updatedKey.expires_at) < new Date() : false
        });
        
    } catch (error) {
        console.error('Error updating API key:', error);
        res.status(500).json({
            error: 'Failed to update API key',
            details: error.message
        });
    }
};

// Regenerate an API key (creates new key, keeps same permissions)
const regenerateApiKey = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get current key info
        const currentKey = await req.db.get('SELECT * FROM _api_keys WHERE id = ?', id);
        if (!currentKey) {
            return res.status(404).json({
                error: 'API key not found'
            });
        }
        
        // Generate new key
        const newApiKey = generateApiKey();
        const newKeyHash = hashApiKey(newApiKey);
        
        // Update database with new hash
        const result = await req.db.run(
            'UPDATE _api_keys SET key_hash = ? WHERE id = ?',
            [newKeyHash, id]
        );
        
        if (result.changes === 0) {
            return res.status(404).json({
                error: 'API key not found'
            });
        }
        
        res.json({
            id: parseInt(id),
            name: currentKey.name,
            api_key: newApiKey, // Only returned on regeneration
            permissions: JSON.parse(currentKey.permissions || '{}'),
            database_permissions: JSON.parse(currentKey.database_permissions || '{}'),
            rate_limit: currentKey.rate_limit,
            expires_at: currentKey.expires_at,
            message: 'API key regenerated successfully'
        });
        
    } catch (error) {
        console.error('Error regenerating API key:', error);
        res.status(500).json({
            error: 'Failed to regenerate API key',
            details: error.message
        });
    }
};

// Delete an API key
const deleteApiKey = async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await req.db.run('DELETE FROM _api_keys WHERE id = ?', id);
        
        if (result.changes === 0) {
            return res.status(404).json({
                error: 'API key not found'
            });
        }
        
        res.json({
            message: 'API key deleted successfully',
            id: parseInt(id)
        });
        
    } catch (error) {
        console.error('Error deleting API key:', error);
        res.status(500).json({
            error: 'Failed to delete API key',
            details: error.message
        });
    }
};

// Get usage statistics for API keys
const getUsageStats = async (req, res) => {
    try {
        // This would require implementing usage tracking
        // For now, return basic stats from last_used_at
        const stats = await req.db.all(`
            SELECT 
                id,
                name,
                last_used_at,
                created_at,
                CASE 
                    WHEN last_used_at > datetime('now', '-1 day') THEN 'active'
                    WHEN last_used_at IS NULL THEN 'unused'
                    ELSE 'inactive'
                END as status
            FROM _api_keys
            ORDER BY last_used_at DESC NULLS LAST
        `);
        
        res.json(stats);
    } catch (error) {
        console.error('Error getting usage stats:', error);
        res.status(500).json({
            error: 'Failed to get usage statistics',
            details: error.message
        });
    }
};

module.exports = {
    listApiKeys,
    createApiKey,
    getApiKey,
    updateApiKey,
    regenerateApiKey,
    deleteApiKey,
    getUsageStats
};