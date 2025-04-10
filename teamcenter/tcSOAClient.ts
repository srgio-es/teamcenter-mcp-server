
import { TCSOAClientConfig } from './types.js';
import { realCallService } from './tcApiService.js';
import { mockCallService } from './tcMockService.js';
import { storeSessionCookie, getSessionCookie } from './tcUtils.js';
import logger from '../logger.js';

export interface SOAClient {
  config: TCSOAClientConfig;
  sessionId: string | null;
  callService: (service: string, operation: string, params: unknown) => Promise<unknown>;
}

export const createSOAClient = (
  config: TCSOAClientConfig, 
  initialSessionId: string | null = null
): SOAClient => {
  let sessionId = initialSessionId;
  
  // If we have a session cookie but no initialSessionId, use the cookie value
  if (!initialSessionId) {
    const cookie = getSessionCookie();
    if (cookie) {
      sessionId = cookie.value;
      logger.debug(`Using session ID from cookie: ${sessionId}`);
    }
  }

  return {
    config,
    
    get sessionId() {
      return sessionId;
    },
    
    set sessionId(value: string | null) {
      sessionId = value;
      
      // When sessionId is updated, also update the session cookie
      // But only if we don't already have a cookie
      if (value) {
        const existingCookie = getSessionCookie();
        if (!existingCookie) {
          // Determine which cookie name to use (ASP.NET_SessionId by default)
          const cookieName = 'ASP.NET_SessionId';
          storeSessionCookie(cookieName, value);
          logger.debug(`Updated session cookie: ${cookieName}=${value}`);
        } else {
          logger.debug(`Not updating cookie, using existing: ${existingCookie.name}=${existingCookie.value}`);
        }
      }
    },
    
    // Service call method that routes to the real or mock implementation
    callService: async (service: string, operation: string, params: unknown): Promise<unknown> => {
      // Generate a unique request ID for client-level tracing
      const clientRequestId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      logger.debug(`[${clientRequestId}] SOA client call: ${service}.${operation}`);
      
      try {
        // Use mock service if mockMode is enabled
        const result = config.mockMode 
          ? await mockCallService(service, operation, params)
          : await realCallService(config, sessionId, service, operation, params);
        
        // Handle response to extract session ID if available
        if (typeof result === 'object' && result !== null) {
          const resultObj = result as { 
            data: any; 
            headers?: Headers;
            sessionId?: string | null;
          };
          
          // For login operations, we need to handle the session ID differently
          if (service === 'Core-2011-06-Session' && operation === 'login') {
            // The cookie from the Set-Cookie header has already been stored by tcApiService.ts
            // We should NOT overwrite it with the sessionId from the response body
            const cookie = getSessionCookie();
            if (cookie) {
              // Use the cookie value as the session ID, not the one from the response
              sessionId = cookie.value;
              logger.debug(`[${clientRequestId}] Using session ID from cookie: ${sessionId}`);
            } else if (resultObj.sessionId) {
              // Only if no cookie was set, fall back to the sessionId from the response
              sessionId = resultObj.sessionId;
              logger.debug(`[${clientRequestId}] No cookie found, using session ID from response: ${sessionId}`);
            }
          } else if (resultObj.sessionId && !sessionId) {
            // For non-login operations, only update the session ID if we don't have one yet
            sessionId = resultObj.sessionId;
            logger.debug(`[${clientRequestId}] Session ID updated: ${sessionId}`);
          }
          
          logger.debug(`[${clientRequestId}] SOA client response received for: ${service}.${operation}`);
          
          // Return just the data part for consistency
          return resultObj.data;
        }
        
        logger.debug(`[${clientRequestId}] SOA client response received for: ${service}.${operation}`);
        return result;
      } catch (error) {
        logger.error(`[${clientRequestId}] SOA client error (${service}.${operation}):`, error);
        throw error;
      }
    }
  };
};
