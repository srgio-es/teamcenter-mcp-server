#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ErrorCode, ListResourcesRequestSchema, ListResourceTemplatesRequestSchema, ListToolsRequestSchema, McpError, ReadResourceRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import * as dotenv from 'dotenv';
// Load environment variables from .env file for local testing
dotenv.config();
// Environment variables for Teamcenter configuration
const TEAMCENTER_BASE_URL = process.env.TEAMCENTER_BASE_URL;
const TEAMCENTER_USERNAME = process.env.TEAMCENTER_USERNAME;
const TEAMCENTER_PASSWORD = process.env.TEAMCENTER_PASSWORD;
if (!TEAMCENTER_BASE_URL || !TEAMCENTER_USERNAME || !TEAMCENTER_PASSWORD) {
    throw new Error('Missing required environment variables for Teamcenter configuration');
}
// Teamcenter API client class
class TeamcenterClient {
    constructor(baseURL, username, password) {
        this.username = username;
        this.password = password;
        this.authToken = null;
        this.axiosInstance = axios.create({
            baseURL,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
    // Authenticate with Teamcenter and get a token
    async authenticate() {
        try {
            const response = await this.axiosInstance.post('/tc/services/v1/core/2.0/Authentication/login', {
                username: this.username,
                password: this.password,
            });
            if (response.data && response.data.token) {
                const token = response.data.token;
                this.authToken = token;
                // Set the token for all future requests
                this.axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
                return token;
            }
            else {
                throw new Error('Authentication failed: No token received');
            }
        }
        catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(`Authentication failed: ${error.response?.data?.message || error.message}`);
            }
            throw error;
        }
    }
    // Get authenticated axios instance
    async getAuthenticatedClient() {
        if (!this.authToken) {
            await this.authenticate();
        }
        return this.axiosInstance;
    }
    // Search for items in Teamcenter
    async searchItems(query, type, limit = 10) {
        const client = await this.getAuthenticatedClient();
        try {
            const searchCriteria = {
                queryName: 'General...',
                entries: [
                    {
                        fieldName: 'Name',
                        values: [query],
                    },
                ],
                sortBy: 'creation_date',
                sortDirection: 'DESC',
                maxResults: limit,
            };
            if (type) {
                searchCriteria.entries.push({
                    fieldName: 'Type',
                    values: [type],
                });
            }
            const response = await client.post('/tc/services/v1/search/2.0/Search/search', {
                searchCriteria,
            });
            return response.data;
        }
        catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(`Search failed: ${error.response?.data?.message || error.message}`);
            }
            throw error;
        }
    }
    // Get item details by ID
    async getItemById(itemId) {
        const client = await this.getAuthenticatedClient();
        try {
            const response = await client.get(`/tc/services/v1/core/2.0/DataManagement/getProperties?uids=${itemId}`);
            return response.data;
        }
        catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(`Failed to get item: ${error.response?.data?.message || error.message}`);
            }
            throw error;
        }
    }
    // Create a new item
    async createItem(type, name, description, properties = {}) {
        const client = await this.getAuthenticatedClient();
        try {
            const createData = {
                boName: type,
                data: {
                    ...properties,
                    object_name: name,
                    object_desc: description,
                },
            };
            const response = await client.post('/tc/services/v1/core/2.0/DataManagement/createObjects', {
                objects: [createData],
            });
            return response.data;
        }
        catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(`Failed to create item: ${error.response?.data?.message || error.message}`);
            }
            throw error;
        }
    }
    // Update an item
    async updateItem(itemId, properties) {
        const client = await this.getAuthenticatedClient();
        try {
            const response = await client.post('/tc/services/v1/core/2.0/DataManagement/setProperties', {
                objects: [
                    {
                        uid: itemId,
                        properties,
                    },
                ],
            });
            return response.data;
        }
        catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(`Failed to update item: ${error.response?.data?.message || error.message}`);
            }
            throw error;
        }
    }
    // Get available item types
    async getItemTypes() {
        const client = await this.getAuthenticatedClient();
        try {
            const response = await client.get('/tc/services/v1/core/2.0/BusinessObjectType/getBusinessObjectTypes');
            return response.data;
        }
        catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(`Failed to get item types: ${error.response?.data?.message || error.message}`);
            }
            throw error;
        }
    }
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
        this.teamcenterClient = new TeamcenterClient(TEAMCENTER_BASE_URL, TEAMCENTER_USERNAME, TEAMCENTER_PASSWORD);
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
                    const itemTypes = await this.teamcenterClient.getItemTypes();
                    return {
                        contents: [
                            {
                                uri: request.params.uri,
                                mimeType: 'application/json',
                                text: JSON.stringify(itemTypes, null, 2),
                            },
                        ],
                    };
                }
                // Item details by ID
                const itemMatch = request.params.uri.match(/^teamcenter:\/\/items\/(.+)$/);
                if (itemMatch) {
                    const itemId = decodeURIComponent(itemMatch[1]);
                    const itemDetails = await this.teamcenterClient.getItemById(itemId);
                    return {
                        contents: [
                            {
                                uri: request.params.uri,
                                mimeType: 'application/json',
                                text: JSON.stringify(itemDetails, null, 2),
                            },
                        ],
                    };
                }
                // Search results
                const searchMatch = request.params.uri.match(/^teamcenter:\/\/search\/(.+)$/);
                if (searchMatch) {
                    const query = decodeURIComponent(searchMatch[1]);
                    const searchResults = await this.teamcenterClient.searchItems(query);
                    return {
                        contents: [
                            {
                                uri: request.params.uri,
                                mimeType: 'application/json',
                                text: JSON.stringify(searchResults, null, 2),
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
            ],
        }));
        // Handle tool calls
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            try {
                switch (request.params.name) {
                    case 'search_items': {
                        const { query, type, limit } = request.params.arguments;
                        if (!query) {
                            throw new McpError(ErrorCode.InvalidParams, 'Query parameter is required');
                        }
                        const results = await this.teamcenterClient.searchItems(query, type, limit);
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify(results, null, 2),
                                },
                            ],
                        };
                    }
                    case 'get_item': {
                        const { id } = request.params.arguments;
                        if (!id) {
                            throw new McpError(ErrorCode.InvalidParams, 'Item ID is required');
                        }
                        const item = await this.teamcenterClient.getItemById(id);
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify(item, null, 2),
                                },
                            ],
                        };
                    }
                    case 'create_item': {
                        const { type, name, description = '', properties = {} } = request.params.arguments;
                        if (!type || !name) {
                            throw new McpError(ErrorCode.InvalidParams, 'Type and name parameters are required');
                        }
                        const result = await this.teamcenterClient.createItem(type, name, description, properties);
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify(result, null, 2),
                                },
                            ],
                        };
                    }
                    case 'update_item': {
                        const { id, properties } = request.params.arguments;
                        if (!id || !properties) {
                            throw new McpError(ErrorCode.InvalidParams, 'Item ID and properties are required');
                        }
                        const result = await this.teamcenterClient.updateItem(id, properties);
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify(result, null, 2),
                                },
                            ],
                        };
                    }
                    case 'get_item_types': {
                        const itemTypes = await this.teamcenterClient.getItemTypes();
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify(itemTypes, null, 2),
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
            await this.teamcenterClient.authenticate();
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