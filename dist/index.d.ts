/**
 * TypeScript definitions for @aws-lambda-mcp/adapter
 */

import { z } from 'zod';
import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from 'aws-lambda';

// Core Types
export interface MCPServerConfig {
  name: string;
  version: string;
  description?: string;
  protocolVersion?: string;
}

// JSON-RPC Types
export interface JsonRpcRequest {
  jsonrpc: string;
  method: string;
  params?: Record<string, unknown>;
  id?: string | number | null;
}

export interface JsonRpcResponse {
  jsonrpc: string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
  id?: string | number | null;
}

export interface MCPToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

export interface MCPResourceResult {
  contents: Array<{
    uri: string;
    text?: string;
    blob?: string;
    mimeType?: string;
  }>;
}

export interface MCPPromptResult {
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: {
      type: 'text' | 'image';
      text?: string;
      data?: string;
      mimeType?: string;
    };
  }>;
}

// Authentication Types
export interface AuthUser {
  token?: string;
  [key: string]: unknown;
}

export interface AuthValidationResult {
  isValid: boolean;
  user?: AuthUser;
  token?: string;
  error?: APIGatewayProxyResult;
}

export interface BearerTokenAuthConfig {
  type: 'bearer-token';
  tokens?: string[];
  validate?: (
    token: string,
    event: APIGatewayProxyEvent
  ) => AuthValidationResult | Promise<AuthValidationResult>;
}

export type AuthConfig = BearerTokenAuthConfig;

export interface LambdaHandlerOptions {
  auth?: AuthConfig;
}

// Schema Types
export type ZodSchema = Record<string, z.ZodType>;
export type ToolHandler<T = Record<string, unknown>> = (args: T) => Promise<MCPToolResult>;
export type ResourceHandler = (uri: string) => Promise<MCPResourceResult>;
export type PromptHandler<T = Record<string, unknown>> = (args: T) => Promise<MCPPromptResult>;

// Core Classes
export declare class MCPServer {
  constructor(config: MCPServerConfig);

  tool<T extends ZodSchema>(
    name: string,
    inputSchema: T,
    handler: ToolHandler<z.infer<z.ZodObject<T>>>
  ): MCPServer;

  resource(name: string, uri: string, handler: ResourceHandler): MCPServer;

  prompt<T extends ZodSchema>(
    name: string,
    inputSchema: T,
    handler: PromptHandler<z.infer<z.ZodObject<T>>>
  ): MCPServer;

  handleRequest(request: JsonRpcRequest): Promise<JsonRpcResponse | null>;
  getStats(): {
    tools: number;
    resources: number;
    prompts: number;
    config: MCPServerConfig;
  };
}

// Main Functions
export declare function createMCPServer(config: MCPServerConfig): MCPServer;

export declare function createLambdaHandler(
  mcpServer: MCPServer,
  options?: LambdaHandlerOptions
): (
  event: APIGatewayProxyEvent,
  context: Context
) => Promise<APIGatewayProxyResult>;

// Common Schemas
export declare const CommonSchemas: {
  string: z.ZodString;
  number: z.ZodNumber;
  boolean: z.ZodBoolean;
  optionalString: z.ZodOptional<z.ZodString>;
  optionalNumber: z.ZodOptional<z.ZodNumber>;
  optionalBoolean: z.ZodOptional<z.ZodBoolean>;
  email: z.ZodString;
  url: z.ZodString;
  uuid: z.ZodString;
  enum: <T extends readonly [string, ...string[]]>(values: T) => z.ZodEnum<T>;
  array: <T extends z.ZodType>(itemSchema: T) => z.ZodArray<T>;
  object: <T extends z.ZodRawShape>(shape: T) => z.ZodObject<T>;
};
