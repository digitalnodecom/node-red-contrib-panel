const crypto = require('crypto');

/**
 * Audit logging utilities for tracking all system changes
 */

/**
 * Extract user information from request
 */
const extractUserInfo = (req) => {
    const userInfo = {
        user_id: null,
        username: 'anonymous',
        session_id: null,
        ip_address: null,
        user_agent: null
    };

    if (!req) return userInfo;

    // Extract IP address
    userInfo.ip_address = req.ip || 
                         (req.connection && req.connection.remoteAddress) || 
                         (req.socket && req.socket.remoteAddress) ||
                         (req.connection && req.connection.socket && req.connection.socket.remoteAddress) ||
                         (req.headers['x-forwarded-for'] && req.headers['x-forwarded-for'].split(',')[0].trim()) ||
                         'unknown';

    // Extract user agent
    userInfo.user_agent = req.headers['user-agent'] || 'unknown';

    // Generate or extract session ID
    if (req.session && req.session.id) {
        userInfo.session_id = req.session.id;
    } else if (req.headers['x-session-id']) {
        userInfo.session_id = req.headers['x-session-id'];
    } else {
        // Generate a simple session ID based on IP + User-Agent + timestamp
        const sessionData = userInfo.ip_address + userInfo.user_agent + Date.now();
        userInfo.session_id = crypto.createHash('md5').update(sessionData).digest('hex').substring(0, 16);
    }

    // Extract user information from different sources
    if (req.headers['x-internal-token']) {
        // Node-RED internal token
        userInfo.username = 'node-red-editor';
        userInfo.user_id = 'internal';
    } else if (req.apiKey) {
        // API key authentication
        userInfo.username = req.apiKey.name || 'api-user';
        userInfo.user_id = `api-key-${req.apiKey.id}`;
    } else if (req.user) {
        // User session (if available)
        userInfo.username = req.user.username || req.user.name || 'authenticated-user';
        userInfo.user_id = req.user.id || req.user.username;
    } else if (req.headers['authorization']) {
        // Basic auth or other auth header
        userInfo.username = 'authenticated-user';
        userInfo.user_id = 'auth-header';
    }

    return userInfo;
};

/**
 * Log an audit event to the master database
 */
