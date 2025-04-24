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
      
      // Build search criteria - Reverting to Finder service pattern
      const searchOptions: TCSearchOptions = {
        searchInput: {
          providerName: "Fnd0BaseProvider", // Reverted to base provider
          searchCriteria: {
            Name: this.query // Reverted to Name criteria for base provider
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
          "Item Type": [{ // Reverted filter key to "Item Type"
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
        'Query-2012-10-Finder', // Reverted service name
        'performSearch', // Reverted operation name
        searchOptions
      ) as TCSearchResponse;
      
      // Convert the results to TCObject format
      const tcObjects = result.objects?.map(obj => convertToTCObject(obj, this.logger)) || [];
      
      this.logger.debug(`[${this.serviceRequestId}] SearchItemsCommand.execute successful: ${tcObjects.length} items found`);
      return { data: tcObjects };
    } catch (error) {
      this.logger.error(`[${this.serviceRequestId}] Error searching items:`, error);
      
      // Attempt to extract more specific error message from Teamcenter response
      let specificMessage = 'Failed to search items';
      if (error instanceof AppError && error.originalError) {
        // Check if AppError wrapped an AxiosError or similar with response data
        const responseData = (error.originalError as any)?.response?.data;
        if (responseData?.ServiceData?.partialErrors?.[0]?.errorValues?.[0]?.message) {
          specificMessage = responseData.ServiceData.partialErrors[0].errorValues[0].message;
        } else if (responseData?.message) {
          specificMessage = responseData.message;
        } else if (error.originalError instanceof Error) {
          specificMessage = error.originalError.message;
        }
      } else if (error instanceof Error) {
        specificMessage = error.message;
      }

      return {
        error: {
          code: 'SEARCH_ERROR',
          level: 'ERROR',
          message: specificMessage
        }
      };
    }
  }
}
