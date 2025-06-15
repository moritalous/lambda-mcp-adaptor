# MCP Tools Server with Authentication Example

This directory contains a comprehensive example implementation of an MCP (Model Context Protocol) server with Bearer token authentication using the `lambda-mcp-adaptor` library. The example demonstrates how to build a secure MCP server with authentication and deploy it on AWS Lambda.

> **🔐 With Authentication**: This version includes Bearer token authentication. For a simpler version without authentication, see the [`mcp-server`](../mcp-server/) example.

## What's in this Example

This example showcases:

- **Secure MCP Server Implementation**: A fully functional server with Bearer token authentication
- **Built-in Authentication**: Uses library's integrated authentication features
- **AWS Lambda Deployment**: Ready-to-deploy serverless architecture using AWS SAM
- **VS Code Integration**: Ready-to-use configuration with secure token handling

## Available Tools

The example server includes the same tools as the simple version, but with secure access:

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
└── mcp-server-auth/               # Complete AWS SAM application with authentication
    ├── mcp-server/                # Lambda function code
    │   ├── app.mjs               # Main application with authentication
    │   ├── package.json          # Dependencies
    │   └── tests/unit/           # Unit tests
    ├── events/                   # Sample event files for testing
    ├── template.yaml             # AWS SAM template with auth parameters
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
cd mcp-server-auth  # Navigate to the SAM application directory
sam build
sam deploy --guided

# During deployment, set ValidTokens parameter:
# Example: "my-secret-token-123,another-token-456"
```

## Usage with MCP Clients

After deployment, configure your MCP client to connect with authentication.

### VSCode Configuration

Add the following configuration to your `mcp.json` file:

```json
{
    "servers": {
        "mcp-server-lambda": {
            "type": "http",
            "url": "https://{your-api-gateway-endpoint}/Prod/mcp",
            "headers": {
                "Authorization": "Bearer ${input:api_key}",
            }
        }
    },
    "inputs": [
        {
            "type": "promptString",
            "id": "api_key",
            "description": "API Key for mcp-server-lambda",
            "password": true
        }
    ]
}
```

Replace `{your-api-gateway-endpoint}` with the actual API Gateway endpoint URL from your deployment output.

### Other MCP Clients

For other MCP clients, use the HTTP transport with authentication:
```
URL: https://{your-api-gateway-endpoint}/Prod/mcp
Header: Authorization: Bearer your-token-here
```

## Key Implementation Patterns

### Authentication Setup Pattern
```javascript
import { createLambdaHandler, Auth } from 'lambda-mcp-adaptor';

// Simple Bearer token authentication
export const lambdaHandler = createLambdaHandler(server, {
  auth: Auth.bearerToken('VALID_TOKENS') // Reads from environment variable
});
```

### Tool Definition Pattern (Same as Simple Version)
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

### Authentication Options
```javascript
// Environment variable tokens (recommended)
auth: Auth.bearerToken('VALID_TOKENS')

// Hardcoded token list
auth: Auth.bearerTokens(['token1', 'token2'])

// Custom validation
auth: Auth.custom(async (token, event) => {
  const isValid = await validateToken(token);
  return { isValid, user: isValid ? { token } : undefined };
})
```

## Testing

The example includes comprehensive testing with authentication:

### Unit Tests
```bash
cd mcp-server-auth
npm test
```

### Local SAM Testing
```bash
# Test with authentication
sam local invoke MCPServerFunction --event events/mcp-initialize-auth.json
```

### Manual Testing
```bash
# Test without token (should return 401)
curl -X POST https://your-endpoint/Prod/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# Test with valid token
curl -X POST https://your-endpoint/Prod/mcp \
  -H "Authorization: Bearer your-token-here" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```
