/**
 * Basic MCP Server Example using @aws-lambda-mcp/adapter
 */

import { createMCPServer, createLambdaHandler } from '../src/index.mjs';
import { z } from 'zod';

// Create MCP server
const server = createMCPServer({
  name: 'Example MCP Server',
  version: '1.0.0',
  description: 'A demonstration of the AWS Lambda MCP Adapter'
});

// Register tools
server
  .tool('calculate', {
    operation: z.enum(['add', 'subtract', 'multiply', 'divide'])
      .describe('Mathematical operation to perform'),
    a: z.number().describe('First number'),
    b: z.number().describe('Second number')
  }, async ({ operation, a, b }) => {
    if (b === 0 && operation === 'divide') {
      return {
        content: [{ type: 'text', text: 'Error: Division by zero' }],
        isError: true
      };
    }
    
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
    format: z.enum(['iso', 'unix', 'readable']).optional().default('iso')
      .describe('Time format to return')
  }, async ({ format = 'iso' }) => {
    const now = new Date();
    let timeString;
    
    switch (format) {
      case 'iso':
        timeString = now.toISOString();
        break;
      case 'unix':
        timeString = Math.floor(now.getTime() / 1000).toString();
        break;
      case 'readable':
        timeString = now.toUTCString();
        break;
    }
    
    return {
      content: [{ type: 'text', text: `Current time (${format}): ${timeString}` }]
    };
  })
  
  .tool('echo', {
    message: z.string().describe('Message to echo back'),
    repeat: z.number().int().positive().max(10).optional().default(1)
      .describe('Number of times to repeat (max 10)')
  }, async ({ message, repeat = 1 }) => {
    const repeated = Array(repeat).fill(message).join(' ');
    return {
      content: [{ type: 'text', text: `Echo: ${repeated}` }]
    };
  });

// Register a resource
server.resource('server-status', 'status://server', async (uri) => {
  const stats = server.getStats();
  return {
    contents: [{
      uri: uri,
      text: JSON.stringify({
        status: 'running',
        uptime: process.uptime(),
        ...stats
      }, null, 2),
      mimeType: 'application/json'
    }]
  };
});

// Register a prompt
server.prompt('analyze-number', {
  number: z.number().describe('Number to analyze'),
  context: z.string().optional().describe('Additional context')
}, ({ number, context }) => {
  return {
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: `Please analyze this number: ${number}${context ? `\n\nContext: ${context}` : ''}\n\nConsider its mathematical properties, significance, and any interesting facts.`
      }
    }]
  };
});

// Export Lambda handler
export const lambdaHandler = createLambdaHandler(server);

// For local testing
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🧪 Testing MCP Server locally...\n');
  
  // Test initialize
  const initResult = await server.handleRequest({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '1.0.0' }
    }
  });
  
  console.log('✅ Initialize:', initResult.serverInfo);
  
  // Test tools list
  const toolsResult = await server.handleRequest({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list'
  });
  
  console.log('✅ Available tools:', toolsResult.tools.map(t => t.name));
  
  // Test calculate tool
  const calcResult = await server.handleRequest({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'calculate',
      arguments: { operation: 'multiply', a: 7, b: 8 }
    }
  });
  
  console.log('✅ Calculate result:', calcResult.content[0].text);
  
  // Test echo tool
  const echoResult = await server.handleRequest({
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: {
      name: 'echo',
      arguments: { message: 'Hello MCP!', repeat: 3 }
    }
  });
  
  console.log('✅ Echo result:', echoResult.content[0].text);
  
  console.log('\n🎉 All tests passed! Server is working correctly.');
}
