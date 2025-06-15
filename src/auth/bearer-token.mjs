/**
 * Bearer Token Authentication Module
 *
 * Provides Bearer token validation functionality for MCP servers
 */

import { withCORS } from '../cors-config.mjs';

/**
 * Creates an authentication error response
 * @param {number} statusCode - HTTP status code
 * @param {string} error - Error code
 * @param {string} message - Error message
 * @param {Object} additionalHeaders - Additional headers to include
 * @returns {Object} Lambda response object
 */
function createAuthErrorResponse(
  statusCode,
  error,
  message,
  additionalHeaders = {}
) {
  const headers = withCORS({
    'Content-Type': 'application/json',
    ...additionalHeaders,
  });

  return {
    statusCode,
    headers,
    body: JSON.stringify({
      error,
      message,
    }),
  };
}

/**
 * Validates Bearer token from the Authorization header
 * @param {Object} event - Lambda event object
 * @param {Object} config - Authentication configuration
 * @returns {Object} Validation result with isValid flag and error/user data
 */
export function validateBearerToken(event, config = {}) {
  const authHeader =
    event.headers?.authorization || event.headers?.Authorization;

  // Check if Authorization header exists
  if (!authHeader) {
    return {
      isValid: false,
      error: createAuthErrorResponse(
        401,
        'unauthorized',
        'Authorization header is required',
        { 'WWW-Authenticate': 'Bearer realm="MCP Server"' }
      ),
    };
  }

  // Check if it's a Bearer token
  if (!authHeader.startsWith('Bearer ')) {
    return {
      isValid: false,
      error: createAuthErrorResponse(
        401,
        'unauthorized',
        'Bearer token is required',
        { 'WWW-Authenticate': 'Bearer realm="MCP Server"' }
      ),
    };
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  // Handle custom validation function
  if (config.validate && typeof config.validate === 'function') {
    try {
      const result = config.validate(token, event);
      if (result && result.isValid) {
        return {
          isValid: true,
          user: result.user || { token },
          token,
        };
      } else {
        return {
          isValid: false,
          error:
            result?.error ||
            createAuthErrorResponse(
              401,
              'invalid_token',
              'Invalid or expired token',
              { 'WWW-Authenticate': 'Bearer realm="MCP Server"' }
            ),
        };
      }
    } catch (error) {
      console.error('Error in custom token validation:', error);
      return {
        isValid: false,
        error: createAuthErrorResponse(
          500,
          'server_error',
          'Authentication validation error'
        ),
      };
    }
  }

  // Handle token list validation
  const validTokens = config.tokens || [];

  if (validTokens.length === 0) {
    console.warn('No valid tokens configured for Bearer token authentication.');
    return {
      isValid: false,
      error: createAuthErrorResponse(
        500,
        'server_error',
        'Authentication not configured'
      ),
    };
  }

  if (!validTokens.includes(token)) {
    return {
      isValid: false,
      error: createAuthErrorResponse(
        401,
        'invalid_token',
        'Invalid or expired token',
        { 'WWW-Authenticate': 'Bearer realm="MCP Server"' }
      ),
    };
  }

  return {
    isValid: true,
    user: { token },
    token,
  };
}

/**
 * Creates a Bearer token authentication configuration from environment variables
 * @param {string} envVar - Environment variable name containing comma-separated tokens
 * @returns {Object} Authentication configuration
 */
export function createBearerTokenConfigFromEnv(envVar = 'VALID_TOKENS') {
  const tokens = (process.env[envVar] || '').split(',').filter((t) => t.trim());

  return {
    type: 'bearer-token',
    tokens,
  };
}

/**
 * Creates a Bearer token authentication configuration with custom validation
 * @param {Function} validateFn - Custom validation function
 * @returns {Object} Authentication configuration
 */
export function createBearerTokenConfigWithValidation(validateFn) {
  return {
    type: 'bearer-token',
    validate: validateFn,
  };
}
