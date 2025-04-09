import { TCCredentials, TCSession, TCResponse, TCObject } from './types.js';
declare class TeamcenterService {
    private soaClient;
    constructor();
    private initService;
    login(credentials: TCCredentials): Promise<TCResponse<TCSession>>;
    getUserOwnedItems(): Promise<TCResponse<TCObject[]>>;
    getLastCreatedItems(limit?: number): Promise<TCResponse<TCObject[]>>;
    isLoggedIn(): boolean;
    logout(): Promise<TCResponse<void>>;
}
export declare const teamcenterService: TeamcenterService;
export {};
