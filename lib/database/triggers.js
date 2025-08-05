const createEventTriggers = async (db, collectionName) => {
    // Create INSERT trigger
    await db.exec(`
        CREATE TRIGGER IF NOT EXISTS panel_trigger_${collectionName}_insert
        AFTER INSERT ON ${collectionName}
        BEGIN
            INSERT INTO _trigger_events (collection, event_type, record_id, new_data)
            VALUES ('${collectionName}', 'INSERT', NEW.id, json_object(
                'id', NEW.id,
                'created_at', NEW.created_at,
                'updated_at', NEW.updated_at
                ${await buildFieldJsonForTrigger(db, collectionName, 'NEW')}
            ));
        END;
    `);
    
    // Create UPDATE trigger
    // Note: In SQLite, OLD contains values before the UPDATE statement
    // NEW contains values as specified in the UPDATE, before any other AFTER triggers
    await db.exec(`
        CREATE TRIGGER IF NOT EXISTS panel_trigger_${collectionName}_update
        AFTER UPDATE ON ${collectionName}
        BEGIN
            INSERT INTO _trigger_events (collection, event_type, record_id, old_data, new_data)
            VALUES ('${collectionName}', 'UPDATE', NEW.id, 
                json_object(
                    'id', OLD.id,
                    'created_at', OLD.created_at,
                    'updated_at', OLD.updated_at
                    ${await buildFieldJsonForTrigger(db, collectionName, 'OLD')}
                ),
                json_object(
                    'id', NEW.id,
                    'created_at', NEW.created_at,
                    'updated_at', NEW.updated_at
                    ${await buildFieldJsonForTrigger(db, collectionName, 'NEW')}
                )
            );
        END;
    `);
    
    // Create DELETE trigger
    await db.exec(`
        CREATE TRIGGER IF NOT EXISTS panel_trigger_${collectionName}_delete
        AFTER DELETE ON ${collectionName}
        BEGIN
            INSERT INTO _trigger_events (collection, event_type, record_id, old_data)
            VALUES ('${collectionName}', 'DELETE', OLD.id, json_object(
                'id', OLD.id,
                'created_at', OLD.created_at,
                'updated_at', OLD.updated_at
                ${await buildFieldJsonForTrigger(db, collectionName, 'OLD')}
            ));
        END;
    `);
    
    console.log(`Created event triggers for collection: ${collectionName}`);
};

const dropEventTriggers = async (db, collectionName) => {
    // Drop current triggers
    await db.exec(`DROP TRIGGER IF EXISTS panel_trigger_${collectionName}_insert`);
    await db.exec(`DROP TRIGGER IF EXISTS panel_trigger_${collectionName}_update`);
    await db.exec(`DROP TRIGGER IF EXISTS panel_trigger_${collectionName}_delete`);
    
    // Drop any old trigger variations that might exist
    await db.exec(`DROP TRIGGER IF EXISTS z_panel_trigger_${collectionName}_update`);
    
    console.log(`Dropped event triggers for collection: ${collectionName}`);
};

const buildFieldJsonForTrigger = async (db, collectionName, prefix) => {
    try {
        // Get collection info to build field list for JSON
        const collection = await db.get('SELECT * FROM _collections WHERE name = ?', collectionName);
        if (!collection) return '';
        
        const fields = await db.all('SELECT name FROM _fields WHERE collection_id = ?', collection.id);
        
        let fieldJson = '';
        for (const field of fields) {
            fieldJson += `, '${field.name}', ${prefix}.${field.name}`;
        }
        
        return fieldJson;
    } catch (error) {
        console.warn(`Could not build field JSON for ${collectionName}:`, error.message);
        return '';
    }
};

const getEventEnabledCollections = async (db) => {
    return await db.all('SELECT name FROM _collections WHERE events_enabled = 1 ORDER BY name');
};

const getUnprocessedEvents = async (db, collectionName = null, limit = 10) => {
    let sql = 'SELECT * FROM _trigger_events WHERE processed = 0';
    const params = [];
    
    if (collectionName) {
        sql += ' AND collection = ?';
        params.push(collectionName);
    }
    
    sql += ' ORDER BY created_at ASC LIMIT ?';
    params.push(limit);
    
    return await db.all(sql, params);
};

const markEventsProcessed = async (db, eventIds) => {
    if (!Array.isArray(eventIds) || eventIds.length === 0) return;
    
    const placeholders = eventIds.map(() => '?').join(',');
    await db.run(`UPDATE _trigger_events SET processed = 1 WHERE id IN (${placeholders})`, eventIds);
};

const cleanupProcessedEvents = async (db, olderThanDays = 7) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    const result = await db.run(
        'DELETE FROM _trigger_events WHERE processed = 1 AND created_at < ?',
        cutoffDate.toISOString()
    );
    
    if (result.changes > 0) {
        console.log(`Cleaned up ${result.changes} processed events older than ${olderThanDays} days`);
    }
    
    return result.changes;
};

const recreateEventTriggers = async (db, collectionName) => {
    console.log(`Recreating event triggers for collection: ${collectionName}`);
    await dropEventTriggers(db, collectionName);
    await createEventTriggers(db, collectionName);
};

const recreateAllEventTriggers = async (db) => {
    const collections = await getEventEnabledCollections(db);
    for (const collection of collections) {
        await recreateEventTriggers(db, collection.name);
    }
    console.log(`Recreated triggers for ${collections.length} collections`);
};

const listAllTriggers = async (db) => {
    const triggers = await db.all(`
        SELECT name, tbl_name as table_name, sql 
        FROM sqlite_master 
        WHERE type = 'trigger' 
        ORDER BY tbl_name, name
    `);
    return triggers;
};

const cleanupDuplicateTriggers = async (db) => {
    // Get all panel triggers
    const triggers = await listAllTriggers(db);
    const panelTriggers = triggers.filter(t => 
        t.name.includes('panel_trigger_') || 
        t.name.includes('z_panel_trigger_')
    );
    
    // Group by table and event type
    const triggerMap = {};
    panelTriggers.forEach(trigger => {
        const table = trigger.table_name;
        if (!triggerMap[table]) {
            triggerMap[table] = [];
        }
        triggerMap[table].push(trigger.name);
    });
    
    // Drop all old variations
    for (const [table, triggerNames] of Object.entries(triggerMap)) {
        console.log(`Cleaning up triggers for table ${table}: ${triggerNames.join(', ')}`);
        
        // Drop all panel triggers for this table
        for (const triggerName of triggerNames) {
            await db.exec(`DROP TRIGGER IF EXISTS ${triggerName}`);
        }
        
        // Check if this collection has events enabled
        const collection = await db.get('SELECT * FROM _collections WHERE name = ? AND events_enabled = 1', table);
        if (collection) {
            // Recreate the proper triggers
            await createEventTriggers(db, table);
        }
    }
    
    console.log('Trigger cleanup completed');
};

module.exports = {
    createEventTriggers,
    dropEventTriggers,
    recreateEventTriggers,
    recreateAllEventTriggers,
    listAllTriggers,
    cleanupDuplicateTriggers,
    getEventEnabledCollections,
    getUnprocessedEvents,
    markEventsProcessed,
    cleanupProcessedEvents
};