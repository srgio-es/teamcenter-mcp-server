
import { TCSession } from './types.js';
import logger from '../logger.js';

// Simple error handling to replace @/utils/errorHandler
enum ErrorType {
  DATA_VALIDATION = 'DATA_VALIDATION',
  DATA_PARSING = 'DATA_PARSING',
  API_RESPONSE = 'API_RESPONSE',
  API_TIMEOUT = 'API_TIMEOUT',
  AUTH_SESSION = 'AUTH_SESSION',
  NETWORK = 'NETWORK',
  UNKNOWN = 'UNKNOWN'
}

class AppError extends Error {
  constructor(
    message: string,
    public type: ErrorType,
    public originalError: Error | null,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

const handleDataError = (error: unknown, context: string): AppError => {
  if (error instanceof AppError) {
    return error;
  }
  
  return new AppError(
    `Data error in ${context}: ${error instanceof Error ? error.message : String(error)}`,
    ErrorType.DATA_PARSING,
    error instanceof Error ? error : null,
    { context }
  );
};

// Cookie names for session persistence
export const JSESSIONID_COOKIE = 'JSESSIONID';
export const ASPNET_SESSIONID_COOKIE = 'ASP.NET_SessionId';

// Session cookie storage for Node.js environment
interface SessionCookie {
  name: string;
  value: string;
}

// Store the session cookie (either JSESSIONID or ASP.NET_SessionId)
let sessionCookie: SessionCookie | null = null;

/**
 * Store the session cookie value
 * @param name The cookie name (JSESSIONID or ASP.NET_SessionId)
 * @param value The cookie value
 */
export const storeSessionCookie = (name: string, value: string): void => {
  sessionCookie = { name, value };
  logger.debug(`Stored ${name} cookie with value: ${value}`);
};

/**
 * Get the stored session cookie
 * @returns The session cookie object or null if not set
 */
export const getSessionCookie = (): SessionCookie | null => {
  return sessionCookie;
};

/**
 * Clear the stored session cookie
 */
export const clearSessionCookie = (): void => {
  sessionCookie = null;
  logger.debug('Session cookie cleared');
};

/**
 * Store the Teamcenter session
 * @param session The session object to store
 */
export const storeSession = (session: TCSession): void => {
  try {
    // Store the session ID in memory
    if (session.sessionId) {
      // Determine which cookie name to use based on the server type
      // This is a heuristic - we'll prefer ASP.NET_SessionId by default
      // but could be configured based on server response headers
      const cookieName = ASPNET_SESSIONID_COOKIE;
      storeSessionCookie(cookieName, session.sessionId);
      logger.debug(`Stored session ID as ${cookieName}`);
    }
  } catch (error) {
    logger.error('Failed to store Teamcenter session:', error);
    // Non-critical error, so we don't throw
  }
};

/**
 * Retrieve the Teamcenter session
 * @returns The session object or null if not found
 */
export const retrieveSession = (): TCSession | null => {
  // Get the session cookie
  const cookie = getSessionCookie();
  
  if (!cookie) {
    logger.debug('No session cookie found');
    return null;
  }
  
  logger.debug(`Found session cookie: ${cookie.name}=${cookie.value}`);
  
  // Create a minimal session object with just the session ID
  return {
    sessionId: cookie.value,
    userId: '',
    userName: ''
  };
};

/**
 * Clear the Teamcenter session
 */
export const clearSession = (): void => {
  clearSessionCookie();
  logger.debug('Teamcenter session cleared');
};

/**
 * Validate a Teamcenter session object
 * @param session The session object to validate
 * @returns True if the session is valid, false otherwise
 */
export const isValidSession = (session: TCSession | null): boolean => {
  if (!session) return false;
  
  // For our simplified session management, we only need the sessionId
  if (!session.sessionId) {
    logger.debug('Invalid session: missing sessionId');
    return false;
  }
  
  return true;
};

/**
 * Create proper request envelope for Teamcenter API
 * @param service The service name
 * @param operation The operation name
 * @param params The operation parameters
 * @returns The formatted request envelope
 */
export const createJSONRequest = (service: string, operation: string, params: unknown): Record<string, unknown> => {
  try {
    // Create the standard header object
    const header = {
      state: {
        stateless: true,
        unloadObjects: true,
        enableServerStateHeaders: true,
        formatProperties: true,
        clientID: "NodeJsTeamcenterClient"
      },
      policy: {}
    };
    
    // Create the envelope structure with header and body
    let requestEnvelope: Record<string, unknown> = {
      header: header,
      body: {}
    };
    
    // Handle specific operations
    if (service === 'Core-2011-06-Session' && operation === 'login') {
      // Extract credentials from params
      const credentials = params as { username: string; password: string };
      
      if (!credentials.username || !credentials.password) {
        throw new AppError(
          'Missing username or password for login',
          ErrorType.DATA_VALIDATION,
          null,
          { service, operation }
        );
      }
      
      logger.debug('Creating login request for user:', credentials.username);
      
      requestEnvelope.body = {
        credentials: {
          user: credentials.username,
          password: credentials.password,
          group: "",
          role: "",
          locale: "en_US",
          descrimator: `NodeJs_${Date.now()}_${Math.random().toString(36).substring(7)}` // Unique discriminator with prefix
        }
      };
    } else if (service === 'Core-2007-06-Session' && operation === 'logout') {
      // Empty body for logout
      requestEnvelope.body = {};
      logger.debug('Creating logout request');
    } else if (service === 'Query-2012-10-Finder' && operation === 'performSearch') {
      // Add the search parameters to the body
      requestEnvelope.body = params;
      logger.debug('Creating search request');
    } else {
      // For other operations, put the params directly in the body
      requestEnvelope.body = params;
      logger.debug(`Creating request for ${service}.${operation}`);
    }
    
    // Debug logging for request envelope (with password masking)
    const debugEnvelope = JSON.parse(JSON.stringify(requestEnvelope));
    if (service === 'Core-2011-06-Session' && operation === 'login' && 
        debugEnvelope.body?.credentials?.password) {
      debugEnvelope.body.credentials.password = '***';
    }
    logger.debug('Request envelope:', debugEnvelope);
    
    return requestEnvelope;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    } else {
      throw handleDataError(error, 'request envelope');
    }
  }
};
