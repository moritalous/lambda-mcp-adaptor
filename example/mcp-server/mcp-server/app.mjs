/**
 * MCP Tools Server - Example Implementation using lambda-mcp-adaptor
 * 
 * This is an example implementation of an MCP server using the lambda-mcp-adaptor library.
 * It demonstrates how to create a comprehensive MCP server with various utility tools.
 */

import { createMCPServer, createLambdaHandler } from 'lambda-mcp-adaptor';
import { z } from 'zod';
import { randomBytes } from 'crypto';

// Create MCP server with configuration
const server = createMCPServer({
  name: 'MCP Tools Server',
  version: '2.0.0',
  description: 'A comprehensive MCP server providing mathematical, time, and utility tools'
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
  base: z.number().optional().describe('Base for power operation or logarithm (optional)')
}, async ({ operation, value, base }) => {
  try {
    let result;
    
    switch (operation) {
      case 'power':
        if (base === undefined) throw new Error('Base is required for power operation');
        result = Math.pow(value, base);
        break;
      case 'sqrt':
        if (value < 0) throw new Error('Cannot calculate square root of negative number');
        result = Math.sqrt(value);
        break;
      case 'sin': result = Math.sin(value); break;
      case 'cos': result = Math.cos(value); break;
      case 'tan': result = Math.tan(value); break;
      case 'log':
        if (value <= 0) throw new Error('Cannot calculate logarithm of non-positive number');
        result = base ? Math.log(value) / Math.log(base) : Math.log(value);
        break;
    }
    
    return {
      content: [{ 
        type: 'text', 
        text: `${operation}(${value}${base !== undefined ? `, ${base}` : ''}) = ${result}` 
      }]
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
  timezone: z.string().optional().default('UTC')
    .describe('Timezone (optional, defaults to UTC)'),
  format: z.enum(['iso', 'unix', 'readable']).optional().default('iso')
    .describe('Output format for the timestamp')
}, async ({ timezone = 'UTC', format = 'iso' }) => {
  const now = new Date();
  let timeString;
  
  switch (format) {
    case 'iso':
      timeString = timezone === 'UTC' ? now.toISOString() : 
        `${now.toISOString()} (requested timezone: ${timezone}, showing UTC)`;
      break;
    case 'unix':
      timeString = Math.floor(now.getTime() / 1000).toString();
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
  count: z.number().int().positive().optional().default(1)
    .describe('Number of UUIDs to generate (default: 1)'),
  format: z.enum(['standard', 'compact']).optional().default('standard')
    .describe('Output format (standard with hyphens or compact without)')
}, async ({ count = 1, format = 'standard' }) => {
  const uuids = [];
  
  for (let i = 0; i < count; i++) {
    const uuid = generateUUID();
    uuids.push(format === 'compact' ? uuid.replace(/-/g, '') : uuid);
  }
  
  const result = count === 1 ? 
    `Generated UUID: ${uuids[0]}` :
    `Generated ${count} UUIDs:\n${uuids.map((uuid, i) => `${i + 1}. ${uuid}`).join('\n')}`;
  
  return {
    content: [{ type: 'text', text: result }]
  };
});

server.tool('generate_random_string', {
  length: z.number().int().positive().max(1000)
    .describe('Length of the random string (max 1000)'),
  charset: z.enum(['alphanumeric', 'alphabetic', 'numeric', 'hex', 'base64']).optional().default('alphanumeric')
    .describe('Character set to use for generation'),
  count: z.number().int().positive().max(10).optional().default(1)
    .describe('Number of strings to generate (max 10)')
}, async ({ length, charset = 'alphanumeric', count = 1 }) => {
  const charsets = {
    alphanumeric: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
    alphabetic: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
    numeric: '0123456789',
    hex: '0123456789ABCDEF',
    base64: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  };
  
  const chars = charsets[charset];
  const strings = [];
  
  for (let i = 0; i < count; i++) {
    let result = '';
    const bytes = randomBytes(length);
    
    for (let j = 0; j < length; j++) {
      result += chars[bytes[j] % chars.length];
    }
    
    strings.push(result);
  }
  
  const result = count === 1 ?
    `Generated random string: ${strings[0]}` :
    `Generated ${count} random strings:\n${strings.map((str, i) => `${i + 1}. ${str}`).join('\n')}`;
  
  return {
    content: [{ type: 'text', text: result }]
  };
});

server.tool('generate_hash', {
  text: z.string().describe('Text to hash'),
  algorithm: z.enum(['md5', 'sha1', 'sha256', 'sha512']).optional().default('sha256')
    .describe('Hash algorithm to use'),
  encoding: z.enum(['hex', 'base64']).optional().default('hex')
    .describe('Output encoding format')
}, async ({ text, algorithm = 'sha256', encoding = 'hex' }) => {
  try {
    const { createHash } = await import('crypto');
    const hash = createHash(algorithm);
    hash.update(text);
    const result = hash.digest(encoding);
    
    return {
      content: [{ type: 'text', text: `${algorithm.toUpperCase()} hash (${encoding}): ${result}` }]
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error generating hash: ${error.message}` }],
      isError: true
    };
  }
});

// ===== TEXT PROCESSING TOOLS =====

server.tool('text_operations', {
  text: z.string().min(1).max(10000).describe('Text to process'),
  operations: z.array(z.enum([
    'word_count', 'char_count', 'line_count', 
    'uppercase', 'lowercase', 'reverse',
    'extract_emails', 'extract_urls'
  ])).min(1).describe('Operations to perform on the text')
}, async ({ text, operations }) => {
  const results = {};
  
  for (const op of operations) {
    switch (op) {
      case 'word_count':
        results.word_count = text.split(/\s+/).filter(word => word.length > 0).length;
        break;
      case 'char_count':
        results.char_count = text.length;
        break;
      case 'line_count':
        results.line_count = text.split('\n').length;
        break;
      case 'uppercase':
        results.uppercase = text.toUpperCase();
        break;
      case 'lowercase':
        results.lowercase = text.toLowerCase();
        break;
      case 'reverse':
        results.reverse = text.split('').reverse().join('');
        break;
      case 'extract_emails':
        const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
        results.emails = text.match(emailRegex) || [];
        break;
      case 'extract_urls':
        const urlRegex = /https?:\/\/[^\s]+/g;
        results.urls = text.match(urlRegex) || [];
        break;
    }
  }
  
  return {
    content: [{
      type: 'text',
      text: `Text Operations Results:\n${JSON.stringify(results, null, 2)}`
    }]
  };
});

// ===== RESOURCES & PROMPTS =====

server.resource('server-info', 'info://server', async (uri) => ({
  contents: [{
    uri: uri,
    text: JSON.stringify({
      ...server.getStats(),
      description: 'MCP Tools Server providing comprehensive utility tools',
      powered_by: 'lambda-mcp-adaptor',
      version: '2.0.0'
    }, null, 2),
    mimeType: 'application/json'
  }]
}));

server.prompt('analyze-calculation', {
  calculation: z.string().describe('Mathematical expression to analyze'),
  context: z.string().optional().describe('Additional context for analysis')
}, ({ calculation, context }) => ({
  messages: [{
    role: 'user',
    content: {
      type: 'text',
      text: `Please analyze this mathematical calculation: ${calculation}${context ? `\n\nContext: ${context}` : ''}\n\nConsider its mathematical properties, significance, and any interesting facts.`
    }
  }]
}));

server.prompt('process-text', {
  text: z.string().describe('Text to process'),
  task: z.enum(['summarize', 'analyze', 'extract_key_points', 'translate']).describe('Processing task to perform'),
  additional_instructions: z.string().optional().describe('Additional instructions for processing')
}, ({ text, task, additional_instructions }) => {
  let taskDescription;
  switch (task) {
    case 'summarize':
      taskDescription = 'Please provide a concise summary of the following text';
      break;
    case 'analyze':
      taskDescription = 'Please analyze the following text for themes, sentiment, and key insights';
      break;
    case 'extract_key_points':
      taskDescription = 'Please extract the key points and main ideas from the following text';
      break;
    case 'translate':
      taskDescription = 'Please translate the following text (auto-detect source language)';
      break;
  }
  
  return {
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: `${taskDescription}:\n\n${text}${additional_instructions ? `\n\nAdditional instructions: ${additional_instructions}` : ''}`
      }
    }]
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

// ===== LAMBDA HANDLER =====

export const lambdaHandler = createLambdaHandler(server);
