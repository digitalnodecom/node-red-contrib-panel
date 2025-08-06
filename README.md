# Node-RED Panel Plugin

A Node-RED plugin that provides a PocketBase-like admin panel backed by SQLite for dynamic table management and CRUD operations.

## Features

### Core Functionality
- **Dynamic Table Management**: Create and manage SQLite tables through a web interface
- **Schema Evolution**: Add new fields to existing collections without data loss
- **Multi-Database Architecture**: Create and manage multiple SQLite databases
- **Admin Dashboard**: Vue.js-based admin panel accessible at `/panel`
- **CRUD Operations**: Full Create, Read, Update, Delete functionality
- **Advanced Upsert Operations**: Insert-or-update with configurable matching fields
- **REST API**: Complete REST API for all operations
- **Field Types**: Support for text, number, integer, boolean, date, JSON, email, and URL fields
- **Field Properties**: Required, unique, and indexable field options for performance
- **Data Export**: Export collection data as JSON
- **Live Schema Updates**: Modify table structure while preserving existing data

### Node-RED Integration
- **6 Custom Nodes**: Query, Insert, Update, Delete, Upsert, and Event Listener nodes
- **Database Dropdowns**: Dynamic selection of databases and collections in node editors
- **Message Override**: Use `msg` properties to dynamically override node configuration
- **Event System**: Real-time database change notifications with SQLite triggers
- **Panel Button**: Quick access button in Node-RED editor header

### Advanced Features
- **Audit Logging**: Comprehensive tracking of all system changes with user identification
- **Database Events**: SQLite trigger-based event system for real-time notifications
- **Server-Side Pagination**: Efficient data browsing with configurable limits and offsets
- **Advanced Sorting**: Click-to-sort columns with visual indicators
- **Column Visibility Controls**: Show/hide columns with localStorage persistence
- **Inline Editing**: Direct cell editing in data browser
- **Journal Mode Management**: Per-database SQLite journal mode configuration (DELETE, WAL, MEMORY)
- **Performance Optimization**: Automatic indexing for unique and indexable fields
- **Security**: Internal token-based authentication for Node-RED editor endpoints

## Installation

### From NPM (Recommended)

```bash
cd ~/.node-red
npm install @digitalnodecom/node-red-contrib-panel
```

### From Source

1. Install the plugin in your Node-RED user directory:
```bash
cd ~/.node-red
npm install /path/to/node-red-panel
```

2. Build the admin UI (only needed for source installation):
```bash
cd node_modules/@digitalnodecom/node-red-contrib-panel/lib/admin
npm install
npm run build
```

3. Restart Node-RED

## Usage

### Admin Panel

After installation, access the admin panel at: `http://localhost:1880/panel`

The admin panel provides:
- **Dashboard**: Real-time audit log and system activity overview
- **Databases Manager**: Create, manage, and configure multiple SQLite databases
- **Collections Manager**: Create, edit, and delete collections within any database
- **Data Browser**: Advanced data browsing with pagination, sorting, and inline editing
- **API Explorer**: Test API endpoints directly from the browser

### Multi-Database Architecture

The plugin supports multiple databases:
- **Master Database**: Contains system metadata, audit logs, and database registry
- **Custom Databases**: Create unlimited additional databases for different projects/environments
- **Database Switching**: Seamlessly switch between databases in the admin UI
- **Isolated Collections**: Each database maintains its own set of collections and data

### Node-RED Nodes

The plugin provides 6 custom nodes in the "Panel" category:

1. **Query Node**: Query data from collections
   - Operations: find, findOne, count
   - Database and collection dropdowns
   - Dynamic query parameters via msg.query
   - Optional static query configuration

2. **Insert Node**: Insert new records
   - Database and collection dropdowns
   - Send record data in msg.payload
   - Optional static data for testing

3. **Update Node**: Update existing records
   - Database and collection dropdowns
   - Send record with id in msg.payload
   - Optional static data for testing

4. **Delete Node**: Delete records
   - Database and collection dropdowns
   - Send record id in msg.payload
   - Optional static record ID for testing

5. **Upsert Node**: Advanced insert-or-update operations
   - Configurable match fields for conflict resolution
   - Three modes: upsert, updateOnly, insertOnly
   - Visual match field selector with unique/indexed indicators
   - SQL preview of generated operations

6. **Listener Node**: Real-time database event monitoring
   - Listen for INSERT, UPDATE, DELETE events
   - Configurable polling interval and batch size
   - Auto-acknowledgment of processed events
   - Only shows event-enabled collections

### Message Override Support

