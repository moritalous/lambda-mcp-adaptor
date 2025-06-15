var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/cors-config.mjs
function withCORS(additionalHeaders = {}) {
  return {
    ...CORS_HEADERS,
    ...additionalHeaders
  };
}
function withBasicCORS(additionalHeaders = {}) {
  return {
    ...BASIC_CORS_HEADERS,
    ...additionalHeaders
  };
}
var CORS_HEADERS, BASIC_CORS_HEADERS;
var init_cors_config = __esm({
  "src/cors-config.mjs"() {
    CORS_HEADERS = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, Mcp-Protocol-Version, Mcp-Session-Id",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
    };
    BASIC_CORS_HEADERS = {
      "Access-Control-Allow-Origin": "*"
    };
  }
});

// src/auth/bearer-token.mjs
function createAuthErrorResponse(statusCode, error, message, additionalHeaders = {}) {
  const headers = withCORS({
    "Content-Type": "application/json",
    ...additionalHeaders
  });
  return {
    statusCode,
    headers,
    body: JSON.stringify({
      error,
      message
    })
  };
}
function validateBearerToken(event, config = {}) {
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  if (!authHeader) {
    return {
      isValid: false,
      error: createAuthErrorResponse(
        401,
        "unauthorized",
        "Authorization header is required",
        { "WWW-Authenticate": 'Bearer realm="MCP Server"' }
      )
    };
  }
  if (!authHeader.startsWith("Bearer ")) {
    return {
      isValid: false,
      error: createAuthErrorResponse(
        401,
        "unauthorized",
        "Bearer token is required",
        { "WWW-Authenticate": 'Bearer realm="MCP Server"' }
      )
    };
  }
  const token = authHeader.substring(7);
  if (config.validate && typeof config.validate === "function") {
    try {
      const result = config.validate(token, event);
      if (result && result.isValid) {
        return {
          isValid: true,
          user: result.user || { token },
          token
        };
      } else {
        return {
          isValid: false,
          error: result?.error || createAuthErrorResponse(
            401,
            "invalid_token",
            "Invalid or expired token",
            { "WWW-Authenticate": 'Bearer realm="MCP Server"' }
          )
        };
      }
    } catch (error) {
      console.error("Error in custom token validation:", error);
      return {
        isValid: false,
        error: createAuthErrorResponse(
          500,
          "server_error",
          "Authentication validation error"
        )
      };
    }
  }
  const validTokens = config.tokens || [];
  if (validTokens.length === 0) {
    console.warn("No valid tokens configured for Bearer token authentication.");
    return {
      isValid: false,
      error: createAuthErrorResponse(
        500,
        "server_error",
        "Authentication not configured"
      )
    };
  }
  if (!validTokens.includes(token)) {
    return {
      isValid: false,
      error: createAuthErrorResponse(
        401,
        "invalid_token",
        "Invalid or expired token",
        { "WWW-Authenticate": 'Bearer realm="MCP Server"' }
      )
    };
  }
  return {
    isValid: true,
    user: { token },
    token
  };
}
var init_bearer_token = __esm({
  "src/auth/bearer-token.mjs"() {
    init_cors_config();
  }
});

// src/auth/middleware.mjs
var middleware_exports = {};
__export(middleware_exports, {
  createAuthMiddleware: () => createAuthMiddleware,
  createAuthenticatedHandler: () => createAuthenticatedHandler
});
function handleCORSPreflight(event) {
  const method = event.requestContext?.http?.method || event.httpMethod;
  if (method === "OPTIONS") {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: ""
    };
  }
  return null;
}
function createAuthMiddleware(authConfig) {
  return async (event) => {
    const corsResponse = handleCORSPreflight(event);
    if (corsResponse) {
      return corsResponse;
    }
    let authResult;
    switch (authConfig.type) {
      case "bearer-token":
        authResult = validateBearerToken(event, authConfig);
        break;
      default:
        console.error(`Unsupported authentication type: ${authConfig.type}`);
        return {
          statusCode: 500,
          headers: withBasicCORS({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            error: "server_error",
            message: "Unsupported authentication type"
          })
        };
    }
    if (!authResult.isValid) {
      console.log("Authentication failed:", authResult.error.body);
      return authResult.error;
    }
    event.user = authResult.user;
    event.authToken = authResult.token;
    console.log("Authentication successful");
    return null;
  };
}
function createAuthenticatedHandler(originalHandler, authConfig) {
  const authMiddleware = createAuthMiddleware(authConfig);
  return async (event) => {
    console.log("=== MCP Server Request Start (with Authentication) ===");
    console.log("Event:", JSON.stringify(event, null, 2));
    try {
      const authResponse = await authMiddleware(event);
      if (authResponse) {
        return authResponse;
      }
      const response = await originalHandler(event);
      console.log("=== MCP Server Request End ===");
      return response;
    } catch (error) {
      console.error("Error in authenticated MCP server:", error);
      return {
        statusCode: 500,
        headers: withBasicCORS({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          error: "internal_server_error",
          message: "An internal server error occurred"
        })
      };
    }
  };
}
var init_middleware = __esm({
  "src/auth/middleware.mjs"() {
    init_bearer_token();
    init_cors_config();
  }
});

