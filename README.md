# lambda-mcp-adaptor

A production-ready MCP (Model Context Protocol) server SDK for AWS Lambda with Zod-based type safety and clean separation of concerns.

[![npm version](https://badge.fury.io/js/lambda-mcp-adaptor.svg)](https://badge.fury.io/js/lambda-mcp-adaptor)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🚀 Features

- **Type-Safe Tool Definitions**: Zod schema validation with automatic JSON Schema generation
- **Method Chaining**: Fluent API for registering tools, resources, and prompts
- **AWS Lambda Optimized**: Clean adapter layer handling all HTTP/JSON-RPC protocol details
- **Zero Configuration**: Works out of the box with sensible defaults
- **Full MCP Compliance**: Supports MCP specification 2025-03-26
- **Error Handling**: Comprehensive validation and error reporting

## 📦 Installation

```bash
npm install lambda-mcp-adaptor zod
```

## 🎯 Quick Start

```javascript
import { createMCPServer, createLambdaHandler } from 'lambda-mcp-adaptor';
import { z } from 'zod';

// Create MCP server
const server = createMCPServer({
  name: 'My MCP Server',
  version: '1.0.0',
  description: 'A powerful MCP server with type-safe validation'
});

// Register tools with type safety
server
  .tool('calculate', {
    operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
    a: z.number(),
    b: z.number()
  }, async ({ operation, a, b }) => {
    let result;
    switch (operation) {
      case 'add': result = a + b; break;
      case 'subtract': result = a - b; break;
      case 'multiply': result = a * b; break;
      case 'divide': result = a / b; break;
    }
    
    return {
      content: [{ type: 'text', text: `${a} ${operation} ${b} = ${result}` }]
    };
  })
  
  .tool('get_time', {
    format: z.enum(['iso', 'unix']).optional().default('iso')
  }, async ({ format = 'iso' }) => {
    const now = new Date();
    const time = format === 'iso' ? now.toISOString() : now.getTime().toString();
    
    return {
      content: [{ type: 'text', text: `Current time: ${time}` }]
    };
  });

// Export Lambda handler (handles all HTTP/JSON-RPC complexity)
export const lambdaHandler = createLambdaHandler(server);
```

## 🔧 API Reference

### createMCPServer(config)

Creates a new MCP server instance.

```javascript
const server = createMCPServer({
  name: 'My Server',           // Required: Server name
  version: '1.0.0',           // Required: Server version
  description: 'Description', // Optional: Server description
  protocolVersion: '2025-03-26' // Optional: MCP protocol version
});
```

### server.tool(name, inputSchema, handler)

Register a tool with Zod schema validation.

```javascript
server.tool('tool_name', {
  param1: z.string().describe('Parameter description'),
  param2: z.number().optional().default(42),
  param3: z.enum(['option1', 'option2'])
}, async ({ param1, param2, param3 }) => {
  // Tool implementation with validated inputs
  return {
    content: [{ type: 'text', text: 'Result' }],
    isError: false // Optional: indicates if this is an error response
  };
});
```

### server.resource(name, uri, handler)

Register a resource.

```javascript
server.resource('resource_name', 'resource://uri', async (uri) => {
  return {
    contents: [{
      uri: uri,
      text: 'Resource content',
      mimeType: 'text/plain'
    }]
  };
});
```

### server.prompt(name, inputSchema, handler)

Register a prompt template.

```javascript
server.prompt('prompt_name', {
  input: z.string(),
  context: z.string().optional()
}, ({ input, context }) => {
  return {
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: `Process: ${input}${context ? ` Context: ${context}` : ''}`
      }
    }]
  };
});
```

### createLambdaHandler(server)

Creates an AWS Lambda handler from an MCP server instance.

```javascript
export const lambdaHandler = createLambdaHandler(server);
```

## 🎨 Advanced Examples

### Complex Tool with Validation

```javascript
server.tool('process_data', {
  data: z.array(z.object({
    id: z.string().uuid(),
    value: z.number().min(0).max(100),
    tags: z.array(z.string()).optional()
  })),
  operation: z.enum(['sum', 'average', 'max', 'min']),
  filters: z.object({
    minValue: z.number().optional(),
    requiredTags: z.array(z.string()).optional()
  }).optional()
}, async ({ data, operation, filters }) => {
  // Complex data processing with full type safety
  let filteredData = data;
  
  if (filters?.minValue) {
    filteredData = filteredData.filter(item => item.value >= filters.minValue);
  }
  
  if (filters?.requiredTags?.length) {
    filteredData = filteredData.filter(item => 
      filters.requiredTags.every(tag => item.tags?.includes(tag))
    );
  }
  
  let result;
  switch (operation) {
    case 'sum':
      result = filteredData.reduce((sum, item) => sum + item.value, 0);
      break;
    case 'average':
      result = filteredData.reduce((sum, item) => sum + item.value, 0) / filteredData.length;
      break;
    case 'max':
      result = Math.max(...filteredData.map(item => item.value));
      break;
    case 'min':
      result = Math.min(...filteredData.map(item => item.value));
      break;
  }
  
  return {
    content: [{
      type: 'text',
      text: `${operation} of ${filteredData.length} items: ${result}`
    }]
  };
});
```

### Error Handling

```javascript
server.tool('divide', {
  a: z.number(),
  b: z.number()
}, async ({ a, b }) => {
  if (b === 0) {
    return {
      content: [{ type: 'text', text: 'Error: Division by zero' }],
      isError: true
    };
  }
  
  return {
    content: [{ type: 'text', text: `${a} ÷ ${b} = ${a / b}` }]
  };
});
```

## 🧪 Testing

```javascript
import { createMCPServer } from 'lambda-mcp-adaptor';
import { z } from 'zod';

// Create test server
const server = createMCPServer({
  name: 'Test Server',
  version: '1.0.0'
});

server.tool('test_tool', {
  input: z.string()
}, async ({ input }) => {
  return { content: [{ type: 'text', text: `Echo: ${input}` }] };
});

// Test tool directly
const result = await server.handleRequest({
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: {
    name: 'test_tool',
    arguments: { input: 'Hello World' }
  }
});

console.log(result); // { content: [{ type: 'text', text: 'Echo: Hello World' }] }
```

## 🚀 Deployment

### AWS SAM Template

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Resources:
  MCPServerFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: src/
      Handler: app.lambdaHandler
      Runtime: nodejs22.x
      Events:
        MCPEndpoint:
          Type: Api
          Properties:
            Path: /mcp
            Method: post
```

### Deploy Commands

```bash
# Build and deploy
sam build
sam deploy --guided
```

## 📚 Common Schemas

The library provides common Zod schemas for convenience:

```javascript
import { CommonSchemas } from 'lambda-mcp-adaptor';

server.tool('example', {
  email: CommonSchemas.email,
  url: CommonSchemas.url,
  uuid: CommonSchemas.uuid,
  tags: CommonSchemas.array(CommonSchemas.string),
  status: CommonSchemas.enum(['active', 'inactive']),
  metadata: CommonSchemas.object({
    key: CommonSchemas.string,
    value: CommonSchemas.optionalString
  })
}, async (args) => {
  // Fully typed arguments
});
```

## 🔍 TypeScript Support

Full TypeScript support with automatic type inference:

```typescript
import { createMCPServer, createLambdaHandler } from 'lambda-mcp-adaptor';
import { z } from 'zod';

const server = createMCPServer({
  name: 'Typed Server',
  version: '1.0.0'
});

server.tool('typed_tool', {
  name: z.string(),
  age: z.number().int().positive(),
  active: z.boolean().optional().default(true)
}, async ({ name, age, active }) => {
  // name: string, age: number, active: boolean
  // Full type safety and IntelliSense support
  
  return {
    content: [{ 
      type: 'text', 
      text: `User ${name} is ${age} years old and ${active ? 'active' : 'inactive'}` 
    }]
  };
});
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🔗 Related

- [MCP Specification](https://modelcontextprotocol.io/specification/)
- [Zod Documentation](https://zod.dev/)
- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)

---

**Built with ❤️ for the MCP community**
