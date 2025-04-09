#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ErrorCode, ListResourcesRequestSchema, ListResourceTemplatesRequestSchema, ListToolsRequestSchema, McpError, ReadResourceRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import * as dotenv from 'dotenv';
import { teamcenterService as tcService } from '../services/teamcenter/teamcenterService.js';
import { createSOAClient } from '../services/teamcenter/tcSOAClient.js';
// Cast the teamcenterService to our interface
const teamcenterService = tcService;
// Load environment variables from .env file for local testing
dotenv.config();
// Environment variables for Teamcenter configuration
const TEAMCENTER_BASE_URL = process.env.TEAMCENTER_BASE_URL;
const TEAMCENTER_USERNAME = process.env.TEAMCENTER_USERNAME;
const TEAMCENTER_PASSWORD = process.env.TEAMCENTER_PASSWORD;
if (!TEAMCENTER_BASE_URL || !TEAMCENTER_USERNAME || !TEAMCENTER_PASSWORD) {
    throw new Error('Missing required environment variables for Teamcenter configuration');
}
// Initialize Teamcenter configuration
const teamcenterConfig = {
    endpoint: TEAMCENTER_BASE_URL,
    timeout: 60000,
    withCredentials: true,
    mode: 'cors'
};
// Set up environment for teamcenterService
global.teamcenterConfig = teamcenterConfig;
// Add missing methods to teamcenterService if they don't exist
if (!('getItemTypes' in tcService)) {
    teamcenterService.getItemTypes = async () => {
        try {
            const soaClient = createSOAClient(teamcenterConfig);
            const result = await soaClient.callService('Core-2006-03-BusinessObjectType', 'getBusinessObjectTypes', {});
            return { data: result };
        }
        catch (error) {
            console.error('Error getting item types:', error);
            return {
                error: {
                    code: 'API_ERROR',
                    level: 'ERROR',
                    message: error instanceof Error ? error.message : 'Failed to get item types'
                }
            };
        }
    };
}
if (!('getItemById' in tcService)) {
    teamcenterService.getItemById = async (itemId) => {
        try {
            const soaClient = createSOAClient(teamcenterConfig);
            const result = await soaClient.callService('Core-2006-03-DataManagement', 'getProperties', { uids: [itemId] });
            return { data: result };
        }
        catch (error) {
            console.error('Error getting item by ID:', error);
            return {
                error: {
                    code: 'API_ERROR',
                    level: 'ERROR',
                    message: error instanceof Error ? error.message : 'Failed to get item'
                }
            };
        }
    };
}
if (!('searchItems' in tcService)) {
    teamcenterService.searchItems = async (query, type, limit = 10) => {
        try {
            const soaClient = createSOAClient(teamcenterConfig);
            // Build search criteria
            const searchOptions = {
                searchInput: {
                    providerName: "Fnd0BaseProvider",
                    searchCriteria: {
                        Name: query
                    },
                    startIndex: 0,
                    maxToReturn: limit,
                    maxToLoad: limit,
                    searchFilterMap: {},
                    searchSortCriteria: [{
                            fieldName: "creation_date",
                            sortDirection: "DESC"
                        }],
                    searchFilterFieldSortType: "Alphabetical",
                    attributesToInflate: [
                        'object_name',
                        'object_desc',
                        'object_string',
                        'item_id',
                        'item_revision_id',
                        'release_status_list',
                        'owning_user',
                        'creation_date',
                        'last_mod_date'
                    ]
                }
            };
            if (type) {
                searchOptions.searchInput.searchFilterMap = {
                    "Item Type": [{
                            searchFilterType: "StringFilter",
                            stringValue: type,
                            startDateValue: "",
                            endDateValue: "",
                            startNumericValue: 0,
                            endNumericValue: 0,
                            count: 1,
                            selected: true,
                            startEndRange: ""
                        }]
                };
            }
            const result = await soaClient.callService('Query-2012-10-Finder', 'performSearch', searchOptions);
            // Cast the result to TCObject[] to satisfy TypeScript
            return { data: result };
        }
        catch (error) {
            console.error('Error searching items:', error);
            return {
                error: {
                    code: 'SEARCH_ERROR',
                    level: 'ERROR',
                    message: error instanceof Error ? error.message : 'Failed to search items'
                }
            };
        }
    };
}
if (!('createItem' in tcService)) {
    teamcenterService.createItem = async (type, name, description, properties = {}) => {
        try {
            const soaClient = createSOAClient(teamcenterConfig);
            const createData = {
                boName: type,
                data: {
                    ...properties,
                    object_name: name,
                    object_desc: description,
                },
            };
            const result = await soaClient.callService('Core-2006-03-DataManagement', 'createObjects', { objects: [createData] });
            return { data: result };
        }
        catch (error) {
            console.error('Error creating item:', error);
            return {
                error: {
                    code: 'CREATE_ERROR',
                    level: 'ERROR',
                    message: error instanceof Error ? error.message : 'Failed to create item'
                }
            };
        }
    };
}
if (!('updateItem' in tcService)) {
    teamcenterService.updateItem = async (itemId, properties) => {
        try {
            const soaClient = createSOAClient(teamcenterConfig);
            const result = await soaClient.callService('Core-2006-03-DataManagement', 'setProperties', {
                objects: [
                    {
                        uid: itemId,
                        properties,
                    },
                ],
            });
            return { data: result };
        }
        catch (error) {
            console.error('Error updating item:', error);
            return {
                error: {
                    code: 'UPDATE_ERROR',
                    level: 'ERROR',
                    message: error instanceof Error ? error.message : 'Failed to update item'
                }
            };
        }
    };
}
// MCP Server implementation
class TeamcenterServer {
    constructor() {
        this.server = new Server({
            name: 'teamcenter-server',
            version: '0.1.0',
        }, {
            capabilities: {
                resources: {},
                tools: {},
            },
        });
        this.setupResourceHandlers();
        this.setupToolHandlers();
        // Error handling
        this.server.onerror = (error) => console.error('[MCP Error]', error);
        process.on('SIGINT', async () => {
            await this.server.close();
            process.exit(0);
        });
    }
    setupResourceHandlers() {
        // List available resources
        this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
            resources: [
                {
                    uri: 'teamcenter://item-types',
                    name: 'Teamcenter Item Types',
                    mimeType: 'application/json',
                    description: 'List of available item types in Teamcenter',
                },
            ],
        }));
        // Define resource templates
        this.server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
            resourceTemplates: [
                {
                    uriTemplate: 'teamcenter://items/{id}',
                    name: 'Teamcenter Item Details',
                    mimeType: 'application/json',
                    description: 'Details of a specific Teamcenter item by ID',
                },
                {
                    uriTemplate: 'teamcenter://search/{query}',
                    name: 'Teamcenter Search Results',
                    mimeType: 'application/json',
                    description: 'Search results for items in Teamcenter',
                },
            ],
        }));
        // Handle resource requests
        this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
            try {
                // Item types resource
                if (request.params.uri === 'teamcenter://item-types') {
                    // Use the teamcenterService to get item types
                    const response = await teamcenterService.getItemTypes();
                    if (response.error) {
                        throw new McpError(ErrorCode.InternalError, response.error.message);
                    }
                    return {
                        contents: [
                            {
                                uri: request.params.uri,
                                mimeType: 'application/json',
                                text: JSON.stringify(response.data, null, 2),
                            },
                        ],
                    };
                }
                // Item details by ID
                const itemMatch = request.params.uri.match(/^teamcenter:\/\/items\/(.+)$/);
                if (itemMatch) {
                    const itemId = decodeURIComponent(itemMatch[1]);
                    // Use the teamcenterService to get item details
                    const response = await teamcenterService.getItemById(itemId);
                    if (response.error) {
                        throw new McpError(ErrorCode.InternalError, response.error.message);
                    }
                    return {
                        contents: [
                            {
                                uri: request.params.uri,
                                mimeType: 'application/json',
                                text: JSON.stringify(response.data, null, 2),
                            },
                        ],
                    };
                }
                // Search results
                const searchMatch = request.params.uri.match(/^teamcenter:\/\/search\/(.+)$/);
                if (searchMatch) {
                    const query = decodeURIComponent(searchMatch[1]);
                    // Use the teamcenterService to search for items
                    const response = await teamcenterService.searchItems(query);
                    if (response.error) {
                        throw new McpError(ErrorCode.InternalError, response.error.message);
                    }
                    return {
                        contents: [
                            {
                                uri: request.params.uri,
                                mimeType: 'application/json',
                                text: JSON.stringify(response.data, null, 2),
                            },
                        ],
                    };
                }
                throw new McpError(ErrorCode.InvalidRequest, `Invalid URI: ${request.params.uri}`);
            }
            catch (error) {
                if (error instanceof McpError) {
                    throw error;
                }
                throw new McpError(ErrorCode.InternalError, error.message);
            }
        });
    }
    setupToolHandlers() {
        // List available tools
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: [
                {
                    name: 'search_items',
                    description: 'Search for items in Teamcenter',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            query: {
                                type: 'string',
                                description: 'Search query',
                            },
                            type: {
                                type: 'string',
                                description: 'Item type to filter by (optional)',
                            },
                            limit: {
                                type: 'number',
                                description: 'Maximum number of results to return (default: 10)',
                            },
                        },
                        required: ['query'],
                    },
                },
                {
                    name: 'get_item',
                    description: 'Get details of a specific item by ID',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            id: {
                                type: 'string',
                                description: 'Item ID',
                            },
                        },
                        required: ['id'],
                    },
                },
                {
                    name: 'create_item',
                    description: 'Create a new item in Teamcenter',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            type: {
                                type: 'string',
                                description: 'Item type',
                            },
                            name: {
                                type: 'string',
                                description: 'Item name',
                            },
                            description: {
                                type: 'string',
                                description: 'Item description',
                            },
                            properties: {
                                type: 'object',
                                description: 'Additional properties for the item',
                            },
                        },
                        required: ['type', 'name'],
                    },
                },
                {
                    name: 'update_item',
                    description: 'Update an existing item in Teamcenter',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            id: {
                                type: 'string',
                                description: 'Item ID',
                            },
                            properties: {
                                type: 'object',
                                description: 'Properties to update',
                            },
                        },
                        required: ['id', 'properties'],
                    },
                },
                {
                    name: 'get_item_types',
                    description: 'Get available item types in Teamcenter',
                    inputSchema: {
                        type: 'object',
                        properties: {},
                    },
                },
                {
                    name: 'login',
                    description: 'Login to Teamcenter',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            username: {
                                type: 'string',
                                description: 'Teamcenter username',
                            },
                            password: {
                                type: 'string',
                                description: 'Teamcenter password',
                            },
                        },
                        required: ['username', 'password'],
                    },
                },
                {
                    name: 'logout',
                    description: 'Logout from Teamcenter',
                    inputSchema: {
                        type: 'object',
                        properties: {},
                    },
                },
                {
                    name: 'get_user_owned_items',
                    description: 'Get items owned by the current user',
                    inputSchema: {
                        type: 'object',
                        properties: {},
                    },
                },
                {
                    name: 'get_last_created_items',
                    description: 'Get the most recently created items',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            limit: {
                                type: 'number',
                                description: 'Maximum number of items to return (default: 10)',
                            },
                        },
                    },
                },
            ],
        }));
        // Handle tool calls
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            try {
                switch (request.params.name) {
                    case 'login': {
                        const { username, password } = request.params.arguments;
                        if (!username || !password) {
                            throw new McpError(ErrorCode.InvalidParams, 'Username and password are required');
                        }
                        const credentials = { username, password };
                        const response = await teamcenterService.login(credentials);
                        if (response.error) {
                            return {
                                content: [
                                    {
                                        type: 'text',
                                        text: `Login failed: ${response.error.message}`,
                                    },
                                ],
                                isError: true,
                            };
                        }
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify(response.data, null, 2),
                                },
                            ],
                        };
                    }
                    case 'logout': {
                        const response = await teamcenterService.logout();
                        if (response.error) {
                            return {
                                content: [
                                    {
                                        type: 'text',
                                        text: `Logout failed: ${response.error.message}`,
                                    },
                                ],
                                isError: true,
                            };
                        }
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: 'Successfully logged out',
                                },
                            ],
                        };
                    }
                    case 'search_items': {
                        const { query, type, limit } = request.params.arguments;
                        if (!query) {
                            throw new McpError(ErrorCode.InvalidParams, 'Query parameter is required');
                        }
                        const response = await teamcenterService.searchItems(query, type, limit);
                        if (response.error) {
                            return {
                                content: [
                                    {
                                        type: 'text',
                                        text: `Search failed: ${response.error.message}`,
                                    },
                                ],
                                isError: true,
                            };
                        }
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify(response.data, null, 2),
                                },
                            ],
                        };
                    }
                    case 'get_item': {
                        const { id } = request.params.arguments;
                        if (!id) {
                            throw new McpError(ErrorCode.InvalidParams, 'Item ID is required');
                        }
                        const response = await teamcenterService.getItemById(id);
                        if (response.error) {
                            return {
                                content: [
                                    {
                                        type: 'text',
                                        text: `Failed to get item: ${response.error.message}`,
                                    },
                                ],
                                isError: true,
                            };
                        }
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify(response.data, null, 2),
                                },
                            ],
                        };
                    }
                    case 'create_item': {
                        const { type, name, description = '', properties = {} } = request.params.arguments;
                        if (!type || !name) {
                            throw new McpError(ErrorCode.InvalidParams, 'Type and name parameters are required');
                        }
                        const response = await teamcenterService.createItem(type, name, description, properties);
                        if (response.error) {
                            return {
                                content: [
                                    {
                                        type: 'text',
                                        text: `Failed to create item: ${response.error.message}`,
                                    },
                                ],
                                isError: true,
                            };
                        }
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify(response.data, null, 2),
                                },
                            ],
                        };
                    }
                    case 'update_item': {
                        const { id, properties } = request.params.arguments;
                        if (!id || !properties) {
                            throw new McpError(ErrorCode.InvalidParams, 'Item ID and properties are required');
                        }
                        const response = await teamcenterService.updateItem(id, properties);
                        if (response.error) {
                            return {
                                content: [
                                    {
                                        type: 'text',
                                        text: `Failed to update item: ${response.error.message}`,
                                    },
                                ],
                                isError: true,
                            };
                        }
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify(response.data, null, 2),
                                },
                            ],
                        };
                    }
                    case 'get_item_types': {
                        const response = await teamcenterService.getItemTypes();
                        if (response.error) {
                            return {
                                content: [
                                    {
                                        type: 'text',
                                        text: `Failed to get item types: ${response.error.message}`,
                                    },
                                ],
                                isError: true,
                            };
                        }
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify(response.data, null, 2),
                                },
                            ],
                        };
                    }
                    case 'get_user_owned_items': {
                        const response = await teamcenterService.getUserOwnedItems();
                        if (response.error) {
                            return {
                                content: [
                                    {
                                        type: 'text',
                                        text: `Failed to get user owned items: ${response.error.message}`,
                                    },
                                ],
                                isError: true,
                            };
                        }
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify(response.data, null, 2),
                                },
                            ],
                        };
                    }
                    case 'get_last_created_items': {
                        const { limit } = request.params.arguments;
                        const response = await teamcenterService.getLastCreatedItems(limit);
                        if (response.error) {
                            return {
                                content: [
                                    {
                                        type: 'text',
                                        text: `Failed to get last created items: ${response.error.message}`,
                                    },
                                ],
                                isError: true,
                            };
                        }
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify(response.data, null, 2),
                                },
                            ],
                        };
                    }
                    default:
                        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
                }
            }
            catch (error) {
                if (error instanceof McpError) {
                    throw error;
                }
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Error: ${error.message}`,
                        },
                    ],
                    isError: true,
                };
            }
        });
    }
    async run() {
        try {
            // Test authentication on startup
            const credentials = {
                username: TEAMCENTER_USERNAME,
                password: TEAMCENTER_PASSWORD
            };
            const loginResponse = await teamcenterService.login(credentials);
            if (loginResponse.error) {
                throw new Error(`Authentication failed: ${loginResponse.error.message}`);
            }
            console.error('Successfully authenticated with Teamcenter');
            const transport = new StdioServerTransport();
            await this.server.connect(transport);
            console.error('Teamcenter MCP server running on stdio');
        }
        catch (error) {
            console.error('Failed to start Teamcenter MCP server:', error);
            process.exit(1);
        }
    }
}
// Start the server
const server = new TeamcenterServer();
server.run().catch(console.error);
//# sourceMappingURL=index.js.map