const logAuditEvent = async (masterDb, options) => {
    const {
        action_type,
        entity_type,
        entity_id = null,
        entity_name = null,
        database_context = 'master',
        details = null,
        req = null
    } = options;

    try {
        // Extract user information
        const userInfo = extractUserInfo(req);

        // Prepare details as JSON string if it's an object
        const detailsJson = details && typeof details === 'object' ? JSON.stringify(details) : details;

        // Insert audit log entry
        await masterDb.run(`
            INSERT INTO _audit_log (
                action_type, entity_type, entity_id, entity_name, database_context,
                user_id, username, session_id, details, ip_address, user_agent
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            action_type,
            entity_type,
            entity_id,
            entity_name,
            database_context,
            userInfo.user_id,
            userInfo.username,
            userInfo.session_id,
            detailsJson,
            userInfo.ip_address,
            userInfo.user_agent
        ]);

        console.log(`Audit: ${userInfo.username} performed ${action_type} on ${entity_type} (${entity_name || entity_id}) in ${database_context}`);
    } catch (error) {
        console.error('Failed to log audit event:', error);
        // Don't throw - audit logging should not break main functionality
    }
};

/**
 * Convenient audit logging functions for common operations
 */
const auditDatabase = {
    created: (masterDb, dbName, displayName, req) => logAuditEvent(masterDb, {
        action_type: 'database_created',
        entity_type: 'database',
        entity_id: dbName,
        entity_name: displayName,
        details: { display_name: displayName },
        req
    }),

    updated: (masterDb, dbName, displayName, changes, req) => logAuditEvent(masterDb, {
        action_type: 'database_updated',
        entity_type: 'database',
        entity_id: dbName,
        entity_name: displayName,
        details: { changes },
        req
    }),

    deleted: (masterDb, dbName, displayName, req) => logAuditEvent(masterDb, {
        action_type: 'database_deleted',
        entity_type: 'database',
        entity_id: dbName,
        entity_name: displayName,
        req
    }),

    setDefault: (masterDb, dbName, displayName, req) => logAuditEvent(masterDb, {
        action_type: 'database_set_default',
        entity_type: 'database',
        entity_id: dbName,
        entity_name: displayName,
        req
    }),

    journalModeChanged: (masterDb, dbName, oldMode, newMode, req) => logAuditEvent(masterDb, {
        action_type: 'database_journal_mode_changed',
        entity_type: 'database',
        entity_id: dbName,
        details: { old_mode: oldMode, new_mode: newMode },
        req
    })
};

const auditCollection = {
    created: (masterDb, collectionName, databaseContext, fieldCount, req) => logAuditEvent(masterDb, {
        action_type: 'collection_created',
        entity_type: 'collection',
        entity_id: collectionName,
        entity_name: collectionName,
        database_context: databaseContext,
        details: { field_count: fieldCount },
        req
    }),

    updated: (masterDb, collectionName, databaseContext, changes, req) => logAuditEvent(masterDb, {
        action_type: 'collection_updated',
        entity_type: 'collection',
        entity_id: collectionName,
        entity_name: collectionName,
        database_context: databaseContext,
        details: { changes },
        req
    }),

    deleted: (masterDb, collectionName, databaseContext, req) => logAuditEvent(masterDb, {
        action_type: 'collection_deleted',
        entity_type: 'collection',
        entity_id: collectionName,
        entity_name: collectionName,
        database_context: databaseContext,
        req
    }),

    truncated: (masterDb, collectionName, databaseContext, recordCount, req) => logAuditEvent(masterDb, {
        action_type: 'collection_truncated',
        entity_type: 'collection',
        entity_id: collectionName,
        entity_name: collectionName,
        database_context: databaseContext,
        details: { records_deleted: recordCount },
        req
    })
};

/**
 * Get recent audit log entries
 */
const getRecentAuditLog = async (masterDb, options = {}) => {
    const {
        limit = 20,
        offset = 0,
        action_type = null,
        entity_type = null,
        database_context = null,
        username = null,
        days = 30
    } = options;

    try {
        let whereClause = 'WHERE created_at >= datetime(\'now\', ?)';
        const params = ['-' + days + ' days'];

        if (action_type) {
            whereClause += ' AND action_type = ?';
            params.push(action_type);
        }

        if (entity_type) {
            whereClause += ' AND entity_type = ?';
            params.push(entity_type);
        }

        if (database_context) {
            whereClause += ' AND database_context = ?';
            params.push(database_context);
        }

        if (username) {
            whereClause += ' AND username = ?';
            params.push(username);
        }

        const query = `
            SELECT 
                id, action_type, entity_type, entity_id, entity_name, database_context,
                user_id, username, details, ip_address, created_at
            FROM _audit_log 
            ${whereClause}
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
        `;

        params.push(limit, offset);

        const entries = await masterDb.all(query, params);

        // Parse JSON details
        return entries.map(entry => ({
            ...entry,
            details: entry.details ? JSON.parse(entry.details) : null,
            created_at: entry.created_at
        }));
    } catch (error) {
        console.error('Failed to fetch audit log:', error);
        return [];
    }
};

/**
 * Get audit log statistics
 */
const getAuditStats = async (masterDb) => {
    try {
        const stats = await masterDb.get(`
            SELECT 
                COUNT(*) as total_entries,
                COUNT(DISTINCT username) as unique_users,
                COUNT(DISTINCT database_context) as databases_affected,
                (SELECT COUNT(*) FROM _audit_log WHERE created_at >= datetime('now', '-1 day')) as last_24h,
                (SELECT COUNT(*) FROM _audit_log WHERE created_at >= datetime('now', '-7 days')) as last_7days
            FROM _audit_log
        `);

        const recentActions = await masterDb.all(`
            SELECT action_type, COUNT(*) as count
            FROM _audit_log 
            WHERE created_at >= datetime('now', '-7 days')
            GROUP BY action_type
            ORDER BY count DESC
            LIMIT 5
        `);

        return {
            ...stats,
            recent_actions: recentActions
        };
    } catch (error) {
        console.error('Failed to fetch audit stats:', error);
        return {
            total_entries: 0,
            unique_users: 0,
            databases_affected: 0,
            last_24h: 0,
            last_7days: 0,
            recent_actions: []
        };
    }
};

/**
 * Clean up old audit log entries
 */
const cleanupAuditLog = async (masterDb, retentionDays = 90) => {
    try {
        const result = await masterDb.run(
            'DELETE FROM _audit_log WHERE created_at < datetime(\'now\', ?)',
            ['-' + retentionDays + ' days']
        );
        
        if (result.changes > 0) {
            console.log(`Cleaned up ${result.changes} old audit log entries (older than ${retentionDays} days)`);
        }
        
        return result.changes;
    } catch (error) {
        console.error('Failed to cleanup audit log:', error);
        return 0;
    }
};

module.exports = {
    logAuditEvent,
    auditDatabase,
    auditCollection,
    getRecentAuditLog,
    getAuditStats,
    cleanupAuditLog,
    extractUserInfo
};