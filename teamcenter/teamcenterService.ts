import { 
  TCCredentials,
  TCSession,
  TCResponse,
  TCSearchOptions,
  TCSearchResponse,
  TCObject
} from './types.js';
import { storeSession, retrieveSession, clearSession, isValidSession } from './tcUtils.js';
import { convertToTCObject, getPropertyValue } from './tcResponseParser.js';
import { SOAClient, createSOAClient } from './tcSOAClient.js';
import { AppError, ErrorType, handleApiError } from './tcErrors.js';
import logger from '../logger.js';

// Default teamcenter config - will be overridden by global config
const defaultTeamcenterConfig = {
  endpoint: 'http://localhost:8080/tc',
  timeout: 60000
};

// Function to get teamcenterConfig from global or use default
const getTeamcenterConfig = () => {
  // Always check the global config first
  if ((globalThis as any).teamcenterConfig) {
    logger.debug('Getting teamcenterConfig from global:', (globalThis as any).teamcenterConfig);
    return (globalThis as any).teamcenterConfig;
  }
  
  logger.debug('Using default teamcenterConfig:', defaultTeamcenterConfig);
  return defaultTeamcenterConfig;
};

/**
 * TeamcenterService class provides a unified interface for interacting with Teamcenter
 * It handles session management, error handling, and provides a consistent API
 */
class TeamcenterService {
  private soaClient: SOAClient | null = null;
  private sessionInfo: TCSession | null = null;
  
  constructor() {
    this.initService();
  }
  
  /**
   * Initialize the service by restoring session and creating SOA client
   */
  private initService(): void {
    try {
      // Restore session if available
      const session = retrieveSession();
      const sessionId = session?.sessionId || null;
      
      // Initialize the SOA client
      this.soaClient = createSOAClient(getTeamcenterConfig(), sessionId);
      this.sessionInfo = session;
      
      if (sessionId && isValidSession(session)) {
        logger.info('Teamcenter session restored from stored cookie');
      } else if (sessionId) {
        logger.warn('Found session ID but session data is incomplete');
      }
    } catch (error) {
      logger.error('Error initializing Teamcenter service:', error);
      // Create SOA client without session
      this.soaClient = createSOAClient(getTeamcenterConfig(), null);
    }
  }

  /**
   * Check if the user is currently logged in
   * @returns True if the user is logged in, false otherwise
   */
  isLoggedIn(): boolean {
    return Boolean(this.soaClient?.sessionId) && Boolean(this.sessionInfo?.sessionId);
  }
  
  /**
   * Get the current session ID
   * @returns The current session ID or null if not logged in
   */
  getSessionId(): string | null {
    return this.soaClient?.sessionId || null;
  }

  /**
   * Create a standard error response for when the user is not logged in
   * @param method The method name that was called
   * @returns A standardized error response
   */
  private createNotLoggedInError(method: string): TCResponse<any> {
    return {
      error: {
        code: 'NO_SESSION',
        level: 'ERROR',
        message: 'User is not logged in'
      }
    };
  }

