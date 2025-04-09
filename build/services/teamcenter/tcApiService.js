import { createJSONRequest } from './tcUtils.js';
import { parseJSONResponse } from './tcResponseParser.js';
// Simple logger implementation to replace @/utils/logger
const logger = {
    debug: (message, ...args) => console.debug(`[DEBUG] ${message}`, ...args),
    info: (message, ...args) => console.info(`[INFO] ${message}`, ...args),
    warn: (message, ...args) => console.warn(`[WARN] ${message}`, ...args),
    error: (message, ...args) => console.error(`[ERROR] ${message}`, ...args)
};
// Simple error handling to replace @/utils/errorHandler
var ErrorType;
(function (ErrorType) {
    ErrorType["DATA_VALIDATION"] = "DATA_VALIDATION";
    ErrorType["DATA_PARSING"] = "DATA_PARSING";
    ErrorType["API_RESPONSE"] = "API_RESPONSE";
    ErrorType["API_TIMEOUT"] = "API_TIMEOUT";
    ErrorType["AUTH_SESSION"] = "AUTH_SESSION";
    ErrorType["NETWORK"] = "NETWORK";
    ErrorType["UNKNOWN"] = "UNKNOWN";
})(ErrorType || (ErrorType = {}));
class AppError extends Error {
    constructor(message, type, originalError, context) {
        super(message);
        this.type = type;
        this.originalError = originalError;
        this.context = context;
        this.name = 'AppError';
    }
}
const handleApiError = (error, context) => {
    if (error instanceof AppError) {
        return error;
    }
    return new AppError(`API error in ${context}: ${error instanceof Error ? error.message : String(error)}`, ErrorType.API_RESPONSE, error instanceof Error ? error : null, { context });
};
/**
 * Helper function to extract ASP.NET_SessionId from cookies
 * @returns The ASP.NET_SessionId cookie value or null if not found
 */
const getAspNetSessionId = () => {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'ASP.NET_SessionId') {
            return value;
        }
    }
    logger.debug('ASP.NET_SessionId cookie not found');
    return null;
};
/**
 * Real API communication implementation for Teamcenter services
 * @param config The SOA client configuration
 * @param sessionId The current session ID or null if not logged in
 * @param service The service name
 * @param operation The operation name
 * @param params The operation parameters
 * @returns The response data
 */
export const realCallService = async (config, sessionId, service, operation, params) => {
    // Form the REST endpoint URL
    const endpoint = `${config.endpoint}/${service}/${operation}`;
    try {
        logger.info(`Making Teamcenter API call to: ${endpoint}`);
        if (service === 'Core-2011-06-Session' && operation === 'login') {
            const credentials = params;
            logger.info('Login request received', { username: credentials.username });
        }
        // Create JSON request body with the proper envelope structure
        const jsonRequestBody = createJSONRequest(service, operation, params);
        // Set up the headers
        const headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            // Ensure cookies are handled properly for CORS
            'X-Requested-With': 'XMLHttpRequest'
        };
        // Add the session ID as authorization if available
        if (sessionId) {
            headers['Authorization'] = `Session ${sessionId}`;
            logger.debug('Added session ID to Authorization header');
        }
        // Explicitly add ASP.NET_SessionId cookie to the request if it exists
        const aspNetSessionId = getAspNetSessionId();
        if (aspNetSessionId) {
            logger.debug('Adding ASP.NET_SessionId to request headers');
            headers['Cookie'] = `ASP.NET_SessionId=${aspNetSessionId}`;
        }
        // Log cookies for debugging
        logger.debug('Current cookies:', document.cookie);
        logger.debug('Request headers:', headers);
        // Set up fetch options with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.timeout || 60000);
        // Make the fetch request with explicit CORS configuration
        let response;
        try {
            response = await fetch(endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify(jsonRequestBody),
                credentials: 'include', // Always include credentials (cookies)
                mode: 'cors', // Explicitly specify CORS mode
                cache: 'no-cache', // Prevent caching issues with session cookies
                signal: controller.signal // For timeout handling
            });
            // Clear the timeout
            clearTimeout(timeoutId);
            // Check for successful response
            if (!response.ok) {
                const errorText = await response.text();
                logger.error(`API error: ${response.status} ${response.statusText}`);
                logger.error('Error details:', errorText);
                // Create a more specific error based on the status code
                if (response.status === 401 || response.status === 403) {
                    throw new AppError(`Authentication error: ${response.statusText}`, ErrorType.AUTH_SESSION, new Error(errorText), { status: response.status });
                }
                else if (response.status === 404) {
                    throw new AppError(`Service not found: ${service}.${operation}`, ErrorType.API_RESPONSE, new Error(errorText), { status: response.status });
                }
                else if (response.status >= 500) {
                    throw new AppError(`Server error: ${response.statusText}`, ErrorType.API_RESPONSE, new Error(errorText), { status: response.status });
                }
                else {
                    throw new AppError(`Teamcenter API error: ${response.status} ${response.statusText}`, ErrorType.API_RESPONSE, new Error(errorText), { status: response.status });
                }
            }
        }
        catch (error) {
            // Clear the timeout if there was an error
            clearTimeout(timeoutId);
            // Handle abort error (timeout)
            if (error instanceof DOMException && error.name === 'AbortError') {
                throw new AppError(`Request timeout after ${config.timeout || 60000}ms`, ErrorType.API_TIMEOUT, error, { service, operation });
            }
            // Re-throw other errors
            throw error;
        }
        // Get and log useful headers
        let newSessionId = null;
        const contentType = response.headers.get('content-type');
        // Extract session ID from authorization header if present
        newSessionId = response.headers.get('Authorization') ||
            response.headers.get('X-Siemens-Session-ID') ||
            response.headers.get('Tc-Session-ID');
        logger.debug('Response content type:', contentType);
        if (newSessionId) {
            logger.debug('Session ID found in headers');
        }
        // Parse the JSON response
        let jsonData;
        try {
            jsonData = await response.json();
            logger.debug(`${service}.${operation} response received`);
            // Debug log the response data
            logger.debug('Response data:', jsonData);
        }
        catch (error) {
            logger.error('Failed to parse JSON response:', error);
            throw new AppError('Failed to parse response as JSON', ErrorType.DATA_PARSING, error instanceof Error ? error : null, { service, operation });
        }
        // Extract data from the response
        return {
            data: parseJSONResponse(service, operation, jsonData),
            headers: response.headers,
            sessionId: newSessionId
        };
    }
    catch (error) {
        // Handle and log the error
        if (error instanceof AppError) {
            // Already an AppError, just log it
            logger.error(`${error.type} Error in ${service}.${operation}: ${error.message}`);
            throw error;
        }
        else {
            // Convert to AppError and log
            const apiError = handleApiError(error, `${service}.${operation}`);
            throw apiError;
        }
    }
};
//# sourceMappingURL=tcApiService.js.map