# Node-RED Panel Plugin

A Node-RED plugin that provides a PocketBase-like admin panel backed by SQLite for dynamic table management and CRUD operations.

## Features

- **Dynamic Table Management**: Create and manage SQLite tables through a web interface
- **Schema Evolution**: Add new fields to existing collections without data loss
- **Admin Dashboard**: Vue.js-based admin panel accessible at `/panel`
- **CRUD Operations**: Full Create, Read, Update, Delete functionality
- **Node-RED Integration**: Custom nodes for database operations
- **REST API**: Complete REST API for all operations
- **Field Types**: Support for text, number, integer, boolean, date, JSON, email, and URL fields
- **Data Export**: Export collection data as JSON
- **API Explorer**: Built-in API testing interface
- **Live Schema Updates**: Modify table structure while preserving existing data

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
- **Dashboard**: Overview of collections and statistics
- **Collections Manager**: Create, edit, and delete collections
- **Data Browser**: View and manage records in each collection
- **API Explorer**: Test API endpoints directly from the browser

### Node-RED Nodes

The plugin provides four custom nodes:

1. **panel-query**: Query data from collections
   - Operations: find, findOne, count
   - Configure collection name and query parameters

2. **panel-insert**: Insert new records
   - Configure collection name
   - Send record data in msg.payload

3. **panel-update**: Update existing records
   - Configure collection name
   - Send record with id in msg.payload

4. **panel-delete**: Delete records
   - Configure collection name
   - Send record id in msg.payload

### API Endpoints

Collections:
- `GET /panel/api/collections` - List all collections
- `POST /panel/api/collections` - Create new collection
- `GET /panel/api/collections/:name` - Get collection details
- `PUT /panel/api/collections/:id` - Update collection
- `DELETE /panel/api/collections/:name` - Delete collection

Records:
- `GET /panel/api/:collection` - List records
- `POST /panel/api/:collection` - Create record
- `GET /panel/api/:collection/:id` - Get record
- `PUT /panel/api/:collection/:id` - Update record
- `DELETE /panel/api/:collection/:id` - Delete record

## Example Flow

```json
[
    {
        "id": "inject1",
        "type": "inject",
        "name": "Create User",
        "props": [
            {
                "p": "payload",
                "v": "{\"name\":\"John Doe\",\"email\":\"john@example.com\",\"active\":true}",
                "vt": "json"
            }
        ],
        "wires": [["insert1"]]
    },
    {
        "id": "insert1",
        "type": "panel-insert",
        "name": "Insert User",
        "collection": "users",
        "wires": [["debug1"]]
    },
    {
        "id": "debug1",
        "type": "debug",
        "name": "Result",
        "complete": "payload"
    }
]
```

## Database Location

The SQLite database is created at: `{Node-RED User Directory}/panel.db`

## Development

### Project Structure
```
@digitalnodecom/node-red-contrib-panel/
├── lib/
│   ├── panel.js          # Main Node-RED integration
│   ├── panel.html        # Node editor UI
│   ├── api/              # REST API implementation
│   ├── database/         # SQLite database layer
│   └── admin/            # Vue.js admin UI
├── examples/             # Example flows
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