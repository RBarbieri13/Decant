# Input Validation with Zod

## Overview

The Decant application implements comprehensive input validation using [Zod](https://zod.dev/) v4.3.6, a TypeScript-first schema validation library. All API endpoints are protected with validation middleware that ensures data integrity before processing.

## Architecture

### File Structure

```
src/backend/
├── validation/
│   └── schemas.ts                    # All Zod validation schemas
├── middleware/
│   ├── validate.ts                   # Validation middleware functions
│   └── __tests__/
│       └── validate.spec.ts          # Comprehensive validation tests
└── routes/
    └── index.ts                      # Route definitions with validation
```

## Validation Middleware

Located in `/Users/robert.barbieri/.claude/projects-workspace/Decant/decant-standalone/src/backend/middleware/validate.ts`

### Available Middleware Functions

#### `validateBody<T>(schema: ZodSchema<T>)`
Validates request body against a Zod schema.

**Usage:**
```typescript
app.post('/api/nodes', validateBody(CreateNodeSchema), createNode);
```

**Features:**
- Returns 400 with detailed errors on validation failure
- Transforms data (e.g., string to number conversions)
- Replaces `req.body` with validated/transformed data

#### `validateQuery<T>(schema: ZodSchema<T>)`
Validates query parameters against a Zod schema.

**Usage:**
```typescript
app.get('/api/search', validateQuery(SearchQuerySchema), search);
```

**Features:**
- Validates query string parameters
- Transforms string values to appropriate types
- Replaces `req.query` with validated data

#### `validateParams<T>(schema: ZodSchema<T>)`
Validates URL parameters against a Zod schema.

**Usage:**
```typescript
app.get('/api/nodes/:id', validateParams(UuidParamSchema), getNode);
```

**Features:**
- Validates route parameters (e.g., UUIDs)
- Returns clear error messages for invalid formats
- Replaces `req.params` with validated data

#### `validate(options: { body?, query?, params? })`
Combined validation for multiple request parts.

**Usage:**
```typescript
app.put('/api/nodes/:id',
  validate({
    params: UuidParamSchema,
    body: UpdateNodeSchema
  }),
  updateNode
);
```

**Features:**
- Validates multiple request parts in single middleware
- Aggregates all validation errors
- Prefixes error fields with source (e.g., `params.id`, `body.title`)

### Error Response Format

All validation errors return a consistent format:

```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "title",
      "message": "Title is required"
    },
    {
      "field": "url",
      "message": "Must be a valid URL"
    }
  ]
}
```

## Validation Schemas

Located in `/Users/robert.barbieri/.claude/projects-workspace/Decant/decant-standalone/src/backend/validation/schemas.ts`

### Node Schemas

#### `CreateNodeSchema`
Validates all fields required to create a new node.

**Required Fields:**
- `title`: string, 1-500 characters
- `url`: valid URL format
- `source_domain`: string, non-empty

**Optional Fields:**
- `company`: string, max 200 characters
- `phrase_description`: string, max 1000 characters
- `short_description`: string, max 2000 characters
- `logo_url`: valid URL or empty string or null
- `ai_summary`: string, max 5000 characters
- `extracted_fields`: record of any values
- `metadata_tags`: array of strings
- `key_concepts`: array of strings
- `function_parent_id`: valid UUID or null
- `organization_parent_id`: valid UUID or null

**Example:**
```typescript
{
  title: "Product Launch Strategy",
  url: "https://example.com/strategy",
  source_domain: "example.com",
  company: "Acme Corp",
  metadata_tags: ["strategy", "product"],
  function_parent_id: "123e4567-e89b-12d3-a456-426614174000"
}
```

#### `UpdateNodeSchema`
Validates partial updates to existing nodes.

**Features:**
- All fields are optional
- At least one field must be provided (enforced via refinement)
- Empty title strings are rejected
- Same validation rules as CreateNodeSchema for provided fields

**Example:**
```typescript
{
  title: "Updated Title",
  company: "New Company Name"
}
```

### Import Schemas

#### `ImportUrlSchema`
Validates URL import requests.

**Validation Rules:**
- URL must be non-empty
- URL must be valid format
- Protocol must be http or https (no ftp, file, etc.)

**Example:**
```typescript
{
  url: "https://techcrunch.com/article"
}
```

#### `SetApiKeySchema`
Validates API key configuration.

**Validation Rules:**
- API key must be non-empty
- API key must be at least 20 characters (basic length check)

**Example:**
```typescript
{
  apiKey: "sk-proj-xxxxxxxxxxxxx"
}
```

### Search Schemas

#### `SearchQuerySchema`
Validates search query parameters.

**Fields:**
- `q`: required, 1-500 characters
- `filters`: optional string
- `limit`: optional, string transformed to number (1-100)
- `offset`: optional, string transformed to number (min 0)

**Example:**
```typescript
?q=machine+learning&limit=20&offset=0
```

**Transformation:**
The schema automatically converts string query parameters to numbers:
```typescript
{ q: "test", limit: "20" } → { q: "test", limit: 20 }
```

### Move & Merge Schemas

#### `MoveNodeSchema`
Validates node movement between hierarchies.

**Fields:**
- `targetParentId`: valid UUID or null/undefined
- `targetHierarchy`: enum of "function" or "organization"

**Example:**
```typescript
{
  targetParentId: "123e4567-e89b-12d3-a456-426614174000",
  targetHierarchy: "function"
}
```

#### `MergeNodesSchema`
Validates node merge operations.

**Fields:**
- `secondaryId`: required, valid UUID
- `options`: optional object
  - `keepMetadata`: optional boolean
  - `appendSummary`: optional boolean

**Example:**
```typescript
{
  secondaryId: "987e6543-e21b-12d3-a456-426614174000",
  options: {
    keepMetadata: true,
    appendSummary: true
  }
}
```

### URL Parameter Schemas

#### `UuidParamSchema`
Validates UUID path parameters.

**Fields:**
- `id`: valid UUID v4 format

**Example:**
```typescript
/api/nodes/123e4567-e89b-12d3-a456-426614174000
```

#### `HierarchyViewParamSchema`
Validates hierarchy view parameters.

**Fields:**
- `view`: enum of "function" or "organization"

**Example:**
```typescript
/api/hierarchy/tree/function
```

## Route Protection

All routes are protected with appropriate validation middleware:

### Node Routes
```typescript
// GET /api/nodes - No validation (returns all)
app.get('/api/nodes', nodeRoutes.getAllNodes);

// GET /api/nodes/:id - Validate UUID param
app.get('/api/nodes/:id', validateParams(UuidParamSchema), nodeRoutes.getNode);

// POST /api/nodes - Validate body
app.post('/api/nodes', validateBody(CreateNodeSchema), nodeRoutes.createNode);

// PUT /api/nodes/:id - Validate both param and body
app.put('/api/nodes/:id',
  validate({ params: UuidParamSchema, body: UpdateNodeSchema }),
  nodeRoutes.updateNode
);

// DELETE /api/nodes/:id - Validate UUID param
app.delete('/api/nodes/:id', validateParams(UuidParamSchema), nodeRoutes.deleteNode);

// POST /api/nodes/:id/merge - Validate both
app.post('/api/nodes/:id/merge',
  validate({ params: UuidParamSchema, body: MergeNodesSchema }),
  nodeRoutes.mergeNodes
);

// POST /api/nodes/:id/move - Validate both
app.post('/api/nodes/:id/move',
  validate({ params: UuidParamSchema, body: MoveNodeSchema }),
  nodeRoutes.moveNode
);
```

### Hierarchy Routes
```typescript
// GET /api/hierarchy/tree/:view - Validate view param
app.get('/api/hierarchy/tree/:view',
  validateParams(HierarchyViewParamSchema),
  hierarchyRoutes.getHierarchyTree
);

// GET /api/hierarchy/segments - No validation
app.get('/api/hierarchy/segments', hierarchyRoutes.getSegments);

// GET /api/hierarchy/organizations - No validation
app.get('/api/hierarchy/organizations', hierarchyRoutes.getOrganizations);
```

### Search Routes
```typescript
// GET /api/search - Validate query params
app.get('/api/search', validateQuery(SearchQuerySchema), searchRoutes.search);
```

### Import Routes
```typescript
// POST /api/import - Validate body + rate limiting
app.post('/api/import',
  importLimiter,
  validateBody(ImportUrlSchema),
  importRoutes.importUrl
);
```

### Settings Routes
```typescript
// POST /api/settings/api-key - Validate body + rate limiting
app.post('/api/settings/api-key',
  settingsLimiter,
  validateBody(SetApiKeySchema),
  importRoutes.setApiKeyEndpoint
);

// GET /api/settings/api-key/status - No validation
app.get('/api/settings/api-key/status',
  settingsLimiter,
  importRoutes.getApiKeyStatus
);
```

## Type Safety

All schemas export TypeScript types for use throughout the application:

```typescript
import {
  CreateNodeInput,
  UpdateNodeInput,
  ImportUrlInput,
  SearchQueryInput,
  MoveNodeInput,
  MergeNodesInput,
  UuidParam,
  HierarchyViewParam
} from '../validation/schemas.js';
```

These types are automatically inferred from the Zod schemas, ensuring consistency between validation and TypeScript types.

## Testing

Comprehensive test suite located in `/Users/robert.barbieri/.claude/projects-workspace/Decant/decant-standalone/src/backend/middleware/__tests__/validate.spec.ts`

### Test Coverage

The test suite covers:

1. **Body Validation**
   - Valid requests pass through
   - Missing required fields are rejected
   - Invalid formats are rejected
   - Length constraints are enforced
   - UUID validation works correctly
   - Optional fields are handled properly

2. **Query Validation**
   - Valid queries pass through
   - Missing required parameters are rejected
   - Type transformations work (string → number)
   - Range constraints are enforced

3. **Params Validation**
   - Valid UUIDs are accepted
   - Invalid UUIDs are rejected
   - Enum values are validated

4. **Combined Validation**
   - Multiple validation sources work together
   - Error aggregation works correctly
   - Field prefixing is correct

5. **Error Format**
   - Consistent error response structure
   - All errors are reported
   - Clear, actionable error messages

### Running Tests

```bash
# Run all tests
pnpm test

# Run validation tests only
pnpm test validate.spec

# Run with coverage
pnpm test:coverage
```

## Best Practices

### Adding New Schemas

1. **Define schema in schemas.ts:**
```typescript
export const NewFeatureSchema = z.object({
  name: z.string().min(1).max(100),
  value: z.number().min(0),
});

export type NewFeatureInput = z.infer<typeof NewFeatureSchema>;
```

2. **Apply to route:**
```typescript
app.post('/api/feature', validateBody(NewFeatureSchema), handler);
```

3. **Use inferred type in handler:**
```typescript
import { NewFeatureInput } from '../validation/schemas.js';

export async function handler(req: Request, res: Response) {
  const data = req.body as NewFeatureInput;
  // TypeScript knows the exact shape of data
}
```

### Schema Design Guidelines

1. **Be specific with error messages:**
```typescript
z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less')
```

2. **Use refinements for complex validation:**
```typescript
.refine(
  (data) => data.startDate < data.endDate,
  { message: 'End date must be after start date' }
)
```

3. **Transform data when needed:**
```typescript
z.string().transform((val) => parseInt(val, 10))
```

4. **Make nullable vs optional explicit:**
```typescript
.nullable()    // Can be null
.optional()    // Can be undefined
.nullable().optional()  // Can be null or undefined
```

## Performance Considerations

- Validation occurs before database operations, preventing unnecessary queries
- Schemas are compiled once at module load time
- Validation is fast (microseconds for typical requests)
- Failed validations short-circuit before expensive operations

## Security Benefits

1. **SQL Injection Prevention**: Type validation ensures parameters are correct types
2. **XSS Prevention**: Length limits prevent excessively long strings
3. **DoS Prevention**: Combined with rate limiting, prevents resource exhaustion
4. **Data Integrity**: Ensures database constraints are met before insertion
5. **Clear Error Messages**: Don't leak sensitive information, only validation errors

## Migration Notes

The validation system is fully implemented and tested. All endpoints use validation middleware. No migration work is needed.

### Integration Checklist

- [x] Zod installed (v4.3.6)
- [x] Validation middleware created
- [x] All schemas defined
- [x] All routes protected
- [x] Comprehensive tests written
- [x] Type exports available
- [x] Documentation complete

## Examples

### Valid Request Examples

```bash
# Create node
curl -X POST http://localhost:8080/api/nodes \
  -H "Content-Type: application/json" \
  -d '{
    "title": "AI Research Paper",
    "url": "https://arxiv.org/paper",
    "source_domain": "arxiv.org",
    "metadata_tags": ["ai", "research"]
  }'

# Search
curl "http://localhost:8080/api/search?q=machine+learning&limit=10"

# Update node
curl -X PUT http://localhost:8080/api/nodes/123e4567-e89b-12d3-a456-426614174000 \
  -H "Content-Type: application/json" \
  -d '{"title": "Updated Title"}'
```

### Error Response Examples

```bash
# Missing required field
curl -X POST http://localhost:8080/api/nodes \
  -H "Content-Type: application/json" \
  -d '{"title": "Missing URL"}'

# Response:
{
  "error": "Validation failed",
  "details": [
    {
      "field": "url",
      "message": "Required"
    },
    {
      "field": "source_domain",
      "message": "Required"
    }
  ]
}

# Invalid UUID
curl http://localhost:8080/api/nodes/not-a-uuid

# Response:
{
  "error": "Validation failed",
  "details": [
    {
      "field": "id",
      "message": "ID must be a valid UUID"
    }
  ]
}
```

## Related Documentation

- [Zod Documentation](https://zod.dev/)
- [Rate Limiting](./RATE_LIMITING.md) (if exists)
- [API Reference](./API.md) (if exists)

## Changelog

### v0.1.0 (Initial Implementation)
- Added Zod v4.3.6 dependency
- Created validation middleware (validateBody, validateQuery, validateParams, validate)
- Defined all validation schemas
- Applied validation to all API routes
- Created comprehensive test suite
- Documentation completed
