import { 
  TCCredentials,
  TCSession,
  TCResponse,
  TCObject,
  TeamcenterConfig,
  TeamcenterServiceOptions,
  ITeamcenterService
} from './types.js';
import { retrieveSession, isValidSession } from './tcUtils.js';
import { SOAClient, createSOAClient } from './tcSOAClient.js';
import { Logger, createDefaultLogger } from './logger.js';
import { CommandExecutor } from './commands/CommandExecutor.js';
import { LoginCommand } from './commands/auth/LoginCommand.js';
import { LogoutCommand } from './commands/auth/LogoutCommand.js';
import { GetItemByIdCommand } from './commands/item/GetItemByIdCommand.js';
import { CreateItemCommand } from './commands/item/CreateItemCommand.js';
import { UpdateItemCommand } from './commands/item/UpdateItemCommand.js';
import { SearchItemsCommand } from './commands/search/SearchItemsCommand.js';
import { GetUserOwnedItemsCommand } from './commands/search/GetUserOwnedItemsCommand.js';
import { GetLastCreatedItemsCommand } from './commands/search/GetLastCreatedItemsCommand.js';
import { GetUserPropertiesCommand } from './commands/user/GetUserPropertiesCommand.js';
import { GetLoggedUserPropertiesCommand } from './commands/user/GetLoggedUserPropertiesCommand.js';
import { GetSessionInfoCommand } from './commands/session/GetSessionInfoCommand.js';
import { GetFavoritesCommand } from './commands/session/GetFavoritesCommand.js';
import { GetItemTypesCommand } from './commands/item/GetItemTypesCommand.js';

/**
 * TeamcenterService class provides a unified interface for interacting with Teamcenter
 * It handles session management, error handling, and provides a consistent API
 * This implementation uses the Command pattern to organize operations
 */
export class TeamcenterService implements ITeamcenterService {
  private soaClient: SOAClient | null = null;
  private sessionInfo: TCSession | null = null;
  private logger: Logger;
  private config: TeamcenterConfig;
  private commandExecutor: CommandExecutor;
  
  /**
   * Create a new TeamcenterService instance
   * @param options Configuration options for the service
   */
  constructor(options: TeamcenterServiceOptions) {
    this.logger = options.logger || createDefaultLogger();
    this.config = options.config;
    this.commandExecutor = new CommandExecutor(this.logger);
    this.initService();
  }
  
