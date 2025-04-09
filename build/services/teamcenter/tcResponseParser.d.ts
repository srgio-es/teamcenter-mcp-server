import { TCItem, TCObject } from './types.js';
export declare const parseJSONResponse: (service: string, operation: string, response: Record<string, unknown>) => unknown;
export declare const convertToTCObject: (itemObj: TCItem) => TCObject;
