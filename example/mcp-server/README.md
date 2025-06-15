# MCP Tools Server Example

This directory contains a comprehensive example implementation of an MCP (Model Context Protocol) server using the `lambda-mcp-adaptor` library. The example demonstrates how to build a feature-rich MCP server and deploy it on AWS Lambda.

## What's in this Example

This example showcases:

- **Complete MCP Server Implementation**: A fully functional server with 8 different tools
- **AWS Lambda Deployment**: Ready-to-deploy serverless architecture using AWS SAM

## Available Tools

The example server includes these tools:

### 🧮 Mathematical Tools
- **`calculate`** - Basic arithmetic operations (add, subtract, multiply, divide)
- **`advanced_math`** - Advanced mathematical functions (power, sqrt, trigonometry, logarithms)

### ⏰ Time & Date Tools
- **`get_current_time`** - Current time with multiple format options (ISO, Unix, readable)
- **`date_calculation`** - Date arithmetic operations (add/subtract days, months, years)

### 🔧 Utility Tools
- **`generate_uuid`** - UUID generation with formatting options
- **`generate_random_string`** - Flexible random string generation with different character sets
- **`generate_hash`** - Cryptographic hash generation (MD5, SHA1, SHA256, SHA512)

### 📝 Text Processing Tools
- **`text_operations`** - Text analysis operations (word count, email extraction, URL extraction, etc.)

### 📚 Resources & Prompts
- **`server-info`** - Server statistics and information resource
- **`analyze-calculation`** - Mathematical analysis prompt template
- **`process-text`** - Text processing prompt template

## Directory Structure

```
example/
└── mcp-server/                    # Complete AWS SAM application
    ├── mcp-server/                # Lambda function code
    │   ├── app.mjs               # Main application using lambda-mcp-adaptor
    │   ├── package.json          # Dependencies
    │   └── tests/unit/           # Unit tests
    ├── events/                   # Sample event files for testing
    ├── template.yaml             # AWS SAM template
    ├── samconfig.toml           # SAM configuration
    └── README.md                # Detailed deployment guide
```

## Quick Start

### Prerequisites
- AWS CLI configured with appropriate permissions
- AWS SAM CLI installed
- Node.js 18.x or later

### Deploy to AWS

```bash
cd mcp-server  # Navigate to the SAM application directory
sam build
sam deploy --guided
```

## Usage with MCP Clients

After deployment, configure your MCP client to connect to the deployed server using the API Gateway endpoint.

### VSCode Configuration

Add the following configuration to your `mcp.json` file:

```json
{
    "servers": {
        "mcp-server-lambda": {
            "type": "http",
            "url": "https://{your-api-gateway-endpoint}/Prod/mcp"
        }
    }
}
```

Replace `{your-api-gateway-endpoint}` with the actual API Gateway endpoint URL from your deployment output.

### Other MCP Clients

For other MCP clients, use the HTTP transport with the endpoint:
```
https://{your-api-gateway-endpoint}/Prod/mcp
```

## Key Implementation Patterns

### Tool Definition Pattern
```javascript
server.tool('tool_name', {
  // Zod schema for input validation
  param1: z.string().describe('Parameter description'),
  param2: z.number().optional().default(42),
  param3: z.enum(['option1', 'option2'])
}, async ({ param1, param2, param3 }) => {
  // Tool implementation with validated inputs
  return {
    content: [{ type: 'text', text: 'Result' }]
  };
});
```

### Error Handling Pattern
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

### Resource Definition Pattern
```javascript
server.resource('server-info', 'info://server', async (uri) => ({
  contents: [{
    uri: uri,
    text: JSON.stringify(serverStats, null, 2),
    mimeType: 'application/json'
  }]
}));
```

## Testing

The example includes comprehensive testing:

### Unit Tests
```bash
cd mcp-server
npm test
```

### Local SAM Testing
```bash
sam local invoke MCPServerFunction --event events/mcp-initialize.json
```
