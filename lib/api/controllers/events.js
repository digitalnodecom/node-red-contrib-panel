const { 
    getUnprocessedEvents, 
    markEventsProcessed, 
    cleanupProcessedEvents 
} = require('../../database/triggers');

const listEvents = async (req, res, next) => {
    try {
        const { collection, limit = 50 } = req.query;
        const events = await getUnprocessedEvents(req.db, collection, parseInt(limit));
        
        // Parse and log UPDATE events for debugging
        events.forEach(event => {
            if (event.event_type === 'UPDATE') {
                console.log('UPDATE Event Debug:', {
                    id: event.id,
                    collection: event.collection,
                    old_data_raw: event.old_data,
                    new_data_raw: event.new_data
                });
            }
        });
        
        res.json(events);
    } catch (error) {
        next(error);
    }
};

const processEvents = async (req, res, next) => {
    try {
        const { eventIds } = req.body;
        
        if (!Array.isArray(eventIds) || eventIds.length === 0) {
            return res.status(400).json({ error: 'eventIds must be a non-empty array' });
        }
        
        await markEventsProcessed(req.db, eventIds);
        res.json({ success: true, processed: eventIds.length });
    } catch (error) {
        next(error);
    }
};

const cleanupEvents = async (req, res, next) => {
    try {
        const { olderThanDays = 7 } = req.body;
        const deletedCount = await cleanupProcessedEvents(req.db, parseInt(olderThanDays));
        res.json({ success: true, deleted: deletedCount });
    } catch (error) {
        next(error);
    }
};

const debugTriggers = async (req, res, next) => {
    try {
        const { listAllTriggers, cleanupDuplicateTriggers } = require('../../database/triggers');
        const { action } = req.query;
        
        if (action === 'cleanup') {
            await cleanupDuplicateTriggers(req.db);
            res.json({ success: true, message: 'Duplicate triggers cleaned up' });
        } else {
            const triggers = await listAllTriggers(req.db);
            const panelTriggers = triggers.filter(t => 
                t.name.includes('panel_trigger_') || 
                t.name.includes('z_panel_trigger_')
            );
            res.json({ 
                total: triggers.length,
                panelTriggers: panelTriggers.length,
                triggers: panelTriggers 
            });
        }
    } catch (error) {
        next(error);
    }
};

module.exports = {
    listEvents,
    processEvents,
    cleanupEvents,
    debugTriggers
};