const fs = require('fs').promises;
const path = require('path');

const getSystemInfo = async (req, res, next) => {
    try {
        // Try multiple locations for the database file
        const possiblePaths = [
            process.env.NODE_RED_USER_DIR && path.join(process.env.NODE_RED_USER_DIR, 'panel.db'),
            path.join(process.cwd(), 'panel.db'),
            path.join(require('os').homedir(), '.node-red', 'panel.db')
        ].filter(Boolean);
        
        let databaseInfo = {
            status: 'unknown',
            possible_paths: possiblePaths
        };

        // If we have a database connection, it's definitely connected
        if (req.db) {
            databaseInfo.status = 'connected';
            
            // Get journal mode
            try {
                const journalResult = await req.db.get('PRAGMA journal_mode');
                databaseInfo.journalMode = journalResult.journal_mode || 'unknown';
            } catch (error) {
                console.warn('Could not retrieve journal mode:', error);
                databaseInfo.journalMode = 'unknown';
            }
            
            // Try to find which path actually exists
            for (const dbPath of possiblePaths) {
                try {
                    const stats = await fs.stat(dbPath);
                    databaseInfo.path = dbPath;
                    databaseInfo.stats = {
                        size: stats.size,
                        created: stats.birthtime,
                        modified: stats.mtime
                    };
                    break;
                } catch (error) {
                    // Try next path
                    continue;
                }
            }
            
            // If we couldn't find the file but have a connection, use first path as default
            if (!databaseInfo.path) {
                databaseInfo.path = possiblePaths[0];
            }
        } else {
            // No database connection, check if any file exists
            let found = false;
            for (const dbPath of possiblePaths) {
                try {
                    const stats = await fs.stat(dbPath);
                    databaseInfo.path = dbPath;
                    databaseInfo.status = 'disconnected';
                    databaseInfo.stats = {
                        size: stats.size,
                        created: stats.birthtime,
                        modified: stats.mtime
                    };
                    found = true;
                    break;
                } catch (error) {
                    continue;
                }
            }
            
            if (!found) {
                databaseInfo.status = 'not_found';
                databaseInfo.path = possiblePaths[0] || 'panel.db';
            }
        }

        // Get SQLite version
        let sqliteVersion = 'unknown';
        try {
            if (req.db) {
                const versionResult = await req.db.get('SELECT sqlite_version() as version');
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