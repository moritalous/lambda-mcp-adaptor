/**
 * Schema Utilities
 *
 * Zod schema conversion and validation utilities
 */

import { z } from 'zod';

/**
 * Convert Zod schema to JSON Schema
 */
export function zodToJsonSchema(zodSchema) {
  const properties = {};
  const required = [];

  for (const [key, schema] of Object.entries(zodSchema)) {
    properties[key] = convertZodTypeToJsonSchema(schema);

    if (!isZodOptional(schema)) {
      required.push(key);
    }
  }

  return {
    type: 'object',
    properties,
    required,
  };
}

/**
 * Convert individual Zod type to JSON Schema
 */
function convertZodTypeToJsonSchema(zodType) {
  // Handle ZodOptional
  if (zodType instanceof z.ZodOptional) {
    return convertZodTypeToJsonSchema(zodType._def.innerType);
  }

  // Handle ZodDefault
  if (zodType instanceof z.ZodDefault) {
    const schema = convertZodTypeToJsonSchema(zodType._def.innerType);
    schema.default = zodType._def.defaultValue();
    return schema;
  }

  // Handle ZodString
  if (zodType instanceof z.ZodString) {
    const schema = { type: 'string' };

    // Add constraints
    if (zodType._def.checks) {
      for (const check of zodType._def.checks) {
        switch (check.kind) {
          case 'min':
            schema.minLength = check.value;
            break;
          case 'max':
            schema.maxLength = check.value;
            break;
          case 'email':
            schema.format = 'email';
            break;
          case 'url':
            schema.format = 'uri';
            break;
          case 'uuid':
            schema.format = 'uuid';
            break;
        }
      }
    }

    if (zodType.description) {
      schema.description = zodType.description;
    }

    return schema;
  }

  // Handle ZodNumber
  if (zodType instanceof z.ZodNumber) {
    const schema = { type: 'number' };

    if (zodType._def.checks) {
      for (const check of zodType._def.checks) {
        switch (check.kind) {
          case 'min':
            schema.minimum = check.value;
            break;
          case 'max':
            schema.maximum = check.value;
            break;
          case 'int':
            schema.type = 'integer';
            break;
        }
      }
    }

    if (zodType.description) {
      schema.description = zodType.description;
    }

    return schema;
  }

  // Handle ZodBoolean
  if (zodType instanceof z.ZodBoolean) {
    const schema = { type: 'boolean' };

    if (zodType.description) {
      schema.description = zodType.description;
    }

    return schema;
  }

  // Handle ZodEnum
  if (zodType instanceof z.ZodEnum) {
    const schema = {
      type: 'string',
      enum: zodType._def.values,
    };

    if (zodType.description) {
      schema.description = zodType.description;
    }

    return schema;
  }

  // Handle ZodArray
  if (zodType instanceof z.ZodArray) {
    const schema = {
      type: 'array',
      items: convertZodTypeToJsonSchema(zodType._def.type),
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

  // Handle ZodObject
  if (zodType instanceof z.ZodObject) {
    return zodToJsonSchema(zodType.shape);
  }

  // Fallback for unknown types
  return {
    type: 'string',
    description: zodType.description || 'Unknown type',
  };
}

/**
 * Check if Zod type is optional
 */
export function isZodOptional(zodType) {
  return zodType instanceof z.ZodOptional || zodType instanceof z.ZodDefault;
}

/**
 * Check if Zod type has default value
 */
export function hasZodDefault(zodType) {
  return zodType instanceof z.ZodDefault;
}

/**
 * Validate arguments with Zod schema
 */
export function validateWithZod(zodSchema, args) {
  const validated = {};

  for (const [key, schema] of Object.entries(zodSchema)) {
    try {
      if (args[key] === undefined && isZodOptional(schema)) {
        if (hasZodDefault(schema)) {
          validated[key] = schema.parse(undefined);
        }
        continue;
      }

      validated[key] = schema.parse(args[key]);
    } catch (error) {
      throw new z.ZodError([
        {
          code: 'custom',
          path: [key],
          message: `${error.message}`,
        },
      ]);
    }
  }

  return validated;
}