// src/schema-utils.mjs
import { z } from "zod";
function zodToJsonSchema(zodSchema) {
  const properties = {};
  const required = [];
  for (const [key, schema] of Object.entries(zodSchema)) {
    properties[key] = convertZodTypeToJsonSchema(schema);
    if (!isZodOptional(schema)) {
      required.push(key);
    }
  }
  return {
    type: "object",
    properties,
    required
  };
}
function convertZodTypeToJsonSchema(zodType) {
  if (zodType instanceof z.ZodOptional) {
    return convertZodTypeToJsonSchema(zodType._def.innerType);
  }
  if (zodType instanceof z.ZodDefault) {
    const schema = convertZodTypeToJsonSchema(zodType._def.innerType);
    schema.default = zodType._def.defaultValue();
    return schema;
  }
  if (zodType instanceof z.ZodString) {
    const schema = { type: "string" };
    if (zodType._def.checks) {
      for (const check of zodType._def.checks) {
        switch (check.kind) {
          case "min":
            schema.minLength = check.value;
            break;
          case "max":
            schema.maxLength = check.value;
            break;
          case "email":
            schema.format = "email";
            break;
          case "url":
            schema.format = "uri";
            break;
          case "uuid":
            schema.format = "uuid";
            break;
        }
      }
    }
    if (zodType.description) {
      schema.description = zodType.description;
    }
    return schema;
  }
  if (zodType instanceof z.ZodNumber) {
    const schema = { type: "number" };
    if (zodType._def.checks) {
      for (const check of zodType._def.checks) {
        switch (check.kind) {
          case "min":
            schema.minimum = check.value;
            break;
          case "max":
            schema.maximum = check.value;
            break;
          case "int":
            schema.type = "integer";
            break;
        }
      }
    }
    if (zodType.description) {
      schema.description = zodType.description;
    }
    return schema;
  }
  if (zodType instanceof z.ZodBoolean) {
    const schema = { type: "boolean" };
    if (zodType.description) {
      schema.description = zodType.description;
    }
    return schema;
  }
  if (zodType instanceof z.ZodEnum) {
    const schema = {
      type: "string",
      enum: zodType._def.values
    };
    if (zodType.description) {
      schema.description = zodType.description;
    }
    return schema;
  }
  if (zodType instanceof z.ZodArray) {
    const schema = {
      type: "array",
      items: convertZodTypeToJsonSchema(zodType._def.type)
    };
    if (zodType._def.minLength) {
      schema.minItems = zodType._def.minLength.value;
    }
    if (zodType._def.maxLength) {
      schema.maxItems = zodType._def.maxLength.value;
    }
    if (zodType.description) {
      schema.description = zodType.description;
    }
    return schema;
  }
  if (zodType instanceof z.ZodObject) {
    return zodToJsonSchema(zodType.shape);
  }
  return {
    type: "string",
    description: zodType.description || "Unknown type"
  };
}
function isZodOptional(zodType) {
  return zodType instanceof z.ZodOptional || zodType instanceof z.ZodDefault;
}
function hasZodDefault(zodType) {
  return zodType instanceof z.ZodDefault;
}
function validateWithZod(zodSchema, args) {
  const validated = {};
  for (const [key, schema] of Object.entries(zodSchema)) {
    try {
      if (args[key] === void 0 && isZodOptional(schema)) {
        if (hasZodDefault(schema)) {
          validated[key] = schema.parse(void 0);
        }
        continue;
      }
      validated[key] = schema.parse(args[key]);
    } catch (error) {
      throw new z.ZodError([
        {
          code: "custom",
          path: [key],
          message: `${error.message}`
        }
      ]);
    }
  }
  return validated;
}

// src/mcp-server.mjs
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
    const jsonSchema = zodToJsonSchema(inputSchema);
    const validatedHandler = async (args) => {
      try {
        const validatedArgs = validateWithZod(inputSchema, args);
        return await handler(validatedArgs);
      } catch (error) {
        if (error.name === "ZodError") {
          throw new Error(
            `Validation error: ${error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`
          );
        }
        throw error;
      }
    };
    this.tools.set(name, {
      name,
      description: handler.description || `Tool: ${name}`,
      inputSchema: jsonSchema,
      handler: validatedHandler
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
   * Register a prompt with Zod schema validation
   */
  prompt(name, inputSchema, handler) {
    zodToJsonSchema(inputSchema);
    const validatedHandler = async (args) => {
      try {
        const validatedArgs = validateWithZod(inputSchema, args);
        return await handler(validatedArgs);
      } catch (error) {
        if (error.name === "ZodError") {
          throw new Error(
            `Validation error: ${error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`
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
        required: !isZodOptional(schema)
      })),
      handler: validatedHandler
    });
    return this;
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
  async handleInitialize() {
    return {
      protocolVersion: this.config.protocolVersion,
      capabilities: {
        tools: { listChanged: true },
        resources: { listChanged: true },
        prompts: { listChanged: true }
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
  async handleToolsList() {
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
    if (!params?.name) {
      throw new Error("Tool name is required");
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
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true
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
      description: resource.description
    }));
    return { resources };
  }
  /**
   * Handle resources/read request
   */
  async handleResourcesRead(params) {
    if (!params?.uri) {
      throw new Error("Resource URI is required");
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
      arguments: prompt.arguments
    }));
    return { prompts };
  }
  /**
   * Handle prompts/get request
   */
  async handlePromptsGet(params) {
    if (!params?.name) {
      throw new Error("Prompt name is required");
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
      config: this.config
    };
  }
};

