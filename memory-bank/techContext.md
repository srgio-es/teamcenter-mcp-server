# Technical Context: Teamcenter MCP Server

## Technologies Used

### Core Technologies

1. **TypeScript**
   - Strongly typed language for robust code
   - Used for all server implementation
   - Compiled to JavaScript for execution
   - Type definitions for improved code safety

2. **Node.js**
   - JavaScript runtime for server-side execution
   - Handles asynchronous operations efficiently
   - Provides access to file system and environment variables
   - Environment-aware code for cross-platform compatibility

3. **Model Context Protocol (MCP)**
   - Protocol for communication between Claude and external services
   - Defines standards for resources and tools
   - Implemented using the MCP SDK
   - Resource templates for dynamic resource access

4. **Teamcenter REST API**
   - Service-Oriented Architecture (SOA) API
   - HTTP-based communication with Teamcenter
   - JSON request/response format
   - Session-based authentication

### Libraries and Frameworks

1. **@modelcontextprotocol/sdk** (v1.9.0)
   - Official SDK for implementing MCP servers
   - Provides server, transport, and type definitions
   - Handles MCP protocol details
   - Error handling and request routing

2. **axios** (v1.8.4)
   - HTTP client for API requests
   - Handles request/response transformations
   - Supports request cancellation and timeouts
   - Error handling and retry capabilities

3. **dotenv** (v16.4.7)
   - Environment variable management
   - Loads variables from .env file for local development
   - Simplifies configuration management
   - Secure handling of sensitive information

4. **ts-node** (v10.9.2)
   - TypeScript execution environment
   - Used for development without separate compilation step
   - Enables direct execution of TypeScript files
   - Hot reloading for development efficiency

5. **typescript** (v5.8.3)
   - TypeScript compiler
   - Provides type checking and transpilation
   - Configured via tsconfig.json
   - Strict type checking for code safety

## Development Setup

### Project Structure

```
teamcenter-mcp-server/
├── .env                  # Environment variables for local development
├── index.ts              # Main entry point and MCP server implementation
├── package.json          # Project dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── build/                # Compiled JavaScript output
└── teamcenter/           # Teamcenter service modules
    ├── tcApiService.ts   # REST API client implementation
    ├── tcMockService.ts  # Mock service for testing
    ├── tcResponseParser.ts # Response transformation utilities
    ├── tcSOAClient.ts    # SOA client implementation
    ├── tcUtils.ts        # Utility functions
    ├── teamcenterService.ts # Main service implementation
    └── types.ts          # TypeScript type definitions
```

### Build Process

1. **Development**:
   - Run `npm run dev` to start the server using ts-node
   - Changes to TypeScript files are immediately reflected
   - Environment variables are loaded from .env file

2. **Production Build**:
   - Run `npm run build` to compile TypeScript to JavaScript
   - Output is generated in the build/ directory
   - Executable permissions are set on the main file

3. **Deployment**:
   - The compiled JavaScript is executed using Node.js
   - Environment variables are provided through the MCP settings file
   - The server communicates with Claude through stdio

### Configuration

1. **Local Development**:
   - Create a .env file with Teamcenter credentials:
     ```
     TEAMCENTER_BASE_URL=https://teamcenter.example.com/api
     TEAMCENTER_USERNAME=your_username
     TEAMCENTER_PASSWORD=your_password
     ```

