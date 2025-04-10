import { 
  TCCredentials,
  TCSession,
  TCResponse,
  TCSearchOptions,
  TCSearchResponse,
  TCObject
} from './types.js';
import { storeSession, retrieveSession, clearSession } from './tcUtils.js';
import { convertToTCObject } from './tcResponseParser.js';
import { SOAClient, createSOAClient } from './tcSOAClient.js';
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

class TeamcenterService {
  private soaClient: SOAClient | null = null;
  
  // Add missing method declarations
  getItemTypes?: () => Promise<TCResponse<any>>;
  getItemById?: (itemId: string) => Promise<TCResponse<any>>;
  searchItems?: (query: string, type?: string, limit?: number) => Promise<TCResponse<TCObject[]>>;
  createItem?: (type: string, name: string, description: string, properties?: Record<string, any>) => Promise<TCResponse<any>>;
  updateItem?: (itemId: string, properties: Record<string, any>) => Promise<TCResponse<any>>;
  
  constructor() {
    this.initService();
  }
  
  private initService(): void {
    // Restore session if available
    const session = retrieveSession();
    const sessionId = session?.sessionId || null;
    
    // Initialize the SOA client (no mock mode)
    this.soaClient = createSOAClient(getTeamcenterConfig(), sessionId);
    
    if (sessionId) {
      logger.info('Teamcenter session restored from stored cookie');
    }
  }

  async login(credentials: TCCredentials): Promise<TCResponse<TCSession>> {
    try {
      if (!this.soaClient) {
        throw new Error('SOA client is not initialized');
      }
    
      // Directly pass username and password to match the expected structure in createJSONRequest
      const session = await this.soaClient.callService(
        'Core-2011-06-Session',
        'login',
        credentials
      ) as TCSession;
      
      // Store session
      storeSession(session);
      
      return { data: session };
    } catch (error) {
      logger.error('Teamcenter login error:', error);
      return {
        error: {
          code: 'LOGIN_ERROR',
          level: 'ERROR',
          message: error instanceof Error ? error.message : 'Login failed'
        }
      };
    }
  }

  async getUserOwnedItems(): Promise<TCResponse<TCObject[]>> {
    if (!this.soaClient?.sessionId) {
      return {
        error: {
          code: 'NO_SESSION',
          level: 'ERROR',
          message: 'User is not logged in'
        }
      };
    }

    try {
      if (!this.soaClient) {
        throw new Error('SOA client is not initialized');
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
      return { data: tcObjects };
    } catch (error) {
      logger.error('Error fetching user owned items:', error);
      return {
        error: {
          code: 'SEARCH_ERROR',
          level: 'ERROR',
          message: error instanceof Error ? error.message : 'Failed to retrieve items'
        }
      };
    }
  }

  async getLastCreatedItems(limit: number = 10): Promise<TCResponse<TCObject[]>> {
    if (!this.soaClient?.sessionId) {
      return {
        error: {
          code: 'NO_SESSION',
          level: 'ERROR',
          message: 'User is not logged in'
        }
      };
    }

    try {
      if (!this.soaClient) {
        throw new Error('SOA client is not initialized');
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
      return { data: tcObjects };
    } catch (error) {
      logger.error('Error fetching last created items:', error);
      return {
        error: {
          code: 'SEARCH_ERROR',
          level: 'ERROR',
          message: error instanceof Error ? error.message : 'Failed to retrieve items'
        }
      };
    }
  }

  isLoggedIn(): boolean {
    return this.soaClient?.sessionId !== null && this.soaClient?.sessionId !== undefined;
  }

  async logout(): Promise<TCResponse<void>> {
    if (!this.soaClient?.sessionId) {
      return { data: undefined };
    }

    try {
      if (!this.soaClient) {
        throw new Error('SOA client is not initialized');
      }
      
      await this.soaClient.callService(
        'Core-2007-06-Session',
        'logout',
        {}
      );
      
      // Clear session
      clearSession();
      this.soaClient.sessionId = null;
      
      return { data: undefined };
    } catch (error) {
      logger.error('Teamcenter logout error:', error);
      return {
        error: {
          code: 'LOGOUT_ERROR',
          level: 'ERROR',
          message: error instanceof Error ? error.message : 'Logout failed'
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
