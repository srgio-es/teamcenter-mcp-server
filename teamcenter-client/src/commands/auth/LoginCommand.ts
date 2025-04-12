import { BaseCommand } from '../Command.js';
import { TCCredentials, TCResponse, TCSession } from '../../types.js';
import { AppError, ErrorType } from '../../tcErrors.js';
import { storeSession } from '../../tcUtils.js';
import { Logger } from '../../logger.js';
import { SOAClient } from '../../tcSOAClient.js';

export class LoginCommand extends BaseCommand<TCSession> {
  private credentials: TCCredentials;

  constructor(logger: Logger, soaClient: SOAClient | null, isLoggedIn: boolean, credentials: TCCredentials) {
    super(logger, soaClient, isLoggedIn);
    this.credentials = credentials;
  }

  async execute(): Promise<TCResponse<TCSession>> {
    this.logger.debug(`[${this.serviceRequestId}] LoginCommand.execute called for user: ${this.credentials.username}`);
    
    try {
      if (!this.soaClient) {
        throw new AppError(
          'SOA client is not initialized',
          ErrorType.UNKNOWN,
          null,
          { method: 'login' }
        );
      }
      
      // Validate credentials
      if (!this.credentials.username || !this.credentials.password) {
        throw new AppError(
          'Username and password are required',
          ErrorType.DATA_VALIDATION,
          null,
          { method: 'login' }
        );
      }
    
      // Call the SOA service
      const session = await this.soaClient.callService(
        'Core-2011-06-Session',
        'login',
        this.credentials
      ) as TCSession;
      
      // Store session
      storeSession(session, this.logger);
      
      this.logger.debug(`[${this.serviceRequestId}] LoginCommand.execute successful for user: ${this.credentials.username}`);
      return { data: session };
    } catch (error) {
      this.logger.error(`[${this.serviceRequestId}] Teamcenter login error:`, error);
      
      // Create a more specific error response
      let errorCode = 'LOGIN_ERROR';
      let errorMessage = 'Login failed';
      
      if (error instanceof AppError) {
        if (error.type === ErrorType.AUTH_SESSION) {
          errorCode = 'INVALID_CREDENTIALS';
          errorMessage = 'Invalid username or password';
        } else if (error.type === ErrorType.NETWORK) {
          errorCode = 'NETWORK_ERROR';
          errorMessage = 'Network error connecting to Teamcenter';
        } else if (error.type === ErrorType.API_TIMEOUT) {
          errorCode = 'TIMEOUT';
          errorMessage = 'Connection to Teamcenter timed out';
        }
        
        errorMessage = error.message || errorMessage;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      return {
        error: {
          code: errorCode,
          level: 'ERROR',
          message: errorMessage
        }
      };
    }
  }
}
