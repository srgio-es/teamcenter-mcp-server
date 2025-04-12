import { BaseCommand } from '../Command.js';
import { TCResponse } from '../../types.js';
import { AppError, ErrorType } from '../../tcErrors.js';
import { Logger } from '../../logger.js';
import { SOAClient } from '../../tcSOAClient.js';

export class GetSessionInfoCommand extends BaseCommand<any> {
  constructor(logger: Logger, soaClient: SOAClient | null, isLoggedIn: boolean) {
    super(logger, soaClient, isLoggedIn);
  }

  async execute(): Promise<TCResponse<any>> {
    this.logger.debug(`[${this.serviceRequestId}] GetSessionInfoCommand.execute called`);

    // Check if user is logged in
    if (!this.isLoggedIn) {
      this.logger.debug(`[${this.serviceRequestId}] GetSessionInfoCommand.execute failed: No session`);
      return this.createNotLoggedInError('getSessionInfo');
    }

    try {
      if (!this.soaClient) {
        throw new AppError(
          'SOA client is not initialized',
          ErrorType.UNKNOWN,
          null,
          { method: 'getSessionInfo' }
        );
      }

      const result = await this.soaClient.callService(
        'Core-2007-01-Session',
        'getTCSessionInfo',
        {}
      );

      this.logger.debug(`[${this.serviceRequestId}] GetSessionInfoCommand.execute successful`);
      return { data: result };
    } catch (error) {
      this.logger.error(`[${this.serviceRequestId}] Error getting session info:`, error);
      return {
        error: {
          code: 'SESSION_INFO_ERROR',
          level: 'ERROR',
          message: error instanceof Error ? error.message : 'Failed to retrieve session info'
        }
      };
    }
  }
}