  /**
   * Login to Teamcenter with the provided credentials
   * @param credentials The credentials to use for login
   * @returns A response containing the session information or an error
   */
  async login(credentials: TCCredentials): Promise<TCResponse<TCSession>> {
    const serviceRequestId = `service_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    logger.debug(`[${serviceRequestId}] TeamcenterService.login called for user: ${credentials.username}`);
    
    try {
      if (!this.soaClient) {
        throw new AppError(
          'SOA client is not initialized',
          ErrorType.UNKNOWN,
          null,
          { method: 'login' }
        );
      }
      
      // Validate credentials
      if (!credentials.username || !credentials.password) {
        throw new AppError(
          'Username and password are required',
          ErrorType.DATA_VALIDATION,
          null,
          { method: 'login' }
        );
      }
    
      // Directly pass username and password to match the expected structure in createJSONRequest
      const session = await this.soaClient.callService(
        'Core-2011-06-Session',
        'login',
        credentials
      ) as TCSession;
      
      // Store session
      storeSession(session);
      this.sessionInfo = session;
      
      logger.debug(`[${serviceRequestId}] TeamcenterService.login successful for user: ${credentials.username}`);
      return { data: session };
    } catch (error) {
      logger.error(`[${serviceRequestId}] Teamcenter login error:`, error);
      
      // Create a more specific error response
      let errorCode = 'LOGIN_ERROR';
      let errorMessage = 'Login failed';
      
      if (error instanceof AppError) {
        if (error.type === ErrorType.AUTH_SESSION) {
          errorCode = 'INVALID_CREDENTIALS';
          errorMessage = 'Invalid username or password';
        } else if (error.type === ErrorType.NETWORK) {
          errorCode = 'NETWORK_ERROR';
          errorMessage = 'Network error connecting to Teamcenter';
        } else if (error.type === ErrorType.API_TIMEOUT) {
          errorCode = 'TIMEOUT';
          errorMessage = 'Connection to Teamcenter timed out';
        }
        
        errorMessage = error.message || errorMessage;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      return {
        error: {
          code: errorCode,
          level: 'ERROR',
          message: errorMessage
        }
      };
    }
  }

  /**
   * Logout from Teamcenter
   * @returns A response indicating success or an error
   */
  async logout(): Promise<TCResponse<void>> {
    const serviceRequestId = `service_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    logger.debug(`[${serviceRequestId}] TeamcenterService.logout called`);
    
    // If not logged in, just return success
    if (!this.isLoggedIn()) {
      logger.debug(`[${serviceRequestId}] TeamcenterService.logout: No active session to logout`);
      return { data: undefined };
    }

    try {
      if (!this.soaClient) {
        throw new AppError(
          'SOA client is not initialized',
          ErrorType.UNKNOWN,
          null,
          { method: 'logout' }
        );
      }
      
      await this.soaClient.callService(
        'Core-2007-06-Session',
        'logout',
        {}
      );
      
      // Clear session
      clearSession();
      if (this.soaClient) {
        this.soaClient.sessionId = null;
      }
      this.sessionInfo = null;
      
      logger.debug(`[${serviceRequestId}] TeamcenterService.logout successful`);
      return { data: undefined };
    } catch (error) {
      logger.error(`[${serviceRequestId}] Teamcenter logout error:`, error);
      
      // Even if logout fails, clear the local session
      clearSession();
      if (this.soaClient) {
        this.soaClient.sessionId = null;
      }
      this.sessionInfo = null;
      
      return {
        error: {
          code: 'LOGOUT_ERROR',
          level: 'ERROR',
          message: error instanceof Error ? error.message : 'Logout failed'
        }
      };
    }
  }

