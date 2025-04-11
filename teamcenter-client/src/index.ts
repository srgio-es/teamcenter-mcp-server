/**
 * Teamcenter Client
 * A client library for interacting with Teamcenter PLM systems
 */

// Export logger interface and default implementation
export { Logger, createDefaultLogger } from './logger.js';

// Export main service
export { TeamcenterService, createTeamcenterService } from './teamcenterService.js';

// Export SOA client
export { SOAClient, createSOAClient } from './tcSOAClient.js';

// Export types
export {
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
  TeamcenterServiceOptions
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
export { realCallService } from './tcApiService.js';

// Export mock service
export { mockCallService } from './tcMockService.js';
