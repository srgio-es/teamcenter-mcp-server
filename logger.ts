import * as winston from 'winston';
import * as path from 'path';
import * as fs from 'fs';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log file paths
const logFilePath = path.join(logsDir, 'teamcenter-mcp-server.log');
const errorLogFilePath = path.join(logsDir, 'teamcenter-mcp-server-error.log');

// Custom format for log messages
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    // Ensure level is a string before calling toUpperCase
    const levelStr = typeof level === 'string' ? level.toUpperCase() : String(level).toUpperCase();
    return `${timestamp} [${levelStr}]: ${message}${metaStr}`;
  })
);

// Create Winston logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'teamcenter-mcp-server' },
  transports: [
    // Write all logs to the combined log file
    new winston.transports.File({ 
      filename: logFilePath,
      level: 'debug'
    }),
    // Write error logs to a separate file
    new winston.transports.File({ 
      filename: errorLogFilePath, 
      level: 'error' 
    }),
  ],
  // Do not exit on uncaught exceptions
  exitOnError: false
});

// Add console transport only if explicitly enabled (not recommended for MCP servers)
if (process.env.ENABLE_CONSOLE_LOGGING === 'true') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      logFormat
    ),
    // Write to stderr instead of stdout for console transport
    stderrLevels: ['error', 'warn', 'info', 'debug', 'verbose', 'silly']
  }));
}

// Utility function to log requests and responses
const logTeamcenterRequest = (service: string, operation: string, params: unknown, requestId?: string) => {
  const reqId = requestId || `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  
  // Mask sensitive data like passwords
  const sanitizedParams = JSON.parse(JSON.stringify(params || {}));
  if (service === 'Core-2011-06-Session' && operation === 'login') {
    if (sanitizedParams.credentials?.password) {
      sanitizedParams.credentials.password = '***';
    } else if (sanitizedParams.password) {
      sanitizedParams.password = '***';
    } else if (sanitizedParams.body?.credentials?.password) {
      sanitizedParams.body.credentials.password = '***';
    }
  }
  
  logger.info(`[${reqId}] TC REQUEST: ${service}.${operation}`, { params: sanitizedParams });
  return reqId;
};

const logTeamcenterResponse = (service: string, operation: string, response: unknown, requestId: string, error?: Error) => {
  if (error) {
    logger.error(`[${requestId}] TC RESPONSE ERROR: ${service}.${operation}`, { error: error.message, stack: error.stack });
  } else {
    logger.info(`[${requestId}] TC RESPONSE: ${service}.${operation}`, { response });
  }
};

// Export a wrapper with typed methods
export default {
  error: (message: string, ...meta: any[]) => {
    logger.error(message, ...meta);
  },
  warn: (message: string, ...meta: any[]) => {
    logger.warn(message, ...meta);
  },
  info: (message: string, ...meta: any[]) => {
    logger.info(message, ...meta);
  },
  debug: (message: string, ...meta: any[]) => {
    logger.debug(message, ...meta);
  },
  // Method to get the log file path (useful for diagnostics)
  getLogFilePath: () => logFilePath,
  // Teamcenter request/response logging
  logTeamcenterRequest,
  logTeamcenterResponse
};
