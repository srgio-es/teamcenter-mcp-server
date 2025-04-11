import { describe, expect, it, jest } from '@jest/globals';
import { TeamcenterServer } from '../index.js';

// Mock the required modules
jest.mock('@modelcontextprotocol/sdk/server/index.js');
jest.mock('@modelcontextprotocol/sdk/server/stdio.js');
jest.mock('teamcenter-client');
jest.mock('dotenv');
jest.mock('../logger.js', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

// Set environment variables for testing
process.env.MOCK_MODE = 'true';
process.env.TEAMCENTER_BASE_URL = 'http://test.example.com';
process.env.TEAMCENTER_USERNAME = 'testuser';
process.env.TEAMCENTER_PASSWORD = 'testpass';

describe('TeamcenterServer', () => {
  it('should be defined', () => {
    expect(TeamcenterServer).toBeDefined();
  });
});
