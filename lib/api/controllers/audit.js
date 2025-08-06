const { getDatabaseManager } = require('../../database/dbManager');
const { getRecentAuditLog, getAuditStats, cleanupAuditLog } = require('../../database/audit');

/**
 * Get audit log entries
 */
const getAuditLog = async (req, res) => {
    try {
        const dbManager = getDatabaseManager();
        const masterDb = dbManager.getMasterDatabase();

        const options = {
            limit: Math.min(parseInt(req.query.limit) || 50, 100),
            offset: parseInt(req.query.offset) || 0,
            action_type: req.query.action_type || null,
            entity_type: req.query.entity_type || null,
            database_context: req.query.database_context || null,
            username: req.query.username || null,
            days: parseInt(req.query.days) || 30
        };

        const entries = await getRecentAuditLog(masterDb, options);

        // Get total count for pagination
        let countQuery = 'SELECT COUNT(*) as total FROM _audit_log WHERE created_at >= datetime(\'now\', ? || \' days\')';
        const countParams = ['-' + options.days];

        if (options.action_type) {
            countQuery += ' AND action_type = ?';
            countParams.push(options.action_type);
        }

        if (options.entity_type) {
            countQuery += ' AND entity_type = ?';
            countParams.push(options.entity_type);
        }

        if (options.database_context) {
            countQuery += ' AND database_context = ?';
            countParams.push(options.database_context);
        }

        if (options.username) {
            countQuery += ' AND username = ?';
            countParams.push(options.username);
        }

        const countResult = await masterDb.get(countQuery, countParams);

        res.json({
            success: true,
            data: entries,
            pagination: {
                total: countResult.total,
                limit: options.limit,
                offset: options.offset,
                has_more: options.offset + options.limit < countResult.total
            }
        });
    } catch (error) {
        console.error('Error fetching audit log:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Get audit log statistics
 */
const getAuditLogStats = async (req, res) => {
    try {
        const dbManager = getDatabaseManager();
        const masterDb = dbManager.getMasterDatabase();

        const stats = await getAuditStats(masterDb);

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error fetching audit stats:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Get audit log filter options
 */
const getAuditLogFilters = async (req, res) => {
    try {
        const dbManager = getDatabaseManager();
        const masterDb = dbManager.getMasterDatabase();

        // Get distinct values for filters
        const [actionTypes, entityTypes, databases, users] = await Promise.all([
            masterDb.all('SELECT DISTINCT action_type FROM _audit_log ORDER BY action_type'),
            masterDb.all('SELECT DISTINCT entity_type FROM _audit_log ORDER BY entity_type'),
            masterDb.all('SELECT DISTINCT database_context FROM _audit_log ORDER BY database_context'),
            masterDb.all('SELECT DISTINCT username FROM _audit_log WHERE username IS NOT NULL ORDER BY username')
        ]);

        res.json({
            success: true,
            data: {
                action_types: actionTypes.map(row => row.action_type),
                entity_types: entityTypes.map(row => row.entity_type),
                databases: databases.map(row => row.database_context),
                users: users.map(row => row.username)
            }
        });
    } catch (error) {
        console.error('Error fetching audit filters:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Cleanup old audit log entries
 */
const cleanupAuditLogEntries = async (req, res) => {
    try {
        const dbManager = getDatabaseManager();
        const masterDb = dbManager.getMasterDatabase();

        const retentionDays = parseInt(req.body.retention_days) || 90;
        
        if (retentionDays < 7) {
            return res.status(400).json({
                success: false,
                error: 'Retention period must be at least 7 days'
            });
        }

        const deletedCount = await cleanupAuditLog(masterDb, retentionDays);

        res.json({
            success: true,
            data: {
                deleted_count: deletedCount,
                retention_days: retentionDays
            }
        });
    } catch (error) {
        console.error('Error cleaning up audit log:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Get recent activity for dashboard
 */
const getRecentActivity = async (req, res) => {
    try {
        const dbManager = getDatabaseManager();
        const masterDb = dbManager.getMasterDatabase();

        const limit = Math.min(parseInt(req.query.limit) || 10, 25);
        
        const recentActivity = await getRecentAuditLog(masterDb, {
            limit,
            offset: 0,
            days: 7 // Only show last 7 days for dashboard
        });

        res.json({
            success: true,
            data: recentActivity
        });
    } catch (error) {
        console.error('Error fetching recent activity:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

module.exports = {
    getAuditLog,
    getAuditLogStats,
    getAuditLogFilters,
    cleanupAuditLogEntries,
    getRecentActivity
};