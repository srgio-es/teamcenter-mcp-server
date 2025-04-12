import { Command } from './Command.js';
import { TCResponse } from '../types.js';
import { Logger } from '../logger.js';

export class CommandExecutor {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async execute<T>(command: Command<T>): Promise<TCResponse<T>> {
    try {
      return await command.execute();
    } catch (error) {
      this.logger.error('Command execution error:', error);
      return {
        error: {
          code: 'COMMAND_ERROR',
          level: 'ERROR',
          message: error instanceof Error ? error.message : 'Command execution failed'
        }
      };
    }
  }
}
