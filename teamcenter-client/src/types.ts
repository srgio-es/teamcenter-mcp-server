import { Logger } from './logger.js';

// Teamcenter SOA API types
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
  [key: string]: any; // Allow for dynamic properties
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

// Search response interface for Query-2012-10-Finder/performSearch
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
  objects?: (TCItem | TCItemRevision | TCDataset)[]; // Keep for backward compatibility
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

// Interface for SOA client initialization
export interface TCSOAClientConfig {
  endpoint: string;
  timeout?: number;
  headers?: Record<string, string>;
  withCredentials?: boolean;
  mode?: RequestMode; // Added mode property to accept RequestMode type
  mockMode?: boolean; // Flag to use mock service instead of real API
}

// Types for SOA service operations
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

// Search options interface for Query-2012-10-Finder/performSearch
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

// Updated TCObject to match the mockData.ts version (making revision required)
export interface TCObject {
  id: string;
  name: string;
  type: string;
  revision: string; // Changed from optional to required
  owner: string;
  modifiedDate: string;
  status: 'Released' | 'In Work' | 'In Review' | 'Obsolete';
  description: string;
  title: string;
  thumbnail?: string;
}

// Add TCObjectType as an alias for TCObject to maintain compatibility
export type TCObjectType = TCObject;

// Adding TCLoginResponse for the login response structure
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

// New types for the refactored client

// Configuration for the Teamcenter client
export interface TeamcenterConfig {
  endpoint: string;
  timeout?: number;
  mockMode?: boolean;
  headers?: Record<string, string>;
  withCredentials?: boolean;
}

// Options for creating a TeamcenterService instance
export interface TeamcenterServiceOptions {
  logger?: Logger;
  config: TeamcenterConfig;
}

// Interface for TeamcenterService
export interface ITeamcenterService {
  isLoggedIn(): boolean;
  getSessionId(): string | null;
  login(credentials: TCCredentials): Promise<TCResponse<TCSession>>;
  logout(): Promise<TCResponse<void>>;
  getUserOwnedItems(): Promise<TCResponse<TCObject[]>>;
  getLastCreatedItems(limit?: number): Promise<TCResponse<TCObject[]>>;
  getSessionInfo(): Promise<TCResponse<any>>;
  getFavorites(): Promise<TCResponse<any>>;
  getUserProperties(uid: string, attributes?: string[]): Promise<TCResponse<any>>;
  getLoggedUserProperties(attributes?: string[]): Promise<TCResponse<any>>;
  getItemTypes(): Promise<TCResponse<any>>;
  getItemById(itemId: string): Promise<TCResponse<any>>;
  searchItems(query: string, type?: string, limit?: number): Promise<TCResponse<TCObject[]>>;
  createItem(type: string, name: string, description?: string, properties?: Record<string, any>): Promise<TCResponse<any>>;
  updateItem(itemId: string, properties: Record<string, any>): Promise<TCResponse<any>>;
}
