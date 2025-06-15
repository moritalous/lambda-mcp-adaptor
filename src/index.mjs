/**
 * @aws-lambda-mcp/adapter
 *
 * An MCP (Model Context Protocol) server SDK for AWS Lambda
 * with Zod-based type safety, authentication support, and clean separation of concerns.
 */

// Core imports
import { MCPServer } from './mcp-server.mjs';

// Core exports
export { MCPServer } from './mcp-server.mjs';
export { createLambdaHandler } from './lambda-adapter.mjs';
export { CommonSchemas } from './common-schemas.mjs';

// Convenience function
export function createMCPServer(config) {
  return new MCPServer(config);
}
