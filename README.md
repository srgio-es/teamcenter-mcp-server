# Teamcenter MCP Server

This is a Model Context Protocol (MCP) server that integrates with Teamcenter PLM using its REST API. It allows you to interact with Teamcenter data directly through Claude.

## Features

The Teamcenter MCP server provides the following capabilities:

### Resources

- `teamcenter://item-types` - List of available item types in Teamcenter
- `teamcenter://items/{id}` - Details of a specific Teamcenter item by ID
- `teamcenter://search/{query}` - Search results for items in Teamcenter

### Tools

- `search_items` - Search for items in Teamcenter
- `get_item` - Get details of a specific item by ID
- `create_item` - Create a new item in Teamcenter
- `update_item` - Update an existing item in Teamcenter
- `get_item_types` - Get available item types in Teamcenter

## Setup

1. The server has been installed in `/home/sergio/Cline/MCP/teamcenter-mcp-server`
2. The MCP configuration has been added to the Claude settings file

### Configuration

Before using the Teamcenter MCP server, you need to update the configuration with your Teamcenter credentials. Edit the MCP settings file at:

```
/home/sergio/.vscode-server/data/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json
```

Replace the placeholder values with your actual Teamcenter credentials:

```json
{
  "mcpServers": {
    "teamcenter": {
      "command": "node",
      "args": ["/home/sergio/Cline/MCP/teamcenter-mcp-server/build/index.js"],
      "env": {
        "TEAMCENTER_BASE_URL": "YOUR_TEAMCENTER_BASE_URL",
        "TEAMCENTER_USERNAME": "YOUR_TEAMCENTER_USERNAME",
        "TEAMCENTER_PASSWORD": "YOUR_TEAMCENTER_PASSWORD"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

## Usage Examples

Once configured, you can use the Teamcenter MCP server through Claude. Here are some examples:

### Search for items

```
use_mcp_tool
server_name: teamcenter
tool_name: search_items
arguments: {
  "query": "engine",
  "type": "Item",
  "limit": 5
}
```

### Get item details

```
use_mcp_tool
server_name: teamcenter
tool_name: get_item
arguments: {
  "id": "ABC123"
}
```

### Create a new item

```
use_mcp_tool
server_name: teamcenter
tool_name: create_item
arguments: {
  "type": "Item",
  "name": "New Part",
  "description": "A new part for the assembly",
  "properties": {
    "item_id": "PART-001",
    "revision": "A"
  }
}
```

### Update an item

```
use_mcp_tool
server_name: teamcenter
tool_name: update_item
arguments: {
  "id": "ABC123",
  "properties": {
    "description": "Updated description",
    "status": "Released"
  }
}
```

### Get item types

```
use_mcp_tool
server_name: teamcenter
tool_name: get_item_types
arguments: {}
```

### Access resources

```
access_mcp_resource
server_name: teamcenter
uri: teamcenter://item-types
```

```
access_mcp_resource
server_name: teamcenter
uri: teamcenter://items/ABC123
```

```
access_mcp_resource
server_name: teamcenter
uri: teamcenter://search/engine
```

## Development

If you need to modify the server, the source code is in `/home/sergio/Cline/MCP/teamcenter-mcp-server/src/index.ts`. After making changes, rebuild the server with:

```bash
cd /home/sergio/Cline/MCP/teamcenter-mcp-server
npm run build
```

### Local Testing

For local testing and development, you can use the included `.env` file to provide your Teamcenter credentials:

1. Edit the `.env` file in the project root directory:

```
# Teamcenter API Configuration
TEAMCENTER_BASE_URL=https://teamcenter.example.com/api
TEAMCENTER_USERNAME=your_username
TEAMCENTER_PASSWORD=your_password
```

2. Replace the placeholder values with your actual Teamcenter credentials.

3. Run the server locally using the development script:

```bash
cd /home/sergio/Cline/MCP/teamcenter-mcp-server
npm run dev
```

This will start the server using ts-node, which allows you to make changes to the TypeScript code without having to rebuild the project each time.

The server will load the environment variables from the `.env` file and attempt to connect to your Teamcenter instance. You should see output indicating whether the authentication was successful.

## Troubleshooting

If you encounter issues with the Teamcenter MCP server:

1. Check that your Teamcenter credentials are correct in the MCP settings file
2. Verify that your Teamcenter instance is accessible from your current network
3. Check the server logs for any error messages
4. Ensure that the Teamcenter REST API endpoints used in the server match your Teamcenter version
