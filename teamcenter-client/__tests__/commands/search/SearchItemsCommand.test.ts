import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { SearchItemsCommand } from '../../../src/commands/search/SearchItemsCommand.js';
import { SOAClient } from '../../../src/tcSOAClient.js';
import { Logger } from '../../../src/logger.js';
import { TCObject, TCResponse, TCSearchResponse } from '../../../src/types.js';
import { AppError, ErrorType } from '../../../src/tcErrors.js';

// Mock Logger
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  logTeamcenterRequest: jest.fn().mockReturnValue('req_123'),
  logTeamcenterResponse: jest.fn()
} as Logger;

// Create a properly typed mock function for callService
type CallServiceType = (service: string, operation: string, params: unknown) => Promise<unknown>;
const mockCallService = jest.fn() as jest.MockedFunction<CallServiceType>;

// Mock SOAClient
const mockSoaClient: SOAClient = {
  config: {
    endpoint: 'https://mock-teamcenter-server.com',
    mockMode: true
  },
  sessionId: 'mock-session-id',
  callService: mockCallService
};

describe('SearchItemsCommand', () => {
  let command: SearchItemsCommand;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });

  it('should execute successfully and return items', async () => {
    // Mock the response from the SOA client
    const mockResponse: TCSearchResponse = {
      objects: [
        { uid: 'item1', type: 'Item', properties: { object_name: 'Item 1' } },
        { uid: 'item2', type: 'Item', properties: { object_name: 'Item 2' } },
      ],
      searchResults: [],
      totalFound: 2,
      totalLoaded: 2,
      serviceData: { plain: [], partialErrors: [] },
    };
    mockCallService.mockResolvedValue(mockResponse);

    command = new SearchItemsCommand(mockLogger, mockSoaClient, true, 'testQuery', undefined, 5);
    const result: TCResponse<TCObject[]> = await command.execute();

    expect(result.error).toBeUndefined();
    expect(result.data).toHaveLength(2);
    expect(result.data?.[0].name).toBe('Item 1');
    expect(mockSoaClient.callService).toHaveBeenCalledWith(
      'Query-2012-10-Finder',
      'performSearch',
      expect.objectContaining({
        searchInput: expect.objectContaining({
          providerName: 'Fnd0BaseProvider',
          searchCriteria: { Name: 'testQuery' },
          maxToReturn: 5,
          searchFilterMap: {}, // No type filter
        }),
      })
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('SearchItemsCommand.execute successful: 2 items found'));
  });

  it('should execute successfully with a type filter', async () => {
    const mockResponse: TCSearchResponse = {
      objects: [{ uid: 'item1', type: 'TypeA', properties: { object_name: 'Item 1 TypeA' } }],
      searchResults: [],
      totalFound: 1,
      totalLoaded: 1,
      serviceData: { plain: [], partialErrors: [] },
    };
    mockCallService.mockResolvedValue(mockResponse);

    command = new SearchItemsCommand(mockLogger, mockSoaClient, true, 'testQuery', 'TypeA', 10);
    const result: TCResponse<TCObject[]> = await command.execute();

    expect(result.error).toBeUndefined();
    expect(result.data).toHaveLength(1);
    expect(result.data?.[0].name).toBe('Item 1 TypeA');
    expect(mockSoaClient.callService).toHaveBeenCalledWith(
      'Query-2012-10-Finder',
      'performSearch',
      expect.objectContaining({
        searchInput: expect.objectContaining({
          providerName: 'Fnd0BaseProvider',
          searchCriteria: { Name: 'testQuery' },
          maxToReturn: 10,
          searchFilterMap: {
            "Item Type": expect.arrayContaining([
              expect.objectContaining({ stringValue: 'TypeA' })
            ])
          },
        }),
      })
    );
  });

  it('should return error if not logged in', async () => {
    command = new SearchItemsCommand(mockLogger, mockSoaClient, false, 'testQuery');
    const result = await command.execute();

    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(result.error?.code).toBe('NO_SESSION');
    expect(result.error?.message).toContain('User is not logged in');
    expect(mockSoaClient.callService).not.toHaveBeenCalled();
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('SearchItemsCommand.execute failed: No session'));
  });

  it('should return error if query is missing', async () => {
    command = new SearchItemsCommand(mockLogger, mockSoaClient, true, ''); // Empty query
    const result = await command.execute();

    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(result.error?.code).toBe('INVALID_PARAMETER');
    expect(result.error?.message).toContain('Search query is required');
    expect(mockSoaClient.callService).not.toHaveBeenCalled();
  });

  it('should return error if limit is invalid', async () => {
    command = new SearchItemsCommand(mockLogger, mockSoaClient, true, 'testQuery', undefined, 0); // Invalid limit
    let result = await command.execute();

    expect(result.error).toBeDefined();
    expect(result.error?.code).toBe('INVALID_PARAMETER');
    expect(result.error?.message).toContain('Limit must be between 1 and 100');

    command = new SearchItemsCommand(mockLogger, mockSoaClient, true, 'testQuery', undefined, 101); // Invalid limit
    result = await command.execute();

    expect(result.error).toBeDefined();
    expect(result.error?.code).toBe('INVALID_PARAMETER');
    expect(result.error?.message).toContain('Limit must be between 1 and 100');
    expect(mockSoaClient.callService).not.toHaveBeenCalled();
  });

  it('should return error if SOA client throws an error', async () => {
    const thrownError = new Error('SOA call failed');
    mockCallService.mockRejectedValue(thrownError);

    command = new SearchItemsCommand(mockLogger, mockSoaClient, true, 'testQuery');
    const result = await command.execute();

    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(result.error?.code).toBe('SEARCH_ERROR');
    expect(result.error?.message).toBe('SOA call failed'); // Uses specific message now
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Error searching items:'), thrownError);
  });

  it('should return specific error message from AppError originalError', async () => {
    // Simulate an AppError wrapping a detailed TC error structure
    const tcErrorObj = { 
      response: { 
        data: { 
          ServiceData: { 
            partialErrors: [{ 
              errorValues: [{ message: 'Teamcenter specific error message' }] 
            }] 
          } 
        } 
      } 
    };
    // Create an Error object with the TC error structure attached
    const originalTcError = new Error('Teamcenter API error');
    Object.assign(originalTcError, tcErrorObj);
    
    const thrownError = new AppError('Wrapped error', ErrorType.API_RESPONSE, originalTcError);
    mockCallService.mockRejectedValue(thrownError);

    command = new SearchItemsCommand(mockLogger, mockSoaClient, true, 'testQuery');
    const result = await command.execute();

    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(result.error?.code).toBe('SEARCH_ERROR');
    expect(result.error?.message).toBe('Teamcenter specific error message'); // Specific message extracted
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Error searching items:'), thrownError);
  });

  it('should return error if SOA client is not initialized', async () => {
    command = new SearchItemsCommand(mockLogger, null, true, 'testQuery'); // Pass null for soaClient
    const result = await command.execute();

    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(result.error?.code).toBe('SEARCH_ERROR');
    expect(result.error?.message).toContain('SOA client is not initialized');
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Error searching items:'), expect.any(AppError));
  });
});
