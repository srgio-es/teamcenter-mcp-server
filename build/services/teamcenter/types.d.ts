export interface TCCredentials {
    username: string;
    password: string;
}
export interface TCSession {
    sessionId: string;
    userId: string;
    userName: string;
    group?: string;
    role?: string;
    groupId?: string;
    groupName?: string;
    roleId?: string;
    roleName?: string;
    status?: string;
    soaVersion?: string;
    locale?: string;
    serverInfo?: {
        UserID?: string;
        TcServerID?: string;
        Version?: string;
        Locale?: string;
    };
}
export interface TCPagingInfo {
    startIndex: number;
    endIndex: number;
    totalFound: number;
}
export interface TCPropertyInfo {
    name: string;
    value: string | number | boolean | null;
    displayValue?: string;
    [key: string]: any;
}
export interface TCItemRevision {
    uid: string;
    type: string;
    properties: Record<string, any>;
}
export interface TCItem {
    uid: string;
    type: string;
    properties: Record<string, any>;
    revisions?: TCItemRevision[];
}
export interface TCDataset {
    uid: string;
    type: string;
    properties: Record<string, any>;
}
export interface TCSearchResponse {
    searchResults: (TCItem | TCItemRevision | TCDataset)[];
    totalFound: number;
    totalLoaded: number;
    searchFilterMap?: Record<string, Array<{
        searchFilterType: string;
        stringValue?: string;
        startDateValue?: string;
        endDateValue?: string;
        startNumericValue?: number;
        endNumericValue?: number;
        count?: number;
        selected?: boolean;
        startEndRange?: string;
    }>>;
    searchFilterCategories?: Array<{
        internalName: string;
        displayName: string;
        defaultFilterValueDisplayCount: number;
    }>;
    defaultFilterFieldDisplayCount?: number;
    serviceData?: any;
    objects?: (TCItem | TCItemRevision | TCDataset)[];
}
export interface TCError {
    code: string;
    level: 'INFO' | 'WARNING' | 'ERROR';
    message: string;
}
export interface TCResponse<T> {
    data?: T;
    error?: TCError;
}
export interface TCSOAClientConfig {
    endpoint: string;
    timeout?: number;
    headers?: Record<string, string>;
    withCredentials?: boolean;
    mode?: RequestMode;
}
export interface TCSearchCriteria {
    types: string[];
    where?: TCSearchWhereClause[];
    excludeProps?: boolean;
    includeProps?: string[];
}
export interface TCSearchWhereClause {
    attribute: string;
    operator: 'equals' | 'like' | 'in' | 'greaterThan' | 'lessThan' | 'greaterThanEquals' | 'lessThanEquals';
    values: string[];
}
export interface TCSearchOptions {
    searchInput: {
        providerName?: string;
        searchCriteria: Record<string, any>;
        startIndex?: number;
        maxToReturn?: number;
        maxToLoad?: number;
        searchFilterMap?: Record<string, Array<{
            searchFilterType: string;
            stringValue?: string;
            startDateValue?: string;
            endDateValue?: string;
            startNumericValue?: number;
            endNumericValue?: number;
            count?: number;
            selected?: boolean;
            startEndRange?: string;
        }>>;
        searchSortCriteria?: Array<{
            fieldName: string;
            sortDirection: 'ASC' | 'DESC';
        }>;
        searchFilterFieldSortType: string;
        attributesToInflate?: string[];
    };
}
export interface TCObject {
    id: string;
    name: string;
    type: string;
    revision: string;
    owner: string;
    modifiedDate: string;
    status: 'Released' | 'In Work' | 'In Review' | 'Obsolete';
    description: string;
    title: string;
    thumbnail?: string;
}
export type TCObjectType = TCObject;
export interface TCLoginResponse {
    serverInfo: {
        UserID: string;
        TcServerID: string;
        Version?: string;
        Locale?: string;
        [key: string]: any;
    };
    PartialErrors?: any;
    [key: string]: any;
}
