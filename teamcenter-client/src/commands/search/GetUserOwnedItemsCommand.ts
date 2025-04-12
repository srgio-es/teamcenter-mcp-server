import { BaseCommand } from '../Command.js';
import { TCResponse, TCObject, TCSearchOptions, TCSearchResponse } from '../../types.js';
import { AppError, ErrorType } from '../../tcErrors.js';
import { Logger } from '../../logger.js';
import { SOAClient } from '../../tcSOAClient.js';
import { convertToTCObject } from '../../tcResponseParser.js';
import { GetSessionInfoCommand } from '../session/GetSessionInfoCommand.js';

export class GetUserOwnedItemsCommand extends BaseCommand<TCObject[]> {
  constructor(logger: Logger, soaClient: SOAClient | null, isLoggedIn: boolean) {
    super(logger, soaClient, isLoggedIn);
  }

  async execute(): Promise<TCResponse<TCObject[]>> {
    this.logger.debug(`[${this.serviceRequestId}] GetUserOwnedItemsCommand.execute called`);
    
    // Check if user is logged in
    if (!this.isLoggedIn) {
      this.logger.debug(`[${this.serviceRequestId}] GetUserOwnedItemsCommand.execute failed: No session`);
      return this.createNotLoggedInError('getUserOwnedItems');
    }

    try {
      if (!this.soaClient) {
        throw new AppError(
          'SOA client is not initialized',
          ErrorType.UNKNOWN,
          null,
          { method: 'getUserOwnedItems' }
        );
      }
      
      // First, get the session info to retrieve the current user's UID
      const sessionInfoCommand = new GetSessionInfoCommand(this.logger, this.soaClient, this.isLoggedIn);
      const sessionInfoResponse = await sessionInfoCommand.execute();
      
      if (sessionInfoResponse.error) {
        throw new AppError(
          `Failed to get session info: ${sessionInfoResponse.error.message}`,
          ErrorType.API_RESPONSE,
          null,
          { method: 'getUserOwnedItems' }
        );
      }

      // Extract the user UID from the session info
      const sessionInfo = sessionInfoResponse.data;
      if (!sessionInfo || !sessionInfo.user || !sessionInfo.user.uid) {
        throw new AppError(
          'Could not retrieve current user UID from session info',
          ErrorType.DATA_PARSING,
          null,
          { method: 'getUserOwnedItems' }
        );
      }

      const userUid = sessionInfo.user.uid;
      this.logger.debug(`[${this.serviceRequestId}] Retrieved current user UID: ${userUid}`);
      
      // Build query to get items owned by current user using the correct API
      const searchOptions: TCSearchOptions = {
        searchInput: {
          providerName: "Awp0FullTextSearchProvider", // Changed provider for better search
          searchCriteria: {
            owningUser: userUid, // Use the actual user UID instead of placeholder
            searchString: "*" // Search for all items
          },
          startIndex: 0,
          maxToReturn: 50, // Increased limit for better results
          maxToLoad: 50,
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
            fieldName: "last_mod_date",
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
            'items_tag',
            'revision_list',
            'fnd0_master_form'
          ]
        }
      };

      this.logger.debug(`[${this.serviceRequestId}] getUserOwnedItems search options:`, JSON.stringify(searchOptions, null, 2));

      const response = await this.soaClient.callService(
        'Query-2010-04-SavedQuery', // Updated service name to match Teamcenter API
        'performSavedSearch', // Updated operation name to match Teamcenter API
        searchOptions
      ) as TCSearchResponse;

      const tcObjects = response.objects?.map(obj => convertToTCObject(obj, this.logger)) || [];
      this.logger.debug(`[${this.serviceRequestId}] GetUserOwnedItemsCommand.execute successful: ${tcObjects.length} items found`);
      return { data: tcObjects };
    } catch (error) {
      this.logger.error(`[${this.serviceRequestId}] Error fetching user owned items:`, error);
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
