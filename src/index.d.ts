/**
 * TypeScript definitions for @aws-lambda-mcp/adapter
 */

import { z } from 'zod';

export interface MCPServerConfig {
  name: string;
  version: string;
  description?: string;
  protocolVersion?: string;
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

export type ZodSchema = Record<string, z.ZodType>;

export type ToolHandler<T = any> = (args: T) => Promise<MCPToolResult>;
export type ResourceHandler = (uri: string) => Promise<MCPResourceResult>;
export type PromptHandler<T = any> = (args: T) => Promise<MCPPromptResult>;

export declare class MCPServer {
  constructor(config: MCPServerConfig);
  
  tool<T extends ZodSchema>(
    name: string,
    inputSchema: T,
    handler: ToolHandler<z.infer<z.ZodObject<T>>>
  ): MCPServer;
  
  resource(
    name: string,
    uri: string,
    handler: ResourceHandler
  ): MCPServer;
  
  prompt<T extends ZodSchema>(
    name: string,
    inputSchema: T,
    handler: PromptHandler<z.infer<z.ZodObject<T>>>
  ): MCPServer;
  
  handleRequest(request: any): Promise<any>;
  getStats(): {
    tools: number;
    resources: number;
    prompts: number;
    config: MCPServerConfig;
  };
}

export interface AWSLambdaEvent {
  httpMethod: string;
  headers: Record<string, string>;
  body: string;
}

export interface AWSLambdaContext {
  // AWS Lambda context properties
}

export interface AWSLambdaResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export type LambdaHandler = (
  event: AWSLambdaEvent,
  context: AWSLambdaContext
) => Promise<AWSLambdaResponse>;

export declare function createLambdaHandler(mcpServer: MCPServer): LambdaHandler;

export declare function createMCPServer(config: MCPServerConfig): MCPServer;

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