  /**
   * Initialize the service by restoring session and creating SOA client
   */
  private initService(): void {
    try {
      // Restore session if available
      const session = retrieveSession(this.logger);
      const sessionId = session?.sessionId || null;
      
      // Initialize the SOA client
      this.soaClient = createSOAClient(this.config, sessionId, this.logger);
      this.sessionInfo = session;
      
      if (sessionId && isValidSession(session, this.logger)) {
        this.logger.info('Teamcenter session restored from stored cookie');
      } else if (sessionId) {
        this.logger.warn('Found session ID but session data is incomplete');
      }
    } catch (error) {
      this.logger.error('Error initializing Teamcenter service:', error);
      // Create SOA client without session
      this.soaClient = createSOAClient(this.config, null, this.logger);
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
   * Login to Teamcenter with the provided credentials
   * @param credentials The credentials to use for login
   * @returns A response containing the session information or an error
   */
  async login(credentials: TCCredentials): Promise<TCResponse<TCSession>> {
    const command = new LoginCommand(this.logger, this.soaClient, this.isLoggedIn(), credentials);
    const response = await this.commandExecutor.execute(command);
    
    // Update session info if login was successful
    if (response.data) {
      this.sessionInfo = response.data;
    }
    
    return response;
  }

  /**
   * Logout from Teamcenter
   * @returns A response indicating success or an error
   */
  async logout(): Promise<TCResponse<void>> {
    const command = new LogoutCommand(this.logger, this.soaClient, this.isLoggedIn());
    const response = await this.commandExecutor.execute(command);
    
    // Clear session info if logout was successful or even if it failed
    this.sessionInfo = null;
    
    return response;
  }

  /**
   * Get items owned by the current user
   * @returns A response containing the user's items or an error
   */
  async getUserOwnedItems(): Promise<TCResponse<TCObject[]>> {
    const command = new GetUserOwnedItemsCommand(this.logger, this.soaClient, this.isLoggedIn());
    return await this.commandExecutor.execute(command);
  }

  /**
   * Get the most recently created items
   * @param limit Maximum number of items to return (default: 10)
   * @returns A response containing the recently created items or an error
   */
  async getLastCreatedItems(limit: number = 10): Promise<TCResponse<TCObject[]>> {
    const command = new GetLastCreatedItemsCommand(this.logger, this.soaClient, this.isLoggedIn(), limit);
    return await this.commandExecutor.execute(command);
  }

  /**
   * Get information about the current session
   * @returns A response containing the session information or an error
   */
  async getSessionInfo(): Promise<TCResponse<any>> {
    const command = new GetSessionInfoCommand(this.logger, this.soaClient, this.isLoggedIn());
    return await this.commandExecutor.execute(command);
  }

  /**
   * Get the user's favorite items
   * @returns A response containing the user's favorites or an error
   */
  async getFavorites(): Promise<TCResponse<any>> {
    const command = new GetFavoritesCommand(this.logger, this.soaClient, this.isLoggedIn());
    return await this.commandExecutor.execute(command);
  }

  /**
   * Get user properties from Teamcenter
   * @param uid The UID of the user to get properties for
   * @param attributes Optional array of specific attributes to retrieve (defaults to a standard set if not provided)
   * @returns A response containing the user properties or an error
   */
  async getUserProperties(uid: string, attributes?: string[]): Promise<TCResponse<any>> {
    const command = new GetUserPropertiesCommand(this.logger, this.soaClient, this.isLoggedIn(), uid, attributes);
    return await this.commandExecutor.execute(command);
  }

  /**
   * Get properties of the currently logged-in user
   * @param attributes Optional array of specific attributes to retrieve
   * @returns A response containing the current user's properties or an error
   */
  async getLoggedUserProperties(attributes?: string[]): Promise<TCResponse<any>> {
    const command = new GetLoggedUserPropertiesCommand(this.logger, this.soaClient, this.isLoggedIn(), attributes);
    return await this.commandExecutor.execute(command);
  }
  
  /**
   * Get available item types in Teamcenter
   * @returns A response containing the item types or an error
   */
  async getItemTypes(): Promise<TCResponse<any>> {
    const command = new GetItemTypesCommand(this.logger, this.soaClient, this.isLoggedIn());
    return await this.commandExecutor.execute(command);
  }
  
  /**
   * Get details of a specific item by ID
   * @param itemId The ID of the item to get
   * @returns A response containing the item details or an error
   */
  async getItemById(itemId: string): Promise<TCResponse<any>> {
    const command = new GetItemByIdCommand(this.logger, this.soaClient, this.isLoggedIn(), itemId);
    return await this.commandExecutor.execute(command);
  }
  
  /**
   * Search for items in Teamcenter
   * @param query The search query
   * @param type Optional item type to filter by
   * @param limit Maximum number of results to return (default: 10)
   * @returns A response containing the search results or an error
   */
  async searchItems(query: string, type?: string, limit: number = 10): Promise<TCResponse<TCObject[]>> {
    const command = new SearchItemsCommand(this.logger, this.soaClient, this.isLoggedIn(), query, type, limit);
    return await this.commandExecutor.execute(command);
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
    const command = new CreateItemCommand(this.logger, this.soaClient, this.isLoggedIn(), type, name, description, properties);
    return await this.commandExecutor.execute(command);
  }
  
  /**
   * Update an existing item in Teamcenter
   * @param itemId The ID of the item to update
   * @param properties The properties to update
   * @returns A response containing the updated item or an error
   */
  async updateItem(itemId: string, properties: Record<string, any>): Promise<TCResponse<any>> {
    const command = new UpdateItemCommand(this.logger, this.soaClient, this.isLoggedIn(), itemId, properties);
    return await this.commandExecutor.execute(command);
  }
}

/**
 * Create a new TeamcenterService instance
 * @param options Configuration options for the service
 * @returns A new TeamcenterService instance
 */
export const createTeamcenterService = (options: TeamcenterServiceOptions): ITeamcenterService => {
  return new TeamcenterService(options);
};
