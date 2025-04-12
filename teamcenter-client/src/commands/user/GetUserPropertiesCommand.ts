import { BaseCommand } from '../Command.js';
import { TCResponse } from '../../types.js';
import { AppError, ErrorType } from '../../tcErrors.js';
import { Logger } from '../../logger.js';
import { SOAClient } from '../../tcSOAClient.js';

export class GetUserPropertiesCommand extends BaseCommand<any> {
  private uid: string;
  private attributes?: string[];

  constructor(logger: Logger, soaClient: SOAClient | null, isLoggedIn: boolean, uid: string, attributes?: string[]) {
    super(logger, soaClient, isLoggedIn);
    this.uid = uid;
    this.attributes = attributes;
  }

  async execute(): Promise<TCResponse<any>> {
    this.logger.debug(`[${this.serviceRequestId}] GetUserPropertiesCommand.execute called for user UID: ${this.uid}`);

    // Check if user is logged in
    if (!this.isLoggedIn) {
      this.logger.debug(`[${this.serviceRequestId}] GetUserPropertiesCommand.execute failed: No session`);
      return this.createNotLoggedInError('getUserProperties');
    }

    // Validate parameters
    if (!this.uid) {
      return {
        error: {
          code: 'INVALID_PARAMETER',
          level: 'ERROR',
          message: 'User UID is required'
        }
      };
    }

    try {
      if (!this.soaClient) {
        throw new AppError(
          'SOA client is not initialized',
          ErrorType.UNKNOWN,
          null,
          { method: 'getUserProperties' }
        );
      }

      // Default attributes to retrieve if not specified
      const defaultAttributes = [
        "user_id", 
        "person", 
        "os_username", 
        "last_login_time", 
        "volume", 
        "home_folder"
      ];

      // Prepare the request payload
      const payload = {
        objects: [{
          uid: this.uid,
          className: "User",
          type: "User"
        }],
        attributes: this.attributes || defaultAttributes
      };
        
      this.logger.debug(`[${this.serviceRequestId}] Payload for getUserProperties:`, payload);

      const result = await this.soaClient.callService(
        'Core-2006-03-DataManagement',
        'getProperties',
        payload
      );

      this.logger.debug(`[${this.serviceRequestId}] GetUserPropertiesCommand.execute successful for user UID: ${this.uid}`);
      return { data: result };
    } catch (error) {
      this.logger.error(`[${this.serviceRequestId}] Error getting user properties:`, error);
      return {
        error: {
          code: 'USER_PROPERTIES_ERROR',
          level: 'ERROR',
          message: error instanceof Error ? error.message : 'Failed to retrieve user properties'
        }
      };
    }
  }
}
