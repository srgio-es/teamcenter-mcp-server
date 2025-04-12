import { BaseCommand } from '../Command.js';
import { TCResponse, TCObject, TCSearchOptions, TCSearchResponse } from '../../types.js';
import { AppError, ErrorType } from '../../tcErrors.js';
import { Logger } from '../../logger.js';
import { SOAClient } from '../../tcSOAClient.js';
import { convertToTCObject } from '../../tcResponseParser.js';

export class SearchItemsCommand extends BaseCommand<TCObject[]> {
  private query: string;
  private type?: string;
  private limit: number;

  constructor(
    logger: Logger, 
    soaClient: SOAClient | null, 
    isLoggedIn: boolean, 
    query: string, 
    type?: string, 
    limit: number = 10
  ) {
    super(logger, soaClient, isLoggedIn);
    this.query = query;
    this.type = type;
    this.limit = limit;
  }

  async execute(): Promise<TCResponse<TCObject[]>> {
    this.logger.debug(`[${this.serviceRequestId}] SearchItemsCommand.execute called with query: ${this.query}, type: ${this.type}, limit: ${this.limit}`);
    
    // Check if user is logged in
    if (!this.isLoggedIn) {
      this.logger.debug(`[${this.serviceRequestId}] SearchItemsCommand.execute failed: No session`);
      return this.createNotLoggedInError('searchItems');
    }
    
    // Validate parameters
    if (!this.query) {
      return {
        error: {
          code: 'INVALID_PARAMETER',
          level: 'ERROR',
          message: 'Search query is required'
        }
      };
    }
    
    if (this.limit <= 0 || this.limit > 100) {
      return {
        error: {
          code: 'INVALID_PARAMETER',
          level: 'ERROR',
          message: 'Limit must be between 1 and 100'
        }
      };
    }
    
    try {
      if (!this.soaClient) {
        throw new AppError(
          'SOA client is not initialized',
          ErrorType.UNKNOWN,
          null,
          { method: 'searchItems' }
        );
      }
      
      // Build search criteria with correct structure for Teamcenter API
      const searchOptions: TCSearchOptions = {
        searchInput: {
          providerName: "Awp0FullTextSearchProvider", // Changed provider for better text search
          searchCriteria: {
            searchString: this.query // Use searchString instead of Name for full text search
          },
          startIndex: 0,
          maxToReturn: this.limit,
          maxToLoad: this.limit,
          searchFilterMap: {},
          searchSortCriteria: [{
            fieldName: "creation_date",
            sortDirection: "DESC"
          }],
          searchFilterFieldSortType: "Alphabetical",
          attributesToInflate: [
            'object_name', 
            'object_desc',
            'object_string',
            'item_id',
            'item_revision_id',
            'release_status_list',
            'owning_user',
            'creation_date',
            'last_mod_date',
            'items_tag', // Added additional attributes for better item information
            'revision_list',
            'fnd0_master_form'
          ]
        }
      };
      
      if (this.type) {
        searchOptions.searchInput.searchFilterMap = {
          "Type": [{ // Changed from "Item Type" to "Type" which is the standard filter name
            searchFilterType: "StringFilter",
            stringValue: this.type,
            startDateValue: "",
            endDateValue: "",
            startNumericValue: 0,
            endNumericValue: 0,
            count: 1,
            selected: true,
            startEndRange: ""
          }]
        };
      }
      
      this.logger.debug(`[${this.serviceRequestId}] Search options:`, JSON.stringify(searchOptions, null, 2));
      
      const result = await this.soaClient.callService(
        'Query-2010-04-SavedQuery', // Updated service name to match Teamcenter API
        'performSavedSearch', // Updated operation name to match Teamcenter API
        searchOptions
      ) as TCSearchResponse;
      
      // Convert the results to TCObject format
      const tcObjects = result.objects?.map(obj => convertToTCObject(obj, this.logger)) || [];
      
      this.logger.debug(`[${this.serviceRequestId}] SearchItemsCommand.execute successful: ${tcObjects.length} items found`);
      return { data: tcObjects };
    } catch (error) {
      this.logger.error(`[${this.serviceRequestId}] Error searching items:`, error);
      return {
        error: {
          code: 'SEARCH_ERROR',
          level: 'ERROR',
          message: error instanceof Error ? error.message : 'Failed to search items'
        }
      };
    }
  }
}
