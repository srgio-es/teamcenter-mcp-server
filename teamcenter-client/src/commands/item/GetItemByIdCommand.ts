import { BaseCommand } from '../Command.js';
import { TCResponse } from '../../types.js';
import { AppError, ErrorType } from '../../tcErrors.js';
import { Logger } from '../../logger.js';
import { SOAClient } from '../../tcSOAClient.js';

export class GetItemByIdCommand extends BaseCommand<any> {
  private itemId: string;

  constructor(logger: Logger, soaClient: SOAClient | null, isLoggedIn: boolean, itemId: string) {
    super(logger, soaClient, isLoggedIn);
    this.itemId = itemId;
  }

  async execute(): Promise<TCResponse<any>> {
    this.logger.debug(`[${this.serviceRequestId}] GetItemByIdCommand.execute called for item: ${this.itemId}`);
    
    // Check if user is logged in
    if (!this.isLoggedIn) {
      this.logger.debug(`[${this.serviceRequestId}] GetItemByIdCommand.execute failed: No session`);
      return this.createNotLoggedInError('getItemById');
    }
    
    // Validate itemId
    if (!this.itemId) {
      return {
        error: {
          code: 'INVALID_PARAMETER',
          level: 'ERROR',
          message: 'Item ID is required'
        }
      };
    }
    
    try {
      if (!this.soaClient) {
        throw new AppError(
          'SOA client is not initialized',
          ErrorType.UNKNOWN,
          null,
          { method: 'getItemById' }
        );
      }
      
      // Use the correct payload structure for Teamcenter API
      const payload = {
        objects: [{
          uid: this.itemId,
          type: "Item" // Specify the type to ensure proper handling
        }],
        attributes: [
          "object_name",
          "object_desc",
          "object_string",
          "item_id",
          "item_revision_id",
          "release_status_list",
          "owning_user",
          "creation_date",
          "last_mod_date",
          "items_tag",
          "revision_list",
          "fnd0_master_form"
        ],
        // Include additional options for better results
        options: {
          withProperties: true,
          withRelatedObjects: true,
          withRevisions: true
        }
      };
      
      this.logger.debug(`[${this.serviceRequestId}] getItemById payload:`, JSON.stringify(payload, null, 2));
      
      const result = await this.soaClient.callService(
        'Core-2007-09-DataManagement', // Updated service name to match Teamcenter API
        'loadObjects', // Use loadObjects instead of getProperties for more complete data
        payload
      );
      
      this.logger.debug(`[${this.serviceRequestId}] GetItemByIdCommand.execute successful for item: ${this.itemId}`);
      return { data: result };
    } catch (error) {
      this.logger.error(`[${this.serviceRequestId}] Error getting item by ID:`, error);
      return {
        error: {
          code: 'API_ERROR',
          level: 'ERROR',
          message: error instanceof Error ? error.message : 'Failed to get item'
        }
      };
    }
  }
}
