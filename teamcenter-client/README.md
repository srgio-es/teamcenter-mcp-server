# Teamcenter Client

A TypeScript client library for interacting with Teamcenter PLM systems.

## Features

- Authentication with Teamcenter
- Session management
- Item search and retrieval
- Item creation and update
- Comprehensive error handling
- Mock mode for testing without a real Teamcenter instance
- Dependency injection for logging

## Installation

```bash
npm install teamcenter-client
```

## Usage

### Basic Usage

```typescript
import { createTeamcenterService } from 'teamcenter-client';

// Create a Teamcenter service instance
const teamcenterService = createTeamcenterService({
  config: {
    endpoint: 'https://teamcenter.example.com/tc',
    timeout: 60000,
    mockMode: false
  }
});

// Login to Teamcenter
const loginResponse = await teamcenterService.login({
  username: 'your_username',
  password: 'your_password'
});

if (loginResponse.error) {
  console.error('Login failed:', loginResponse.error.message);
} else {
  console.log('Login successful:', loginResponse.data);
  
  // Search for items
  const searchResponse = await teamcenterService.searchItems('Part123');
  
  if (searchResponse.error) {
    console.error('Search failed:', searchResponse.error.message);
  } else {
    console.log('Search results:', searchResponse.data);
  }
  
  // Logout
  await teamcenterService.logout();
}
```

### Custom Logger

You can provide your own logger implementation:

```typescript
import { createTeamcenterService, Logger } from 'teamcenter-client';
import winston from 'winston';

// Create a custom logger that uses Winston
const customLogger: Logger = {
  error: (message, ...meta) => winston.error(message, ...meta),
  warn: (message, ...meta) => winston.warn(message, ...meta),
  info: (message, ...meta) => winston.info(message, ...meta),
  debug: (message, ...meta) => winston.debug(message, ...meta),
  logTeamcenterRequest: (service, operation, params, requestId) => {
    const reqId = requestId || `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    winston.info(`[${reqId}] TC REQUEST: ${service}.${operation}`, { params });
    return reqId;
  },
  logTeamcenterResponse: (service, operation, response, requestId, error) => {
    if (error) {
      winston.error(`[${requestId}] TC RESPONSE ERROR: ${service}.${operation}`, { error: error.message });
    } else {
      winston.info(`[${requestId}] TC RESPONSE: ${service}.${operation}`, { response });
    }
  }
};

// Create a Teamcenter service instance with the custom logger
const teamcenterService = createTeamcenterService({
  logger: customLogger,
  config: {
    endpoint: 'https://teamcenter.example.com/tc',
    timeout: 60000,
    mockMode: false
  }
});
```

### Mock Mode

For testing without a real Teamcenter instance:

```typescript
import { createTeamcenterService } from 'teamcenter-client';

// Create a Teamcenter service instance in mock mode
const teamcenterService = createTeamcenterService({
  config: {
    endpoint: 'http://localhost:8080/tc', // Not used in mock mode
    timeout: 60000,
    mockMode: true
  }
});

// Login with any username/password in mock mode
const loginResponse = await teamcenterService.login({
  username: 'admin',
  password: 'admin'
});

// Use the service as normal
const searchResponse = await teamcenterService.searchItems('Part123');
```

## API Reference

### TeamcenterService

The main service for interacting with Teamcenter.

#### Methods

- `login(credentials: TCCredentials): Promise<TCResponse<TCSession>>`
- `logout(): Promise<TCResponse<void>>`
- `searchItems(query: string, type?: string, limit?: number): Promise<TCResponse<TCObject[]>>`
- `getItemById(itemId: string): Promise<TCResponse<any>>`
- `createItem(type: string, name: string, description?: string, properties?: Record<string, any>): Promise<TCResponse<any>>`
- `updateItem(itemId: string, properties: Record<string, any>): Promise<TCResponse<any>>`
- `getItemTypes(): Promise<TCResponse<any>>`
- `getUserOwnedItems(): Promise<TCResponse<TCObject[]>>`
- `getLastCreatedItems(limit?: number): Promise<TCResponse<TCObject[]>>`
- `getSessionInfo(): Promise<TCResponse<any>>`
- `getFavorites(): Promise<TCResponse<any>>`
- `isLoggedIn(): boolean`
- `getSessionId(): string | null`

### Configuration

```typescript
interface TeamcenterConfig {
  endpoint: string;
  timeout?: number;
  mockMode?: boolean;
  headers?: Record<string, string>;
  withCredentials?: boolean;
}

interface TeamcenterServiceOptions {
  logger?: Logger;
  config: TeamcenterConfig;
}
```

### Response Format

All service methods return a `TCResponse<T>` object:

```typescript
interface TCResponse<T> {
  data?: T;
  error?: TCError;
}

interface TCError {
  code: string;
  level: 'INFO' | 'WARNING' | 'ERROR';
  message: string;
}
```

## License

ISC
