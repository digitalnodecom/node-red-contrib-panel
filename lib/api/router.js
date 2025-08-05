const express = require('express');
const router = express.Router();
const collectionsController = require('./controllers/collections');
const recordsController = require('./controllers/records');
const systemController = require('./controllers/system');
const eventsController = require('./controllers/events');
const { validateCollection, validateRecord } = require('./middlewares/validation');

// System routes
router.get('/system', systemController.getSystemInfo);
router.put('/system/journal-mode', systemController.changeJournalMode);

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

// Records routes
router.get('/:collection', recordsController.list);
router.get('/:collection/:id', recordsController.get);
router.post('/:collection', validateRecord, recordsController.create);
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