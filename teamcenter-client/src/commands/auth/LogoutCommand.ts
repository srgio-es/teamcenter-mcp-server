import { BaseCommand } from '../Command.js';
import { TCResponse } from '../../types.js';
import { AppError, ErrorType } from '../../tcErrors.js';
import { clearSession } from '../../tcUtils.js';
import { Logger } from '../../logger.js';
import { SOAClient } from '../../tcSOAClient.js';

export class LogoutCommand extends BaseCommand<void> {
  constructor(logger: Logger, soaClient: SOAClient | null, isLoggedIn: boolean) {
    super(logger, soaClient, isLoggedIn);
  }

  async execute(): Promise<TCResponse<void>> {
    this.logger.debug(`[${this.serviceRequestId}] LogoutCommand.execute called`);
    
    // If not logged in, just return success
    if (!this.isLoggedIn) {
      this.logger.debug(`[${this.serviceRequestId}] LogoutCommand.execute: No active session to logout`);
      return { data: undefined };
    }

    try {
      if (!this.soaClient) {
        throw new AppError(
          'SOA client is not initialized',
          ErrorType.UNKNOWN,
          null,
          { method: 'logout' }
        );
      }
      
      await this.soaClient.callService(
        'Core-2007-06-Session',
        'logout',
        {}
      );
      
      // Clear session
      clearSession(this.logger);
      if (this.soaClient) {
        this.soaClient.sessionId = null;
      }
      
      this.logger.debug(`[${this.serviceRequestId}] LogoutCommand.execute successful`);
      return { data: undefined };
    } catch (error) {
      this.logger.error(`[${this.serviceRequestId}] Teamcenter logout error:`, error);
      
      // Even if logout fails, clear the local session
      clearSession(this.logger);
      if (this.soaClient) {
        this.soaClient.sessionId = null;
      }
      
      return {
        error: {
          code: 'LOGOUT_ERROR',
          level: 'ERROR',
          message: error instanceof Error ? error.message : 'Logout failed'
        }
      };
    }
  }
}
