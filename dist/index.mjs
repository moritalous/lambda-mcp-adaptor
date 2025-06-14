// src/index.mjs
import { z } from "zod";
var MCPServer = class {
  constructor(config) {
    this.config = {
      name: config.name || "MCP Server",
      version: config.version || "1.0.0",
      description: config.description || "MCP Server powered by AWS Lambda",
      protocolVersion: config.protocolVersion || "2025-03-26",
      ...config
    };
    this.tools = /* @__PURE__ */ new Map();
    this.resources = /* @__PURE__ */ new Map();
    this.prompts = /* @__PURE__ */ new Map();
  }
  /**
   * Register a tool with Zod schema validation
   */
  tool(name, inputSchema, handler) {
    const jsonSchema = this.zodToJsonSchema(inputSchema);
    const validatedHandler = async (args) => {
      try {
        const validatedArgs = this.validateWithZod(inputSchema, args);
        return await handler(validatedArgs);
      } catch (error) {
        if (error.name === "ZodError") {
          throw new Error(`Validation error: ${error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`);
        }
        throw error;
      }
    };
    this.tools.set(name, {
      name,
      description: handler.description || `Tool: ${name}`,
      inputSchema: jsonSchema,
      handler: validatedHandler,
      zodSchema: inputSchema
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
      handler
    });
    return this;
  }
  /**
   * Register a prompt
   */
  prompt(name, inputSchema, handler) {
    const jsonSchema = this.zodToJsonSchema(inputSchema);
    this.prompts.set(name, {
      name,
      description: handler.description || `Prompt: ${name}`,
      inputSchema: jsonSchema,
      handler,
      zodSchema: inputSchema
    });
    return this;
  }
  /**
   * Convert Zod schema object to JSON Schema
   */
  zodToJsonSchema(zodSchema) {
    const properties = {};
    const required = [];
    for (const [key, schema] of Object.entries(zodSchema)) {
      const jsonSchemaProperty = this.convertZodToJsonSchema(schema);
      properties[key] = jsonSchemaProperty;
      if (!this.isZodOptional(schema) && !this.hasZodDefault(schema)) {
        required.push(key);
      }
    }
    return {
      type: "object",
      properties,
      required
    };
  }
  /**
   * Convert individual Zod schema to JSON Schema property
   */
  convertZodToJsonSchema(zodSchema) {
    if (zodSchema._def.typeName === "ZodOptional") {
      return this.convertZodToJsonSchema(zodSchema._def.innerType);
    }
    if (zodSchema._def.typeName === "ZodDefault") {
      const baseSchema = this.convertZodToJsonSchema(zodSchema._def.innerType);
      baseSchema.default = zodSchema._def.defaultValue();
      return baseSchema;
    }
    switch (zodSchema._def.typeName) {
      case "ZodString":
        return {
          type: "string",
          description: zodSchema.description || "String value"
        };
      case "ZodNumber":
        return {
          type: "number",
          description: zodSchema.description || "Numeric value"
        };
      case "ZodBoolean":
        return {
          type: "boolean",
          description: zodSchema.description || "Boolean value"
        };
      case "ZodEnum":
        return {
          type: "string",
          enum: zodSchema._def.values,
          description: zodSchema.description || `One of: ${zodSchema._def.values.join(", ")}`
        };
      case "ZodArray":
        return {
          type: "array",
          items: this.convertZodToJsonSchema(zodSchema._def.type),
          description: zodSchema.description || "Array of values"
        };
      case "ZodObject":
        const nestedProperties = {};
        const nestedRequired = [];
        for (const [key, nestedSchema] of Object.entries(zodSchema._def.shape())) {
          nestedProperties[key] = this.convertZodToJsonSchema(nestedSchema);
          if (!this.isZodOptional(nestedSchema)) {
            nestedRequired.push(key);
          }
        }
        return {
          type: "object",
          properties: nestedProperties,
          required: nestedRequired,
          description: zodSchema.description || "Object value"
        };
      default:
        console.warn(`Unknown Zod type: ${zodSchema._def.typeName}, defaulting to string`);
        return {
          type: "string",
          description: zodSchema.description || "String value"
        };
    }
  }
  /**
   * Check if Zod schema is optional
   */
  isZodOptional(zodSchema) {
    return zodSchema._def.typeName === "ZodOptional" || zodSchema._def.typeName === "ZodDefault";
  }
  /**
   * Check if Zod schema has default value
   */
  hasZodDefault(zodSchema) {
    return zodSchema._def.typeName === "ZodDefault";
  }
  /**
   * Validate arguments with Zod schema
   */
  validateWithZod(zodSchema, args) {
    const validated = {};
    for (const [key, schema] of Object.entries(zodSchema)) {
      try {
        if (args[key] === void 0 && this.isZodOptional(schema)) {
          if (this.hasZodDefault(schema)) {
            validated[key] = schema.parse(void 0);
          }
          continue;
        }
        validated[key] = schema.parse(args[key]);
      } catch (error) {
        throw new z.ZodError([{
          code: "custom",
          path: [key],
          message: `${error.message}`
        }]);
      }
    }
    return validated;
  }
  /**
   * Handle MCP protocol requests
   */
  async handleRequest(request) {
    switch (request.method) {
      case "initialize":
        return this.handleInitialize(request.params || {});
      case "notifications/initialized":
        return null;
      case "tools/list":
        return this.handleToolsList(request.params || {});
      case "tools/call":
        return this.handleToolsCall(request.params);
      case "resources/list":
        return this.handleResourcesList(request.params || {});
      case "resources/read":
        return this.handleResourcesRead(request.params);
      case "prompts/list":
        return this.handlePromptsList(request.params || {});
      case "prompts/get":
        return this.handlePromptsGet(request.params);
      default:
        throw new Error(`Method not found: ${request.method}`);
    }
  }
  /**
   * Handle initialize request
   */
  async handleInitialize(params) {
    const clientVersion = params.protocolVersion;
    const supportedVersions = ["2024-11-05", "2025-03-26"];
    const negotiatedVersion = supportedVersions.includes(clientVersion) ? clientVersion : this.config.protocolVersion;
    return {
      protocolVersion: negotiatedVersion,
      capabilities: {
        tools: this.tools.size > 0 ? { listChanged: true } : void 0,
        resources: this.resources.size > 0 ? { listChanged: true } : void 0,
        prompts: this.prompts.size > 0 ? { listChanged: true } : void 0
      },
      serverInfo: {
        name: this.config.name,
        version: this.config.version
      },
      instructions: this.config.description
    };
  }
  /**
   * Handle tools/list request
   */
  async handleToolsList(params) {
    const tools = Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }));
    return { tools };
  }
  /**
   * Handle tools/call request
   */
  async handleToolsCall(params) {
    if (!params || !params.name) {
      throw new Error("Tool name is required");
    }
    const tool = this.tools.get(params.name);
    if (!tool) {
      throw new Error(`Tool not found: ${params.name}`);
    }
    return await tool.handler(params.arguments || {});
  }
  /**
   * Handle resources/list request
   */
  async handleResourcesList(params) {
    const resources = Array.from(this.resources.values()).map((resource) => ({
      name: resource.name,
      uri: resource.uri,
      description: resource.description
    }));
    return { resources };
  }
  /**
   * Handle resources/read request
   */
  async handleResourcesRead(params) {
    if (!params || !params.uri) {
      throw new Error("Resource URI is required");
    }
    const resource = Array.from(this.resources.values()).find((r) => r.uri === params.uri);
    if (!resource) {
      throw new Error(`Resource not found: ${params.uri}`);
    }
    return await resource.handler(params.uri);
  }
  /**
   * Handle prompts/list request
   */
  async handlePromptsList(params) {
    const prompts = Array.from(this.prompts.values()).map((prompt) => ({
      name: prompt.name,
      description: prompt.description,
      arguments: this.jsonSchemaToPromptArgs(prompt.inputSchema)
    }));
    return { prompts };
  }
  /**
   * Handle prompts/get request
   */
  async handlePromptsGet(params) {
    if (!params || !params.name) {
      throw new Error("Prompt name is required");
    }
    const prompt = this.prompts.get(params.name);
    if (!prompt) {
      throw new Error(`Prompt not found: ${params.name}`);
    }
    const validatedArgs = this.validateWithZod(prompt.zodSchema, params.arguments || {});
    return await prompt.handler(validatedArgs);
  }
  /**
   * Convert JSON Schema to prompt arguments format
   */
  jsonSchemaToPromptArgs(jsonSchema) {
    const args = [];
    for (const [name, property] of Object.entries(jsonSchema.properties || {})) {
      args.push({
        name,
        description: property.description || `${name} parameter`,
        required: jsonSchema.required?.includes(name) || false
      });
    }
    return args;
  }
  /**
   * Get server statistics
   */
  getStats() {
    return {
      tools: this.tools.size,
      resources: this.resources.size,
      prompts: this.prompts.size,
      config: this.config
    };
  }
};
function createLambdaHandler(mcpServer) {
  return async (event, context) => {
    try {
      const method = event.httpMethod;
      const headers = event.headers || {};
      const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS"
      };
      if (method === "OPTIONS") {
        return createResponse("", 200, corsHeaders);
      }
      if (method === "POST") {
        return await handleMCPRequest(mcpServer, event.body, headers, corsHeaders);
      }
      if (method === "GET") {
        return createErrorResponse(405, -32e3, "Method not allowed: Stateless mode", corsHeaders);
      }
      return createErrorResponse(405, -32e3, `Method not allowed: ${method}`, corsHeaders);
    } catch (error) {
      console.error("Lambda error:", error);
      return createErrorResponse(500, -32603, "Internal server error", {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      });
    }
  };
}
async function handleMCPRequest(mcpServer, body, headers, corsHeaders) {
  const contentType = headers["content-type"] || headers["Content-Type"] || "";
  if (!contentType.includes("application/json")) {
    return createErrorResponse(400, -32700, "Parse error: Content-Type must be application/json", corsHeaders);
  }
  let jsonRpcMessage;
  try {
    jsonRpcMessage = JSON.parse(body || "{}");
  } catch (error) {
    return createErrorResponse(400, -32700, "Parse error: Invalid JSON", corsHeaders);
  }
  if (!jsonRpcMessage.jsonrpc || jsonRpcMessage.jsonrpc !== "2.0") {
    return createErrorResponse(400, -32600, "Invalid Request: missing jsonrpc field", corsHeaders, jsonRpcMessage.id);
  }
  try {
    const response = await mcpServer.handleRequest(jsonRpcMessage);
    if (response === null) {
      return { statusCode: 202, headers: corsHeaders, body: "" };
    }
    return createResponse(
      JSON.stringify({
        jsonrpc: "2.0",
        id: jsonRpcMessage.id,
        result: response
      }),
      200,
      {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Mcp-Protocol-Version": mcpServer.config.protocolVersion
      }
    );
  } catch (error) {
    console.error("MCP processing error:", error);
    let errorCode = -32603;
    if (error.message.includes("not found"))
      errorCode = -32601;
    else if (error.message.includes("Validation error"))
      errorCode = -32602;
    return createErrorResponse(200, errorCode, error.message, corsHeaders, jsonRpcMessage.id);
  }
}
function createResponse(body, statusCode = 200, headers = {}) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", ...headers },
    body
  };
}
function createErrorResponse(statusCode, errorCode, message, headers = {}, id = null) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({
      jsonrpc: "2.0",
      error: { code: errorCode, message },
      id
    })
  };
}
function createMCPServer(config) {
  return new MCPServer(config);
}
var CommonSchemas = {
  string: z.string(),
  number: z.number(),
  boolean: z.boolean(),
  optionalString: z.string().optional(),
  optionalNumber: z.number().optional(),
  optionalBoolean: z.boolean().optional(),
  // Common patterns
  email: z.string().email(),
  url: z.string().url(),
  uuid: z.string().uuid(),
  // Utility functions
  enum: (values) => z.enum(values),
  array: (itemSchema) => z.array(itemSchema),
  object: (shape) => z.object(shape)
};
export {
  CommonSchemas,
  MCPServer,
  createLambdaHandler,
  createMCPServer
};
