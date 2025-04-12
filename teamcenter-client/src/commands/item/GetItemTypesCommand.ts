import { BaseCommand } from '../Command.js';
import { TCResponse } from '../../types.js';
import { AppError, ErrorType } from '../../tcErrors.js';
import { Logger } from '../../logger.js';
import { SOAClient } from '../../tcSOAClient.js';

export class GetItemTypesCommand extends BaseCommand<any> {
  constructor(logger: Logger, soaClient: SOAClient | null, isLoggedIn: boolean) {
    super(logger, soaClient, isLoggedIn);
  }

  async execute(): Promise<TCResponse<any>> {
    this.logger.debug(`[${this.serviceRequestId}] GetItemTypesCommand.execute called`);
    
    // Check if user is logged in
    if (!this.isLoggedIn) {
      this.logger.debug(`[${this.serviceRequestId}] GetItemTypesCommand.execute failed: No session`);
      return this.createNotLoggedInError('getItemTypes');
    }
    
    try {
      if (!this.soaClient) {
        throw new AppError(
          'SOA client is not initialized',
          ErrorType.UNKNOWN,
          null,
          { method: 'getItemTypes' }
        );
      }
      
      // Use the correct service and operation for getting item types
      const payload = {
        info: [
          {
            typeName: "Item", // Get all subtypes of Item
            typeNamespace: ""
          }
        ],
        pref: {
          returnSubtypes: true, // Include all subtypes
          returnTypeHierarchy: true // Include hierarchy information
        }
      };
      
      this.logger.debug(`[${this.serviceRequestId}] getItemTypes payload:`, JSON.stringify(payload, null, 2));
      
      const result = await this.soaClient.callService(
        'Core-2007-01-DataManagement', // Updated service name to match Teamcenter API
        'getTypeDescriptions', // Use getTypeDescriptions instead of getBusinessObjectTypes
        payload
      );
      
      this.logger.debug(`[${this.serviceRequestId}] GetItemTypesCommand.execute successful`);
      return { data: result };
    } catch (error) {
      this.logger.error(`[${this.serviceRequestId}] Error getting item types:`, error);
      return {
        error: {
          code: 'API_ERROR',
          level: 'ERROR',
          message: error instanceof Error ? error.message : 'Failed to get item types'
        }
      };
    }
  }
}
