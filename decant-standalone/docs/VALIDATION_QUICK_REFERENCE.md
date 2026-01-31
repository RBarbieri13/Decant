# Validation Quick Reference

## Import Statements

```typescript
// In route files
import { validateBody, validateQuery, validateParams, validate } from '../middleware/validate.js';
import { CreateNodeSchema, UuidParamSchema, /* etc */ } from '../validation/schemas.js';

// For type annotations
import { CreateNodeInput, UpdateNodeInput, /* etc */ } from '../validation/schemas.js';
```

## Middleware Usage Patterns

### Single Body Validation
```typescript
app.post('/api/resource', validateBody(ResourceSchema), handler);
```

### Single Query Validation
```typescript
app.get('/api/search', validateQuery(SearchSchema), handler);
```

### Single Params Validation
```typescript
app.get('/api/resource/:id', validateParams(UuidParamSchema), handler);
```

### Combined Validation
```typescript
app.put('/api/resource/:id',
  validate({
    params: UuidParamSchema,
    body: UpdateResourceSchema
  }),
  handler
);
```

### With Rate Limiting
```typescript
app.post('/api/expensive',
  rateLimiter,
  validateBody(ExpensiveSchema),
  handler
);
```

## Available Schemas

| Schema | Purpose | Required Fields | Optional Fields |
|--------|---------|-----------------|-----------------|
| `CreateNodeSchema` | Create new node | title, url, source_domain | company, descriptions, logo_url, ai_summary, tags, concepts, parent_ids |
| `UpdateNodeSchema` | Update existing node | At least one field | title, company, descriptions, logo_url, ai_summary, tags, concepts, parent_ids |
| `ImportUrlSchema` | Import URL | url (http/https) | - |
| `SetApiKeySchema` | Set API key | apiKey (min 20 chars) | - |
| `SearchQuerySchema` | Search nodes | q (query string) | filters, limit, offset |
| `MoveNodeSchema` | Move node | targetHierarchy | targetParentId |
| `MergeNodesSchema` | Merge nodes | secondaryId | options |
| `UuidParamSchema` | Validate UUID param | id | - |
| `HierarchyViewParamSchema` | Validate hierarchy view | view (function/organization) | - |

## Common Validation Rules

### String Constraints
```typescript
z.string().min(1)                    // Non-empty
z.string().min(1).max(500)          // Length range
z.string().url()                     // Valid URL
z.string().uuid()                    // Valid UUID
z.string().optional()                // Optional field
z.string().nullable()                // Can be null
```

### Number Constraints
```typescript
z.number().min(1)                    // Minimum value
z.number().max(100)                  // Maximum value
z.number().min(0).max(100)          // Range
```

### Enum Validation
```typescript
z.enum(['function', 'organization']) // One of specific values
```

### Array Validation
```typescript
z.array(z.string())                  // Array of strings
z.array(z.string()).optional()       // Optional array
```

### Object Validation
```typescript
z.record(z.string(), z.any())        // Record/dictionary
z.object({ ... })                    // Structured object
```

### Transformations
```typescript
z.string()
  .regex(/^\d+$/)                    // Must be numeric string
  .transform(val => parseInt(val))   // Convert to number
  .pipe(z.number().min(1))          // Validate as number
```

### Custom Refinements
```typescript
z.object({
  startDate: z.date(),
  endDate: z.date()
}).refine(
  data => data.endDate > data.startDate,
  { message: "End date must be after start date" }
)
```

## Error Response Format

All validation failures return HTTP 400 with this structure:

```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "fieldName",
      "message": "Error message"
    }
  ]
}
```

### Combined Validation Error Format

When using `validate()` with multiple sources:

```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "params.id",
      "message": "ID must be a valid UUID"
    },
    {
      "field": "body.title",
      "message": "Title is required"
    }
  ]
}
```

## Type Safety in Handlers

After validation, request data is correctly typed:

```typescript
export async function createNode(req: Request, res: Response) {
  // req.body is already validated and typed as CreateNodeInput
  const { title, url, source_domain } = req.body;
  // TypeScript knows all these fields exist and their types
}
```

## Testing Validation

```typescript
import request from 'supertest';

// Test valid request
const response = await request(app)
  .post('/api/nodes')
  .send({
    title: 'Test',
    url: 'https://example.com',
    source_domain: 'example.com'
  });
expect(response.status).toBe(201);

// Test invalid request
const response = await request(app)
  .post('/api/nodes')
  .send({ title: '' }); // Missing required fields
expect(response.status).toBe(400);
expect(response.body.details).toBeDefined();
```

## Common Patterns

### Optional with Default
```typescript
z.string().optional().default('default value')
```

### Nullable or Empty String
```typescript
z.string().url().optional().or(z.literal('')).or(z.null())
```

### At Least One Field Required
```typescript
z.object({ field1: z.string().optional(), field2: z.string().optional() })
  .refine(data => Object.keys(data).length > 0, {
    message: 'At least one field must be provided'
  })
```

### String to Number Transformation
```typescript
z.string()
  .regex(/^\d+$/, 'Must be a number')
  .transform(val => parseInt(val, 10))
  .pipe(z.number().min(1).max(100))
```

### URL Protocol Validation
```typescript
z.string()
  .url()
  .refine(url => {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  }, { message: 'URL must use http or https protocol' })
```

## Field Length Recommendations

Based on database schema:

- `title`: 1-500 characters
- `company`: 0-200 characters
- `phrase_description`: 0-1000 characters
- `short_description`: 0-2000 characters
- `ai_summary`: 0-5000 characters
- `search query`: 1-500 characters
- `url`: valid URL format

## HTTP Status Codes

- `200 OK`: Validation passed, operation successful
- `201 Created`: Validation passed, resource created
- `400 Bad Request`: Validation failed
- `404 Not Found`: Valid request, resource not found
- `500 Internal Server Error`: Server error (not validation)

## Debugging Tips

### Enable Detailed Logging
Validation errors are automatically logged with detailed information.

### Check Error Details
Always inspect `response.body.details` array for specific validation failures.

### Verify Schema Matches Database
Ensure validation constraints match database column constraints.

### Use Type Inference
Let TypeScript infer types from schemas:
```typescript
type MyType = z.infer<typeof MySchema>;
```

### Test Edge Cases
- Empty strings
- Very long strings (max length + 1)
- Invalid UUIDs
- Wrong enum values
- Missing required fields
- Extra unexpected fields (Zod strips by default)

## Performance Tips

- Schemas are compiled once at module load
- Validation is synchronous and fast (microseconds)
- Failed validation short-circuits database operations
- Combine with rate limiting for expensive endpoints

## Security Considerations

- Never trust client input - always validate
- Use strict types (avoid `z.any()` except for `extracted_fields`)
- Enforce length limits to prevent DoS
- Validate UUIDs to prevent injection
- Sanitize URLs to prevent XSS via href attributes
- Rate limit endpoints that use AI services

## Adding New Validation

1. Define schema in `src/backend/validation/schemas.ts`
2. Export TypeScript type using `z.infer`
3. Apply middleware in `src/backend/routes/index.ts`
4. Update handler to use inferred type
5. Add tests to `validate.spec.ts`
6. Update this documentation

## Resources

- [Zod Documentation](https://zod.dev/)
- [Validation Implementation](./VALIDATION.md)
- [API Routes Reference](../src/backend/routes/index.ts)
- [Schema Definitions](../src/backend/validation/schemas.ts)
