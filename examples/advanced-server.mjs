/**
 * Advanced MCP Server Example with complex tools and validation
 */

import { createMCPServer, createLambdaHandler, CommonSchemas } from '../src/index.mjs';
import { z } from 'zod';
import { randomBytes } from 'crypto';

const server = createMCPServer({
  name: 'Advanced MCP Server',
  version: '2.0.0',
  description: 'Advanced example showcasing complex tools and validation'
});

// Complex data processing tool
server.tool('process_data', {
  data: z.array(z.object({
    id: z.string(), // Changed from CommonSchemas.uuid to simple string
    name: z.string().min(1).max(100),
    value: z.number().min(0).max(1000),
    category: z.enum(['A', 'B', 'C']),
    tags: z.array(z.string()).optional(),
    metadata: z.record(z.string()).optional()
  })).min(1).max(100),
  operation: z.enum(['sum', 'average', 'max', 'min', 'count', 'group']),
  filters: z.object({
    category: z.enum(['A', 'B', 'C']).optional(),
    minValue: z.number().optional(),
    maxValue: z.number().optional(),
    requiredTags: z.array(z.string()).optional(),
    namePattern: z.string().optional()
  }).optional()
}, async ({ data, operation, filters }) => {
  // Apply filters
  let filteredData = data;
  
  if (filters) {
    if (filters.category) {
      filteredData = filteredData.filter(item => item.category === filters.category);
    }
    
    if (filters.minValue !== undefined) {
      filteredData = filteredData.filter(item => item.value >= filters.minValue);
    }
    
    if (filters.maxValue !== undefined) {
      filteredData = filteredData.filter(item => item.value <= filters.maxValue);
    }
    
    if (filters.requiredTags?.length) {
      filteredData = filteredData.filter(item => 
        filters.requiredTags.every(tag => item.tags?.includes(tag))
      );
    }
    
    if (filters.namePattern) {
      const regex = new RegExp(filters.namePattern, 'i');
      filteredData = filteredData.filter(item => regex.test(item.name));
    }
  }
  
  if (filteredData.length === 0) {
    return {
      content: [{ type: 'text', text: 'No data matches the specified filters' }],
      isError: true
    };
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
    case 'count':
      result = filteredData.length;
      break;
    case 'group':
      const grouped = filteredData.reduce((acc, item) => {
        acc[item.category] = (acc[item.category] || 0) + 1;
        return acc;
      }, {});
      result = grouped;
      break;
  }
  
  return {
    content: [{
      type: 'text',
      text: `Operation: ${operation}\nFiltered items: ${filteredData.length}/${data.length}\nResult: ${JSON.stringify(result, null, 2)}`
    }]
  };
});

// File-like operations tool
server.tool('text_operations', {
  text: z.string().min(1).max(10000),
  operations: z.array(z.enum([
    'word_count', 'char_count', 'line_count', 
    'uppercase', 'lowercase', 'reverse',
    'extract_emails', 'extract_urls', 'hash'
  ])).min(1)
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
      case 'hash':
        const { createHash } = await import('crypto');
        results.sha256_hash = createHash('sha256').update(text).digest('hex');
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

// Random data generator
server.tool('generate_test_data', {
  type: z.enum(['users', 'products', 'events', 'mixed']),
  count: z.number().int().min(1).max(100),
  options: z.object({
    includeIds: z.boolean().optional().default(true),
    includeTimestamps: z.boolean().optional().default(false),
    categories: z.array(z.string()).optional(),
    seed: z.string().optional()
  }).optional()
}, async ({ type, count, options = {} }) => {
  const data = [];
  
  // Simple seeded random (for reproducible results)
  let seedValue = 0;
  if (options.seed) {
    for (let i = 0; i < options.seed.length; i++) {
      seedValue += options.seed.charCodeAt(i);
    }
  }
  
  const seededRandom = () => {
    seedValue = (seedValue * 9301 + 49297) % 233280;
    return seedValue / 233280;
  };
  
  const randomChoice = (arr) => arr[Math.floor(seededRandom() * arr.length)];
  const randomInt = (min, max) => Math.floor(seededRandom() * (max - min + 1)) + min;
  
  const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry'];
  const products = ['Widget', 'Gadget', 'Tool', 'Device', 'Component', 'Module'];
  const events = ['Login', 'Purchase', 'View', 'Click', 'Download', 'Share'];
  const categories = options.categories || ['A', 'B', 'C', 'Premium', 'Standard', 'Basic'];
  
  for (let i = 0; i < count; i++) {
    let item = {};
    
    if (options.includeIds) {
      item.id = `${type}_${i + 1}_${randomInt(1000, 9999)}`;
    }
    
    switch (type) {
      case 'users':
        item.name = randomChoice(names);
        item.email = `${item.name.toLowerCase()}${randomInt(1, 999)}@example.com`;
        item.age = randomInt(18, 80);
        item.active = seededRandom() > 0.3;
        break;
        
      case 'products':
        item.name = `${randomChoice(products)} ${randomInt(100, 999)}`;
        item.price = Math.round(seededRandom() * 1000 * 100) / 100;
        item.category = randomChoice(categories);
        item.inStock = seededRandom() > 0.2;
        break;
        
      case 'events':
        item.event = randomChoice(events);
        item.userId = `user_${randomInt(1, 100)}`;
        item.value = Math.round(seededRandom() * 100);
        break;
        
      case 'mixed':
        const mixedType = randomChoice(['user', 'product', 'event']);
        item.type = mixedType;
        if (mixedType === 'user') {
          item.name = randomChoice(names);
          item.score = randomInt(0, 100);
        } else if (mixedType === 'product') {
          item.name = randomChoice(products);
          item.price = Math.round(seededRandom() * 500 * 100) / 100;
        } else {
          item.event = randomChoice(events);
          item.count = randomInt(1, 50);
        }
        break;
    }
    
    if (options.includeTimestamps) {
      const now = new Date();
      const randomDays = randomInt(0, 30);
      item.timestamp = new Date(now.getTime() - randomDays * 24 * 60 * 60 * 1000).toISOString();
    }
    
    data.push(item);
  }
  
  return {
    content: [{
      type: 'text',
      text: `Generated ${count} ${type} records:\n${JSON.stringify(data, null, 2)}`
    }]
  };
});

export const lambdaHandler = createLambdaHandler(server);

// Local testing
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🧪 Testing Advanced MCP Server...\n');
  
  // Test complex data processing
  const testData = [
    { id: 'item-1', name: 'Product A', value: 150, category: 'A', tags: ['premium', 'new'] },
    { id: 'item-2', name: 'Product B', value: 75, category: 'B', tags: ['standard'] },
    { id: 'item-3', name: 'Product C', value: 200, category: 'A', tags: ['premium'] }
  ];
  
  const processResult = await server.handleRequest({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'process_data',
      arguments: {
        data: testData,
        operation: 'average',
        filters: { category: 'A' }
      }
    }
  });
  
  console.log('✅ Data processing result:');
  console.log(processResult.content[0].text);
  
  // Test text operations
  const textResult = await server.handleRequest({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'text_operations',
      arguments: {
        text: 'Hello World! Contact us at info@example.com or visit https://example.com',
        operations: ['word_count', 'extract_emails', 'extract_urls']
      }
    }
  });
  
  console.log('\n✅ Text operations result:');
  console.log(textResult.content[0].text);
  
  console.log('\n🎉 Advanced server tests completed!');
}
