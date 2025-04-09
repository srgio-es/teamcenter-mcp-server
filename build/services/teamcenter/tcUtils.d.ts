import { TCSession } from './types.js';
export declare const SESSION_STORAGE_KEY = "tc_session";
/**
 * Store the Teamcenter session in browser storage
 * @param session The session object to store
 */
export declare const storeSession: (session: TCSession) => void;
/**
 * Retrieve the Teamcenter session from browser storage
 * @returns The session object or null if not found or invalid
 */
export declare const retrieveSession: () => TCSession | null;
/**
 * Clear the Teamcenter session from browser storage
 */
export declare const clearSession: () => void;
/**
 * Validate a Teamcenter session object
 * @param session The session object to validate
 * @returns True if the session is valid, false otherwise
 */
export declare const isValidSession: (session: TCSession | null) => boolean;
/**
 * Create proper request envelope for Teamcenter API
 * @param service The service name
 * @param operation The operation name
 * @param params The operation parameters
 * @returns The formatted request envelope
 */
export declare const createJSONRequest: (service: string, operation: string, params: unknown) => Record<string, unknown>;
