/**
 * MCP Server Core Implementation
 *
 * Handles MCP protocol logic and tool/resource/prompt management
 */

import {
  zodToJsonSchema,
  validateWithZod,
  isZodOptional,
} from './schema-utils.mjs';

/**
 * Main MCP Server class with Zod-based type safety
 */
export class MCPServer {
  constructor(config) {
    this.config = {
      name: config.name || 'MCP Server',
      version: config.version || '1.0.0',
      description: config.description || 'MCP Server powered by AWS Lambda',
      protocolVersion: config.protocolVersion || '2025-03-26',
      ...config,
    };

    this.tools = new Map();
    this.resources = new Map();
    this.prompts = new Map();
  }

  /**
   * Register a tool with Zod schema validation
   */
  tool(name, inputSchema, handler) {
    const jsonSchema = zodToJsonSchema(inputSchema);

    const validatedHandler = async (args) => {
      try {
        const validatedArgs = validateWithZod(inputSchema, args);
        return await handler(validatedArgs);
      } catch (error) {
        if (error.name === 'ZodError') {
          throw new Error(
            `Validation error: ${error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`
          );
        }
        throw error;
      }
    };

    this.tools.set(name, {
      name,
      description: handler.description || `Tool: ${name}`,
      inputSchema: jsonSchema,
      handler: validatedHandler,
    });

    return this;
  }

  /**
   * Register a resource
   */
  resource(name, uri, handler) {
    this.resources.set(name, {
      name,
      uri,
      description: handler.description || `Resource: ${name}`,
      handler,
    });

    return this;
  }

  /**
   * Register a prompt with Zod schema validation
   */
  prompt(name, inputSchema, handler) {
    zodToJsonSchema(inputSchema);

    const validatedHandler = async (args) => {
      try {
        const validatedArgs = validateWithZod(inputSchema, args);
        return await handler(validatedArgs);
      } catch (error) {
        if (error.name === 'ZodError') {
          throw new Error(
            `Validation error: ${error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`
          );
        }
        throw error;
      }
    };

    this.prompts.set(name, {
      name,
      description: handler.description || `Prompt: ${name}`,
      arguments: Object.entries(inputSchema).map(([key, schema]) => ({
        name: key,
        description: schema.description || `${key} parameter`,
        required: !isZodOptional(schema),
      })),
      handler: validatedHandler,
    });

    return this;
  }

  /**
   * Handle MCP protocol requests
   */
  async handleRequest(request) {
    switch (request.method) {
      case 'initialize':
        return this.handleInitialize(request.params || {});
      case 'notifications/initialized':
        return null;
      case 'tools/list':
        return this.handleToolsList(request.params || {});
      case 'tools/call':
        return this.handleToolsCall(request.params);
      case 'resources/list':
        return this.handleResourcesList(request.params || {});
      case 'resources/read':
        return this.handleResourcesRead(request.params);
      case 'prompts/list':
        return this.handlePromptsList(request.params || {});
      case 'prompts/get':
        return this.handlePromptsGet(request.params);
      default:
        throw new Error(`Method not found: ${request.method}`);
    }
  }

  /**
   * Handle initialize request
   */
  async handleInitialize() {
    return {
      protocolVersion: this.config.protocolVersion,
      capabilities: {
        tools: { listChanged: true },
        resources: { listChanged: true },
        prompts: { listChanged: true },
      },
      serverInfo: {
        name: this.config.name,
        version: this.config.version,
      },
      instructions: this.config.description,
    };
  }

  /**
   * Handle tools/list request
   */
  async handleToolsList() {
    const tools = Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));

    return { tools };
  }

  /**
   * Handle tools/call request
   */
  async handleToolsCall(params) {
    if (!params?.name) {
      throw new Error('Tool name is required');
    }

    const tool = this.tools.get(params.name);
    if (!tool) {
      throw new Error(`Tool not found: ${params.name}`);
    }

    try {
      const result = await tool.handler(params.arguments || {});
      return result;
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  }

  /**
   * Handle resources/list request
   */
  async handleResourcesList() {
    const resources = Array.from(this.resources.values()).map((resource) => ({
      uri: resource.uri,
      name: resource.name,
      description: resource.description,
    }));

    return { resources };
  }

  /**
   * Handle resources/read request
   */
  async handleResourcesRead(params) {
    if (!params?.uri) {
      throw new Error('Resource URI is required');
    }

    const resource = Array.from(this.resources.values()).find(
      (r) => r.uri === params.uri
    );
    if (!resource) {
      throw new Error(`Resource not found: ${params.uri}`);
    }

    try {
      const result = await resource.handler(params.uri);
      return result;
    } catch (error) {
      throw new Error(`Resource read error: ${error.message}`);
    }
  }

  /**
   * Handle prompts/list request
   */
  async handlePromptsList() {
    const prompts = Array.from(this.prompts.values()).map((prompt) => ({
      name: prompt.name,
      description: prompt.description,
      arguments: prompt.arguments,
    }));

    return { prompts };
  }

  /**
   * Handle prompts/get request
   */
  async handlePromptsGet(params) {
    if (!params?.name) {
      throw new Error('Prompt name is required');
    }

    const prompt = this.prompts.get(params.name);
    if (!prompt) {
      throw new Error(`Prompt not found: ${params.name}`);
    }

    try {
      const result = await prompt.handler(params.arguments || {});
      return result;
    } catch (error) {
      throw new Error(`Prompt execution error: ${error.message}`);
    }
  }

  /**
   * Get server statistics
   */
  getStats() {
    return {
      tools: this.tools.size,
      resources: this.resources.size,
      prompts: this.prompts.size,
      config: this.config,
    };
  }
}
