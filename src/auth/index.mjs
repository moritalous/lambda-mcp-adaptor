/**
 * Authentication Module
 * 
 * Provides authentication functionality for MCP servers
 */

export {
  validateBearerToken,
  createBearerTokenConfigFromEnv,
  createBearerTokenConfigWithValidation
} from './bearer-token.mjs';

export {
  createAuthMiddleware,
  createAuthenticatedHandler
} from './middleware.mjs';

/**
 * Authentication configuration presets
 */
export const AuthPresets = {
  /**
   * Bearer token authentication using environment variable
   * @param {string} envVar - Environment variable name (default: 'VALID_TOKENS')
   * @returns {Object} Authentication configuration
   */
  bearerTokenFromEnv: (envVar = 'VALID_TOKENS') => ({
    type: 'bearer-token',
    tokens: (process.env[envVar] || '').split(',').filter(t => t.trim())
  }),
  
  /**
   * Bearer token authentication with token list
   * @param {string[]} tokens - Array of valid tokens
   * @returns {Object} Authentication configuration
   */
  bearerTokenWithList: (tokens) => ({
    type: 'bearer-token',
    tokens: Array.isArray(tokens) ? tokens : [tokens]
  }),
  
  /**
   * Bearer token authentication with custom validation
   * @param {Function} validateFn - Custom validation function
   * @returns {Object} Authentication configuration
   */
  bearerTokenWithValidation: (validateFn) => ({
    type: 'bearer-token',
    validate: validateFn
  })
};

/**
 * Quick authentication setup helpers
 */
export const Auth = {
  /**
   * No authentication (default)
   */
  none: () => null,
  
  /**
   * Bearer token authentication from environment variable
   * @param {string} envVar - Environment variable name
   */
  bearerToken: (envVar = 'VALID_TOKENS') => AuthPresets.bearerTokenFromEnv(envVar),
  
  /**
   * Bearer token authentication with token list
   * @param {string|string[]} tokens - Token or array of tokens
   */
  bearerTokens: (tokens) => AuthPresets.bearerTokenWithList(tokens),
  
  /**
   * Custom bearer token validation
   * @param {Function} validateFn - Validation function
   */
  custom: (validateFn) => AuthPresets.bearerTokenWithValidation(validateFn)
};
