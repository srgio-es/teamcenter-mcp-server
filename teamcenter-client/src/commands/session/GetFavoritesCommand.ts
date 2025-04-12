import { BaseCommand } from '../Command.js';
import { TCResponse } from '../../types.js';
import { AppError, ErrorType } from '../../tcErrors.js';
import { Logger } from '../../logger.js';
import { SOAClient } from '../../tcSOAClient.js';

export class GetFavoritesCommand extends BaseCommand<any> {
  constructor(logger: Logger, soaClient: SOAClient | null, isLoggedIn: boolean) {
    super(logger, soaClient, isLoggedIn);
  }

  async execute(): Promise<TCResponse<any>> {
    this.logger.debug(`[${this.serviceRequestId}] GetFavoritesCommand.execute called`);

    // Check if user is logged in
    if (!this.isLoggedIn) {
      this.logger.debug(`[${this.serviceRequestId}] GetFavoritesCommand.execute failed: No session`);
      return this.createNotLoggedInError('getFavorites');
    }

    try {
      if (!this.soaClient) {
        throw new AppError(
          'SOA client is not initialized',
          ErrorType.UNKNOWN,
          null,
          { method: 'getFavorites' }
        );
      }

      const result = await this.soaClient.callService(
        'Core-2008-03-Session',
        'getFavorites',
        {}
      );

      this.logger.debug(`[${this.serviceRequestId}] GetFavoritesCommand.execute successful`);
      return { data: result };
    } catch (error) {
      this.logger.error(`[${this.serviceRequestId}] Error getting favorites:`, error);
      return {
        error: {
          code: 'FAVORITES_ERROR',
          level: 'ERROR',
          message: error instanceof Error ? error.message : 'Failed to retrieve favorites'
        }
      };
    }
  }
}
