/**
 * Basic tests for lambda-mcp-adaptor
 */

import { expect } from 'chai';
import { createMCPServer, createLambdaHandler } from '../src/index.mjs';
import { z } from 'zod';

describe('lambda-mcp-adaptor', function() {
  let server;
  
  beforeEach(function() {
    server = createMCPServer({
      name: 'Test Server',
      version: '1.0.0',
      description: 'Test MCP Server'
    });
  });
  
  describe('MCPServer', function() {
    it('should create server with correct config', function() {
      expect(server.config.name).to.equal('Test Server');
      expect(server.config.version).to.equal('1.0.0');
      expect(server.config.protocolVersion).to.equal('2025-03-26');
    });
    
    it('should register tools with method chaining', function() {
      const result = server
        .tool('test1', { input: z.string() }, async ({ input }) => ({ content: [{ type: 'text', text: input }] }))
        .tool('test2', { value: z.number() }, async ({ value }) => ({ content: [{ type: 'text', text: value.toString() }] }));
      
      expect(result).to.equal(server);
      expect(server.tools.size).to.equal(2);
      expect(server.tools.has('test1')).to.be.true;
      expect(server.tools.has('test2')).to.be.true;
    });
    
    it('should handle initialize request', async function() {
      server.tool('test', { input: z.string() }, async ({ input }) => ({ content: [{ type: 'text', text: input }] }));
      
      const result = await server.handleRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0.0' }
        }
      });
      
      expect(result.protocolVersion).to.equal('2025-03-26');
      expect(result.serverInfo.name).to.equal('Test Server');
      expect(result.capabilities.tools).to.deep.equal({ listChanged: true });
    });
    
    it('should handle tools/list request', async function() {
      server.tool('calculate', {
        a: z.number(),
        b: z.number()
      }, async ({ a, b }) => ({ content: [{ type: 'text', text: (a + b).toString() }] }));
      
      const result = await server.handleRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
      });
      
      expect(result.tools).to.be.an('array');
      expect(result.tools).to.have.length(1);
      expect(result.tools[0].name).to.equal('calculate');
      expect(result.tools[0].inputSchema.type).to.equal('object');
      expect(result.tools[0].inputSchema.properties).to.have.property('a');
      expect(result.tools[0].inputSchema.properties).to.have.property('b');
    });
    
    it('should handle tools/call request with validation', async function() {
      server.tool('add', {
        a: z.number(),
        b: z.number()
      }, async ({ a, b }) => ({ content: [{ type: 'text', text: `${a} + ${b} = ${a + b}` }] }));
      
      const result = await server.handleRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'add',
          arguments: { a: 5, b: 3 }
        }
      });
      
      expect(result.content).to.be.an('array');
      expect(result.content[0].text).to.equal('5 + 3 = 8');
    });
    
    it('should validate tool arguments with Zod', async function() {
      server.tool('validate_test', {
        email: z.string().email(),
        age: z.number().int().positive()
      }, async ({ email, age }) => ({ content: [{ type: 'text', text: `${email}: ${age}` }] }));
      
      // Valid arguments
      const validResult = await server.handleRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'validate_test',
          arguments: { email: 'test@example.com', age: 25 }
        }
      });
      
      expect(validResult.content[0].text).to.equal('test@example.com: 25');
      
      // Invalid arguments should return error response
      const errorResult = await server.handleRequest({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'validate_test',
          arguments: { email: 'invalid-email', age: -5 }
        }
      });
      
      expect(errorResult.isError).to.be.true;
      expect(errorResult.content[0].text).to.include('Validation error');
    });
    
    it('should handle optional parameters with defaults', async function() {
      server.tool('optional_test', {
        required: z.string(),
        optional: z.string().optional(),
        withDefault: z.number().optional().default(42)
      }, async ({ required, optional, withDefault }) => ({
        content: [{ type: 'text', text: `${required}, ${optional || 'none'}, ${withDefault}` }]
      }));
      
      const result = await server.handleRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'optional_test',
          arguments: { required: 'test' }
        }
      });
      
      expect(result.content[0].text).to.equal('test, none, 42');
    });
    
    it('should handle enum validation', async function() {
      server.tool('enum_test', {
        operation: z.enum(['add', 'subtract', 'multiply'])
      }, async ({ operation }) => ({ content: [{ type: 'text', text: operation }] }));
      
      // Valid enum value
      const validResult = await server.handleRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'enum_test',
          arguments: { operation: 'add' }
        }
      });
      
      expect(validResult.content[0].text).to.equal('add');
      
      // Invalid enum value should return error response
      const enumErrorResult = await server.handleRequest({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'enum_test',
          arguments: { operation: 'invalid' }
        }
      });
      
      expect(enumErrorResult.isError).to.be.true;
      expect(enumErrorResult.content[0].text).to.include('Validation error');
    });
    
    it('should register and handle resources', async function() {
      server.resource('test-resource', 'test://resource', async (uri) => ({
        contents: [{ uri, text: 'Resource content', mimeType: 'text/plain' }]
      }));
      
      const listResult = await server.handleRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'resources/list'
      });
      
      expect(listResult.resources).to.have.length(1);
      expect(listResult.resources[0].name).to.equal('test-resource');
      
      const readResult = await server.handleRequest({
        jsonrpc: '2.0',
        id: 2,
        method: 'resources/read',
        params: { uri: 'test://resource' }
      });
      
      expect(readResult.contents[0].text).to.equal('Resource content');
    });
    
    it('should register and handle prompts', async function() {
      server.prompt('test-prompt', {
        input: z.string(),
        context: z.string().optional()
      }, ({ input, context }) => ({
        messages: [{
          role: 'user',
          content: { type: 'text', text: `Process: ${input}${context ? ` (${context})` : ''}` }
        }]
      }));
      
      const listResult = await server.handleRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'prompts/list'
      });
      
      expect(listResult.prompts).to.have.length(1);
      expect(listResult.prompts[0].name).to.equal('test-prompt');
      
      const getResult = await server.handleRequest({
        jsonrpc: '2.0',
        id: 2,
        method: 'prompts/get',
        params: {
          name: 'test-prompt',
          arguments: { input: 'test input', context: 'test context' }
        }
      });
      
      expect(getResult.messages[0].content.text).to.equal('Process: test input (test context)');
    });
  });
  
  describe('Lambda Handler', function() {
    it('should create Lambda handler', function() {
      const handler = createLambdaHandler(server);
      expect(handler).to.be.a('function');
    });
    
    it('should handle OPTIONS request (CORS)', async function() {
      const handler = createLambdaHandler(server);
      
      const result = await handler({
        httpMethod: 'OPTIONS',
        headers: {}
      });
      
      expect(result.statusCode).to.equal(200);
      expect(result.headers['Access-Control-Allow-Origin']).to.equal('*');
      expect(result.headers['Access-Control-Allow-Methods']).to.include('POST');
    });
    
    it('should handle POST request with MCP message', async function() {
      server.tool('test', { input: z.string() }, async ({ input }) => ({ content: [{ type: 'text', text: input }] }));
      
      const handler = createLambdaHandler(server);
      
      const result = await handler({
        httpMethod: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list'
        })
      });
      
      expect(result.statusCode).to.equal(200);
      expect(result.headers['Content-Type']).to.equal('application/json');
      
      const response = JSON.parse(result.body);
      expect(response.jsonrpc).to.equal('2.0');
      expect(response.id).to.equal(1);
      expect(response.result.tools).to.be.an('array');
    });
    
    it('should handle invalid JSON', async function() {
      const handler = createLambdaHandler(server);
      
      const result = await handler({
        httpMethod: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json'
      });
      
      expect(result.statusCode).to.equal(400);
      
      const response = JSON.parse(result.body);
      expect(response.error.code).to.equal(-32700);
      expect(response.error.message).to.include('Parse error');
    });
    
    it('should handle missing Content-Type', async function() {
      const handler = createLambdaHandler(server);
      
      const result = await handler({
        httpMethod: 'POST',
        headers: {},
        body: '{}'
      });
      
      expect(result.statusCode).to.equal(400);
      
      const response = JSON.parse(result.body);
      expect(response.error.code).to.equal(-32700);
      expect(response.error.message).to.include('Content-Type');
    });
    
    it('should handle GET request (not allowed)', async function() {
      const handler = createLambdaHandler(server);
      
      const result = await handler({
        httpMethod: 'GET',
        headers: {}
      });
      
      expect(result.statusCode).to.equal(405);
      
      const response = JSON.parse(result.body);
      expect(response.error.code).to.equal(-32000);
      expect(response.error.message).to.include('Method not allowed');
    });
  });
});
