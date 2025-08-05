const express = require('express');
const router = express.Router();
const collectionsController = require('./controllers/collections');
const recordsController = require('./controllers/records');
const systemController = require('./controllers/system');
const eventsController = require('./controllers/events');
const apiKeysController = require('./controllers/apiKeys');
const { validateCollection, validateRecord } = require('./middlewares/validation');
const { authenticate, requirePermission, rateLimit } = require('./middlewares/auth');

// Apply authentication and rate limiting to all routes
router.use(authenticate);
router.use(rateLimit);

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

// Records routes - these will have collection-specific permission checks
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