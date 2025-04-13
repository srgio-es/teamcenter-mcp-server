/**
 * Teamcenter Client
 * A client library for interacting with Teamcenter PLM systems
 */

// Export logger interface and default implementation
export type { Logger } from './logger.js';
export { createDefaultLogger } from './logger.js';

// Export main service
export { TeamcenterService, createTeamcenterService } from './teamcenterService.js';

// Export SOA client
export type { SOAClient } from './tcSOAClient.js';
export { createSOAClient } from './tcSOAClient.js';

// Export Command pattern classes
export type { Command } from './commands/Command.js';
export { BaseCommand } from './commands/Command.js';
export { CommandExecutor } from './commands/CommandExecutor.js';

// Export Auth commands
export { LoginCommand } from './commands/auth/LoginCommand.js';
export { LogoutCommand } from './commands/auth/LogoutCommand.js';

// Export Session commands
export { GetSessionInfoCommand } from './commands/session/GetSessionInfoCommand.js';
export { GetFavoritesCommand } from './commands/session/GetFavoritesCommand.js';

// Export User commands
export { GetUserPropertiesCommand } from './commands/user/GetUserPropertiesCommand.js';
export { GetLoggedUserPropertiesCommand } from './commands/user/GetLoggedUserPropertiesCommand.js';

// Export Item commands
export { GetItemTypesCommand } from './commands/item/GetItemTypesCommand.js';
export { GetItemByIdCommand } from './commands/item/GetItemByIdCommand.js';
export { CreateItemCommand } from './commands/item/CreateItemCommand.js';
export { UpdateItemCommand } from './commands/item/UpdateItemCommand.js';

// Export Search commands
export { SearchItemsCommand } from './commands/search/SearchItemsCommand.js';
export { GetUserOwnedItemsCommand } from './commands/search/GetUserOwnedItemsCommand.js';
export { GetLastCreatedItemsCommand } from './commands/search/GetLastCreatedItemsCommand.js';

// Export types
export type {
  TCCredentials,
  TCSession,
  TCResponse,
  TCSearchOptions,
  TCSearchResponse,
  TCObject,
  TCItem,
  TCItemRevision,
  TCDataset,
  TCSOAClientConfig,
  TeamcenterConfig,
  TeamcenterServiceOptions,
  ITeamcenterService
} from './types.js';

// Export utility functions
export {
  storeSessionCookie,
  getSessionCookie,
  clearSessionCookie,
  storeSession,
  retrieveSession,
  clearSession,
  isValidSession,
  createJSONRequest
} from './tcUtils.js';

// Export error handling
export {
  AppError,
  ErrorType,
  handleApiError,
  handleDataError,
  handleAuthError,
  handleNetworkError,
  logError
} from './tcErrors.js';

// Export response parser
export {
  parseJSONResponse,
  convertToTCObject,
  getPropertyValue
} from './tcResponseParser.js';

// Export API service
export { callService } from './tcApiService.js';

// Export mock service
export { mockCallService } from './tcMockService.js';
