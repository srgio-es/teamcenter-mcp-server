
import { TCSOAClientConfig, TCSession } from './types.js';
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

// Constants
export const SESSION_STORAGE_KEY = 'tc_session'; // Kept for backward compatibility

// Cookie names for session persistence
export const JSESSIONID_COOKIE = 'JSESSIONID';
export const ASPNET_SESSIONID_COOKIE = 'ASP.NET_SessionId';

// In-memory storage for Node.js environment
let memoryStorage: Record<string, string> = {};

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
const hasCookieSupport = typeof document !== 'undefined' && typeof document.cookie !== 'undefined';

/**
 * Get a cookie value by name
 * @param name The name of the cookie to retrieve
 * @returns The cookie value or null if not found
 */
export const getCookie = (name: string): string | null => {
  if (!hasCookieSupport) {
    return null;
  }
  
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [cookieName, cookieValue] = cookie.trim().split('=');
    if (cookieName === name) {
      return cookieValue;
    }
  }
  return null;
};

/**
 * Set a cookie with the given name and value
 * @param name The name of the cookie
 * @param value The value to store
 * @param path The cookie path (default: '/')
 * @param maxAge The cookie max age in seconds (default: session cookie)
 */
export const setCookie = (name: string, value: string, path: string = '/', maxAge?: number): void => {
  if (!hasCookieSupport) {
    return;
  }
  
  let cookieStr = `${name}=${value}; path=${path}`;
  if (maxAge !== undefined) {
    cookieStr += `; max-age=${maxAge}`;
  }
  
  document.cookie = cookieStr;
};

/**
 * Delete a cookie by setting its expiration to the past
 * @param name The name of the cookie to delete
 * @param path The cookie path (default: '/')
 */
