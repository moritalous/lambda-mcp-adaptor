import { expect } from 'chai';
import { lambdaHandler } from '../../app.mjs';

describe('Tests for MCP Tools Server using lambda-mcp-adaptor', function () {
    it('verifies successful initialize request', async () => {
        const event = {
            httpMethod: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'initialize',
                params: {
                    protocolVersion: '2025-03-26',
                    capabilities: {
                        roots: {
                            listChanged: true
                        }
                    },
                    clientInfo: {
                        name: 'test-client',
                        version: '1.0.0'
                    }
                }
            })
        };

        const result = await lambdaHandler(event);

        expect(result).to.be.an('object');
        expect(result.statusCode).to.equal(200);
        expect(result.headers['Content-Type']).to.equal('application/json');
        
        const response = JSON.parse(result.body);
        expect(response.jsonrpc).to.equal('2.0');
        expect(response.id).to.equal(1);
        expect(response.result).to.be.an('object');
        expect(response.result.protocolVersion).to.equal('2025-03-26');
        expect(response.result.capabilities).to.be.an('object');
        expect(response.result.serverInfo).to.be.an('object');
        expect(response.result.serverInfo.name).to.equal('MCP Tools Server');
        expect(response.result.serverInfo.version).to.equal('2.0.0');
    });

    it('verifies successful tools/list request with enhanced tools', async () => {
        const event = {
            httpMethod: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 2,
                method: 'tools/list'
            })
        };

        const result = await lambdaHandler(event);

        expect(result).to.be.an('object');
        expect(result.statusCode).to.equal(200);
        
        const response = JSON.parse(result.body);
        expect(response.jsonrpc).to.equal('2.0');
        expect(response.id).to.equal(2);
        expect(response.result).to.be.an('object');
        expect(response.result.tools).to.be.an('array');
        expect(response.result.tools.length).to.be.greaterThan(5); // Should have many tools now
        
        // Check for specific tools
        const toolNames = response.result.tools.map(tool => tool.name);
        expect(toolNames).to.include('calculate');
        expect(toolNames).to.include('advanced_math');
        expect(toolNames).to.include('get_current_time');
        expect(toolNames).to.include('generate_uuid');
        expect(toolNames).to.include('text_operations');
    });

    it('verifies successful calculate tool call with validation', async () => {
        const event = {
            httpMethod: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 3,
                method: 'tools/call',
                params: {
                    name: 'calculate',
                    arguments: {
                        operation: 'multiply',
                        a: 7,
                        b: 8
                    }
                }
            })
        };

        const result = await lambdaHandler(event);

        expect(result).to.be.an('object');
        expect(result.statusCode).to.equal(200);
        
        const response = JSON.parse(result.body);
        expect(response.jsonrpc).to.equal('2.0');
        expect(response.id).to.equal(3);
        expect(response.result).to.be.an('object');
        expect(response.result.content).to.be.an('array');
        expect(response.result.content[0].text).to.include('7 multiply 8 = 56');
    });

    it('verifies advanced math tool functionality', async () => {
        const event = {
            httpMethod: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 4,
                method: 'tools/call',
                params: {
                    name: 'advanced_math',
                    arguments: {
                        operation: 'power',
                        value: 2,
                        base: 3
                    }
                }
            })
        };

        const result = await lambdaHandler(event);

        expect(result).to.be.an('object');
        expect(result.statusCode).to.equal(200);
        
        const response = JSON.parse(result.body);
        expect(response.result.content[0].text).to.include('power(2, 3) = 8');
    });

    it('verifies text operations tool', async () => {
        const event = {
            httpMethod: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 5,
                method: 'tools/call',
                params: {
                    name: 'text_operations',
                    arguments: {
                        text: 'Hello World Test',
                        operations: ['word_count', 'char_count']
                    }
                }
            })
        };

        const result = await lambdaHandler(event);

        expect(result).to.be.an('object');
        expect(result.statusCode).to.equal(200);
        
        const response = JSON.parse(result.body);
        expect(response.result.content[0].text).to.include('word_count');
        expect(response.result.content[0].text).to.include('char_count');
    });

    it('verifies validation error handling', async () => {
        const event = {
            httpMethod: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 6,
                method: 'tools/call',
                params: {
                    name: 'calculate',
                    arguments: {
                        operation: 'invalid_operation', // Invalid enum value
                        a: 5,
                        b: 3
                    }
                }
            })
        };

        const result = await lambdaHandler(event);

        expect(result).to.be.an('object');
        expect(result.statusCode).to.equal(200);
        
        const response = JSON.parse(result.body);
        expect(response.jsonrpc).to.equal('2.0');
        expect(response.id).to.equal(6);
        expect(response.error).to.be.an('object');
        expect(response.error.code).to.equal(-32602); // Invalid params
        expect(response.error.message).to.include('Validation error');
    });

    it('verifies resources/list functionality', async () => {
        const event = {
            httpMethod: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 7,
                method: 'resources/list'
            })
        };

        const result = await lambdaHandler(event);

        expect(result).to.be.an('object');
        expect(result.statusCode).to.equal(200);
        
        const response = JSON.parse(result.body);
        expect(response.result.resources).to.be.an('array');
        expect(response.result.resources.length).to.be.greaterThan(0);
    });

    it('verifies prompts/list functionality', async () => {
        const event = {
            httpMethod: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 8,
                method: 'prompts/list'
            })
        };

        const result = await lambdaHandler(event);

        expect(result).to.be.an('object');
        expect(result.statusCode).to.equal(200);
        
        const response = JSON.parse(result.body);
        expect(response.result.prompts).to.be.an('array');
        expect(response.result.prompts.length).to.be.greaterThan(0);
    });

    it('verifies CORS headers', async () => {
        const event = {
            httpMethod: 'OPTIONS',
            headers: {}
        };

        const result = await lambdaHandler(event);

        expect(result).to.be.an('object');
        expect(result.statusCode).to.equal(200);
        expect(result.headers['Access-Control-Allow-Origin']).to.equal('*');
        expect(result.headers['Access-Control-Allow-Methods']).to.include('POST');
    });
});
