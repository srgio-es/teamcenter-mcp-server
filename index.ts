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

// Import Teamcenter types
import { TCCredentials, TCSearchOptions, TCObject, TCResponse } from './teamcenter/types.js';
import { createSOAClient } from './teamcenter/tcSOAClient.js';

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

// Initialize Teamcenter configuration
const teamcenterConfig = {
  endpoint: MOCK_MODE ? 'http://localhost:8080/tc' : (TEAMCENTER_BASE_URL as string),
  timeout: 60000,
  mockMode: MOCK_MODE
};

logger.info(`Starting Teamcenter MCP server in ${MOCK_MODE ? 'MOCK' : 'REAL'} mode`);

// Set up environment for teamcenterService
(global as any).teamcenterConfig = teamcenterConfig;

// Import Teamcenter service modules after setting global config
import { teamcenterService, initTeamcenterService } from './teamcenter/teamcenterService.js';

// Initialize the teamcenterService after setting global config
initTeamcenterService();

// Create a typed version of the teamcenterService with all the methods we need
interface TeamcenterServiceInterface {
  login(credentials: TCCredentials): Promise<TCResponse<any>>;
  logout(): Promise<TCResponse<void>>;
  getUserOwnedItems(): Promise<TCResponse<TCObject[]>>;
  getLastCreatedItems(limit?: number): Promise<TCResponse<TCObject[]>>;
  getItemTypes(): Promise<TCResponse<any>>;
  getItemById(itemId: string): Promise<TCResponse<any>>;
  searchItems(query: string, type?: string, limit?: number): Promise<TCResponse<TCObject[]>>;
  createItem(type: string, name: string, description: string, properties?: Record<string, any>): Promise<TCResponse<any>>;
  updateItem(itemId: string, properties: Record<string, any>): Promise<TCResponse<any>>;
}

// Cast the teamcenterService to our interface
const typedTeamcenterService = teamcenterService as unknown as TeamcenterServiceInterface;

// Add missing methods to teamcenterService if they don't exist
if (!('getItemTypes' in typedTeamcenterService)) {
  teamcenterService.getItemTypes = async (): Promise<TCResponse<any>> => {
    try {
      const soaClient = createSOAClient(teamcenterConfig);
      const result = await soaClient.callService(
        'Core-2006-03-BusinessObjectType',
        'getBusinessObjectTypes',
        {}
      );
      return { data: result };
    } catch (error) {
      logger.error('Error getting item types:', error);
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

if (!('getItemById' in typedTeamcenterService)) {
  teamcenterService.getItemById = async (itemId: string): Promise<TCResponse<any>> => {
    try {
      const soaClient = createSOAClient(teamcenterConfig);
      const result = await soaClient.callService(
        'Core-2006-03-DataManagement',
        'getProperties',
        { uids: [itemId] }
      );
      return { data: result };
    } catch (error) {
      logger.error('Error getting item by ID:', error);
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

if (!('searchItems' in typedTeamcenterService)) {
  teamcenterService.searchItems = async (query: string, type?: string, limit: number = 10): Promise<TCResponse<TCObject[]>> => {
    try {
      const soaClient = createSOAClient(teamcenterConfig);
      
      // Build search criteria
      const searchOptions: TCSearchOptions = {
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
      
      const result = await soaClient.callService(
        'Query-2012-10-Finder',
        'performSearch',
        searchOptions
      );
      
      // Cast the result to TCObject[] to satisfy TypeScript
      return { data: result as unknown as TCObject[] };
    } catch (error) {
      logger.error('Error searching items:', error);
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

if (!('createItem' in typedTeamcenterService)) {
  teamcenterService.createItem = async (type: string, name: string, description: string, properties: Record<string, any> = {}): Promise<TCResponse<any>> => {
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
      
      const result = await soaClient.callService(
        'Core-2006-03-DataManagement',
        'createObjects',
        { objects: [createData] }
      );
      
      return { data: result };
    } catch (error) {
      logger.error('Error creating item:', error);
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

if (!('updateItem' in typedTeamcenterService)) {
  teamcenterService.updateItem = async (itemId: string, properties: Record<string, any>): Promise<TCResponse<any>> => {
    try {
      const soaClient = createSOAClient(teamcenterConfig);
      
      const result = await soaClient.callService(
        'Core-2006-03-DataManagement',
        'setProperties',
        {
          objects: [
            {
              uid: itemId,
              properties,
            },
          ],
        }
      );
      
      return { data: result };
    } catch (error) {
      logger.error('Error updating item:', error);
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
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'teamcenter-server',
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
          const response = await typedTeamcenterService.getItemTypes();
          
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
          const response = await typedTeamcenterService.getItemById(itemId);
          
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
          const response = await typedTeamcenterService.searchItems(query);
          
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
            
            const response = await typedTeamcenterService.searchItems(query, type, limit);
            
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
            
            const response = await typedTeamcenterService.getItemById(id);
            
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
            
            const response = await typedTeamcenterService.createItem(type, name, description, properties);
            
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
            
            const response = await typedTeamcenterService.updateItem(id, properties);
            
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
            const response = await typedTeamcenterService.getItemTypes();
            
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

// Start the server
const server = new TeamcenterServer();
server.run().catch((error) => logger.error('Server run error:', error));
