import { describe, expect, it } from '@jest/globals';
import { AppError, ErrorType, handleApiError, handleDataError, handleAuthError, handleNetworkError } from '../src/tcErrors.js';

describe('tcErrors', () => {
  describe('AppError', () => {
    it('should create an error with the correct properties', () => {
      const message = 'Test error message';
      const type = ErrorType.API_RESPONSE;
      const originalError = new Error('Original error');
      const context = { method: 'testMethod' };

      const error = new AppError(message, type, originalError, context);

      expect(error.message).toBe(message);
      expect(error.type).toBe(type);
      expect(error.originalError).toBe(originalError);
      expect(error.context).toEqual(context);
      expect(error.name).toBe('AppError');
      expect(error instanceof Error).toBe(true);
    });

    it('should create an error with undefined context when not provided', () => {
      const message = 'Test error message';
      const type = ErrorType.DATA_PARSING;
      const originalError = new Error('Original error');

      const error = new AppError(message, type, originalError);

      expect(error.message).toBe(message);
      expect(error.type).toBe(type);
      expect(error.originalError).toBe(originalError);
      expect(error.context).toBeUndefined();
    });
  });

  describe('ErrorType', () => {
    it('should have the expected error types', () => {
      expect(ErrorType.API_RESPONSE).toBe('API_RESPONSE');
      expect(ErrorType.DATA_PARSING).toBe('DATA_PARSING');
      expect(ErrorType.AUTH_SESSION).toBe('AUTH_SESSION');
      expect(ErrorType.NETWORK).toBe('NETWORK');
      expect(ErrorType.API_TIMEOUT).toBe('API_TIMEOUT');
      expect(ErrorType.DATA_VALIDATION).toBe('DATA_VALIDATION');
      expect(ErrorType.UNKNOWN).toBe('UNKNOWN');
    });
  });

  describe('Error handlers', () => {
    it('handleApiError should create an AppError with API_RESPONSE type', () => {
      const originalError = new Error('Network failed');
      const error = handleApiError(originalError, 'getItem');
      
      expect(error).toBeInstanceOf(AppError);
      expect(error.type).toBe(ErrorType.API_RESPONSE);
      expect(error.originalError).toBe(originalError);
      expect(error.message).toContain('API error in getItem');
    });

    it('handleDataError should create an AppError with DATA_PARSING type', () => {
      const originalError = new Error('Invalid JSON');
      const error = handleDataError(originalError, 'parseResponse');
      
      expect(error).toBeInstanceOf(AppError);
      expect(error.type).toBe(ErrorType.DATA_PARSING);
      expect(error.originalError).toBe(originalError);
      expect(error.message).toContain('Data error in parseResponse');
    });

    it('handleAuthError should create an AppError with AUTH_SESSION type', () => {
      const originalError = new Error('Invalid credentials');
      const error = handleAuthError(originalError, 'login');
      
      expect(error).toBeInstanceOf(AppError);
      expect(error.type).toBe(ErrorType.AUTH_SESSION);
      expect(error.originalError).toBe(originalError);
      expect(error.message).toContain('Authentication error in login');
    });

    it('handleNetworkError should create an AppError with NETWORK type', () => {
      const originalError = new Error('Connection refused');
      const error = handleNetworkError(originalError, 'apiCall');
      
      expect(error).toBeInstanceOf(AppError);
      expect(error.type).toBe(ErrorType.NETWORK);
      expect(error.originalError).toBe(originalError);
      expect(error.message).toContain('Network error in apiCall');
    });

    it('error handlers should return the original error if it is already an AppError', () => {
      const originalError = new AppError('Already handled', ErrorType.DATA_VALIDATION, null);
      
      const apiError = handleApiError(originalError, 'test');
      const dataError = handleDataError(originalError, 'test');
      const authError = handleAuthError(originalError, 'test');
      const networkError = handleNetworkError(originalError, 'test');
      
      expect(apiError).toBe(originalError);
      expect(dataError).toBe(originalError);
      expect(authError).toBe(originalError);
      expect(networkError).toBe(originalError);
    });
  });
});
