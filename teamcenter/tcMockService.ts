
import { TCCredentials, TCSearchOptions, TCSearchResponse } from './types.js';
import logger from '../logger.js';

// Mock service implementation
export const mockCallService = async (
  service: string, 
  operation: string, 
  params: unknown
): Promise<unknown> => {
  // Generate a unique request ID for tracing
  const requestId = logger.logTeamcenterRequest(service, operation, params);
  
  logger.debug(`[${requestId}] SOA call (MOCK MODE): ${service}.${operation}`, params);
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Mock responses based on service and operation
  if (service === 'Core-2011-06-Session' && operation === 'login') {
    // Handle both direct credentials and wrapped credentials formats
    let user, password;
    
    if ((params as any).credentials) {
      // Format from createJSONRequest: { credentials: { user, password, ... } }
      user = (params as { credentials: { user: string; password: string } }).credentials.user;
      password = (params as { credentials: { user: string; password: string } }).credentials.password;
    } else if ((params as any).body && (params as any).body.credentials) {
      // Format from request envelope: { body: { credentials: { user, password, ... } } }
      user = (params as { body: { credentials: { user: string; password: string } } }).body.credentials.user;
      password = (params as { body: { credentials: { user: string; password: string } } }).body.credentials.password;
    } else {
      // Direct format: { username, password }
      user = (params as { username: string; password: string }).username;
      password = (params as { username: string; password: string }).password;
    }
    
    // Always accept admin/admin, but credentials with matching username/password also work in mock mode
    if ((user === 'admin' && password === 'admin') ||
        (user === password)) {
      const response = {
        serverInfo: {
          version: "14.0.0.0",
          instanceName: "Mock TC Server",
          hostName: "localhost"
        },
        sessionId: 'mock-session-123',
        userId: user,
        userName: user === 'admin' ? 'Administrator' : user,
        groupId: 'group-1',
        groupName: 'Engineering',
        roleId: 'role-1',
        roleName: 'Engineer'
      };
      
      // Log the mock response
      logger.logTeamcenterResponse(service, operation, response, requestId);
      
      return response;
    }
    throw new Error('Invalid credentials');
  }
  
  if (service === 'Core-2007-06-Session' && operation === 'logout') {
    const response = { success: true };
    
    // Log the mock response
    logger.logTeamcenterResponse(service, operation, response, requestId);
    
    return response;
  }
  
  if (service === 'Query-2012-10-Finder' && operation === 'performSearch') {
    // Extract the search parameters
    const searchParams = (params as any).searchInput || {};
    const savedQueryName = searchParams.searchCriteria?.savedQueryName;
    
    logger.debug(`Performing search with saved query: ${savedQueryName}`);
    
    // Mock search results for the new API format
    const mockItems = [
      {
        uid: 'item-001',
        type: 'Item',
        properties: [
          { name: 'object_name', value: 'Part ABC-123' },
          { name: 'object_desc', value: 'Mechanical part for assembly' },
          { name: 'object_string', value: 'ABC-123: Mechanical part' },
          { name: 'item_revision_id', value: 'A' },
          { name: 'release_status_list', value: 'Released' },
          { name: 'owning_user', value: 'Administrator' },
          { name: 'last_mod_date', value: '2023-08-15' }
        ],
        revisions: [
          {
            uid: 'itemrev-001-A',
            type: 'ItemRevision',
            properties: [
              { name: 'object_name', value: 'Part ABC-123' },
              { name: 'object_desc', value: 'Mechanical part for assembly' },
              { name: 'object_string', value: 'ABC-123: Mechanical part' },
              { name: 'item_revision_id', value: 'A' },
              { name: 'release_status_list', value: 'Released' },
              { name: 'owning_user', value: 'Administrator' },
              { name: 'last_mod_date', value: '2023-08-15' }
            ]
          }
        ]
      },
      {
        uid: 'item-002',
        type: 'Item',
        properties: [
          { name: 'object_name', value: 'Assembly XYZ-789' },
          { name: 'object_desc', value: 'Final assembly for product' },
          { name: 'object_string', value: 'XYZ-789: Final assembly' },
          { name: 'item_revision_id', value: 'B' },
          { name: 'release_status_list', value: 'In Review' },
          { name: 'owning_user', value: 'Administrator' },
          { name: 'last_mod_date', value: '2023-09-20' }
        ],
        revisions: [
          {
            uid: 'itemrev-002-B',
            type: 'ItemRevision',
            properties: [
              { name: 'object_name', value: 'Assembly XYZ-789' },
              { name: 'object_desc', value: 'Final assembly for product' },
              { name: 'object_string', value: 'XYZ-789: Final assembly' },
              { name: 'item_revision_id', value: 'B' },
              { name: 'release_status_list', value: 'In Review' },
              { name: 'owning_user', value: 'Administrator' },
              { name: 'last_mod_date', value: '2023-09-20' }
            ]
          }
        ]
      }
    ];
    
    const response = {
      searchResults: mockItems,
      totalFound: mockItems.length,
      totalLoaded: mockItems.length,
      searchFilterMap: {
        "Item Type": [{
          searchFilterType: "StringFilter",
          stringValue: "Item",
          startDateValue: "",
          endDateValue: "",
          startNumericValue: 0,
          endNumericValue: 0,
          count: 2,
          selected: true,
          startEndRange: ""
        }],
        "Owner": [{
          searchFilterType: "StringFilter",
          stringValue: "Administrator",
          startDateValue: "",
          endDateValue: "",
          startNumericValue: 0,
          endNumericValue: 0,
          count: 2,
          selected: true,
          startEndRange: ""
        }]
      },
      searchFilterCategories: [{
        internalName: "Item Type",
        displayName: "Item Type",
        defaultFilterValueDisplayCount: 5
      }],
      defaultFilterFieldDisplayCount: 5,
      searchFilterFieldSortType: "Alphabetical",
      serviceData: {},
      // Keep objects for backward compatibility
      objects: mockItems
    };
    
    // Log the mock response
    logger.logTeamcenterResponse(service, operation, response, requestId);
    
    return response;
  }
  
  const error = new Error(`Unimplemented SOA service: ${service}.${operation}`);
  
  // Log the error response
  logger.logTeamcenterResponse(service, operation, null, requestId, error);
  
  throw error;
};
