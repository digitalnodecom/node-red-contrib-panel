const express = require('express');
const router = express.Router();
const collectionsController = require('./controllers/collections');
const recordsController = require('./controllers/records');
const systemController = require('./controllers/system');
const eventsController = require('./controllers/events');
const databasesController = require('./controllers/databases');
const auditController = require('./controllers/audit');
const { validateCollection, validateRecord } = require('./middlewares/validation');

// Database management routes
router.get('/databases', databasesController.listDatabases);
router.post('/databases', databasesController.createDatabase);
router.get('/databases/stats', databasesController.getDatabaseStats);
router.get('/databases/:dbId', databasesController.getDatabase);
router.put('/databases/:dbId', databasesController.updateDatabase);
router.delete('/databases/:dbId', databasesController.deleteDatabase);
router.post('/databases/:dbId/set-default', databasesController.setDefaultDatabase);

// System routes
router.get('/system', systemController.getSystemInfo);
router.put('/system/journal-mode', systemController.changeJournalMode);

// Audit log routes (master database only - audit logs are not database-scoped)
router.get('/audit/log', auditController.getAuditLog);
router.get('/audit/stats', auditController.getAuditLogStats);
router.get('/audit/filters', auditController.getAuditLogFilters);
router.get('/audit/recent', auditController.getRecentActivity);
router.post('/audit/cleanup', auditController.cleanupAuditLogEntries);

// Collections routes
router.get('/collections', collectionsController.list);
router.get('/collections/:name', collectionsController.get);
router.post('/collections', validateCollection, collectionsController.create);
router.put('/collections/:name', validateCollection, collectionsController.update);
router.delete('/collections/:name', collectionsController.delete);
router.post('/collections/:name/truncate', collectionsController.truncate);

// Events routes
router.get('/events', eventsController.listEvents);
router.post('/events/process', eventsController.processEvents);
router.post('/events/cleanup', eventsController.cleanupEvents);
router.get('/events/triggers', eventsController.debugTriggers);

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
router.get('/databases/:dbId/collections', collectionsController.list);
router.get('/databases/:dbId/collections/:name', collectionsController.get);
router.post('/databases/:dbId/collections', validateCollection, collectionsController.create);
router.put('/databases/:dbId/collections/:name', validateCollection, collectionsController.update);
router.delete('/databases/:dbId/collections/:name', collectionsController.delete);
router.post('/databases/:dbId/collections/:name/truncate', collectionsController.truncate);

// Database-scoped events routes
router.get('/databases/:dbId/events', eventsController.listEvents);
router.post('/databases/:dbId/events/process', eventsController.processEvents);
router.post('/databases/:dbId/events/cleanup', eventsController.cleanupEvents);
router.get('/databases/:dbId/events/triggers', eventsController.debugTriggers);

// Database-scoped records routes
router.get('/databases/:dbId/:collection', recordsController.list);
router.get('/databases/:dbId/:collection/:id', recordsController.get);
router.post('/databases/:dbId/:collection', validateRecord, recordsController.create);
router.post('/databases/:dbId/:collection/upsert', validateRecord, recordsController.upsert);
router.put('/databases/:dbId/:collection/:id', validateRecord, recordsController.update);
router.delete('/databases/:dbId/:collection/:id', recordsController.delete);

// Legacy routes (for backward compatibility) - use master database
router.get('/:collection', recordsController.list);
router.get('/:collection/:id', recordsController.get);
router.post('/:collection', validateRecord, recordsController.create);
router.post('/:collection/upsert', validateRecord, recordsController.upsert);
router.put('/:collection/:id', validateRecord, recordsController.update);
router.delete('/:collection/:id', recordsController.delete);

// Error handling middleware
router.use((err, req, res, next) => {
    console.error('API Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
        details: err.details || null
    });
});

module.exports = router;