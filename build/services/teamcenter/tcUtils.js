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
const handleDataError = (error, context) => {
    if (error instanceof AppError) {
        return error;
    }
    return new AppError(`Data error in ${context}: ${error instanceof Error ? error.message : String(error)}`, ErrorType.DATA_PARSING, error instanceof Error ? error : null, { context });
};
// Constants
export const SESSION_STORAGE_KEY = 'tc_session';
/**
 * Store the Teamcenter session in browser storage
 * @param session The session object to store
 */
export const storeSession = (session) => {
    try {
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
        logger.debug('Teamcenter session stored in browser storage');
    }
    catch (error) {
        logger.error('Failed to store Teamcenter session:', error);
        // Non-critical error, so we don't throw
    }
};
/**
 * Retrieve the Teamcenter session from browser storage
 * @returns The session object or null if not found or invalid
 */
export const retrieveSession = () => {
    const storedSession = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!storedSession) {
        logger.debug('No Teamcenter session found in browser storage');
        return null;
    }
    try {
        const session = JSON.parse(storedSession);
        logger.debug('Teamcenter session restored from browser storage');
        return session;
    }
    catch (error) {
        logger.error('Failed to parse stored Teamcenter session:', error);
        // Clear the invalid session data
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
        return null;
    }
};
/**
 * Clear the Teamcenter session from browser storage
 */
export const clearSession = () => {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    logger.debug('Teamcenter session cleared from browser storage');
};
/**
 * Validate a Teamcenter session object
 * @param session The session object to validate
 * @returns True if the session is valid, false otherwise
 */
export const isValidSession = (session) => {
    if (!session)
        return false;
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
export const createJSONRequest = (service, operation, params) => {
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
        let requestEnvelope = {
            header: header,
            body: {}
        };
        // Handle specific operations
        if (service === 'Core-2011-06-Session' && operation === 'login') {
            // Extract credentials from params, ensuring we get the original values from the login form
            const credentials = params;
            if (!credentials.username || !credentials.password) {
                throw new AppError('Missing username or password for login', ErrorType.DATA_VALIDATION, null, { service, operation });
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
        }
        else if (service === 'Core-2007-06-Session' && operation === 'logout') {
            // Empty body for logout
            requestEnvelope.body = {};
            logger.debug('Creating logout request');
        }
        else if (service === 'Query-2012-10-Finder' && operation === 'performSearch') {
            // Add the search parameters to the body
            requestEnvelope.body = params;
            logger.debug('Creating search request');
        }
        else {
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
    }
    catch (error) {
        if (error instanceof AppError) {
            throw error;
        }
        else {
            throw handleDataError(error, 'request envelope');
        }
    }
};
//# sourceMappingURL=tcUtils.js.map