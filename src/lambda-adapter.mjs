/**
 * AWS Lambda Adapter
 * 
 * Handles Lambda integration and HTTP request/response processing
 */

import { CORS_HEADERS, withBasicCORS } from './cors-config.mjs';

/**
 * Create HTTP response
 */
export function createResponse(body, statusCode = 200, headers = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  };
}

/**
 * Create error response
 */
export function createErrorResponse(statusCode, code, message, headers = {}, id = null) {
  return createResponse({
    jsonrpc: '2.0',
    error: { code, message },
    id
  }, statusCode, headers);
}

/**
 * Handle MCP request processing
 */
export async function handleMCPRequest(mcpServer, body, headers, corsHeaders) {
  const contentType = headers['content-type'] || headers['Content-Type'] || '';
  if (!contentType.includes('application/json')) {
    return createErrorResponse(400, -32700, 'Parse error: Content-Type must be application/json', corsHeaders);
  }
  
  let jsonRpcMessage;
  try {
    jsonRpcMessage = JSON.parse(body || '{}');
  } catch (error) {
    return createErrorResponse(400, -32700, 'Parse error: Invalid JSON', corsHeaders);
  }
  
  if (!jsonRpcMessage.jsonrpc || jsonRpcMessage.jsonrpc !== '2.0') {
    return createErrorResponse(400, -32600, 'Invalid Request: missing jsonrpc field', corsHeaders, jsonRpcMessage.id);
  }
  
  if (!jsonRpcMessage.method) {
    return createErrorResponse(400, -32600, 'Invalid Request: missing method field', corsHeaders, jsonRpcMessage.id);
  }
  
  try {
    const result = await mcpServer.handleRequest(jsonRpcMessage);
    
    if (result === null) {
      return createResponse('', 204, corsHeaders);
    }
    
    return createResponse({
      jsonrpc: '2.0',
      result,
      id: jsonRpcMessage.id
    }, 200, corsHeaders);
    
  } catch (error) {
    console.error('MCP request error:', error);
    
    let errorCode = -32603; // Internal error
    let errorMessage = error.message;
    
    if (error.message.includes('Method not found')) {
      errorCode = -32601;
    } else if (error.message.includes('not found') || error.message.includes('required')) {
      errorCode = -32602; // Invalid params
    }
    
    return createErrorResponse(500, errorCode, errorMessage, corsHeaders, jsonRpcMessage.id);
  }
}

/**
 * AWS Lambda Adapter for MCP Server
 */
export function createLambdaHandler(mcpServer, options = {}) {
  const baseHandler = async (event, context) => {
    try {
      const method = event.httpMethod || event.requestContext?.http?.method;
      const headers = event.headers || {};
      
      if (method === 'OPTIONS') {
        return createResponse('', 200, CORS_HEADERS);
      }
      
      if (method === 'POST') {
        return await handleMCPRequest(mcpServer, event.body, headers, CORS_HEADERS);
      }
      
      if (method === 'GET') {
        return createErrorResponse(405, -32000, 'Method not allowed: Stateless mode', CORS_HEADERS);
      }
      
      return createErrorResponse(405, -32000, `Method not allowed: ${method}`, CORS_HEADERS);
      
    } catch (error) {
      console.error('Lambda error:', error);
      return createErrorResponse(500, -32603, 'Internal server error', 
        withBasicCORS({ 'Content-Type': 'application/json' })
      );
    }
  };
  
  // If authentication is configured, wrap with authentication middleware
  if (options.auth) {
    return async (event, context) => {
      try {
        const { createAuthenticatedHandler } = await import('./auth/middleware.mjs');
        const authenticatedHandler = createAuthenticatedHandler(baseHandler, options.auth);
        return await authenticatedHandler(event, context);
      } catch (error) {
        console.error('Authentication module error:', error);
        return {
          statusCode: 500,
          headers: withBasicCORS({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            error: 'server_error',
            message: 'Authentication module not available'
          })
        };
      }
    };
  }
  
  return baseHandler;
}
