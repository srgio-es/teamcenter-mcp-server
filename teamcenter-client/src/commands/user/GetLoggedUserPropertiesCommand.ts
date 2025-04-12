import { BaseCommand } from '../Command.js';
import { TCResponse } from '../../types.js';
import { AppError, ErrorType } from '../../tcErrors.js';
import { Logger } from '../../logger.js';
import { SOAClient } from '../../tcSOAClient.js';
import { GetSessionInfoCommand } from '../session/GetSessionInfoCommand.js';
import { GetUserPropertiesCommand } from './GetUserPropertiesCommand.js';

export class GetLoggedUserPropertiesCommand extends BaseCommand<any> {
  private attributes?: string[];

  constructor(logger: Logger, soaClient: SOAClient | null, isLoggedIn: boolean, attributes?: string[]) {
    super(logger, soaClient, isLoggedIn);
    this.attributes = attributes;
  }

  async execute(): Promise<TCResponse<any>> {
    this.logger.debug(`[${this.serviceRequestId}] GetLoggedUserPropertiesCommand.execute called`);

    // Check if user is logged in
    if (!this.isLoggedIn) {
      this.logger.debug(`[${this.serviceRequestId}] GetLoggedUserPropertiesCommand.execute failed: No session`);
      return this.createNotLoggedInError('getLoggedUserProperties');
    }

    try {
      if (!this.soaClient) {
        throw new AppError(
          'SOA client is not initialized',
          ErrorType.UNKNOWN,
          null,
          { method: 'getLoggedUserProperties' }
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
          { method: 'getLoggedUserProperties' }
        );
      }

      // Extract the user UID from the session info
      const sessionInfo = sessionInfoResponse.data;
      if (!sessionInfo || !sessionInfo.user || !sessionInfo.user.uid) {
        throw new AppError(
          'Could not retrieve current user UID from session info',
          ErrorType.DATA_PARSING,
          null,
          { method: 'getLoggedUserProperties' }
        );
      }

      const userUid = sessionInfo.user.uid;
      this.logger.debug(`[${this.serviceRequestId}] Retrieved current user UID: ${userUid}`);

      // Now get the user properties using the retrieved UID
      const userPropertiesCommand = new GetUserPropertiesCommand(
        this.logger, 
        this.soaClient, 
        this.isLoggedIn, 
        userUid, 
        this.attributes
      );
      
      return await userPropertiesCommand.execute();
    } catch (error) {
      this.logger.error(`[${this.serviceRequestId}] Error getting logged user properties:`, error);
      return {
        error: {
          code: 'USER_PROPERTIES_ERROR',
          level: 'ERROR',
          message: error instanceof Error ? error.message : 'Failed to retrieve logged user properties'
        }
      };
    }
  }
}
