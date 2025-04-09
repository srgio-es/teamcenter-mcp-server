# System Patterns: Teamcenter MCP Server

## System Architecture

The Teamcenter MCP Server follows a layered architecture that separates concerns and promotes maintainability:

```
┌─────────────────────────────────────────────────────┐
│                  MCP Server Layer                   │
│  (Handles MCP protocol, resources, and tool calls)  │
├─────────────────────────────────────────────────────┤
│                 Service Layer                       │
│  (Business logic, Teamcenter operations)            │
├─────────────────────────────────────────────────────┤
│                 Client Layer                        │
│  (SOA client, API communication, authentication)    │
├─────────────────────────────────────────────────────┤
│                 Utility Layer                       │
│  (Response parsing, session management, utilities)  │
└─────────────────────────────────────────────────────┘
```

### Key Components

1. **MCP Server (index.ts)**
   - Implements the Model Context Protocol
   - Defines resources and tools
   - Handles request routing
   - Manages server lifecycle

2. **Teamcenter Service (teamcenterService.ts)**
   - Implements business logic for Teamcenter operations
   - Manages session state
   - Provides high-level API for Teamcenter operations

3. **SOA Client (tcSOAClient.ts)**
   - Handles communication with Teamcenter REST API
   - Manages authentication and session tokens
   - Formats requests according to Teamcenter API specifications

4. **API Service (tcApiService.ts)**
   - Alternative implementation for REST API communication
   - Used for specific API endpoints not covered by SOA

5. **Mock Service (tcMockService.ts)**
   - Provides mock implementations for testing
   - Simulates Teamcenter responses

6. **Response Parser (tcResponseParser.ts)**
   - Transforms Teamcenter API responses into standardized objects
   - Handles error cases and edge conditions

7. **Utilities (tcUtils.ts)**
   - Provides helper functions
   - Manages session storage and retrieval

## Key Technical Decisions

### 1. MCP Protocol Implementation

The server implements the Model Context Protocol (MCP) to expose Teamcenter functionality to Claude. This decision enables:

- Standardized communication between Claude and Teamcenter
- Clear separation between the UI (Claude) and the data source (Teamcenter)
- Ability to expose both resources (data) and tools (actions)

### 2. Service-Oriented Architecture (SOA)

The server uses Teamcenter's SOA API for most operations, which provides:

- Comprehensive access to Teamcenter functionality
- Consistent error handling
- Support for complex operations

### 3. Singleton Pattern for Services

The teamcenterService is implemented as a singleton to:

- Maintain a single session with Teamcenter
- Provide a consistent interface for Teamcenter operations
- Simplify state management

### 4. Environment-Based Configuration

Configuration is managed through environment variables to:

- Separate configuration from code
- Support different deployment environments
- Secure sensitive information like credentials

### 5. Error Handling Strategy

The server implements a comprehensive error handling strategy:

- All API calls are wrapped in try/catch blocks
- Errors are transformed into standardized TCResponse objects
- MCP errors are mapped to appropriate error codes

## Component Relationships

```mermaid
graph TD
    A[MCP Server] --> B[Teamcenter Service]
    B --> C[SOA Client]
    B --> D[API Service]
    B --> E[Mock Service]
    C --> F[Response Parser]
    D --> F
    E --> F
    C --> G[Utilities]
    D --> G
    E --> G
```

### Data Flow

1. **Request Flow**:
   - Claude sends an MCP request to the server
   - The server routes the request to the appropriate handler
   - The handler calls the teamcenterService
   - The service uses the SOA client to communicate with Teamcenter
   - The response is parsed and returned to Claude

2. **Authentication Flow**:
   - The server reads credentials from environment variables
   - On startup, it authenticates with Teamcenter
   - The session token is stored for subsequent requests
   - If authentication fails, appropriate errors are returned

3. **Error Flow**:
   - API errors are caught and transformed into TCResponse objects
   - MCP errors are mapped to appropriate error codes
   - Errors are logged for debugging
   - User-friendly error messages are returned to Claude

## Design Patterns

### 1. Facade Pattern

The teamcenterService acts as a facade, providing a simplified interface to the complex Teamcenter API:

```typescript
// Simplified interface exposed by the facade
async searchItems(query: string, type?: string, limit?: number): Promise<TCResponse<TCObject[]>>

// Complex implementation details hidden behind the facade
const searchOptions: TCSearchOptions = {
  searchInput: {
    providerName: "Fnd0BaseProvider",
    searchCriteria: { Name: query },
    // ... many more configuration options
  }
};
```

### 2. Adapter Pattern

The response parser adapts Teamcenter's complex response format to a simplified TCObject format:

```typescript
// Adapter function
export function convertToTCObject(rawObject: any): TCObject {
  return {
    id: rawObject.uid,
    name: rawObject.properties.object_name?.dbValues?.[0] || '',
    // ... mapping between different formats
  };
}
```

### 3. Factory Pattern

The SOA client uses a factory function to create new instances:

```typescript
// Factory function
export function createSOAClient(config: TCSOAClientConfig, sessionId?: string | null): SOAClient {
  return new SOAClient(config, sessionId);
}
```

### 4. Strategy Pattern

The server can use different service implementations (API, SOA, Mock) based on configuration:

```typescript
// Different strategies for the same operation
// SOA strategy
teamcenterService.searchItems = async (query, type, limit) => {
  // Implementation using SOA
};

// Mock strategy
mockTeamcenterService.searchItems = async (query, type, limit) => {
  // Implementation using mock data
};
```

## Critical Implementation Paths

### 1. Authentication

```
MCP Server -> teamcenterService.login() -> SOAClient.callService() -> Teamcenter API -> Session Token
```

### 2. Item Search

```
MCP Server -> teamcenterService.searchItems() -> SOAClient.callService() -> Teamcenter API -> Raw Results -> Response Parser -> TCObjects
```

### 3. Item Creation

```
MCP Server -> teamcenterService.createItem() -> SOAClient.callService() -> Teamcenter API -> Raw Result -> Response Parser -> TCObject
```

### 4. Resource Access

```
MCP Server -> ReadResourceRequestSchema handler -> teamcenterService method -> SOAClient.callService() -> Teamcenter API -> Raw Result -> JSON Response
```

## Performance Considerations

1. **Session Management**: The server maintains a single session with Teamcenter to reduce authentication overhead.

2. **Response Parsing**: Heavy parsing is done server-side to reduce the load on Claude.

3. **Error Caching**: Common errors are cached to avoid repeated API calls for known issues.

4. **Pagination**: Search results are paginated to manage large result sets efficiently.

5. **Timeout Handling**: API calls have configurable timeouts to prevent hanging operations.
