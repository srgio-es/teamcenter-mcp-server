/**
 * Logger interface for Teamcenter client
 * Allows consumers to provide their own logging implementation
 */
export interface Logger {
  error(message: string, ...meta: any[]): void;
  warn(message: string, ...meta: any[]): void;
  info(message: string, ...meta: any[]): void;
  debug(message: string, ...meta: any[]): void;
  logTeamcenterRequest(service: string, operation: string, params: unknown, requestId?: string): string;
  logTeamcenterResponse(service: string, operation: string, response: unknown, requestId: string, error?: Error): void;
}

/**
 * Create a default logger that logs to console
 * Used when no logger is provided
 */
export const createDefaultLogger = (): Logger => ({
  error: (message, ...meta) => console.error(message, ...meta),
  warn: (message, ...meta) => console.warn(message, ...meta),
  info: (message, ...meta) => console.info(message, ...meta),
  debug: (message, ...meta) => console.debug(message, ...meta),
  
  logTeamcenterRequest: (service, operation, params, requestId) => {
    const reqId = requestId || `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    // Mask sensitive data like passwords
    const sanitizedParams = JSON.parse(JSON.stringify(params || {}));
    if (service === 'Core-2011-06-Session' && operation === 'login') {
      if (sanitizedParams.credentials?.password) {
        sanitizedParams.credentials.password = '***';
      } else if (sanitizedParams.password) {
        sanitizedParams.password = '***';
      } else if (sanitizedParams.body?.credentials?.password) {
        sanitizedParams.body.credentials.password = '***';
      }
    }
    
    console.info(`[${reqId}] TC REQUEST: ${service}.${operation}`, { params: sanitizedParams });
    return reqId;
  },
  
  logTeamcenterResponse: (service, operation, response, requestId, error) => {
    if (error) {
      console.error(`[${requestId}] TC RESPONSE ERROR: ${service}.${operation}`, { error: error.message, stack: error.stack });
    } else {
      console.info(`[${requestId}] TC RESPONSE: ${service}.${operation}`, { response });
    }
  }
});