All nodes support dynamic configuration via message properties when "Use msg properties" is enabled:
- `msg.database` - Override configured database
- `msg.collection` - Override configured collection
- Node-specific parameters (query, data, matchFields, etc.)

### API Endpoints

#### Multi-Database Support
- `GET /panel/api/databases` - List all databases
- `POST /panel/api/databases` - Create new database
- `PUT /panel/api/databases/:name` - Update database
- `DELETE /panel/api/databases/:name` - Delete database
- `POST /panel/api/databases/:name/set-default` - Set default database

#### Collections (Database Context)
- `GET /panel/api/:database/collections` - List collections in database
- `POST /panel/api/:database/collections` - Create collection in database
- `GET /panel/api/:database/collections/:name` - Get collection details
- `PUT /panel/api/:database/collections/:name` - Update collection
- `DELETE /panel/api/:database/collections/:name` - Delete collection

#### Records (Database Context)
- `GET /panel/api/:database/:collection` - List records with pagination/sorting
- `POST /panel/api/:database/:collection` - Create record
- `GET /panel/api/:database/:collection/:id` - Get record
- `PUT /panel/api/:database/:collection/:id` - Update record
- `DELETE /panel/api/:database/:collection/:id` - Delete record

#### System & Audit
- `GET /panel/api/audit` - Get audit log entries
- `GET /panel/api/audit/stats` - Get audit statistics
- `GET /panel/api/audit/filters` - Get available filters
- `POST /panel/api/audit/cleanup` - Clean up old audit entries
- `GET /panel/api/system` - System health and information

#### Node-RED Integration
- `GET /panel/node-databases` - Get databases for node dropdowns
- `GET /panel/node-collections?database=name` - Get collections for node dropdowns
- `GET /panel/event-collections?database=name` - Get event-enabled collections

## Example Flows

### Basic CRUD Operations

```json
[
    {
        "id": "inject1",
        "type": "inject",
        "name": "Create User",
        "props": [{
            "p": "payload",
            "v": "{\"name\":\"John Doe\",\"email\":\"john@example.com\",\"active\":true}",
            "vt": "json"
        }],
        "wires": [["insert1"]]
    },
    {
        "id": "insert1",
        "type": "insert",
        "name": "Insert User",
        "database": "master",
        "collection": "users",
        "wires": [["debug1"]]
    },
    {
        "id": "debug1",
        "type": "debug",
        "name": "Result"
    }
]
```

### Advanced Upsert with Event Listening

```json
[
    {
        "id": "upsert1",
        "type": "upsert",
        "name": "Upsert Product",
        "database": "inventory",
        "collection": "products",
        "matchFields": ["sku"],
        "mode": "upsert",
        "wires": [["debug1"]]
    },
    {
        "id": "listener1",
        "type": "listener",
        "name": "Product Events",
        "database": "inventory", 
        "collection": "products",
        "eventTypes": ["INSERT", "UPDATE"],
        "pollingInterval": 5,
        "wires": [["debug2"]]
    }
]
```

## Database Storage

### Master Database
- **Location**: `{Node-RED User Directory}/panel.db`
- **Contains**: System metadata, audit logs, database registry

### Additional Databases
- **Location**: `{Node-RED User Directory}/panel_databases/{database_name}.db`
- **Contains**: Collections and data for each custom database

## Development

### Project Structure
```
@digitalnodecom/node-red-contrib-panel/
├── lib/
│   ├── panel.js              # Main Node-RED integration & Express server
│   ├── panel.html            # Node editor UI definitions  
│   ├── api/                  # REST API implementation
│   │   ├── controllers/      # API route handlers
│   │   ├── middlewares/      # Validation middleware
│   │   └── router.js         # API routing
│   ├── database/             # SQLite database layer
│   │   ├── db.js             # Database connection & initialization
│   │   ├── dbManager.js      # Multi-database management
│   │   ├── audit.js          # Audit logging system
│   │   ├── schema.js         # Collection management
│   │   └── triggers.js       # Event system with SQLite triggers
│   ├── security/             # Authentication & tokens
│   └── admin/                # Vue.js admin UI
│       ├── src/              # Vue source code
│       └── dist/             # Built admin UI
├── icons/                    # Node icons (node-red-panel.svg)
├── examples/                 # Example Node-RED flows
└── package.json
```

### Building Admin UI
```bash
cd lib/admin
npm install
npm run dev    # Development mode
npm run build  # Production build
```

## Requirements

- Node-RED >= 2.0.0
- Node.js >= 14.0.0

## License

MIT