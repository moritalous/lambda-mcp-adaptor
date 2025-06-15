/**
 * MCP Tools Server - Example Implementation with Bearer Token Authentication
 * 
 * This example demonstrates how to use the lambda-mcp-adaptor library with built-in
 * Bearer token authentication. The authentication is handled by the library,
 * making the implementation much simpler.
 */

import { createMCPServer, createLambdaHandler } from 'lambda-mcp-adaptor';
import { z } from 'zod';
import { randomBytes } from 'crypto';

// Create MCP server with configuration
const server = createMCPServer({
  name: 'MCP Tools Server',
  version: '2.0.0',
  description: 'A comprehensive MCP server providing mathematical, time, and utility tools with Bearer token authentication'
});

// ===== MATHEMATICAL TOOLS =====

server.tool('calculate', {
  operation: z.enum(['add', 'subtract', 'multiply', 'divide'])
    .describe('The mathematical operation to perform'),
  a: z.number().describe('First number'),
  b: z.number().describe('Second number')
}, async ({ operation, a, b }) => {
  if (b === 0 && operation === 'divide') {
    return {
      content: [{ type: 'text', text: 'Error: Division by zero is not allowed' }],
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
});

server.tool('advanced_math', {
  operation: z.enum(['power', 'sqrt', 'sin', 'cos', 'tan', 'log'])
    .describe('The advanced mathematical operation to perform'),
  value: z.number().describe('Input value'),
  base: z.number().optional().describe('Base for power operation or logarithm (default: e for log, 2 for power)')
}, async ({ operation, value, base }) => {
  let result;
  
  try {
    switch (operation) {
      case 'power':
        result = Math.pow(value, base || 2);
        break;
      case 'sqrt':
        if (value < 0) {
          return {
            content: [{ type: 'text', text: 'Error: Cannot calculate square root of negative number' }],
            isError: true
          };
        }
        result = Math.sqrt(value);
        break;
      case 'sin':
        result = Math.sin(value);
        break;
      case 'cos':
        result = Math.cos(value);
        break;
      case 'tan':
        result = Math.tan(value);
        break;
      case 'log':
        if (value <= 0) {
          return {
            content: [{ type: 'text', text: 'Error: Cannot calculate logarithm of non-positive number' }],
            isError: true
          };
        }
        result = base ? Math.log(value) / Math.log(base) : Math.log(value);
        break;
    }
    
    return {
      content: [{ type: 'text', text: `${operation}(${value}${base ? `, ${base}` : ''}) = ${result}` }]
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true
    };
  }
});

// ===== TIME & DATE TOOLS =====

server.tool('get_current_time', {
  timezone: z.string().optional().default('UTC').describe('Timezone (default: UTC)'),
  format: z.enum(['iso', 'unix', 'readable']).optional().default('iso')
    .describe('Output format: iso, unix timestamp, or readable string')
}, async ({ timezone, format }) => {
  const now = new Date();
  let timeString;
  
  switch (format) {
    case 'unix':
      timeString = Math.floor(now.getTime() / 1000).toString();
      break;
    case 'iso':
      timeString = timezone === 'UTC' ? now.toISOString() :
        `${now.toISOString()} (requested timezone: ${timezone}, showing UTC)`;
      break;
    case 'readable':
      timeString = timezone === 'UTC' ? now.toUTCString() :
        `${now.toUTCString()} (requested timezone: ${timezone}, showing UTC)`;
      break;
  }
  
  return {
    content: [{ type: 'text', text: `Current time: ${timeString}` }]
  };
});

server.tool('date_calculation', {
  date: z.string().describe('Base date in ISO format (YYYY-MM-DD or full ISO string)'),
  operation: z.enum(['add', 'subtract']).describe('Operation to perform'),
  amount: z.number().int().positive().describe('Amount to add or subtract'),
  unit: z.enum(['days', 'months', 'years']).describe('Unit of time to add or subtract')
}, async ({ date, operation, amount, unit }) => {
  try {
    const baseDate = new Date(date);
    
    if (isNaN(baseDate.getTime())) {
      throw new Error('Invalid date format');
    }
    
    const multiplier = operation === 'add' ? 1 : -1;
    const adjustedAmount = amount * multiplier;
    
    let resultDate = new Date(baseDate);
    
    switch (unit) {
      case 'days':
        resultDate.setDate(resultDate.getDate() + adjustedAmount);
        break;
      case 'months':
        resultDate.setMonth(resultDate.getMonth() + adjustedAmount);
        break;
      case 'years':
        resultDate.setFullYear(resultDate.getFullYear() + adjustedAmount);
        break;
    }
    
    return {
      content: [{
        type: 'text',
        text: `${baseDate.toISOString().split('T')[0]} ${operation} ${amount} ${unit} = ${resultDate.toISOString().split('T')[0]}`
      }]
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true
    };
  }
});

// ===== UTILITY TOOLS =====

server.tool('generate_uuid', {
  count: z.number().int().positive().optional().default(1).describe('Number of UUIDs to generate'),
  format: z.enum(['standard', 'compact']).optional().default('standard')
    .describe('Format: standard (with hyphens) or compact (without hyphens)')
}, async ({ count, format }) => {
  const uuids = [];
  
  for (let i = 0; i < count; i++) {
    let uuid = generateUUID();
    if (format === 'compact') {
      uuid = uuid.replace(/-/g, '');
    }
    uuids.push(uuid);
  }
  
  return {
    content: [{
      type: 'text',
      text: count === 1 ? uuids[0] : uuids.join('\n')
    }]
  };
});

server.tool('generate_random_string', {
  length: z.number().int().positive().max(1000).describe('Length of the random string (max 1000)'),
  charset: z.enum(['alphanumeric', 'alphabetic', 'numeric', 'hex', 'base64'])
    .optional().default('alphanumeric').describe('Character set to use'),
  count: z.number().int().positive().optional().default(1).describe('Number of strings to generate')
}, async ({ length, charset, count }) => {
  const charsets = {
    alphanumeric: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
    alphabetic: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
    numeric: '0123456789',
    hex: '0123456789abcdef',
    base64: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  };
  
  const chars = charsets[charset];
  const strings = [];
  
  for (let i = 0; i < count; i++) {
    let result = '';
    for (let j = 0; j < length; j++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    strings.push(result);
  }
  
  return {
    content: [{
      type: 'text',
      text: count === 1 ? strings[0] : strings.join('\n')
    }]
  };
});

server.tool('generate_hash', {
  text: z.string().describe('Text to hash'),
  algorithm: z.enum(['md5', 'sha1', 'sha256', 'sha512']).optional().default('sha256')
    .describe('Hash algorithm to use'),
  encoding: z.enum(['hex', 'base64']).optional().default('hex')
    .describe('Output encoding')
}, async ({ text, algorithm, encoding }) => {
  try {
    const crypto = await import('crypto');
    const hash = crypto.createHash(algorithm);
    hash.update(text);
    const result = hash.digest(encoding);
    
    return {
      content: [{
        type: 'text',
        text: `${algorithm.toUpperCase()}(${encoding}): ${result}`
      }]
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true
    };
  }
});

server.tool('text_operations', {
  text: z.string().describe('Text to process'),
  operations: z.array(z.enum([
    'word_count', 'char_count', 'line_count',
    'uppercase', 'lowercase', 'reverse',
    'extract_emails', 'extract_urls'
  ])).describe('Operations to perform on the text')
}, async ({ text, operations }) => {
  const results = [];
  
  for (const operation of operations) {
    switch (operation) {
      case 'word_count':
        const wordCount = text.trim().split(/\s+/).filter(word => word.length > 0).length;
        results.push(`Word count: ${wordCount}`);
        break;
      case 'char_count':
        results.push(`Character count: ${text.length}`);
        break;
      case 'line_count':
        const lineCount = text.split('\n').length;
        results.push(`Line count: ${lineCount}`);
        break;
      case 'uppercase':
        results.push(`Uppercase: ${text.toUpperCase()}`);
        break;
      case 'lowercase':
        results.push(`Lowercase: ${text.toLowerCase()}`);
        break;
      case 'reverse':
        results.push(`Reversed: ${text.split('').reverse().join('')}`);
        break;
      case 'extract_emails':
        const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
        const emails = text.match(emailRegex) || [];
        results.push(`Emails found: ${emails.length > 0 ? emails.join(', ') : 'None'}`);
        break;
      case 'extract_urls':
        const urlRegex = /https?:\/\/[^\s]+/g;
        const urls = text.match(urlRegex) || [];
        results.push(`URLs found: ${urls.length > 0 ? urls.join(', ') : 'None'}`);
        break;
    }
  }
  
  return {
    content: [{ type: 'text', text: results.join('\n') }]
  };
});

// ===== PROMPTS =====

server.prompt('analyze-calculation', {
  calculation: z.string().describe('Mathematical expression to analyze'),
  context: z.string().optional().describe('Additional context for the analysis')
}, async ({ calculation, context }) => {
  return {
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Please analyze this mathematical calculation: ${calculation}${context ? `\n\nContext: ${context}` : ''}\n\nProvide step-by-step breakdown, identify the mathematical concepts involved, and explain the result.`
        }
      }
    ]
  };
});

server.prompt('process-text', {
  text: z.string().describe('Text to process'),
  task: z.string().describe('Processing task to perform'),
  additional_instructions: z.string().optional().describe('Additional instructions for processing')
}, async ({ text, task, additional_instructions }) => {
  return {
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `${task}:\n\n${text}${additional_instructions ? `\n\nAdditional instructions: ${additional_instructions}` : ''}`
        }
      }
    ]
  };
});

// ===== HELPER FUNCTIONS =====

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ===== LAMBDA HANDLER WITH LIBRARY AUTHENTICATION =====

// Simple Bearer token authentication using environment variable
const authConfig = {
  type: 'bearer-token',
  tokens: (process.env.VALID_TOKENS || '').split(',').filter(t => t.trim())
};

export const lambdaHandler = createLambdaHandler(server, {
  auth: authConfig
});
