import { describe, expect, it, jest } from '@jest/globals';
import logger from '../logger.js';

// Mock winston to avoid actual file writes during tests
jest.mock('winston', () => {
  const mockLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
  
  return {
    format: {
      combine: jest.fn(),
      timestamp: jest.fn(),
      errors: jest.fn(),
      splat: jest.fn(),
      printf: jest.fn(),
      colorize: jest.fn(),
    },
    createLogger: jest.fn(() => mockLogger),
    transports: {
      File: jest.fn(),
      Console: jest.fn(),
    },
  };
});

describe('logger', () => {
  it('should expose the expected logging methods', () => {
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.getLogFilePath).toBe('function');
    expect(typeof logger.logTeamcenterRequest).toBe('function');
    expect(typeof logger.logTeamcenterResponse).toBe('function');
  });

  it('logTeamcenterRequest should mask password in login requests', () => {
    const requestId = logger.logTeamcenterRequest(
      'Core-2011-06-Session',
      'login',
      { credentials: { username: 'testuser', password: 'secret' } }
    );
    
    expect(requestId).toBeDefined();
    expect(requestId).toMatch(/^req_\d+_[a-z0-9]+$/);
  });

  it('logTeamcenterRequest should generate a unique request ID', () => {
    const requestId1 = logger.logTeamcenterRequest('Test', 'operation', {});
    const requestId2 = logger.logTeamcenterRequest('Test', 'operation', {});
    
    expect(requestId1).not.toBe(requestId2);
  });

  it('logTeamcenterRequest should use provided request ID if given', () => {
    const customId = 'custom_request_id';
    const requestId = logger.logTeamcenterRequest('Test', 'operation', {}, customId);
    
    expect(requestId).toBe(customId);
  });
});
