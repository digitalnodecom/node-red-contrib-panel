const fs = require('fs').promises;
const path = require('path');
const { getDatabaseManager } = require('../../database/dbManager');

const getSystemInfo = async (req, res, next) => {
    try {
        const dbManager = getDatabaseManager();
        const mainDb = dbManager ? dbManager.getMainDatabase() : null;
        const dbDir = dbManager ? dbManager.getDbDirectory() : null;

        // Get the main database path
        const mainDbPath = dbDir ? path.join(dbDir, 'main.db') : null;

        let databaseInfo = {
            status: 'unknown'
        };

        // If we have a database connection, it's definitely connected
        if (mainDb) {
            databaseInfo.status = 'connected';

            // Get journal mode
            try {
                const journalResult = await mainDb.get('PRAGMA journal_mode');
                databaseInfo.journalMode = journalResult.journal_mode || 'unknown';
            } catch (error) {
                console.warn('Could not retrieve journal mode:', error);
                databaseInfo.journalMode = 'unknown';
            }

            // Get database file stats
            if (mainDbPath) {
                try {
                    const stats = await fs.stat(mainDbPath);
                    databaseInfo.path = mainDbPath;
                    databaseInfo.stats = {
                        size: stats.size,
                        created: stats.birthtime,
                        modified: stats.mtime
                    };
                } catch (error) {
                    console.warn('Could not stat database file:', error);
                    databaseInfo.path = mainDbPath;
                }
            }
        } else {
            // No database manager available
            databaseInfo.status = 'not_found';
            databaseInfo.path = mainDbPath || 'database not initialized';
        }

        // Get SQLite version
        let sqliteVersion = 'unknown';
        try {
            if (mainDb) {
                const versionResult = await mainDb.get('SELECT sqlite_version() as version');
                sqliteVersion = versionResult.version;
            }
        } catch (error) {
            console.warn('Could not retrieve SQLite version:', error);
        }

        // Get plugin version from package.json
        let pluginVersion = 'unknown';
        try {
            const packageJson = require('../../../package.json');
            pluginVersion = packageJson.version;
        } catch (error) {
            console.warn('Could not retrieve plugin version:', error);
        }

        const systemInfo = {
            database: databaseInfo,
            nodeVersion: process.version,
            node_version: process.version,  // snake_case for compatibility
            sqlite_version: sqliteVersion,
            plugin_version: pluginVersion,
            database_path: databaseInfo.path,
            journal_mode: databaseInfo.journalMode || 'unknown',
            platform: process.platform,
            arch: process.arch,
            uptime: process.uptime()
        };

        res.json(systemInfo);
    } catch (error) {
        next(error);
    }
};

const changeJournalMode = async (req, res, next) => {
    try {
        const { mode } = req.body;
        const validModes = ['DELETE', 'TRUNCATE', 'PERSIST', 'MEMORY', 'WAL', 'OFF'];
        
        if (!mode || !validModes.includes(mode.toUpperCase())) {
            return res.status(400).json({
                error: 'Invalid journal mode',
                validModes: validModes
            });
        }
        
        if (!req.db) {
            return res.status(500).json({
                error: 'Database connection not available'
            });
        }
        
        // Execute the journal mode change
        const result = await req.db.get(`PRAGMA journal_mode = ${mode.toUpperCase()}`);
        const newJournalMode = result.journal_mode;
        
        // Check if the mode change was successful
        const requestedMode = mode.toUpperCase();
        const actualMode = newJournalMode.toUpperCase();
        
        let warning = null;
        let success = true;
        
        if (requestedMode !== actualMode) {
            success = false;
            warning = `Failed to change to ${requestedMode} mode. Current mode is still ${actualMode}. You may need to restart Node-RED for the change to take effect.`;
        } else {
            // Provide informational warnings for successful mode changes
            switch (actualMode) {
                case 'MEMORY':
                    warning = 'MEMORY mode stores journal in RAM. Database may become corrupted if application crashes.';
                    break;
                case 'OFF':
                    warning = 'OFF mode disables journaling entirely. No transaction safety - use with extreme caution.';
                    break;
                case 'WAL':
                    warning = 'WAL mode is now active. Unlike other modes, WAL persists in the database file and will remain active across Node-RED restarts.';
                    break;
            }
        }
        
        res.json({
            success: success,
            journalMode: newJournalMode,
            requestedMode: requestedMode,
            actualMode: actualMode,
            warning: warning
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getSystemInfo,
    changeJournalMode
};