export const deleteCookie = (name: string, path: string = '/'): void => {
  if (!hasCookieSupport) {
    return;
  }
  
  document.cookie = `${name}=; path=${path}; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
};

/**
 * Store the Teamcenter session in cookies or memory in Node.js
 * @param session The session object to store
 */
export const storeSession = (session: TCSession): void => {
  try {
    // Store the session ID in the appropriate cookie if in browser environment
    if (hasCookieSupport) {
      // Check if we already have a JSESSIONID or ASP.NET_SessionId cookie
      const jsessionId = getCookie(JSESSIONID_COOKIE);
      const aspNetSessionId = getCookie(ASPNET_SESSIONID_COOKIE);
      
      // If we have a JSESSIONID cookie, update it with the session ID
      if (jsessionId) {
        setCookie(JSESSIONID_COOKIE, session.sessionId);
        logger.debug('Updated JSESSIONID cookie with session ID');
      }
      
      // If we have an ASP.NET_SessionId cookie, update it with the session ID
      if (aspNetSessionId) {
        setCookie(ASPNET_SESSIONID_COOKIE, session.sessionId);
        logger.debug('Updated ASP.NET_SessionId cookie with session ID');
      }
      
      // If we don't have either cookie, set both to ensure compatibility
      if (!jsessionId && !aspNetSessionId) {
        setCookie(JSESSIONID_COOKIE, session.sessionId);
        setCookie(ASPNET_SESSIONID_COOKIE, session.sessionId);
        logger.debug('Created session cookies for both JSESSIONID and ASP.NET_SessionId');
      }
      
      // For backward compatibility, also store in sessionStorage
      if (isBrowser) {
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
        logger.debug('Teamcenter session also stored in browser sessionStorage for backward compatibility');
      }
    } else if (isBrowser) {
      // Fallback to sessionStorage if cookies are not available
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      logger.debug('Teamcenter session stored in browser sessionStorage (cookies not available)');
    } else {
      // Fallback to memory storage for Node.js
      memoryStorage[SESSION_STORAGE_KEY] = JSON.stringify(session);
      logger.debug('Teamcenter session stored in memory (Node.js environment)');
    }
  } catch (error) {
    logger.error('Failed to store Teamcenter session:', error);
    // Non-critical error, so we don't throw
  }
};

/**
 * Retrieve the Teamcenter session from cookies, sessionStorage, or memory in Node.js
 * @returns The session object or null if not found or invalid
 */
export const retrieveSession = (): TCSession | null => {
  // First try to get session ID from cookies
  if (hasCookieSupport) {
    const jsessionId = getCookie(JSESSIONID_COOKIE);
    const aspNetSessionId = getCookie(ASPNET_SESSIONID_COOKIE);
    
    // If we have a session ID from cookies, construct a minimal session object
    if (jsessionId || aspNetSessionId) {
      const sessionId = jsessionId || aspNetSessionId;
      
      // Ensure sessionId is not null (TypeScript safety)
      if (sessionId) {
        logger.debug(`Teamcenter session ID found in cookies: ${sessionId}`);
        
        // Try to get the full session from sessionStorage for additional info
        let fullSession: TCSession | null = null;
        
        if (isBrowser) {
          const storedSession = sessionStorage.getItem(SESSION_STORAGE_KEY);
          if (storedSession) {
            try {
              fullSession = JSON.parse(storedSession) as TCSession;
            } catch (error) {
              logger.warn('Failed to parse stored session from sessionStorage:', error);
            }
          }
        } else {
          const storedSession = memoryStorage[SESSION_STORAGE_KEY] || null;
          if (storedSession) {
            try {
              fullSession = JSON.parse(storedSession) as TCSession;
            } catch (error) {
              logger.warn('Failed to parse stored session from memory:', error);
            }
          }
        }
        
        // If we have a full session and the session IDs match, return it
        if (fullSession && fullSession.sessionId === sessionId) {
          logger.debug('Full Teamcenter session restored from storage');
          return fullSession;
        }
        
        // Otherwise, return a minimal session object with just the session ID
        logger.debug('Created minimal Teamcenter session from cookie');
        return {
          sessionId: sessionId,
          userId: '',
          userName: ''
        };
      }
    }
  }
  
  // Fallback to sessionStorage or memory storage
  let storedSession: string | null = null;
  
  if (isBrowser) {
    storedSession = sessionStorage.getItem(SESSION_STORAGE_KEY);
  } else {
    storedSession = memoryStorage[SESSION_STORAGE_KEY] || null;
  }
  
  if (!storedSession) {
    logger.debug('No Teamcenter session found in storage');
    return null;
  }
  
  try {
    const session = JSON.parse(storedSession) as TCSession;
    logger.debug('Teamcenter session restored from storage');
    return session;
  } catch (error) {
    logger.error('Failed to parse stored Teamcenter session:', error);
    // Clear the invalid session data
    clearSession();
    return null;
  }
};

/**
 * Clear the Teamcenter session from cookies, sessionStorage, or memory in Node.js
 */
export const clearSession = (): void => {
  // Clear cookies if in browser environment
  if (hasCookieSupport) {
    deleteCookie(JSESSIONID_COOKIE);
    deleteCookie(ASPNET_SESSIONID_COOKIE);
    logger.debug('Teamcenter session cookies cleared');
  }
  
  // Also clear sessionStorage for backward compatibility
  if (isBrowser) {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    logger.debug('Teamcenter session cleared from browser sessionStorage');
  } else {
    delete memoryStorage[SESSION_STORAGE_KEY];
    logger.debug('Teamcenter session cleared from memory (Node.js environment)');
  }
};

/**
 * Validate a Teamcenter session object
 * @param session The session object to validate
 * @returns True if the session is valid, false otherwise
 */
export const isValidSession = (session: TCSession | null): boolean => {
  if (!session) return false;
  
  // Check for required fields
  if (!session.sessionId || !session.userId) {
    logger.debug('Invalid session: missing required fields');
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
        clientID: "ActiveWorkspaceClient"
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
      // Extract credentials from params, ensuring we get the original values from the login form
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
          descrimator: `TcWeb_${Date.now()}_${Math.random().toString(36).substring(7)}` // Unique discriminator with prefix
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
