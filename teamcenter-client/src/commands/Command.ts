import { TCResponse } from '../types.js';
import { Logger } from '../logger.js';
import { SOAClient } from '../tcSOAClient.js';

export interface Command<T> {
  execute(): Promise<TCResponse<T>>;
}

export abstract class BaseCommand<T> implements Command<T> {
  protected logger: Logger;
  protected soaClient: SOAClient | null;
  protected serviceRequestId: string;
  protected isLoggedIn: boolean;

  constructor(logger: Logger, soaClient: SOAClient | null, isLoggedIn: boolean) {
    this.logger = logger;
    this.soaClient = soaClient;
    this.isLoggedIn = isLoggedIn;
    this.serviceRequestId = `cmd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  }

  abstract execute(): Promise<TCResponse<T>>;

  protected createNotLoggedInError(method: string): TCResponse<T> {
    return {
      error: {
        code: 'NO_SESSION',
        level: 'ERROR',
        message: 'User is not logged in'
      }
    };
  }
}
