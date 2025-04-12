import { BaseCommand } from '../Command.js';
import { TCResponse } from '../../types.js';
import { AppError, ErrorType } from '../../tcErrors.js';
import { Logger } from '../../logger.js';
import { SOAClient } from '../../tcSOAClient.js';

export class UpdateItemCommand extends BaseCommand<any> {
  private itemId: string;
  private properties: Record<string, any>;

  constructor(
    logger: Logger, 
    soaClient: SOAClient | null, 
    isLoggedIn: boolean, 
    itemId: string, 
    properties: Record<string, any>
  ) {
    super(logger, soaClient, isLoggedIn);
    this.itemId = itemId;
    this.properties = properties;
  }

  async execute(): Promise<TCResponse<any>> {
    this.logger.debug(`[${this.serviceRequestId}] UpdateItemCommand.execute called for item: ${this.itemId}`);
    
    // Check if user is logged in
    if (!this.isLoggedIn) {
      this.logger.debug(`[${this.serviceRequestId}] UpdateItemCommand.execute failed: No session`);
      return this.createNotLoggedInError('updateItem');
    }
    
    // Validate parameters
    if (!this.itemId || !this.properties || Object.keys(this.properties).length === 0) {
      return {
        error: {
          code: 'INVALID_PARAMETER',
          level: 'ERROR',
          message: 'Item ID and properties are required'
        }
      };
    }
    
    try {
      if (!this.soaClient) {
        throw new AppError(
          'SOA client is not initialized',
          ErrorType.UNKNOWN,
          null,
          { method: 'updateItem' }
        );
      }
      
      // Use the correct payload structure for Teamcenter API
      const updateData = {
        objects: [{
          object: this.itemId,
          properties: Object.entries(this.properties).reduce((acc, [key, value]) => {
            acc[key] = {
              // Convert all values to arrays as required by Teamcenter API
              values: Array.isArray(value) ? value : [value]
            };
            return acc;
          }, {} as Record<string, { values: any[] }>)
        }]
      };
      
      this.logger.debug(`[${this.serviceRequestId}] updateItem payload:`, JSON.stringify(updateData, null, 2));
      
      const result = await this.soaClient.callService(
        'Core-2010-09-DataManagement', // Updated service name to match Teamcenter API
        'setProperties2', // Use setProperties2 for better property updating
        updateData
      );
      
      this.logger.debug(`[${this.serviceRequestId}] UpdateItemCommand.execute successful for item: ${this.itemId}`);
      return { data: result };
    } catch (error) {
      this.logger.error(`[${this.serviceRequestId}] Error updating item:`, error);
      return {
        error: {
          code: 'UPDATE_ERROR',
          level: 'ERROR',
          message: error instanceof Error ? error.message : 'Failed to update item'
        }
      };
    }
  }
}
