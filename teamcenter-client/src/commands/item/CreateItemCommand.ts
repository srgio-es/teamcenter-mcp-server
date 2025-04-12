import { BaseCommand } from '../Command.js';
import { TCResponse } from '../../types.js';
import { AppError, ErrorType } from '../../tcErrors.js';
import { Logger } from '../../logger.js';
import { SOAClient } from '../../tcSOAClient.js';

export class CreateItemCommand extends BaseCommand<any> {
  private type: string;
  private name: string;
  private description: string;
  private properties: Record<string, any>;

  constructor(
    logger: Logger, 
    soaClient: SOAClient | null, 
    isLoggedIn: boolean, 
    type: string, 
    name: string, 
    description: string = '', 
    properties: Record<string, any> = {}
  ) {
    super(logger, soaClient, isLoggedIn);
    this.type = type;
    this.name = name;
    this.description = description;
    this.properties = properties;
  }

  async execute(): Promise<TCResponse<any>> {
    this.logger.debug(`[${this.serviceRequestId}] CreateItemCommand.execute called with type: ${this.type}, name: ${this.name}`);
    
    // Check if user is logged in
    if (!this.isLoggedIn) {
      this.logger.debug(`[${this.serviceRequestId}] CreateItemCommand.execute failed: No session`);
      return this.createNotLoggedInError('createItem');
    }
    
    // Validate parameters
    if (!this.type || !this.name) {
      return {
        error: {
          code: 'INVALID_PARAMETER',
          level: 'ERROR',
          message: 'Type and name are required'
        }
      };
    }
    
    try {
      if (!this.soaClient) {
        throw new AppError(
          'SOA client is not initialized',
          ErrorType.UNKNOWN,
          null,
          { method: 'createItem' }
        );
      }
      
      // Use the correct payload structure for Teamcenter API
      const createData = {
        clientId: "NodeJsTeamcenterClient",
        createInput: [{
          boName: this.type,
          propertyNameValues: {
            object_name: [this.name],
            object_desc: [this.description],
            ...Object.entries(this.properties).reduce((acc, [key, value]) => {
              acc[key] = Array.isArray(value) ? value : [value];
              return acc;
            }, {} as Record<string, any>)
          }
        }]
      };
      
      this.logger.debug(`[${this.serviceRequestId}] createItem payload:`, JSON.stringify(createData, null, 2));
      
      const result = await this.soaClient.callService(
        'Core-2010-09-DataManagement', // Updated service name to match Teamcenter API
        'createRelateAndSubmitObjects', // Use createRelateAndSubmitObjects for better item creation
        createData
      );
      
      this.logger.debug(`[${this.serviceRequestId}] CreateItemCommand.execute successful for item: ${this.name}`);
      return { data: result };
    } catch (error) {
      this.logger.error(`[${this.serviceRequestId}] Error creating item:`, error);
      return {
        error: {
          code: 'CREATE_ERROR',
          level: 'ERROR',
          message: error instanceof Error ? error.message : 'Failed to create item'
        }
      };
    }
  }
}
