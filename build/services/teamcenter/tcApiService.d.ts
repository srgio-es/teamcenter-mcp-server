import { TCSOAClientConfig } from './types.js';
/**
 * Real API communication implementation for Teamcenter services
 * @param config The SOA client configuration
 * @param sessionId The current session ID or null if not logged in
 * @param service The service name
 * @param operation The operation name
 * @param params The operation parameters
 * @returns The response data
 */
export declare const realCallService: (config: TCSOAClientConfig, sessionId: string | null, service: string, operation: string, params: unknown) => Promise<unknown>;