  /**
   * Get items owned by the current user
   * @returns A response containing the user's items or an error
   */
  async getUserOwnedItems(): Promise<TCResponse<TCObject[]>> {
    const serviceRequestId = `service_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    logger.debug(`[${serviceRequestId}] TeamcenterService.getUserOwnedItems called`);
    
    // Check if user is logged in
    if (!this.isLoggedIn()) {
      logger.debug(`[${serviceRequestId}] TeamcenterService.getUserOwnedItems failed: No session`);
      return this.createNotLoggedInError('getUserOwnedItems');
    }

    try {
      if (!this.soaClient) {
        throw new AppError(
          'SOA client is not initialized',
          ErrorType.UNKNOWN,
          null,
          { method: 'getUserOwnedItems' }
        );
      }
      
      // Build query to get items owned by current user
      const searchOptions: TCSearchOptions = {
        searchInput: {
          providerName: "Awp0SavedQuerySearchProvider",
          searchCriteria: {
            itemOwner: "${user.name}", // Teamcenter will replace this with current user
            savedQueryName: "My Items"
          },
          startIndex: 0,
          maxToReturn: 10,
          maxToLoad: 10,
          searchFilterMap: {
            "Item Type": [{
              searchFilterType: "StringFilter",
              stringValue: "Item",
              startDateValue: "",
              endDateValue: "",
              startNumericValue: 0,
              endNumericValue: 0,
              count: 1,
              selected: true,
              startEndRange: ""
            }]
          },
          searchSortCriteria: [{
            fieldName: "last_mod_date",
            sortDirection: "DESC"
          }],
          searchFilterFieldSortType: "Alphabetical",
          attributesToInflate: [
            'object_name', 
            'object_desc', 
            'object_string', 
            'item_revision_id', 
            'release_status_list',
            'owning_user',
            'last_mod_date'
          ]
        }
      };

      const response = await this.soaClient.callService(
        'Query-2012-10-Finder',
        'performSearch',
        searchOptions
      ) as TCSearchResponse;

      const tcObjects = response.objects?.map(obj => convertToTCObject(obj)) || [];
      logger.debug(`[${serviceRequestId}] TeamcenterService.getUserOwnedItems successful: ${tcObjects.length} items found`);
      return { data: tcObjects };
    } catch (error) {
      logger.error(`[${serviceRequestId}] Error fetching user owned items:`, error);
      return {
        error: {
          code: 'SEARCH_ERROR',
          level: 'ERROR',
          message: error instanceof Error ? error.message : 'Failed to retrieve items'
        }
      };
    }
  }

  /**
   * Get the most recently created items
   * @param limit Maximum number of items to return (default: 10)
   * @returns A response containing the recently created items or an error
   */
  async getLastCreatedItems(limit: number = 10): Promise<TCResponse<TCObject[]>> {
    const serviceRequestId = `service_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    logger.debug(`[${serviceRequestId}] TeamcenterService.getLastCreatedItems called with limit: ${limit}`);
    
    // Check if user is logged in
    if (!this.isLoggedIn()) {
      logger.debug(`[${serviceRequestId}] TeamcenterService.getLastCreatedItems failed: No session`);
      return this.createNotLoggedInError('getLastCreatedItems');
    }
    
    // Validate limit parameter
    if (limit <= 0 || limit > 100) {
      return {
        error: {
          code: 'INVALID_PARAMETER',
          level: 'ERROR',
          message: 'Limit must be between 1 and 100'
        }
      };
    }

    try {
      if (!this.soaClient) {
        throw new AppError(
          'SOA client is not initialized',
          ErrorType.UNKNOWN,
          null,
          { method: 'getLastCreatedItems' }
        );
      }
      
      // Build query to get last created items by current user
      const searchOptions: TCSearchOptions = {
        searchInput: {
          providerName: "Fnd0BaseProvider",
          searchCriteria: {
            owning_user: "infodba", // Teamcenter will replace this with current user
          },
          startIndex: 0,
          maxToReturn: limit,
          maxToLoad: limit,
          searchFilterMap: {
            "Item Type": [{
              searchFilterType: "StringFilter",
              stringValue: "Item",
              startDateValue: "",
              endDateValue: "",
              startNumericValue: 0,
              endNumericValue: 0,
              count: 1,
              selected: true,
              startEndRange: ""
            }]
          },
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

      const response = await this.soaClient.callService(
        'Query-2012-10-Finder',
        'performSearch',
        searchOptions
      ) as TCSearchResponse;

      const tcObjects = response.objects?.map(obj => convertToTCObject(obj)) || [];
      logger.debug(`[${serviceRequestId}] TeamcenterService.getLastCreatedItems successful: ${tcObjects.length} items found`);
      return { data: tcObjects };
    } catch (error) {
      logger.error(`[${serviceRequestId}] Error fetching last created items:`, error);
      return {
        error: {
          code: 'SEARCH_ERROR',
          level: 'ERROR',
          message: error instanceof Error ? error.message : 'Failed to retrieve items'
        }
      };
    }
  }

  /**
   * Get information about the current session
   * @returns A response containing the session information or an error
   */
  async getSessionInfo(): Promise<TCResponse<any>> {
    const serviceRequestId = `service_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    logger.debug(`[${serviceRequestId}] TeamcenterService.getSessionInfo called`);

    // Check if user is logged in
    if (!this.isLoggedIn()) {
      logger.debug(`[${serviceRequestId}] TeamcenterService.getSessionInfo failed: No session`);
      return this.createNotLoggedInError('getSessionInfo');
    }

    try {
      if (!this.soaClient) {
        throw new AppError(
          'SOA client is not initialized',
          ErrorType.UNKNOWN,
          null,
          { method: 'getSessionInfo' }
        );
      }

      const result = await this.soaClient.callService(
        'Core-2007-01-Session',
        'getTCSessionInfo',
        {}
      );

      logger.debug(`[${serviceRequestId}] TeamcenterService.getSessionInfo successful`);
      return { data: result };
    } catch (error) {
      logger.error(`[${serviceRequestId}] Error getting session info:`, error);
      return {
        error: {
          code: 'SESSION_INFO_ERROR',
          level: 'ERROR',
          message: error instanceof Error ? error.message : 'Failed to retrieve session info'
        }
      };
    }
  }

  /**
   * Get the user's favorite items
   * @returns A response containing the user's favorites or an error
   */
  async getFavorites(): Promise<TCResponse<any>> {
    const serviceRequestId = `service_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    logger.debug(`[${serviceRequestId}] TeamcenterService.getFavorites called`);

    // Check if user is logged in
    if (!this.isLoggedIn()) {
      logger.debug(`[${serviceRequestId}] TeamcenterService.getFavorites failed: No session`);
      return this.createNotLoggedInError('getFavorites');
    }

    try {
      if (!this.soaClient) {
        throw new AppError(
          'SOA client is not initialized',
          ErrorType.UNKNOWN,
          null,
          { method: 'getFavorites' }
        );
      }

      const result = await this.soaClient.callService(
        'Core-2008-03-Session',
        'getFavorites',
        {}
      );

      logger.debug(`[${serviceRequestId}] TeamcenterService.getFavorites successful`);
      return { data: result };
    } catch (error) {
      logger.error(`[${serviceRequestId}] Error getting favorites:`, error);
      return {
        error: {
          code: 'FAVORITES_ERROR',
          level: 'ERROR',
          message: error instanceof Error ? error.message : 'Failed to retrieve favorites'
        }
      };
    }
  }
  
  /**
   * Get available item types in Teamcenter
   * @returns A response containing the item types or an error
   */
  async getItemTypes(): Promise<TCResponse<any>> {
    const serviceRequestId = `service_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    logger.debug(`[${serviceRequestId}] TeamcenterService.getItemTypes called`);
    
    // Check if user is logged in
    if (!this.isLoggedIn()) {
      logger.debug(`[${serviceRequestId}] TeamcenterService.getItemTypes failed: No session`);
      return this.createNotLoggedInError('getItemTypes');
    }
    
    try {
      if (!this.soaClient) {
        throw new AppError(
          'SOA client is not initialized',
          ErrorType.UNKNOWN,
          null,
          { method: 'getItemTypes' }
        );
      }
      
      const result = await this.soaClient.callService(
        'Core-2006-03-BusinessObjectType',
        'getBusinessObjectTypes',
        {}
      );
      
      logger.debug(`[${serviceRequestId}] TeamcenterService.getItemTypes successful`);
      return { data: result };
    } catch (error) {
      logger.error(`[${serviceRequestId}] Error getting item types:`, error);
      return {
        error: {
          code: 'API_ERROR',
          level: 'ERROR',
          message: error instanceof Error ? error.message : 'Failed to get item types'
        }
      };
    }
  }
  
  /**
   * Get details of a specific item by ID
   * @param itemId The ID of the item to get
   * @returns A response containing the item details or an error
   */
  async getItemById(itemId: string): Promise<TCResponse<any>> {
    const serviceRequestId = `service_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    logger.debug(`[${serviceRequestId}] TeamcenterService.getItemById called for item: ${itemId}`);
    
    // Check if user is logged in
    if (!this.isLoggedIn()) {
      logger.debug(`[${serviceRequestId}] TeamcenterService.getItemById failed: No session`);
      return this.createNotLoggedInError('getItemById');
    }
    
    // Validate itemId
    if (!itemId) {
      return {
        error: {
          code: 'INVALID_PARAMETER',
          level: 'ERROR',
          message: 'Item ID is required'
        }
      };
    }
    
    try {
      if (!this.soaClient) {
        throw new AppError(
          'SOA client is not initialized',
          ErrorType.UNKNOWN,
          null,
          { method: 'getItemById' }
        );
      }
      
      const result = await this.soaClient.callService(
        'Core-2006-03-DataManagement',
        'getProperties',
        { uids: [itemId] }
      );
      
      logger.debug(`[${serviceRequestId}] TeamcenterService.getItemById successful for item: ${itemId}`);
      return { data: result };
    } catch (error) {
      logger.error(`[${serviceRequestId}] Error getting item by ID:`, error);
      return {
        error: {
          code: 'API_ERROR',
          level: 'ERROR',
          message: error instanceof Error ? error.message : 'Failed to get item'
        }
      };
    }
  }
  
  /**
   * Search for items in Teamcenter
   * @param query The search query
   * @param type Optional item type to filter by
   * @param limit Maximum number of results to return (default: 10)
   * @returns A response containing the search results or an error
   */
  async searchItems(query: string, type?: string, limit: number = 10): Promise<TCResponse<TCObject[]>> {
    const serviceRequestId = `service_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    logger.debug(`[${serviceRequestId}] TeamcenterService.searchItems called with query: ${query}, type: ${type}, limit: ${limit}`);
    
    // Check if user is logged in
    if (!this.isLoggedIn()) {
      logger.debug(`[${serviceRequestId}] TeamcenterService.searchItems failed: No session`);
      return this.createNotLoggedInError('searchItems');
    }
    
    // Validate parameters
    if (!query) {
      return {
        error: {
          code: 'INVALID_PARAMETER',
          level: 'ERROR',
          message: 'Search query is required'
        }
      };
    }
    
    if (limit <= 0 || limit > 100) {
      return {
        error: {
          code: 'INVALID_PARAMETER',
          level: 'ERROR',
          message: 'Limit must be between 1 and 100'
        }
      };
    }
    
    try {
      if (!this.soaClient) {
        throw new AppError(
          'SOA client is not initialized',
          ErrorType.UNKNOWN,
          null,
          { method: 'searchItems' }
        );
      }
      
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
      
      const result = await this.soaClient.callService(
        'Query-2012-10-Finder',
        'performSearch',
        searchOptions
      ) as TCSearchResponse;
      
      // Convert the results to TCObject format
      const tcObjects = result.objects?.map(obj => convertToTCObject(obj)) || [];
      
      logger.debug(`[${serviceRequestId}] TeamcenterService.searchItems successful: ${tcObjects.length} items found`);
      return { data: tcObjects };
    } catch (error) {
      logger.error(`[${serviceRequestId}] Error searching items:`, error);
      return {
        error: {
          code: 'SEARCH_ERROR',
          level: 'ERROR',
          message: error instanceof Error ? error.message : 'Failed to search items'
        }
      };
    }
  }
  
  /**
   * Create a new item in Teamcenter
   * @param type The type of item to create
   * @param name The name of the item
   * @param description The description of the item
   * @param properties Additional properties for the item
   * @returns A response containing the created item or an error
   */
  async createItem(type: string, name: string, description: string = '', properties: Record<string, any> = {}): Promise<TCResponse<any>> {
    const serviceRequestId = `service_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    logger.debug(`[${serviceRequestId}] TeamcenterService.createItem called with type: ${type}, name: ${name}`);
    
    // Check if user is logged in
    if (!this.isLoggedIn()) {
      logger.debug(`[${serviceRequestId}] TeamcenterService.createItem failed: No session`);
      return this.createNotLoggedInError('createItem');
    }
    
    // Validate parameters
    if (!type || !name) {
      return {
        error: {
          code: 'INVALID_PARAMETER',
          level: 'ERROR',
          message: 'Type and name are required'
        }
      };
    }
    
    try {
      if (!this.soaClient) {
        throw new AppError(
          'SOA client is not initialized',
          ErrorType.UNKNOWN,
          null,
          { method: 'createItem' }
        );
      }
      
      const createData = {
        boName: type,
        data: {
          ...properties,
          object_name: name,
          object_desc: description,
        },
      };
      
      const result = await this.soaClient.callService(
        'Core-2006-03-DataManagement',
        'createObjects',
        { objects: [createData] }
      );
      
      logger.debug(`[${serviceRequestId}] TeamcenterService.createItem successful for item: ${name}`);
      return { data: result };
    } catch (error) {
      logger.error(`[${serviceRequestId}] Error creating item:`, error);
      return {
        error: {
          code: 'CREATE_ERROR',
          level: 'ERROR',
          message: error instanceof Error ? error.message : 'Failed to create item'
        }
      };
    }
  }
  
  /**
   * Update an existing item in Teamcenter
   * @param itemId The ID of the item to update
   * @param properties The properties to update
   * @returns A response containing the updated item or an error
   */
  async updateItem(itemId: string, properties: Record<string, any>): Promise<TCResponse<any>> {
    const serviceRequestId = `service_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    logger.debug(`[${serviceRequestId}] TeamcenterService.updateItem called for item: ${itemId}`);
    
    // Check if user is logged in
    if (!this.isLoggedIn()) {
      logger.debug(`[${serviceRequestId}] TeamcenterService.updateItem failed: No session`);
      return this.createNotLoggedInError('updateItem');
    }
    
    // Validate parameters
    if (!itemId || !properties || Object.keys(properties).length === 0) {
      return {
        error: {
          code: 'INVALID_PARAMETER',
          level: 'ERROR',
          message: 'Item ID and properties are required'
        }
      };
    }
    
    try {
      if (!this.soaClient) {
        throw new AppError(
          'SOA client is not initialized',
          ErrorType.UNKNOWN,
          null,
          { method: 'updateItem' }
        );
      }
      
      const result = await this.soaClient.callService(
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
      
      logger.debug(`[${serviceRequestId}] TeamcenterService.updateItem successful for item: ${itemId}`);
      return { data: result };
    } catch (error) {
      logger.error(`[${serviceRequestId}] Error updating item:`, error);
      return {
        error: {
          code: 'UPDATE_ERROR',
          level: 'ERROR',
          message: error instanceof Error ? error.message : 'Failed to update item'
        }
      };
    }
  }
}

// Export a function to create the TeamcenterService instance
export const createTeamcenterService = () => new TeamcenterService();

// Export singleton instance (will be initialized in index.ts after setting global config)
export let teamcenterService: TeamcenterService;

// Initialize the teamcenterService
export const initTeamcenterService = () => {
  teamcenterService = new TeamcenterService();
  return teamcenterService;
};
