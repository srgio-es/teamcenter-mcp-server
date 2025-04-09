import { realCallService } from './tcApiService.js';
export const createSOAClient = (config, initialSessionId = null) => {
    let sessionId = initialSessionId;
    return {
        config,
        get sessionId() {
            return sessionId;
        },
        set sessionId(value) {
            sessionId = value;
        },
        // Service call method that routes to the real implementation
        callService: async (service, operation, params) => {
            try {
                const result = await realCallService(config, sessionId, service, operation, params);
                // Handle response to extract session ID if available
                if (typeof result === 'object' && result !== null) {
                    const resultObj = result;
                    // Update session ID if provided in the response
                    if (resultObj.sessionId) {
                        sessionId = resultObj.sessionId;
                        console.log('Session ID updated:', sessionId);
                    }
                    // Return just the data part for consistency
                    return resultObj.data;
                }
                return result;
            }
            catch (error) {
                console.error(`SOA client error (${service}.${operation}):`, error);
                throw error;
            }
        }
    };
};
//# sourceMappingURL=tcSOAClient.js.map