/**
 * Authentication Middleware Module
 *
 * Provides authentication middleware for MCP Lambda handlers
 */

import { validateBearerToken } from './bearer-token.mjs';
import { CORS_HEADERS, withBasicCORS } from '../cors-config.mjs';

/**
 * Handles CORS preflight requests
 * @param {Object} event - Lambda event object
 * @returns {Object|null} CORS response or null if not a preflight request
 */
function handleCORSPreflight(event) {
  const method = event.requestContext?.http?.method || event.httpMethod;

  if (method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: '',
    };
  }

  return null;
}

/**
 * Creates an authentication middleware function
 * @param {Object} authConfig - Authentication configuration
 * @returns {Function} Middleware function
 */
export function createAuthMiddleware(authConfig) {
  return async (event) => {
    // Handle CORS preflight requests
    const corsResponse = handleCORSPreflight(event);
    if (corsResponse) {
      return corsResponse;
    }

    // Perform authentication based on type
    let authResult;

    switch (authConfig.type) {
      case 'bearer-token':
        authResult = validateBearerToken(event, authConfig);
        break;

      default:
        console.error(`Unsupported authentication type: ${authConfig.type}`);
        return {
          statusCode: 500,
          headers: withBasicCORS({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            error: 'server_error',
            message: 'Unsupported authentication type',
          }),
        };
    }

    // Handle authentication failure
    if (!authResult.isValid) {
      console.log('Authentication failed:', authResult.error.body);
      return authResult.error;
    }

    // Authentication successful - add user context to event
    event.user = authResult.user;
    event.authToken = authResult.token;

    console.log('Authentication successful');
    return null; // Continue to next middleware/handler
  };
}

/**
 * Creates an authenticated Lambda handler wrapper
 * @param {Function} originalHandler - Original Lambda handler function
 * @param {Object} authConfig - Authentication configuration
 * @returns {Function} Wrapped handler with authentication
 */
export function createAuthenticatedHandler(originalHandler, authConfig) {
  const authMiddleware = createAuthMiddleware(authConfig);

  return async (event) => {
    console.log('=== MCP Server Request Start (with Authentication) ===');
    console.log('Event:', JSON.stringify(event, null, 2));

    try {
      // Run authentication middleware
      const authResponse = await authMiddleware(event);

      // If middleware returns a response, it means authentication failed or CORS preflight
      if (authResponse) {
        return authResponse;
      }

      // Authentication successful, proceed with original handler
      const response = await originalHandler(event);

      console.log('=== MCP Server Request End ===');
      return response;
    } catch (error) {
      console.error('Error in authenticated MCP server:', error);
      return {
        statusCode: 500,
        headers: withBasicCORS({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          error: 'internal_server_error',
          message: 'An internal server error occurred',
        }),
      };
    }
  };
}
