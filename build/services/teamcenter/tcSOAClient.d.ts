import { TCSOAClientConfig } from './types.js';
export interface SOAClient {
    config: TCSOAClientConfig;
    sessionId: string | null;
    callService: (service: string, operation: string, params: unknown) => Promise<unknown>;
}
export declare const createSOAClient: (config: TCSOAClientConfig, initialSessionId?: string | null) => SOAClient;
