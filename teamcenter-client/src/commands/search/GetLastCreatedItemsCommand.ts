import { BaseCommand } from '../Command.js';
import { TCResponse, TCObject, TCSearchOptions, TCSearchResponse } from '../../types.js';
import { AppError, ErrorType } from '../../tcErrors.js';
import { Logger } from '../../logger.js';
import { SOAClient } from '../../tcSOAClient.js';
import { convertToTCObject } from '../../tcResponseParser.js';

export class GetLastCreatedItemsCommand extends BaseCommand<TCObject[]> {
  private limit: number;

  constructor(logger: Logger, soaClient: SOAClient | null, isLoggedIn: boolean, limit: number = 10) {
    super(logger, soaClient, isLoggedIn);
    this.limit = limit;
  }

  async execute(): Promise<TCResponse<TCObject[]>> {
    this.logger.debug(`[${this.serviceRequestId}] GetLastCreatedItemsCommand.execute called with limit: ${this.limit}`);
    
    // Check if user is logged in
    if (!this.isLoggedIn) {
      this.logger.debug(`[${this.serviceRequestId}] GetLastCreatedItemsCommand.execute failed: No session`);
      return this.createNotLoggedInError('getLastCreatedItems');
    }
    
    // Validate limit parameter
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
          { method: 'getLastCreatedItems' }
        );
      }
      
      // Build query to get last created items using the correct API
      const searchOptions: TCSearchOptions = {
        searchInput: {
          providerName: "Awp0FullTextSearchProvider", // Changed provider for better search
          searchCriteria: {
            searchString: "*" // Search for all items
          },
          startIndex: 0,
          maxToReturn: this.limit,
          maxToLoad: this.limit,
          searchFilterMap: {
            "Type": [{ // Changed from "Item Type" to "Type" which is the standard filter name
              searchFilterType: "StringFilter",
              stringValue: "Item",
              startDateValue: "",
              endDateValue: "",
              startNumericValue: 0,
              endNumericValue: 0,
              count: 1,
              selected: true,
              startEndRange: ""
            }]
          },
          searchSortCriteria: [{
            fieldName: "creation_date",
            sortDirection: "DESC" // Sort by creation date descending to get newest items first
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
            'items_tag',
            'revision_list',
            'fnd0_master_form'
          ]
        }
      };

      this.logger.debug(`[${this.serviceRequestId}] getLastCreatedItems search options:`, JSON.stringify(searchOptions, null, 2));

      const response = await this.soaClient.callService(
        'Query-2010-04-SavedQuery', // Updated service name to match Teamcenter API
        'performSavedSearch', // Updated operation name to match Teamcenter API
        searchOptions
      ) as TCSearchResponse;

      const tcObjects = response.objects?.map(obj => convertToTCObject(obj, this.logger)) || [];
      this.logger.debug(`[${this.serviceRequestId}] GetLastCreatedItemsCommand.execute successful: ${tcObjects.length} items found`);
      return { data: tcObjects };
    } catch (error) {
      this.logger.error(`[${this.serviceRequestId}] Error fetching last created items:`, error);
      return {
        error: {
          code: 'SEARCH_ERROR',
          level: 'ERROR',
          message: error instanceof Error ? error.message : 'Failed to retrieve items'
        }
      };
    }
  }
}
