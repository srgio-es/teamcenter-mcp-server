
import { TCSOAClientConfig } from './types.js';
import { realCallService } from './tcApiService.js';

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

  return {
    config,
    
    get sessionId() {
      return sessionId;
    },
    
    set sessionId(value: string | null) {
      sessionId = value;
    },
    
    // Service call method that routes to the real implementation
    callService: async (service: string, operation: string, params: unknown): Promise<unknown> => {
      try {
        const result = await realCallService(config, sessionId, service, operation, params);
        
        // Handle response to extract session ID if available
        if (typeof result === 'object' && result !== null) {
          const resultObj = result as { 
            data: any; 
            headers?: Headers;
            sessionId?: string | null;
          };
          
          // Update session ID if provided in the response
          if (resultObj.sessionId) {
            sessionId = resultObj.sessionId;
            console.log('Session ID updated:', sessionId);
          }
          
          // Return just the data part for consistency
          return resultObj.data;
        }
        
        return result;
      } catch (error) {
        console.error(`SOA client error (${service}.${operation}):`, error);
        throw error;
      }
    }
  };
};
