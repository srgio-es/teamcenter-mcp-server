#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import * as dotenv from 'dotenv';
import logger from './logger.js';

// Import from teamcenter-client package
import {
  createTeamcenterService,
  TCCredentials,
  Logger
} from 'teamcenter-client';

// Load environment variables from .env file for local testing
dotenv.config();

// Environment variables for Teamcenter configuration
const TEAMCENTER_BASE_URL = process.env.TEAMCENTER_BASE_URL;
const TEAMCENTER_USERNAME = process.env.TEAMCENTER_USERNAME;
const TEAMCENTER_PASSWORD = process.env.TEAMCENTER_PASSWORD;
const MOCK_MODE = process.env.MOCK_MODE === 'true';

// Debug logging for environment variables
logger.debug('Environment variables:');
logger.debug(`TEAMCENTER_BASE_URL: ${TEAMCENTER_BASE_URL}`);
logger.debug(`TEAMCENTER_USERNAME: ${TEAMCENTER_USERNAME}`);
logger.debug(`MOCK_MODE: ${MOCK_MODE}`);

if (!MOCK_MODE && (!TEAMCENTER_BASE_URL || !TEAMCENTER_USERNAME || !TEAMCENTER_PASSWORD)) {
  throw new Error('Missing required environment variables for Teamcenter configuration. Set MOCK_MODE=true to use mock data.');
}

// Create a logger adapter that uses the MCP server's logger
const loggerAdapter: Logger = {
  error: (message, ...meta) => logger.error(message, ...meta),
  warn: (message, ...meta) => logger.warn(message, ...meta),
  info: (message, ...meta) => logger.info(message, ...meta),
  debug: (message, ...meta) => logger.debug(message, ...meta),
  logTeamcenterRequest: (service, operation, params, requestId) => {
    const reqId = requestId || `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    logger.info(`[${reqId}] TC REQUEST: ${service}.${operation}`, { params });
    return reqId;
  },
  logTeamcenterResponse: (service, operation, response, requestId, error) => {
    if (error) {
      logger.error(`[${requestId}] TC RESPONSE ERROR: ${service}.${operation}`, { error: error.message });
    } else {
      logger.info(`[${requestId}] TC RESPONSE: ${service}.${operation}`, { response });
    }
  }
};

// Initialize Teamcenter configuration
const teamcenterConfig = {
  endpoint: MOCK_MODE ? 'http://localhost:8080/tc' : (TEAMCENTER_BASE_URL as string),
  timeout: 60000,
  mockMode: MOCK_MODE
};

logger.info(`Starting Teamcenter MCP server in ${MOCK_MODE ? 'MOCK' : 'REAL'} mode`);

// Create the Teamcenter service with the logger adapter
const teamcenterService = createTeamcenterService({
  logger: loggerAdapter,
  config: teamcenterConfig
});

// MCP Server implementation
class TeamcenterServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'teamcenter-mcp-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    this.setupResourceHandlers();
    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error) => logger.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupResourceHandlers() {
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
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(ErrorCode.InternalError, (error as Error).message);
      }
    });
  }

  private setupToolHandlers() {
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
        {
          name: 'get_session_info',
          description: 'Get current Teamcenter session information',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get_favorites',
          description: 'Get user favorites from Teamcenter',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get_user_properties',
          description: 'Get properties of a specific user by UID',
          inputSchema: {
            type: 'object',
            properties: {
              uid: {
                type: 'string',
                description: 'User UID',
              },
              attributes: {
                type: 'array',
                items: {
                  type: 'string'
                },
                description: 'Optional array of specific attributes to retrieve',
              },
            },
            required: ['uid'],
          },
        },
        {
          name: 'get_logged_user_properties',
          description: 'Get properties of the currently logged-in user',
          inputSchema: {
            type: 'object',
            properties: {
              attributes: {
                type: 'array',
                items: {
                  type: 'string'
                },
                description: 'Optional array of specific attributes to retrieve',
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
            const { username, password } = request.params.arguments as {
              username: string;
              password: string;
            };
            
            if (!username || !password) {
              throw new McpError(ErrorCode.InvalidParams, 'Username and password are required');
            }
            
            // Create credentials object matching TCCredentials interface
            const credentials: TCCredentials = { username, password };
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
            const { query, type, limit } = request.params.arguments as {
              query: string;
              type?: string;
              limit?: number;
            };
            
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
            const { id } = request.params.arguments as { id: string };
            
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
            const { type, name, description = '', properties = {} } = request.params.arguments as {
              type: string;
              name: string;
              description?: string;
              properties?: Record<string, any>;
            };
            
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
            const { id, properties } = request.params.arguments as {
              id: string;
              properties: Record<string, any>;
            };
            
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
            const { limit } = request.params.arguments as { limit?: number };
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

          case 'get_session_info': {
            const response = await teamcenterService.getSessionInfo();
            
            if (response.error) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Failed to get session info: ${response.error.message}`,
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

          case 'get_favorites': {
            const response = await teamcenterService.getFavorites();
            
            if (response.error) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Failed to get favorites: ${response.error.message}`,
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

          case 'get_user_properties': {
            const { uid, attributes } = request.params.arguments as {
              uid: string;
              attributes?: string[];
            };
            
            if (!uid) {
              throw new McpError(ErrorCode.InvalidParams, 'User UID is required');
            }
            
            const response = await teamcenterService.getUserProperties(uid, attributes);
            
            if (response.error) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Failed to get user properties: ${response.error.message}`,
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

          case 'get_logged_user_properties': {
            const { attributes } = request.params.arguments as {
              attributes?: string[];
            };
            
            const response = await teamcenterService.getLoggedUserProperties(attributes);
            
            if (response.error) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Failed to get logged user properties: ${response.error.message}`,
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
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  async run() {
    try {
      if (!MOCK_MODE) {
        // Test authentication on startup in real mode
        const credentials: TCCredentials = {
          username: TEAMCENTER_USERNAME!,
          password: TEAMCENTER_PASSWORD!
        };
        
        const loginResponse = await teamcenterService.login(credentials);
        
        if (loginResponse.error) {
          throw new Error(`Authentication failed: ${loginResponse.error.message}`);
        }
        
        logger.info('Successfully authenticated with Teamcenter');
      } else {
        logger.info('Running in MOCK mode - no authentication required');
      }
      
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      logger.info('Teamcenter MCP server running on stdio');
    } catch (error) {
      logger.error('Failed to start Teamcenter MCP server:', error);
      process.exit(1);
    }
  }
}

// Export the TeamcenterServer class for testing
export { TeamcenterServer };

// Start the server
const server = new TeamcenterServer();
server.run().catch((error) => logger.error('Server run error:', error));
