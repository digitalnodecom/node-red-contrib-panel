const express = require('express');
const router = express.Router();
const collectionsController = require('./controllers/collections');
const recordsController = require('./controllers/records');
const systemController = require('./controllers/system');
const eventsController = require('./controllers/events');
const apiKeysController = require('./controllers/apiKeys');
const databasesController = require('./controllers/databases');
const auditController = require('./controllers/audit');
const { validateCollection, validateRecord } = require('./middlewares/validation');
const { authenticate, requirePermission, rateLimit } = require('./middlewares/auth');

// Apply authentication and rate limiting to all routes
router.use(authenticate);
router.use(rateLimit);

// Database management routes
router.get('/databases', requirePermission('read'), databasesController.listDatabases);
router.post('/databases', requirePermission('write'), databasesController.createDatabase);
router.get('/databases/stats', requirePermission('read'), databasesController.getDatabaseStats);
router.get('/databases/:dbId', requirePermission('read'), databasesController.getDatabase);
router.put('/databases/:dbId', requirePermission('write'), databasesController.updateDatabase);
router.delete('/databases/:dbId', requirePermission('write'), databasesController.deleteDatabase);
router.post('/databases/:dbId/set-default', requirePermission('write'), databasesController.setDefaultDatabase);

// API Key management routes (require write permissions)
router.get('/api-keys', requirePermission('read'), apiKeysController.listApiKeys);
router.post('/api-keys', requirePermission('write'), apiKeysController.createApiKey);
router.get('/api-keys/:id', requirePermission('read'), apiKeysController.getApiKey);
router.put('/api-keys/:id', requirePermission('write'), apiKeysController.updateApiKey);
router.post('/api-keys/:id/regenerate', requirePermission('write'), apiKeysController.regenerateApiKey);
router.delete('/api-keys/:id', requirePermission('write'), apiKeysController.deleteApiKey);
router.get('/api-keys-usage', requirePermission('read'), apiKeysController.getUsageStats);

// System routes
router.get('/system', requirePermission('read'), systemController.getSystemInfo);
router.put('/system/journal-mode', requirePermission('write'), systemController.changeJournalMode);

// Audit log routes (master database only - audit logs are not database-scoped)
router.get('/audit/log', requirePermission('read'), auditController.getAuditLog);
router.get('/audit/stats', requirePermission('read'), auditController.getAuditLogStats);
router.get('/audit/filters', requirePermission('read'), auditController.getAuditLogFilters);
router.get('/audit/recent', requirePermission('read'), auditController.getRecentActivity);
router.post('/audit/cleanup', requirePermission('write'), auditController.cleanupAuditLogEntries);

// Collections routes
router.get('/collections', requirePermission('read'), collectionsController.list);
router.get('/collections/:name', requirePermission('read'), collectionsController.get);
router.post('/collections', requirePermission('write'), validateCollection, collectionsController.create);
router.put('/collections/:name', requirePermission('write'), validateCollection, collectionsController.update);
router.delete('/collections/:name', requirePermission('write'), collectionsController.delete);
router.post('/collections/:name/truncate', requirePermission('write'), collectionsController.truncate);

// Events routes
router.get('/events', requirePermission('read'), eventsController.listEvents);
router.post('/events/process', requirePermission('write'), eventsController.processEvents);
router.post('/events/cleanup', requirePermission('write'), eventsController.cleanupEvents);
router.get('/events/triggers', requirePermission('read'), eventsController.debugTriggers);

// Database-scoped routes - Collections and Records with database context
router.use('/databases/:dbId', async (req, res, next) => {
    try {
        const dbManager = req.dbManager;
        const dbId = req.params.dbId;
        
        // Get the specific database connection
        const db = await dbManager.getDatabase(dbId);
        req.db = db; // Override the default master database connection
        req.currentDatabase = await dbManager.getDatabaseInfo(dbId);
        
        next();
    } catch (error) {
        res.status(404).json({
            error: 'Database not found',
            details: error.message
        });
    }
});

// Database-scoped collections routes
router.get('/databases/:dbId/collections', requirePermission('read'), collectionsController.list);
router.get('/databases/:dbId/collections/:name', requirePermission('read'), collectionsController.get);
router.post('/databases/:dbId/collections', requirePermission('write'), validateCollection, collectionsController.create);
router.put('/databases/:dbId/collections/:name', requirePermission('write'), validateCollection, collectionsController.update);
router.delete('/databases/:dbId/collections/:name', requirePermission('write'), collectionsController.delete);
router.post('/databases/:dbId/collections/:name/truncate', requirePermission('write'), collectionsController.truncate);

// Database-scoped events routes
router.get('/databases/:dbId/events', requirePermission('read'), eventsController.listEvents);
router.post('/databases/:dbId/events/process', requirePermission('write'), eventsController.processEvents);
router.post('/databases/:dbId/events/cleanup', requirePermission('write'), eventsController.cleanupEvents);
router.get('/databases/:dbId/events/triggers', requirePermission('read'), eventsController.debugTriggers);

// Database-scoped records routes
router.get('/databases/:dbId/:collection', requirePermission('read'), recordsController.list);
router.get('/databases/:dbId/:collection/:id', requirePermission('read'), recordsController.get);
router.post('/databases/:dbId/:collection', requirePermission('write'), validateRecord, recordsController.create);
router.post('/databases/:dbId/:collection/upsert', requirePermission('write'), validateRecord, recordsController.upsert);
router.put('/databases/:dbId/:collection/:id', requirePermission('write'), validateRecord, recordsController.update);
router.delete('/databases/:dbId/:collection/:id', requirePermission('write'), recordsController.delete);

// Legacy routes (for backward compatibility) - use master database
router.get('/:collection', requirePermission('read'), recordsController.list);
router.get('/:collection/:id', requirePermission('read'), recordsController.get);
router.post('/:collection', requirePermission('write'), validateRecord, recordsController.create);
router.post('/:collection/upsert', requirePermission('write'), validateRecord, recordsController.upsert);
router.put('/:collection/:id', requirePermission('write'), validateRecord, recordsController.update);
router.delete('/:collection/:id', requirePermission('write'), recordsController.delete);

// Error handling middleware
router.use((err, req, res, next) => {
    console.error('API Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
        details: err.details || null
    });
});

module.exports = router;