// src/lambda-adapter.mjs
init_cors_config();
function createResponse(body, statusCode = 200, headers = {}) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    body: typeof body === "string" ? body : JSON.stringify(body)
  };
}
function createErrorResponse(statusCode, code, message, headers = {}, id = null) {
  return createResponse(
    {
      jsonrpc: "2.0",
      error: { code, message },
      id
    },
    statusCode,
    headers
  );
}
async function handleMCPRequest(mcpServer, body, headers, corsHeaders) {
  const contentType = headers["content-type"] || headers["Content-Type"] || "";
  if (!contentType.includes("application/json")) {
    return createErrorResponse(
      400,
      -32700,
      "Parse error: Content-Type must be application/json",
      corsHeaders
    );
  }
  let jsonRpcMessage;
  try {
    jsonRpcMessage = JSON.parse(body || "{}");
  } catch {
    return createErrorResponse(
      400,
      -32700,
      "Parse error: Invalid JSON",
      corsHeaders
    );
  }
  if (!jsonRpcMessage.jsonrpc || jsonRpcMessage.jsonrpc !== "2.0") {
    return createErrorResponse(
      400,
      -32600,
      "Invalid Request: missing jsonrpc field",
      corsHeaders,
      jsonRpcMessage.id
    );
  }
  if (!jsonRpcMessage.method) {
    return createErrorResponse(
      400,
      -32600,
      "Invalid Request: missing method field",
      corsHeaders,
      jsonRpcMessage.id
    );
  }
  try {
    const result = await mcpServer.handleRequest(jsonRpcMessage);
    if (result === null) {
      return createResponse("", 204, corsHeaders);
    }
    return createResponse(
      {
        jsonrpc: "2.0",
        result,
        id: jsonRpcMessage.id
      },
      200,
      corsHeaders
    );
  } catch (error) {
    console.error("MCP request error:", error);
    let errorCode = -32603;
    let errorMessage = error.message;
    if (error.message.includes("Method not found")) {
      errorCode = -32601;
    } else if (error.message.includes("not found") || error.message.includes("required")) {
      errorCode = -32602;
    }
    return createErrorResponse(
      500,
      errorCode,
      errorMessage,
      corsHeaders,
      jsonRpcMessage.id
    );
  }
}
function createLambdaHandler(mcpServer, options = {}) {
  const baseHandler = async (event) => {
    try {
      const method = event.httpMethod || event.requestContext?.http?.method;
      const headers = event.headers || {};
      if (method === "OPTIONS") {
        return createResponse("", 200, CORS_HEADERS);
      }
      if (method === "POST") {
        return await handleMCPRequest(
          mcpServer,
          event.body,
          headers,
          CORS_HEADERS
        );
      }
      if (method === "GET") {
        return createErrorResponse(
          405,
          -32e3,
          "Method not allowed: Stateless mode",
          CORS_HEADERS
        );
      }
      return createErrorResponse(
        405,
        -32e3,
        `Method not allowed: ${method}`,
        CORS_HEADERS
      );
    } catch (error) {
      console.error("Lambda error:", error);
      return createErrorResponse(
        500,
        -32603,
        "Internal server error",
        withBasicCORS({ "Content-Type": "application/json" })
      );
    }
  };
  if (options.auth) {
    return async (event, context) => {
      try {
        const { createAuthenticatedHandler: createAuthenticatedHandler2 } = await Promise.resolve().then(() => (init_middleware(), middleware_exports));
        const authenticatedHandler = createAuthenticatedHandler2(
          baseHandler,
          options.auth
        );
        return await authenticatedHandler(event, context);
      } catch (error) {
        console.error("Authentication module error:", error);
        return {
          statusCode: 500,
          headers: withBasicCORS({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            error: "server_error",
            message: "Authentication module not available"
          })
        };
      }
    };
  }
  return baseHandler;
}

// src/common-schemas.mjs
import { z as z2 } from "zod";
var CommonSchemas = {
  // Basic types
  string: z2.string(),
  number: z2.number(),
  boolean: z2.boolean(),
  // Optional types
  optionalString: z2.string().optional(),
  optionalNumber: z2.number().optional(),
  optionalBoolean: z2.boolean().optional(),
  // Common patterns
  email: z2.string().email(),
  url: z2.string().url(),
  uuid: z2.string().uuid(),
  // Utility functions
  enum: (values) => z2.enum(values),
  array: (itemSchema) => z2.array(itemSchema),
  object: (shape) => z2.object(shape)
};

// src/index.mjs
function createMCPServer(config) {
  return new MCPServer(config);
}
export {
  CommonSchemas,
  MCPServer,
  createLambdaHandler,
  createMCPServer
};
