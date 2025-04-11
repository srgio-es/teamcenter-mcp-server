import { TCSOAClientConfig } from './types.js';
import { createJSONRequest, getSessionCookie, storeSessionCookie } from './tcUtils.js';
import { parseJSONResponse } from './tcResponseParser.js';
import { AppError, ErrorType, handleApiError, logError } from './tcErrors.js';
import { Logger, createDefaultLogger } from './logger.js';

/**
 * Real API communication implementation for Teamcenter services
 * @param config The SOA client configuration
 * @param sessionId The current session ID or null if not logged in
 * @param service The service name
 * @param operation The operation name
 * @param params The operation parameters
 * @param logger Optional logger instance
 * @returns The response data
 */
export const realCallService = async (
  config: TCSOAClientConfig,
  sessionId: string | null,
  service: string,
  operation: string,
  params: unknown,
  logger: Logger = createDefaultLogger()
): Promise<unknown> => {
  // Form the REST endpoint URL
  const endpoint = `${config.endpoint}/${service}/${operation}`;
  
  // Generate a unique request ID for tracing
  const requestId = logger.logTeamcenterRequest(service, operation, params);
  
  try {
    logger.info(`[${requestId}] Making Teamcenter API call to: ${endpoint}`);
    
    if (service === 'Core-2011-06-Session' && operation === 'login') {
      const credentials = params as { username: string; password: string };
      logger.info(`[${requestId}] Login request received`, { username: credentials.username });
    }
    
    // Create JSON request body with the proper envelope structure
    const jsonRequestBody = createJSONRequest(service, operation, params, logger);
    
    // Set up the headers
    const headers: HeadersInit = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    };
    
    // Add the session ID as authorization if available
    if (sessionId) {
      headers['Authorization'] = `Session ${sessionId}`;
      logger.debug('Added session ID to Authorization header');
    }
    
    // Explicitly add session cookie to the request if it exists
    const sessionCookie = getSessionCookie(logger);
    if (sessionCookie) {
      logger.debug(`Adding ${sessionCookie.name} cookie to request headers`);
      headers['Cookie'] = `${sessionCookie.name}=${sessionCookie.value}`;
    }
    
    logger.debug('Request headers:', headers);
    
    // Set up fetch options with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout || 60000);
    
    // Make the fetch request
    let response;
    try {
      const fetchOptions = {
        method: 'POST',
        headers,
        body: JSON.stringify(jsonRequestBody),
        signal: controller.signal // For timeout handling
      };
      
      response = await fetch(endpoint, fetchOptions);
      
      // Clear the timeout
      clearTimeout(timeoutId);
      
      // Check for successful response
      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`API error: ${response.status} ${response.statusText}`);
        logger.error('Error details:', errorText);
        
        // Create a more specific error based on the status code
        if (response.status === 401 || response.status === 403) {
          throw new AppError(
            `Authentication error: ${response.statusText}`,
            ErrorType.AUTH_SESSION,
            new Error(errorText),
            { status: response.status }
          );
        } else if (response.status === 404) {
          throw new AppError(
            `Service not found: ${service}.${operation}`,
            ErrorType.API_RESPONSE,
            new Error(errorText),
            { status: response.status }
          );
        } else if (response.status >= 500) {
          throw new AppError(
            `Server error: ${response.statusText}`,
            ErrorType.API_RESPONSE,
            new Error(errorText),
            { status: response.status }
          );
        } else {
          throw new AppError(
            `Teamcenter API error: ${response.status} ${response.statusText}`,
            ErrorType.API_RESPONSE,
            new Error(errorText),
            { status: response.status }
          );
        }
      }
    } catch (error) {
      // Clear the timeout if there was an error
      clearTimeout(timeoutId);
      
      // Handle abort error (timeout)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AppError(
          `Request timeout after ${config.timeout || 60000}ms`,
          ErrorType.API_TIMEOUT,
          error,
          { service, operation }
        );
      }
      
      // Handle network errors
      if (error instanceof Error && error.message.includes('fetch failed')) {
        throw new AppError(
          `Network error connecting to Teamcenter: ${error.message}`,
          ErrorType.NETWORK,
          error,
          { service, operation, endpoint }
        );
      }
      
      // Re-throw other errors
      throw error;
    }
    
    // Get and log useful headers
    let newSessionId = null;
    const contentType = response.headers.get('content-type');
    
    // Extract session ID from authorization header if present
    // Note: We're still extracting this for logging purposes, but the cookie-based session ID
    // will be prioritized in tcSOAClient.ts
    newSessionId = response.headers.get('Authorization') || 
                  response.headers.get('X-Siemens-Session-ID') || 
                  response.headers.get('Tc-Session-ID');
    
    logger.debug('Response content type:', contentType);
    if (newSessionId) {
      logger.debug('Session ID found in headers (will be used as fallback only)');
    }
    
    // Check for session cookies in the response
    const setCookieHeader = response.headers.get('Set-Cookie');
    if (setCookieHeader) {
      logger.debug('Set-Cookie header found:', setCookieHeader);
      
      // Parse the Set-Cookie header to extract session cookies
      // This is a simplified approach - in a real implementation, you might use a cookie parsing library
      const cookies = setCookieHeader.split(',');
      
      for (const cookie of cookies) {
        const [cookieNameValue] = cookie.split(';');
        const [cookieName, cookieValue] = cookieNameValue.split('=');
        
        if (cookieName.trim() === 'JSESSIONID') {
          logger.debug(`Found JSESSIONID cookie in response: ${cookieValue}`);
          // Store the session cookie for future requests
          storeSessionCookie('JSESSIONID', cookieValue, logger);
        } else if (cookieName.trim() === 'ASP.NET_SessionId') {
          logger.debug(`Found ASP.NET_SessionId cookie in response: ${cookieValue}`);
          // Store the session cookie for future requests
          storeSessionCookie('ASP.NET_SessionId', cookieValue, logger);
        }
      }
    }
    
    // Parse the JSON response
    let jsonData;
    try {
      jsonData = await response.json();
      logger.debug(`[${requestId}] ${service}.${operation} response received`);
      
      // Debug log the response data
      logger.debug(`[${requestId}] Response data:`, jsonData);
      
      // Parse the response
      const parsedData = parseJSONResponse(service, operation, jsonData as Record<string, unknown>, logger);
      
      // Log the parsed response
      logger.logTeamcenterResponse(service, operation, parsedData, requestId);
      
      // Extract data from the response
      return {
        data: parsedData,
        headers: response.headers,
        sessionId: newSessionId
      };
    } catch (error) {
      logger.error(`[${requestId}] Failed to parse JSON response:`, error);
      logger.logTeamcenterResponse(service, operation, null, requestId, 
        error instanceof Error ? error : new Error('Failed to parse response as JSON'));
      
      throw new AppError(
        'Failed to parse response as JSON',
        ErrorType.DATA_PARSING,
        error instanceof Error ? error : null,
        { service, operation, responseText: await response.text() }
      );
    }
  } catch (error) {
    // Handle and log the error
    if (error instanceof AppError) {
      // Already an AppError, just log it
      logger.error(`[${requestId}] ${error.type} Error in ${service}.${operation}: ${error.message}`);
      logger.logTeamcenterResponse(service, operation, null, requestId, error);
      throw error;
    } else {
      // Convert to AppError and log
      const apiError = handleApiError(error, `${service}.${operation}`);
      logger.logTeamcenterResponse(service, operation, null, requestId, apiError);
      // Log additional context for debugging
      logError(apiError, `API call to ${service}.${operation}`, logger);
      throw apiError;
    }
  }
};