2. **MCP Configuration**:
   - Edit the MCP settings file to configure the server:
     ```json
     {
       "mcpServers": {
         "teamcenter": {
           "command": "node",
           "args": ["/path/to/teamcenter-mcp-server/build/index.js"],
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

## Technical Constraints

### Teamcenter API Limitations

1. **Authentication**:
   - Teamcenter requires session-based authentication
   - Sessions expire after a period of inactivity
   - Re-authentication is needed when sessions expire
   - Session cookies must be properly managed

2. **API Structure**:
   - Teamcenter uses a complex SOA API structure
   - Operations are grouped by service and operation names
   - Request/response formats vary by operation
   - Envelope structure required for all requests

3. **Performance**:
   - Some Teamcenter operations can be slow for large datasets
   - Search operations may timeout for broad queries
   - Rate limiting may be applied by the Teamcenter server
   - Response sizes can be large for complex objects

### MCP Protocol Constraints

1. **Communication Channel**:
   - MCP servers communicate with Claude through stdio
   - No direct UI capabilities or user interaction
   - All user interaction must go through Claude
   - Request/response format must follow MCP standards

2. **Resource Limitations**:
   - Resources must be representable as UTF-8 text
   - Binary data must be encoded or referenced externally
   - Resource URIs must follow the MCP URI template format
   - Resource templates must be properly defined for dynamic access

3. **Tool Limitations**:
   - Tool inputs must be JSON-serializable
   - Tool outputs must be text or structured content
   - No direct file system access from tools
   - Error responses must follow MCP error code standards

### Security Considerations

1. **Credential Handling**:
   - Credentials are stored in environment variables
   - No hardcoding of credentials in source code
   - Credentials are not logged or exposed in responses
   - Password masking in debug logs

2. **Session Management**:
   - Session tokens are stored securely
   - Sessions are properly terminated on server shutdown
   - Failed authentication attempts are limited
   - Cookie-based session persistence

3. **Error Handling**:
   - Error messages don't expose sensitive information
   - Stack traces are not returned to the client
   - Input validation prevents injection attacks
   - Error categorization for better security analysis

## Dependencies

### Direct Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| @modelcontextprotocol/sdk | ^1.9.0 | MCP server implementation |
| @types/node | ^22.14.0 | TypeScript definitions for Node.js |
| axios | ^1.8.4 | HTTP client for API requests |
| dotenv | ^16.4.7 | Environment variable management |
| ts-node | ^10.9.2 | TypeScript execution environment |
| typescript | ^5.8.3 | TypeScript compiler |

### External Dependencies

1. **Teamcenter PLM**:
   - Requires a running Teamcenter instance
   - Needs valid user credentials with appropriate permissions
   - Depends on specific Teamcenter version compatibility

2. **Claude**:
   - Requires Claude with MCP support
   - Depends on Claude's understanding of Teamcenter concepts
   - Relies on proper MCP configuration in Claude

## Tool Usage Patterns

### MCP Resource Access

```typescript
// Resource access pattern
this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  try {
    // Extract parameters from URI
    const match = request.params.uri.match(/^teamcenter:\/\/items\/(.+)$/);
    if (match) {
      const itemId = decodeURIComponent(match[1]);
      
      // Call service method
      const response = await typedTeamcenterService.getItemById(itemId);
      
      // Handle errors
      if (response.error) {
        throw new McpError(ErrorCode.InternalError, response.error.message);
      }
      
      // Return formatted response
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
```

### MCP Tool Implementation

```typescript
// Tool implementation pattern
this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    switch (request.params.name) {
      case 'search_items': {
        // Extract parameters
        const { query, type, limit } = request.params.arguments as {
          query: string;
          type?: string;
          limit?: number;
        };
        
        // Validate parameters
        if (!query) {
          throw new McpError(ErrorCode.InvalidParams, 'Query parameter is required');
        }
        
        // Call service method
        const response = await typedTeamcenterService.searchItems(query, type, limit);
        
        // Handle errors
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
        
        // Return formatted response
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
      
      // Additional cases for other tools...
      
      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
    }
  } catch (error) {
    // Handle unexpected errors
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
```

### Teamcenter API Calls

```typescript
// Teamcenter API call pattern
async searchItems(query: string, type?: string, limit: number = 10): Promise<TCResponse<TCObject[]>> {
  try {
    // Create SOA client
    const soaClient = createSOAClient(teamcenterConfig);
    
    // Build request parameters
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
    
    // Add type filter if provided
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
    
    // Make API call
    const result = await soaClient.callService(
      'Query-2012-10-Finder',
      'performSearch',
      searchOptions
    );
    
    // Return successful response
    return { data: result as unknown as TCObject[] };
  } catch (error) {
    // Return error response
    logger.error('Error searching items:', error);
    return {
      error: {
        code: 'SEARCH_ERROR',
        level: 'ERROR',
        message: error instanceof Error ? error.message : 'Failed to search items'
      }
    };
  }
}
```

### Error Handling

```typescript
// Error handling pattern with AppError class
try {
  // Operation that might fail
  const response = await typedTeamcenterService.getItemById(id);
  
  // Check for service-level errors
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
  
  // Success path
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response.data, null, 2),
      },
    ],
  };
} catch (error) {
  // Handle unexpected errors
  if (error instanceof McpError) {
    throw error; // Let MCP framework handle it
  }
  
  // Check if it's our AppError type
  if (error instanceof AppError) {
    // Log with error type for better categorization
    logger.error(`${error.type} Error: ${error.message}`, error.context);
    
    // Convert to MCP-friendly error
    return {
      content: [
        {
          type: 'text',
          text: `Error (${error.type}): ${error.message}`,
        },
      ],
      isError: true,
    };
  }
  
  // Generic error handling
  logger.error('Unexpected error:', error);
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
