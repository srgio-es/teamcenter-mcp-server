import { Logger, createDefaultLogger } from './logger.js';

// Centralized error handling for Teamcenter services
export enum ErrorType {
  DATA_VALIDATION = 'DATA_VALIDATION',
  DATA_PARSING = 'DATA_PARSING',
  API_RESPONSE = 'API_RESPONSE',
  API_TIMEOUT = 'API_TIMEOUT',
  AUTH_SESSION = 'AUTH_SESSION',
  NETWORK = 'NETWORK',
  UNKNOWN = 'UNKNOWN'
}

export class AppError extends Error {
  constructor(
    message: string,
    public type: ErrorType,
    public originalError: Error | null,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const handleApiError = (error: unknown, context: string, _logger?: Logger): AppError => {
  if (error instanceof AppError) {
    return error;
  }
  
  return new AppError(
    `API error in ${context}: ${error instanceof Error ? error.message : String(error)}`,
    ErrorType.API_RESPONSE,
    error instanceof Error ? error : null,
    { context }
  );
};

export const handleDataError = (error: unknown, context: string, _logger?: Logger): AppError => {
  if (error instanceof AppError) {
    return error;
  }
  
  return new AppError(
    `Data error in ${context}: ${error instanceof Error ? error.message : String(error)}`,
    ErrorType.DATA_PARSING,
    error instanceof Error ? error : null,
    { context }
  );
};

export const handleAuthError = (error: unknown, context: string, _logger?: Logger): AppError => {
  if (error instanceof AppError) {
    return error;
  }
  
  return new AppError(
    `Authentication error in ${context}: ${error instanceof Error ? error.message : String(error)}`,
    ErrorType.AUTH_SESSION,
    error instanceof Error ? error : null,
    { context }
  );
};

export const handleNetworkError = (error: unknown, context: string, _logger?: Logger): AppError => {
  if (error instanceof AppError) {
    return error;
  }
  
  return new AppError(
    `Network error in ${context}: ${error instanceof Error ? error.message : String(error)}`,
    ErrorType.NETWORK,
    error instanceof Error ? error : null,
    { context }
  );
};

export const logError = (error: unknown, context: string, logger: Logger = createDefaultLogger()): void => {
  if (error instanceof AppError) {
    logger.error(`[${error.type}] ${error.message}`, { context, originalError: error.originalError });
  } else if (error instanceof Error) {
    logger.error(`[${ErrorType.UNKNOWN}] ${error.message}`, { context, stack: error.stack });
  } else {
    logger.error(`[${ErrorType.UNKNOWN}] Unknown error`, { context, error });
  }
};
