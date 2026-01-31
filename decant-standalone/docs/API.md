# Decant API Documentation

**Version:** 1.0.0
**Base URL:** `http://localhost:3000`
**Protocol:** HTTP/REST
**Authentication:** None (local application)

---

## Table of Contents

1. [Overview](#overview)
2. [Error Handling](#error-handling)
3. [Rate Limiting](#rate-limiting)
4. [Pagination](#pagination)
5. [Nodes API](#nodes-api)
6. [Hierarchy API](#hierarchy-api)
7. [Search API](#search-api)
8. [Import API](#import-api)
9. [Queue API](#queue-api)
10. [Backup API](#backup-api)
11. [Audit API](#audit-api)
12. [Settings API](#settings-api)
13. [Health API](#health-api)
14. [Events API (SSE)](#events-api-sse)

---

## Overview

The Decant API is a RESTful API for managing hierarchical knowledge graphs with AI-powered classification and enrichment. It supports dual-hierarchy organization (functional and organizational), content import with automatic categorization, and real-time updates via Server-Sent Events.

### Key Features

- **Dual Hierarchy**: Organize content by function (what it does) and organization (who makes it)
- **AI Classification**: Automatic categorization using GPT-4o-mini
- **Phase 2 Enrichment**: Background processing for deep content analysis
- **Full-Text Search**: Advanced search with filters and facets
- **Real-Time Updates**: SSE for live notifications
- **Backup & Restore**: Database snapshots and JSON export/import

### Base URL Configuration

The default port is `3000`, configurable via the `PORT` environment variable:

```bash
PORT=3000 npm start
```

---

## Error Handling

All API endpoints follow a consistent error response format:

### Error Response Format

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": "Additional details (development mode only)"
}
```

### Common HTTP Status Codes

| Status Code | Meaning | When Used |
|------------|---------|-----------|
| `200` | OK | Successful request |
| `201` | Created | Resource successfully created |
| `400` | Bad Request | Invalid input or validation error |
| `401` | Unauthorized | Invalid or missing API key |
| `403` | Forbidden | SSRF protection blocked request |
| `404` | Not Found | Resource not found |
| `408` | Request Timeout | Request exceeded time limit |
| `413` | Payload Too Large | Content exceeds size limit |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Unexpected server error |
| `502` | Bad Gateway | External service fetch failed |
| `503` | Service Unavailable | API key missing or service degraded |

### Error Codes

Import-specific error codes:

- `URL_REQUIRED`: URL parameter missing
- `URL_INVALID`: Malformed URL
- `URL_INVALID_PROTOCOL`: URL must use http/https
- `SSRF_BLOCKED`: Security protection blocked private IP
- `FETCH_FAILED`: Failed to fetch URL content
- `TIMEOUT`: Request timed out
- `CONTENT_TOO_LARGE`: Content exceeds size limit
- `API_KEY_MISSING`: OpenAI API key not configured
- `API_KEY_INVALID`: OpenAI API key is invalid
- `EXTRACTION_FAILED`: Failed to extract content
- `INTERNAL_ERROR`: Unexpected server error

---

## Rate Limiting

Rate limiting is enforced per-IP address with different limits for different endpoint groups.

### Rate Limit Tiers

| Endpoint Group | Window | Max Requests | Headers |
|---------------|--------|--------------|---------|
| General API | 60s | 100 requests | `X-RateLimit-Limit`, `X-RateLimit-Remaining` |
| Import API | 60s | 10 requests | `X-RateLimit-Limit`, `X-RateLimit-Remaining` |
| Settings API | 60s | 5 requests | `X-RateLimit-Limit`, `X-RateLimit-Remaining` |

### Rate Limit Headers

All responses include rate limit information:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1678901234
```

### Rate Limit Exceeded Response

```json
{
  "error": "Too many requests, please try again later"
}
```

**Status Code:** `429 Too Many Requests`

**Configuration:** Rate limits can be configured via environment variables:

```bash
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100
RATE_LIMIT_IMPORT_MAX=10
RATE_LIMIT_SETTINGS_MAX=5
```

---

## Pagination

Many list endpoints support optional pagination for better performance with large datasets.

### Pagination Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number (1-based) |
| `limit` | integer | 20 | Items per page (max: 500) |

### Paginated Response Format

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 156,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### Backward Compatibility

Endpoints that support pagination are backward compatible:

- **Without pagination params**: Returns all results as a simple array
- **With pagination params**: Returns paginated response with metadata

---

## Nodes API

Nodes represent items in the knowledge graph (segments, categories, content items, organizations).

### Get All Nodes

Retrieve all nodes with optional pagination.

**Endpoint:** `GET /api/nodes`

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 500)

**Example Request:**

```bash
# Get all nodes (no pagination)
curl http://localhost:3000/api/nodes

# Get paginated nodes
curl "http://localhost:3000/api/nodes?page=1&limit=20"
```

**Example Response (without pagination):**

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Claude Opus",
    "url": "https://anthropic.com/opus",
    "source_domain": "anthropic.com",
    "company": "Anthropic",
    "phrase_description": "Most capable Claude model for complex tasks",
    "short_description": "Claude Opus is Anthropic's most powerful AI model...",
    "logo_url": "https://anthropic.com/logo.png",
    "ai_summary": "Claude Opus is designed for...",
    "extracted_fields": {
      "segment": "A",
      "category": "LLM",
      "contentType": "T"
    },
    "metadata_tags": ["ORG.ANTH", "FNC.TEXT", "TEC.AI"],
    "key_concepts": ["large language model", "ai assistant"],
    "function_parent_id": "abc-123-def",
    "organization_parent_id": "xyz-789-ghi",
    "function_code": "A.LLM.T.1",
    "organization_code": "ANTH.AI.1",
    "phase2_completed": true,
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  }
]
```

**Example Response (with pagination):**

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 156,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

### Get Single Node

Retrieve a specific node by ID.

**Endpoint:** `GET /api/nodes/:id`

**Path Parameters:**
- `id` (required): Node UUID

**Example Request:**

```bash
curl http://localhost:3000/api/nodes/550e8400-e29b-41d4-a716-446655440000
```

**Example Response:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Claude Opus",
  "url": "https://anthropic.com/opus",
  "source_domain": "anthropic.com",
  "company": "Anthropic",
  "phrase_description": "Most capable Claude model",
  "short_description": "Claude Opus is Anthropic's most powerful AI model...",
  "logo_url": "https://anthropic.com/logo.png",
  "ai_summary": "Claude Opus is designed for complex reasoning tasks...",
  "extracted_fields": {
    "segment": "A",
    "category": "LLM",
    "contentType": "T"
  },
  "metadata_tags": ["ORG.ANTH", "FNC.TEXT", "TEC.AI"],
  "key_concepts": ["large language model", "ai assistant"],
  "function_parent_id": "abc-123-def",
  "organization_parent_id": "xyz-789-ghi",
  "function_code": "A.LLM.T.1",
  "organization_code": "ANTH.AI.1",
  "phase2_completed": true,
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T10:30:00.000Z"
}
```

**Error Responses:**

```json
// 404 Not Found
{
  "error": "Node not found"
}

// 400 Bad Request
{
  "error": "ID must be a valid UUID"
}
```

---

### Create Node

Create a new node in the knowledge graph.

**Endpoint:** `POST /api/nodes`

**Request Body:**

```json
{
  "title": "ChatGPT",
  "url": "https://chat.openai.com",
  "source_domain": "openai.com",
  "company": "OpenAI",
  "phrase_description": "Conversational AI assistant",
  "short_description": "ChatGPT is a conversational AI...",
  "logo_url": "https://openai.com/logo.png",
  "ai_summary": "ChatGPT is a large language model...",
  "extracted_fields": {
    "segment": "A",
    "category": "LLM",
    "contentType": "T"
  },
  "metadata_tags": ["ORG.OAIA", "FNC.CHAT"],
  "key_concepts": ["conversational ai", "chatbot"],
  "function_parent_id": "abc-123-def",
  "organization_parent_id": null
}
```

**Required Fields:**
- `title`: String (1-500 chars)
- `url`: Valid HTTP/HTTPS URL
- `source_domain`: String (min 1 char)

**Optional Fields:**
- `company`: String (max 200 chars)
- `phrase_description`: String (max 1000 chars)
- `short_description`: String (max 2000 chars)
- `logo_url`: Valid URL or null
- `ai_summary`: String (max 5000 chars)
- `extracted_fields`: Object
- `metadata_tags`: Array of strings
- `key_concepts`: Array of strings
- `function_parent_id`: UUID or null
- `organization_parent_id`: UUID or null

**Example Request:**

```bash
curl -X POST http://localhost:3000/api/nodes \
  -H "Content-Type: application/json" \
  -d '{
    "title": "ChatGPT",
    "url": "https://chat.openai.com",
    "source_domain": "openai.com",
    "company": "OpenAI"
  }'
```

**Example Response:**

```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "title": "ChatGPT",
  "url": "https://chat.openai.com",
  "source_domain": "openai.com",
  "company": "OpenAI",
  "created_at": "2024-01-16T14:22:00.000Z",
  "updated_at": "2024-01-16T14:22:00.000Z"
}
```

**Status Code:** `201 Created`

**Error Responses:**

```json
// 400 Bad Request - Validation Error
{
  "error": "Validation failed: Title is required"
}

// 400 Bad Request - Invalid URL
{
  "error": "Validation failed: Must be a valid URL"
}
```

---

### Update Node

Update an existing node's properties.

**Endpoint:** `PUT /api/nodes/:id`

**Path Parameters:**
- `id` (required): Node UUID

**Request Body:** (all fields optional, at least one required)

```json
{
  "title": "Updated Title",
  "company": "New Company Name",
  "phrase_description": "Updated description",
  "short_description": "Updated longer description",
  "logo_url": "https://example.com/new-logo.png",
  "ai_summary": "Updated AI summary",
  "extracted_fields": {
    "segment": "B",
    "category": "NEW"
  },
  "metadata_tags": ["TAG1", "TAG2"],
  "key_concepts": ["concept1", "concept2"],
  "function_parent_id": "new-parent-id",
  "organization_parent_id": null
}
```

**Example Request:**

```bash
curl -X PUT http://localhost:3000/api/nodes/550e8400-e29b-41d4-a716-446655440000 \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Claude Opus 4.5",
    "phrase_description": "Most capable Claude model for complex reasoning"
  }'
```

**Example Response:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Claude Opus 4.5",
  "phrase_description": "Most capable Claude model for complex reasoning",
  "updated_at": "2024-01-16T15:30:00.000Z"
}
```

**Error Responses:**

```json
// 404 Not Found
{
  "error": "Node not found"
}

// 400 Bad Request
{
  "error": "At least one field must be provided for update"
}
```

---

### Delete Node

Soft-delete a node (marks as deleted, doesn't remove from database).

**Endpoint:** `DELETE /api/nodes/:id`

**Path Parameters:**
- `id` (required): Node UUID

**Example Request:**

```bash
curl -X DELETE http://localhost:3000/api/nodes/550e8400-e29b-41d4-a716-446655440000
```

**Example Response:**

```json
{
  "success": true
}
```

**Error Responses:**

```json
// 404 Not Found
{
  "error": "Node not found"
}

// 400 Bad Request
{
  "error": "Cannot delete node with children"
}
```

---

### Merge Nodes

Merge two nodes into one, combining their metadata and relationships.

**Endpoint:** `POST /api/nodes/:id/merge`

**Path Parameters:**
- `id` (required): Primary node UUID (will be kept)

**Request Body:**

```json
{
  "secondaryId": "770e8400-e29b-41d4-a716-446655440002",
  "options": {
    "keepMetadata": true,
    "appendSummary": true
  }
}
```

**Parameters:**
- `secondaryId` (required): UUID of node to merge into primary
- `options.keepMetadata` (optional): Keep metadata from secondary node (default: true)
- `options.appendSummary` (optional): Append secondary's summary to primary (default: true)

**Example Request:**

```bash
curl -X POST http://localhost:3000/api/nodes/550e8400-e29b-41d4-a716-446655440000/merge \
  -H "Content-Type: application/json" \
  -d '{
    "secondaryId": "770e8400-e29b-41d4-a716-446655440002",
    "options": {
      "keepMetadata": true,
      "appendSummary": true
    }
  }'
```

**Example Response:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Claude Opus",
  "metadata_tags": ["ORG.ANTH", "FNC.TEXT", "TAG.MERGED"],
  "ai_summary": "Original summary... [Merged from secondary node] Secondary summary...",
  "updated_at": "2024-01-16T16:00:00.000Z"
}
```

**Error Responses:**

```json
// 400 Bad Request
{
  "error": "secondaryId is required"
}

// 404 Not Found
{
  "error": "One or both nodes not found"
}
```

---

### Move Node

Move a node to a new parent in the hierarchy.

**Endpoint:** `POST /api/nodes/:id/move`

**Path Parameters:**
- `id` (required): Node UUID to move

**Request Body:**

```json
{
  "targetParentId": "abc-123-def",
  "targetHierarchy": "function"
}
```

**Parameters:**
- `targetParentId` (optional): New parent UUID (null for root level)
- `targetHierarchy` (required): Which hierarchy to move in ("function" or "organization")

**Example Request:**

```bash
curl -X POST http://localhost:3000/api/nodes/550e8400-e29b-41d4-a716-446655440000/move \
  -H "Content-Type: application/json" \
  -d '{
    "targetParentId": "abc-123-def",
    "targetHierarchy": "function"
  }'
```

**Example Response:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "function_parent_id": "abc-123-def",
  "organization_parent_id": null,
  "function_code": "A.LLM.T.2",
  "updated_at": "2024-01-16T16:15:00.000Z"
}
```

**Error Responses:**

```json
// 404 Not Found
{
  "error": "Node not found"
}

// 400 Bad Request
{
  "error": "Target hierarchy must be either \"function\" or \"organization\""
}
```

---

### Get Related Nodes

Get nodes similar to a given node based on content and metadata.

**Endpoint:** `GET /api/nodes/:id/related`

**Path Parameters:**
- `id` (required): Node UUID

**Query Parameters:**
- `limit` (optional): Maximum number of results (default: 5, max: 20)

**Example Request:**

```bash
curl "http://localhost:3000/api/nodes/550e8400-e29b-41d4-a716-446655440000/related?limit=5"
```

**Example Response:**

```json
{
  "nodeId": "550e8400-e29b-41d4-a716-446655440000",
  "related": [
    {
      "node": {
        "id": "660e8400-e29b-41d4-a716-446655440001",
        "title": "Claude Sonnet",
        "url": "https://anthropic.com/sonnet",
        "segment": "A",
        "category": "LLM",
        "contentType": "T",
        "logo_url": "https://anthropic.com/logo.png",
        "phrase_description": "Balanced Claude model"
      },
      "similarityScore": 92,
      "sharedAttributes": ["ORG.ANTH", "FNC.TEXT", "TEC.AI"]
    },
    {
      "node": {
        "id": "770e8400-e29b-41d4-a716-446655440002",
        "title": "GPT-4",
        "url": "https://openai.com/gpt-4",
        "segment": "A",
        "category": "LLM",
        "contentType": "T",
        "logo_url": "https://openai.com/logo.png",
        "phrase_description": "Advanced language model"
      },
      "similarityScore": 85,
      "sharedAttributes": ["FNC.TEXT", "TEC.AI"]
    }
  ]
}
```

**Error Responses:**

```json
// 404 Not Found
{
  "error": "Node not found"
}
```

---

## Hierarchy API

Manage and query the dual-hierarchy organization system.

### Get Hierarchy Tree

Retrieve the complete hierarchy tree for a specific view.

**Endpoint:** `GET /api/hierarchy/tree/:view`

**Path Parameters:**
- `view` (required): "function" or "organization"

**Example Request:**

```bash
# Get functional hierarchy
curl http://localhost:3000/api/hierarchy/tree/function

# Get organizational hierarchy
curl http://localhost:3000/api/hierarchy/tree/organization
```

**Example Response:**

```json
[
  {
    "id": "segment-ai-001",
    "title": "AI",
    "type": "segment",
    "code": "A",
    "children": [
      {
        "id": "category-llm-001",
        "title": "Large Language Models",
        "type": "category",
        "code": "A.LLM",
        "children": [
          {
            "id": "content-type-tools-001",
            "title": "Tools",
            "type": "content_type",
            "code": "A.LLM.T",
            "children": [
              {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "title": "Claude Opus",
                "type": "item",
                "code": "A.LLM.T.1",
                "url": "https://anthropic.com/opus",
                "logo_url": "https://anthropic.com/logo.png",
                "children": []
              }
            ]
          }
        ]
      }
    ]
  }
]
```

**Error Responses:**

```json
// 400 Bad Request
{
  "error": "Invalid view. Must be \"function\" or \"organization\""
}
```

---

### Get Segments

List all functional segments (top-level categories).

**Endpoint:** `GET /api/hierarchy/segments`

**Example Request:**

```bash
curl http://localhost:3000/api/hierarchy/segments
```

**Example Response:**

```json
[
  {
    "code": "A",
    "name": "AI",
    "description": "Artificial Intelligence, Machine Learning, LLMs"
  },
  {
    "code": "T",
    "name": "Technology",
    "description": "Software, Hardware, Development Tools"
  },
  {
    "code": "F",
    "name": "Finance",
    "description": "Money, Investing, FP&A"
  }
]
```

---

### Get Organizations

List all organizations (top-level organizational entities).

**Endpoint:** `GET /api/hierarchy/organizations`

**Example Request:**

```bash
curl http://localhost:3000/api/hierarchy/organizations
```

**Example Response:**

```json
[
  {
    "code": "ANTH",
    "name": "Anthropic",
    "description": "AI safety and research"
  },
  {
    "code": "OAIA",
    "name": "OpenAI",
    "description": "AI research and deployment"
  }
]
```

---

### Get Node by Hierarchy Code

Retrieve a node using its hierarchy code.

**Endpoint:** `GET /api/hierarchy/code/:view/:code`

**Path Parameters:**
- `view` (required): "function" or "organization"
- `code` (required): Hierarchy code (e.g., "A.LLM.T.1")

**Example Request:**

```bash
curl http://localhost:3000/api/hierarchy/code/function/A.LLM.T.1
```

**Example Response:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Claude Opus",
  "function_code": "A.LLM.T.1",
  "url": "https://anthropic.com/opus",
  "company": "Anthropic"
}
```

**Error Responses:**

```json
// 404 Not Found
{
  "error": "Node not found with code: A.LLM.T.1"
}

// 400 Bad Request
{
  "error": "Hierarchy code is required"
}
```

---

### Get Ancestry Path

Get the full ancestry path (all ancestors) for a node.

**Endpoint:** `GET /api/hierarchy/path/:view/:nodeId`

**Path Parameters:**
- `view` (required): "function" or "organization"
- `nodeId` (required): Node UUID

**Example Request:**

```bash
curl http://localhost:3000/api/hierarchy/path/function/550e8400-e29b-41d4-a716-446655440000
```

**Example Response:**

```json
{
  "nodeId": "550e8400-e29b-41d4-a716-446655440000",
  "view": "function",
  "ancestors": [
    {
      "id": "segment-ai-001",
      "title": "AI",
      "code": "A",
      "type": "segment"
    },
    {
      "id": "category-llm-001",
      "title": "Large Language Models",
      "code": "A.LLM",
      "type": "category"
    },
    {
      "id": "content-type-tools-001",
      "title": "Tools",
      "code": "A.LLM.T",
      "type": "content_type"
    }
  ],
  "depth": 3
}
```

---

### Get Subtree

Retrieve a subtree at a specific hierarchy path.

**Endpoint:** `GET /api/hierarchy/subtree/:view/:path`

**Path Parameters:**
- `view` (required): "function" or "organization"
- `path` (required): Hierarchy path prefix (e.g., "A.LLM")

**Example Request:**

```bash
curl http://localhost:3000/api/hierarchy/subtree/function/A.LLM
```

**Example Response:**

```json
{
  "path": "A.LLM",
  "view": "function",
  "nodes": [
    {
      "id": "content-type-tools-001",
      "title": "Tools",
      "code": "A.LLM.T",
      "children": [
        {
          "id": "550e8400-e29b-41d4-a716-446655440000",
          "title": "Claude Opus",
          "code": "A.LLM.T.1",
          "children": []
        }
      ]
    }
  ],
  "count": 2
}
```

**Error Responses:**

```json
// 400 Bad Request
{
  "error": "Invalid path format. Use dot-separated alphanumeric segments (e.g., A.LLM.T)"
}
```

---

### Get Hierarchy Statistics

Get depth statistics and cache information for a hierarchy.

**Endpoint:** `GET /api/hierarchy/stats/:view`

**Path Parameters:**
- `view` (required): "function" or "organization"

**Example Request:**

```bash
curl http://localhost:3000/api/hierarchy/stats/function
```

**Example Response:**

```json
{
  "view": "function",
  "totalNodes": 245,
  "maxDepth": 4,
  "depthBreakdown": {
    "0": 10,
    "1": 45,
    "2": 89,
    "3": 78,
    "4": 23
  },
  "cache": {
    "function": 15,
    "organization": 8
  }
}
```

---

### Invalidate Hierarchy Cache

Manually invalidate hierarchy caches (useful after bulk updates).

**Endpoint:** `POST /api/hierarchy/invalidate`

**Request Body:**

```json
{
  "view": "function",
  "codes": [
    {
      "oldCode": "A.LLM.T.1",
      "newCode": "A.LLM.T.2"
    }
  ]
}
```

**Parameters:**
- `view` (optional): "function", "organization", or "all" (default: "all")
- `codes` (optional): Array of code mutations for granular invalidation

**Example Request:**

```bash
# Invalidate all caches
curl -X POST http://localhost:3000/api/hierarchy/invalidate \
  -H "Content-Type: application/json" \
  -d '{}'

# Invalidate specific view
curl -X POST http://localhost:3000/api/hierarchy/invalidate \
  -H "Content-Type: application/json" \
  -d '{"view": "function"}'

# Granular invalidation
curl -X POST http://localhost:3000/api/hierarchy/invalidate \
  -H "Content-Type: application/json" \
  -d '{
    "codes": [
      {"oldCode": "A.LLM.T.1", "newCode": "A.LLM.T.2"}
    ]
  }'
```

**Example Response:**

```json
{
  "success": true,
  "message": "Invalidated all hierarchy caches"
}
```

---

### Get Cache Statistics

Get detailed hierarchy cache statistics.

**Endpoint:** `GET /api/hierarchy/cache/stats`

**Example Request:**

```bash
curl http://localhost:3000/api/hierarchy/cache/stats
```

**Example Response:**

```json
{
  "function": {
    "size": 15,
    "keys": ["tree", "A.LLM", "A.LLM.T"]
  },
  "organization": {
    "size": 8,
    "keys": ["tree", "ANTH", "OAIA"]
  },
  "totalEntries": 23
}
```

---

## Search API

Full-text search with advanced filtering and faceting capabilities.

### Basic Search

Simple search across all nodes with optional pagination.

**Endpoint:** `GET /api/search`

**Query Parameters:**
- `q` (required): Search query string (1-500 chars)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (default: 20, max: 100)

**Example Request:**

```bash
# Simple search (no pagination)
curl "http://localhost:3000/api/search?q=machine+learning"

# Paginated search
curl "http://localhost:3000/api/search?q=machine+learning&page=1&limit=20"
```

**Example Response (without pagination):**

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Claude Opus",
    "url": "https://anthropic.com/opus",
    "company": "Anthropic",
    "phrase_description": "Most capable Claude model",
    "extracted_fields": {
      "segment": "A",
      "category": "LLM",
      "contentType": "T"
    },
    "matchScore": 0.95
  }
]
```

**Example Response (with pagination):**

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  }
}
```

**Error Responses:**

```json
// 400 Bad Request
{
  "error": "Query parameter \"q\" is required"
}
```

---

### Advanced Search

Advanced search with filters and faceted results.

**Endpoint:** `GET /api/search/advanced`

**Query Parameters:**
- `q` (required): Search query string
- `segment` (optional): Filter by segment code (A, T, F, etc.)
- `category` (optional): Filter by category code (LLM, AGT, etc.)
- `contentType` (optional): Filter by content type (T, A, V, etc.)
- `organization` (optional): Filter by organization (partial match)
- `dateStart` (optional): Filter by start date (ISO date string)
- `dateEnd` (optional): Filter by end date (ISO date string)
- `hasMetadata` (optional): Only show enriched nodes (true/false)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (default: 20, max: 100)

**Example Request:**

```bash
curl "http://localhost:3000/api/search/advanced?q=ai&segment=A&contentType=T&hasMetadata=true&page=1&limit=20"
```

**Example Response:**

```json
{
  "results": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Claude Opus",
      "url": "https://anthropic.com/opus",
      "company": "Anthropic",
      "phrase_description": "Most capable Claude model",
      "extracted_fields": {
        "segment": "A",
        "category": "LLM",
        "contentType": "T"
      },
      "metadata_tags": ["ORG.ANTH", "FNC.TEXT"],
      "matchScore": 0.95
    }
  ],
  "facets": {
    "segments": {
      "A": 42,
      "T": 15,
      "F": 8
    },
    "categories": {
      "LLM": 28,
      "AGT": 14,
      "FND": 5
    },
    "contentTypes": {
      "T": 35,
      "A": 18,
      "V": 9
    },
    "organizations": [
      {
        "name": "Anthropic",
        "count": 12
      },
      {
        "name": "OpenAI",
        "count": 10
      }
    ]
  },
  "total": 42,
  "page": 1,
  "pageSize": 20
}
```

**Filter Examples:**

```bash
# Filter by segment
curl "http://localhost:3000/api/search/advanced?q=tools&segment=A"

# Filter by content type and date range
curl "http://localhost:3000/api/search/advanced?q=tutorial&contentType=A&dateStart=2024-01-01&dateEnd=2024-12-31"

# Only enriched nodes
curl "http://localhost:3000/api/search/advanced?q=ai&hasMetadata=true"

# Multiple filters
curl "http://localhost:3000/api/search/advanced?q=language+model&segment=A&category=LLM&organization=Anthropic"
```

---

## Import API

Import and automatically classify content from URLs using AI.

### Import URL

Import a URL with automatic AI classification and enrichment.

**Endpoint:** `POST /api/import`

**Rate Limit:** 10 requests per 60 seconds

**Request Body:**

```json
{
  "url": "https://anthropic.com/opus",
  "forceRefresh": false,
  "priority": 1
}
```

**Parameters:**
- `url` (required): Valid HTTP/HTTPS URL
- `forceRefresh` (optional): Bypass cache and re-import (default: false)
- `priority` (optional): Queue priority 1-10 (default: 5, higher = more urgent)

**Example Request:**

```bash
curl -X POST http://localhost:3000/api/import \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://anthropic.com/opus",
    "forceRefresh": false,
    "priority": 5
  }'
```

**Example Response:**

```json
{
  "success": true,
  "nodeId": "550e8400-e29b-41d4-a716-446655440000",
  "cached": false,
  "node": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Claude Opus",
    "url": "https://anthropic.com/opus",
    "source_domain": "anthropic.com",
    "created_at": "2024-01-16T10:00:00.000Z"
  },
  "classification": {
    "segment": "A",
    "category": "LLM",
    "contentType": "T",
    "organization": "ANTH",
    "confidence": 0.95
  },
  "hierarchyCodes": {
    "function": "A.LLM.T.1",
    "organization": "ANTH.AI.1"
  },
  "metadata": {
    "extractedFields": {
      "segment": "A",
      "category": "LLM",
      "contentType": "T"
    },
    "metadataTags": ["ORG.ANTH", "FNC.TEXT", "TEC.AI"]
  },
  "phase2": {
    "queued": true,
    "jobId": "job-123-abc"
  }
}
```

**Cached Response:**

If URL was previously imported and `forceRefresh` is false:

```json
{
  "success": true,
  "nodeId": "550e8400-e29b-41d4-a716-446655440000",
  "cached": true,
  "node": {...},
  "classification": {...}
}
```

**Error Responses:**

```json
// 400 Bad Request - Missing URL
{
  "success": false,
  "error": "URL is required",
  "code": "URL_REQUIRED"
}

// 400 Bad Request - Invalid URL
{
  "success": false,
  "error": "Invalid URL format",
  "code": "URL_INVALID"
}

// 403 Forbidden - SSRF Protection
{
  "success": false,
  "error": "Access to private IP addresses is not allowed",
  "code": "SSRF_BLOCKED"
}

// 408 Request Timeout
{
  "success": false,
  "error": "Request timed out after 30 seconds",
  "code": "TIMEOUT"
}

// 413 Payload Too Large
{
  "success": false,
  "error": "Content exceeds maximum size of 5MB",
  "code": "CONTENT_TOO_LARGE"
}

// 503 Service Unavailable - No API Key
{
  "success": false,
  "error": "OpenAI API key not configured",
  "code": "API_KEY_MISSING"
}

// 401 Unauthorized - Invalid API Key
{
  "success": false,
  "error": "Invalid OpenAI API key",
  "code": "API_KEY_INVALID"
}

// 502 Bad Gateway - Fetch Failed
{
  "success": false,
  "error": "Failed to fetch URL content",
  "code": "FETCH_FAILED"
}
```

---

### Check Import Status

Check if a URL has already been imported.

**Endpoint:** `GET /api/import/check`

**Query Parameters:**
- `url` (required): URL to check

**Example Request:**

```bash
curl "http://localhost:3000/api/import/check?url=https://anthropic.com/opus"
```

**Example Response (exists):**

```json
{
  "exists": true,
  "cached": true,
  "nodeId": "550e8400-e29b-41d4-a716-446655440000",
  "classification": {
    "segment": "A",
    "category": "LLM",
    "contentType": "T",
    "organization": "ANTH",
    "confidence": 0.95
  },
  "cachedAt": "2024-01-16T10:00:00.000Z"
}
```

**Example Response (not exists):**

```json
{
  "exists": false,
  "cached": false
}
```

---

### Invalidate Import Cache

Remove a URL from the import cache.

**Endpoint:** `DELETE /api/import/cache`

**Query Parameters:**
- `url` (required): URL to invalidate

**Example Request:**

```bash
curl -X DELETE "http://localhost:3000/api/import/cache?url=https://anthropic.com/opus"
```

**Example Response:**

```json
{
  "success": true,
  "invalidated": true
}
```

---

### Get Import Cache Statistics

Get cache hit rate and statistics.

**Endpoint:** `GET /api/import/cache/stats`

**Example Request:**

```bash
curl http://localhost:3000/api/import/cache/stats
```

**Example Response:**

```json
{
  "success": true,
  "stats": {
    "size": 156,
    "hits": 423,
    "misses": 189,
    "hitRate": 0.69,
    "maxSize": 1000,
    "oldestEntry": "2024-01-10T08:30:00.000Z"
  }
}
```

---

## Queue API

Manage background processing jobs (Phase 2 enrichment).

### Get Queue Status

Get current queue statistics.

**Endpoint:** `GET /api/queue/status`

**Example Request:**

```bash
curl http://localhost:3000/api/queue/status
```

**Example Response:**

```json
{
  "pending": 12,
  "processing": 2,
  "complete": 245,
  "failed": 3,
  "isRunning": true
}
```

---

### List Jobs

List all jobs with optional filtering and pagination.

**Endpoint:** `GET /api/queue/jobs`

**Query Parameters:**
- `status` (optional): Filter by status (pending, processing, complete, failed)
- `limit` (optional): Results per page (default: 50, max: 500)
- `offset` (optional): Skip first N results (default: 0)

**Example Request:**

```bash
# Get all pending jobs
curl "http://localhost:3000/api/queue/jobs?status=pending"

# Get failed jobs with pagination
curl "http://localhost:3000/api/queue/jobs?status=failed&limit=20&offset=0"
```

**Example Response:**

```json
{
  "jobs": [
    {
      "id": "job-123-abc",
      "nodeId": "550e8400-e29b-41d4-a716-446655440000",
      "phase": "phase2",
      "status": "pending",
      "attempts": 0,
      "errorMessage": null,
      "createdAt": "2024-01-16T10:05:00.000Z",
      "processedAt": null
    },
    {
      "id": "job-456-def",
      "nodeId": "660e8400-e29b-41d4-a716-446655440001",
      "phase": "phase2",
      "status": "failed",
      "attempts": 3,
      "errorMessage": "API rate limit exceeded",
      "createdAt": "2024-01-16T09:30:00.000Z",
      "processedAt": "2024-01-16T09:35:00.000Z"
    }
  ],
  "total": 15,
  "page": 1,
  "limit": 50
}
```

**Error Responses:**

```json
// 400 Bad Request
{
  "error": "Limit must be a number"
}
```

---

### Get Job for Node

Get the most recent job for a specific node.

**Endpoint:** `GET /api/queue/jobs/:nodeId`

**Path Parameters:**
- `nodeId` (required): Node UUID

**Example Request:**

```bash
curl http://localhost:3000/api/queue/jobs/550e8400-e29b-41d4-a716-446655440000
```

**Example Response:**

```json
{
  "job": {
    "id": "job-123-abc",
    "nodeId": "550e8400-e29b-41d4-a716-446655440000",
    "phase": "phase2",
    "status": "complete",
    "attempts": 1,
    "errorMessage": null,
    "createdAt": "2024-01-16T10:05:00.000Z",
    "processedAt": "2024-01-16T10:07:00.000Z"
  }
}
```

**No Job Response:**

```json
{
  "job": null
}
```

---

### Retry Job

Retry a failed job.

**Endpoint:** `POST /api/queue/retry/:jobId`

**Path Parameters:**
- `jobId` (required): Job UUID

**Example Request:**

```bash
curl -X POST http://localhost:3000/api/queue/retry/job-456-def
```

**Example Response:**

```json
{
  "success": true,
  "message": "Job queued for retry"
}
```

**Error Responses:**

```json
// 404 Not Found
{
  "success": false,
  "message": "Job not found"
}

// 400 Bad Request - Not Failed
{
  "success": false,
  "message": "Cannot retry job with status 'complete'. Only failed jobs can be retried."
}
```

---

### Cancel Job

Cancel or remove a job from the queue.

**Endpoint:** `DELETE /api/queue/jobs/:jobId`

**Path Parameters:**
- `jobId` (required): Job UUID

**Example Request:**

```bash
curl -X DELETE http://localhost:3000/api/queue/jobs/job-123-abc
```

**Example Response:**

```json
{
  "success": true
}
```

**Error Responses:**

```json
// 404 Not Found
{
  "success": false,
  "message": "Job not found"
}

// 400 Bad Request - Currently Processing
{
  "success": false,
  "message": "Cannot cancel a job that is currently processing"
}
```

---

### Clear Completed Jobs

Remove completed jobs from the queue (cleanup).

**Endpoint:** `POST /api/queue/clear`

**Request Body:**

```json
{
  "olderThan": "2024-01-01T00:00:00.000Z"
}
```

**Parameters:**
- `olderThan` (optional): ISO date string - only clear jobs older than this date

**Example Request:**

```bash
# Clear all completed jobs
curl -X POST http://localhost:3000/api/queue/clear \
  -H "Content-Type: application/json" \
  -d '{}'

# Clear jobs older than a specific date
curl -X POST http://localhost:3000/api/queue/clear \
  -H "Content-Type: application/json" \
  -d '{"olderThan": "2024-01-01T00:00:00.000Z"}'
```

**Example Response:**

```json
{
  "cleared": 156
}
```

---

## Backup API

Database backup, restore, and data export/import.

### Create Backup

Create a snapshot backup of the database.

**Endpoint:** `POST /api/backup`

**Example Request:**

```bash
curl -X POST http://localhost:3000/api/backup
```

**Example Response:**

```json
{
  "success": true,
  "filename": "decant-backup-2024-01-16T15-30-00.db",
  "size": 1048576,
  "createdAt": "2024-01-16T15:30:00.000Z"
}
```

**Error Responses:**

```json
// 500 Internal Server Error
{
  "success": false,
  "error": "Failed to create backup: disk full"
}
```

---

### List Backups

List all available backup files.

**Endpoint:** `GET /api/backups`

**Example Request:**

```bash
curl http://localhost:3000/api/backups
```

**Example Response:**

```json
[
  {
    "filename": "decant-backup-2024-01-16T15-30-00.db",
    "size": 1048576,
    "createdAt": "2024-01-16T15:30:00.000Z"
  },
  {
    "filename": "decant-backup-2024-01-15T10-00-00.db",
    "size": 987654,
    "createdAt": "2024-01-15T10:00:00.000Z"
  }
]
```

---

### Restore Backup

Restore the database from a backup file.

**Endpoint:** `POST /api/restore`

**Request Body:**

```json
{
  "filename": "decant-backup-2024-01-16T15-30-00.db"
}
```

**Example Request:**

```bash
curl -X POST http://localhost:3000/api/restore \
  -H "Content-Type: application/json" \
  -d '{"filename": "decant-backup-2024-01-16T15-30-00.db"}'
```

**Example Response:**

```json
{
  "success": true,
  "message": "Database restored successfully",
  "filename": "decant-backup-2024-01-16T15-30-00.db"
}
```

**Error Responses:**

```json
// 400 Bad Request
{
  "success": false,
  "error": "filename is required in request body"
}

// 404 Not Found
{
  "success": false,
  "error": "Backup file not found"
}
```

---

### Delete Backup

Delete a backup file.

**Endpoint:** `DELETE /api/backups/:filename`

**Path Parameters:**
- `filename` (required): Backup filename

**Example Request:**

```bash
curl -X DELETE http://localhost:3000/api/backups/decant-backup-2024-01-15T10-00-00.db
```

**Example Response:**

```json
{
  "success": true
}
```

---

### Export Data as JSON

Export all data as JSON for migration or external processing.

**Endpoint:** `GET /api/export`

**Example Request:**

```bash
curl http://localhost:3000/api/export -o decant-export.json
```

**Example Response:**

The response is a downloadable JSON file:

```json
{
  "exportedAt": "2024-01-16T16:00:00.000Z",
  "version": "1.0.0",
  "data": {
    "nodes": [...],
    "metadata_tags": [...],
    "extracted_fields": [...],
    "segments": [...],
    "organizations": [...]
  }
}
```

**Response Headers:**

```http
Content-Type: application/json
Content-Disposition: attachment; filename="decant-export-2024-01-16.json"
```

---

### Import Data from JSON

Import data from a JSON export file.

**Endpoint:** `POST /api/import/json`

**Request Body:**

```json
{
  "data": {
    "exportedAt": "2024-01-16T16:00:00.000Z",
    "version": "1.0.0",
    "data": {
      "nodes": [...],
      "metadata_tags": [...]
    }
  },
  "mode": "merge"
}
```

**Parameters:**
- `data` (required): Exported JSON data object
- `mode` (required): Import mode - "merge" or "replace"
  - `merge`: Add new items, update existing (by ID)
  - `replace`: Clear database and import (destructive)

**Example Request:**

```bash
curl -X POST http://localhost:3000/api/import/json \
  -H "Content-Type: application/json" \
  -d @decant-export.json
```

**Example Response:**

```json
{
  "success": true,
  "nodesImported": 245,
  "metadataTagsImported": 678,
  "mode": "merge"
}
```

**Error Responses:**

```json
// 400 Bad Request
{
  "success": false,
  "error": "Invalid import data structure. Expected { exportedAt, version, data }"
}

// 400 Bad Request
{
  "success": false,
  "error": "mode must be either \"merge\" or \"replace\""
}
```

---

## Audit API

Track and query hierarchy code changes and node modifications.

### Get Node History

Get the code change history for a specific node.

**Endpoint:** `GET /api/nodes/:id/history`

**Path Parameters:**
- `id` (required): Node UUID

**Query Parameters:**
- `hierarchyType` (optional): Filter by hierarchy ("function" or "organization")
- `limit` (optional): Maximum results (default: 50)
- `offset` (optional): Skip first N results (default: 0)

**Example Request:**

```bash
# Get all history for a node
curl http://localhost:3000/api/nodes/550e8400-e29b-41d4-a716-446655440000/history

# Get function hierarchy changes only
curl "http://localhost:3000/api/nodes/550e8400-e29b-41d4-a716-446655440000/history?hierarchyType=function"

# Paginated history
curl "http://localhost:3000/api/nodes/550e8400-e29b-41d4-a716-446655440000/history?limit=20&offset=0"
```

**Example Response:**

```json
{
  "nodeId": "550e8400-e29b-41d4-a716-446655440000",
  "changes": [
    {
      "id": "audit-123-abc",
      "hierarchyType": "function",
      "oldCode": "A.LLM.T.1",
      "newCode": "A.LLM.T.2",
      "changeType": "code_reassignment",
      "reason": "Sibling node deleted",
      "triggeredBy": "delete_cascade",
      "changedAt": "2024-01-16T14:30:00.000Z",
      "relatedNodes": [
        {
          "id": "660e8400-e29b-41d4-a716-446655440001",
          "title": "Claude Sonnet"
        }
      ],
      "metadata": {
        "previousPosition": 2,
        "newPosition": 1
      }
    },
    {
      "id": "audit-456-def",
      "hierarchyType": "function",
      "oldCode": null,
      "newCode": "A.LLM.T.1",
      "changeType": "initial_assignment",
      "reason": "Node created",
      "triggeredBy": "create",
      "changedAt": "2024-01-15T10:00:00.000Z",
      "relatedNodes": null,
      "metadata": null
    }
  ]
}
```

**Change Types:**
- `initial_assignment`: First code assigned
- `parent_change`: Node moved to new parent
- `code_reassignment`: Code changed due to sibling changes
- `position_swap`: Position changed within siblings
- `restructure`: Major hierarchy restructure

**Triggered By:**
- `create`: Node creation
- `update`: Manual update
- `delete_cascade`: Cascade from deleted sibling
- `move`: Node moved
- `merge`: Nodes merged
- `restructure`: Bulk restructure operation

---

### Get Recent Changes

Get recent audit changes across all nodes.

**Endpoint:** `GET /api/audit/recent`

**Query Parameters:**
- `limit` (optional): Maximum results (default: 50, max: 500)

**Example Request:**

```bash
curl "http://localhost:3000/api/audit/recent?limit=20"
```

**Example Response:**

```json
{
  "changes": [
    {
      "id": "audit-789-ghi",
      "nodeId": "770e8400-e29b-41d4-a716-446655440002",
      "nodeTitle": "GPT-4",
      "hierarchyType": "organization",
      "oldCode": "OAIA.AI.1",
      "newCode": "OAIA.AI.2",
      "changeType": "code_reassignment",
      "reason": "Sibling deleted",
      "triggeredBy": "delete_cascade",
      "changedAt": "2024-01-16T16:00:00.000Z",
      "relatedNodes": [
        {
          "id": "880e8400-e29b-41d4-a716-446655440003",
          "title": "GPT-3.5"
        }
      ]
    }
  ],
  "total": 20
}
```

---

### Get Audit Statistics

Get aggregate statistics about code changes.

**Endpoint:** `GET /api/audit/stats`

**Example Request:**

```bash
curl http://localhost:3000/api/audit/stats
```

**Example Response:**

```json
{
  "totalChanges": 1245,
  "byHierarchyType": {
    "function": 678,
    "organization": 567
  },
  "byChangeType": {
    "initial_assignment": 456,
    "parent_change": 234,
    "code_reassignment": 345,
    "position_swap": 123,
    "restructure": 87
  },
  "byTriggeredBy": {
    "create": 456,
    "update": 234,
    "delete_cascade": 345,
    "move": 123,
    "merge": 45,
    "restructure": 42
  },
  "recentChanges": 23,
  "oldestChange": "2024-01-01T00:00:00.000Z",
  "newestChange": "2024-01-16T16:15:00.000Z"
}
```

---

## Settings API

Manage API keys and application settings.

### Set API Key

Configure the OpenAI API key for AI classification.

**Endpoint:** `POST /api/settings/api-key`

**Rate Limit:** 5 requests per 60 seconds

**Request Body:**

```json
{
  "apiKey": "sk-proj-abc123..."
}
```

**Example Request:**

```bash
curl -X POST http://localhost:3000/api/settings/api-key \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "sk-proj-abc123..."}'
```

**Example Response:**

```json
{
  "success": true
}
```

**Error Responses:**

```json
// 400 Bad Request
{
  "error": "API key is required"
}

// 400 Bad Request
{
  "error": "Invalid API key format"
}
```

**Security Note:** API keys are encrypted at rest using the `DECANT_MASTER_KEY`.

---

### Get API Key Status

Check if an OpenAI API key is configured.

**Endpoint:** `GET /api/settings/api-key/status`

**Rate Limit:** 5 requests per 60 seconds

**Example Request:**

```bash
curl http://localhost:3000/api/settings/api-key/status
```

**Example Response:**

```json
{
  "configured": true
}
```

---

### Delete API Key

Remove the stored OpenAI API key.

**Endpoint:** `DELETE /api/settings/api-key`

**Rate Limit:** 5 requests per 60 seconds

**Example Request:**

```bash
curl -X DELETE http://localhost:3000/api/settings/api-key
```

**Example Response:**

```json
{
  "success": true
}
```

---

## Health API

System health checks and metrics for monitoring and orchestration.

### Quick Health Check

Fast health check for basic monitoring.

**Endpoint:** `GET /health`

**Example Request:**

```bash
curl http://localhost:3000/health
```

**Example Response:**

```json
{
  "status": "healthy",
  "timestamp": "2024-01-16T16:30:00.000Z",
  "latencyMs": 2
}
```

**Status Values:**
- `healthy`: All systems operational
- `degraded`: Some non-critical issues
- `unhealthy`: Critical systems down

---

### Liveness Probe

Kubernetes-style liveness probe (always returns 200 if process is running).

**Endpoint:** `GET /health/live`

**Example Request:**

```bash
curl http://localhost:3000/health/live
```

**Example Response:**

```json
{
  "status": "alive",
  "timestamp": "2024-01-16T16:30:00.000Z"
}
```

**Status Code:** Always `200 OK` if the process is running

---

### Readiness Probe

Kubernetes-style readiness probe with comprehensive checks.

**Endpoint:** `GET /health/ready`

**Example Request:**

```bash
curl http://localhost:3000/health/ready
```

**Example Response (ready):**

```json
{
  "status": "ready",
  "timestamp": "2024-01-16T16:30:00.000Z",
  "overallStatus": "healthy",
  "checks": {
    "database": {
      "status": "healthy",
      "latencyMs": 1
    },
    "llm": {
      "status": "healthy",
      "configured": true
    },
    "queue": {
      "status": "healthy",
      "isRunning": true
    }
  }
}
```

**Status Code:** `200 OK` if ready, `503 Service Unavailable` if not ready

**Example Response (not ready):**

```json
{
  "status": "not_ready",
  "timestamp": "2024-01-16T16:30:00.000Z",
  "checks": {
    "database": {
      "status": "unhealthy",
      "error": "Database connection failed"
    }
  }
}
```

---

### Full Health Check

Detailed health information for all system components.

**Endpoint:** `GET /health/full`

**Example Request:**

```bash
curl http://localhost:3000/health/full
```

**Example Response:**

```json
{
  "status": "healthy",
  "timestamp": "2024-01-16T16:30:00.000Z",
  "checks": {
    "database": {
      "status": "healthy",
      "latencyMs": 1,
      "nodeCount": 245,
      "sizeBytes": 1048576
    },
    "llm": {
      "status": "healthy",
      "configured": true,
      "provider": "openai",
      "model": "gpt-4o-mini"
    },
    "queue": {
      "status": "healthy",
      "isRunning": true,
      "pending": 12,
      "processing": 2,
      "failed": 1
    },
    "cache": {
      "status": "healthy",
      "hierarchyCache": {
        "function": 15,
        "organization": 8
      },
      "importCache": {
        "size": 156,
        "hitRate": 0.69
      }
    },
    "filesystem": {
      "status": "healthy",
      "backupDir": true,
      "dataDir": true
    }
  }
}
```

**Status Codes:**
- `200 OK`: Healthy or degraded (still operational)
- `503 Service Unavailable`: Unhealthy (critical systems down)

---

### Component Health Check

Check health of a specific component.

**Endpoint:** `GET /health/component/:name`

**Path Parameters:**
- `name` (required): Component name (database, llm, queue, cache, filesystem)

**Example Request:**

```bash
curl http://localhost:3000/health/component/database
```

**Example Response:**

```json
{
  "component": "database",
  "status": "healthy",
  "latencyMs": 1,
  "nodeCount": 245,
  "sizeBytes": 1048576,
  "timestamp": "2024-01-16T16:30:00.000Z"
}
```

**Error Responses:**

```json
// 400 Bad Request
{
  "error": "Invalid component name",
  "validComponents": ["database", "llm", "queue", "cache", "filesystem"]
}

// 503 Service Unavailable
{
  "component": "database",
  "status": "unhealthy",
  "error": "Database connection failed",
  "timestamp": "2024-01-16T16:30:00.000Z"
}
```

---

### Metrics

Prometheus-style application metrics.

**Endpoint:** `GET /metrics`

**Example Request:**

```bash
curl http://localhost:3000/metrics
```

**Example Response:**

```json
{
  "uptime": 86400,
  "uptimeHuman": "24h 0m 0s",
  "database": {
    "nodeCount": 245,
    "deletedNodeCount": 12,
    "totalTags": 678,
    "tableSizes": {
      "nodes": 204800,
      "metadata_tags": 102400,
      "extracted_fields": 51200
    },
    "databaseSizeBytes": 1048576
  },
  "queue": {
    "pending": 12,
    "processing": 2,
    "complete": 245,
    "failed": 3,
    "isRunning": true
  },
  "circuitBreakers": {
    "openai": {
      "state": "closed",
      "failures": 0,
      "successRate": 1.0
    }
  },
  "memoryUsage": {
    "heapUsed": 52428800,
    "heapTotal": 104857600,
    "rss": 157286400,
    "external": 1048576
  },
  "process": {
    "pid": 12345,
    "nodeVersion": "v20.10.0",
    "platform": "darwin",
    "arch": "arm64"
  },
  "timestamp": "2024-01-16T16:30:00.000Z"
}
```

---

## Events API (SSE)

Server-Sent Events for real-time updates and notifications.

### Subscribe to Events

Establish a Server-Sent Events connection for real-time updates.

**Endpoint:** `GET /api/events`

**Example Request:**

```bash
curl -N http://localhost:3000/api/events
```

**Example with JavaScript:**

```javascript
const eventSource = new EventSource('http://localhost:3000/api/events');

// Connection established
eventSource.addEventListener('connected', (event) => {
  console.log('Connected:', JSON.parse(event.data));
});

// Node created
eventSource.addEventListener('node:created', (event) => {
  const data = JSON.parse(event.data);
  console.log('Node created:', data.nodeId, data.title);
});

// Node updated
eventSource.addEventListener('node:updated', (event) => {
  const data = JSON.parse(event.data);
  console.log('Node updated:', data.nodeId, data.changes);
});

// Node deleted
eventSource.addEventListener('node:deleted', (event) => {
  const data = JSON.parse(event.data);
  console.log('Node deleted:', data.nodeId);
});

// Import completed
eventSource.addEventListener('import:complete', (event) => {
  const data = JSON.parse(event.data);
  console.log('Import complete:', data.url, data.nodeId);
});

// Phase 2 enrichment completed
eventSource.addEventListener('phase2:complete', (event) => {
  const data = JSON.parse(event.data);
  console.log('Phase 2 complete:', data.nodeId);
});

// Queue status changed
eventSource.addEventListener('queue:status', (event) => {
  const data = JSON.parse(event.data);
  console.log('Queue status:', data.pending, data.processing);
});

// Keep-alive ping (every 30 seconds)
eventSource.addEventListener('ping', (event) => {
  console.log('Ping:', JSON.parse(event.data).timestamp);
});

// Handle errors
eventSource.onerror = (error) => {
  console.error('SSE error:', error);
  eventSource.close();
};
```

### Event Types

| Event Type | Description | Data |
|-----------|-------------|------|
| `connected` | Initial connection | `{ timestamp }` |
| `node:created` | Node created | `{ nodeId, title, url }` |
| `node:updated` | Node updated | `{ nodeId, changes }` |
| `node:deleted` | Node deleted | `{ nodeId }` |
| `import:started` | Import started | `{ url }` |
| `import:complete` | Import completed | `{ url, nodeId, cached }` |
| `import:failed` | Import failed | `{ url, error }` |
| `phase2:started` | Phase 2 enrichment started | `{ nodeId, jobId }` |
| `phase2:complete` | Phase 2 enrichment completed | `{ nodeId, metadata }` |
| `phase2:failed` | Phase 2 enrichment failed | `{ nodeId, error }` |
| `queue:status` | Queue status changed | `{ pending, processing, complete, failed }` |
| `hierarchy:updated` | Hierarchy changed | `{ view, nodeId }` |
| `ping` | Keep-alive ping | `{ timestamp }` |

### SSE Response Format

```http
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no

event: connected
data: {"timestamp":"2024-01-16T16:30:00.000Z"}

event: node:created
data: {"type":"node:created","nodeId":"550e8400-e29b-41d4-a716-446655440000","title":"Claude Opus","url":"https://anthropic.com/opus","timestamp":"2024-01-16T16:30:15.000Z"}

event: ping
data: {"timestamp":"2024-01-16T16:30:30.000Z"}
```

### Connection Lifecycle

1. **Connect**: Client opens SSE connection
2. **Handshake**: Server sends `connected` event
3. **Stream**: Server sends events as they occur
4. **Ping**: Server sends keep-alive pings every 30 seconds
5. **Disconnect**: Client closes connection or network fails
6. **Cleanup**: Server releases resources

### Reconnection

Browsers automatically reconnect SSE connections after network failures. The reconnection delay defaults to 3 seconds.

---

## Environment Configuration

Configure the API behavior using environment variables.

### Available Variables

```bash
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration
DATABASE_PATH=./data/decant.db

# Rate Limiting Configuration
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100
RATE_LIMIT_IMPORT_MAX=10
RATE_LIMIT_SETTINGS_MAX=5

# CORS Configuration
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# Security Configuration
DECANT_MASTER_KEY=<32+ character encryption key>

# OpenAI Configuration
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o-mini

# Logging Configuration
LOG_LEVEL=info
LOG_PRETTY=true
LOG_FORMAT=pretty

# Scraper Configuration
SCRAPER_TIMEOUT_MS=30000
SCRAPER_MAX_SIZE_BYTES=5242880
```

### Example .env File

```bash
# .env
PORT=3000
NODE_ENV=development
DATABASE_PATH=./data/decant.db
DECANT_MASTER_KEY=your-32-character-encryption-key-here
OPENAI_API_KEY=sk-proj-your-openai-api-key
OPENAI_MODEL=gpt-4o-mini
LOG_LEVEL=info
RATE_LIMIT_MAX=100
RATE_LIMIT_IMPORT_MAX=10
SCRAPER_TIMEOUT_MS=30000
```

---

## Code Examples

### Node.js Client Example

```javascript
const axios = require('axios');

const API_BASE = 'http://localhost:3000';

// Import a URL
async function importUrl(url) {
  try {
    const response = await axios.post(`${API_BASE}/api/import`, {
      url,
      forceRefresh: false,
      priority: 5
    });

    console.log('Import successful:', response.data);
    return response.data;
  } catch (error) {
    console.error('Import failed:', error.response?.data || error.message);
    throw error;
  }
}

// Get all nodes with pagination
async function getAllNodes(page = 1, limit = 20) {
  try {
    const response = await axios.get(`${API_BASE}/api/nodes`, {
      params: { page, limit }
    });

    return response.data;
  } catch (error) {
    console.error('Failed to get nodes:', error.message);
    throw error;
  }
}

// Search with filters
async function searchNodes(query, filters = {}) {
  try {
    const response = await axios.get(`${API_BASE}/api/search/advanced`, {
      params: {
        q: query,
        ...filters,
        page: 1,
        limit: 20
      }
    });

    return response.data;
  } catch (error) {
    console.error('Search failed:', error.message);
    throw error;
  }
}

// Usage
(async () => {
  // Import a URL
  const importResult = await importUrl('https://anthropic.com/opus');
  console.log('Node ID:', importResult.nodeId);

  // Get paginated nodes
  const nodes = await getAllNodes(1, 20);
  console.log('Total nodes:', nodes.pagination.total);

  // Search with filters
  const results = await searchNodes('AI', {
    segment: 'A',
    contentType: 'T',
    hasMetadata: true
  });
  console.log('Search results:', results.total);
})();
```

### Python Client Example

```python
import requests
from typing import Optional, Dict, List

API_BASE = "http://localhost:3000"

class DecantClient:
    def __init__(self, base_url: str = API_BASE):
        self.base_url = base_url
        self.session = requests.Session()

    def import_url(self, url: str, force_refresh: bool = False, priority: int = 5) -> Dict:
        """Import a URL with AI classification"""
        response = self.session.post(
            f"{self.base_url}/api/import",
            json={
                "url": url,
                "forceRefresh": force_refresh,
                "priority": priority
            }
        )
        response.raise_for_status()
        return response.json()

    def get_nodes(self, page: int = 1, limit: int = 20) -> Dict:
        """Get all nodes with pagination"""
        response = self.session.get(
            f"{self.base_url}/api/nodes",
            params={"page": page, "limit": limit}
        )
        response.raise_for_status()
        return response.json()

    def search_advanced(self, query: str, **filters) -> Dict:
        """Advanced search with filters"""
        params = {"q": query, **filters}
        response = self.session.get(
            f"{self.base_url}/api/search/advanced",
            params=params
        )
        response.raise_for_status()
        return response.json()

    def get_hierarchy_tree(self, view: str = "function") -> List[Dict]:
        """Get hierarchy tree"""
        response = self.session.get(
            f"{self.base_url}/api/hierarchy/tree/{view}"
        )
        response.raise_for_status()
        return response.json()

# Usage
client = DecantClient()

# Import URL
result = client.import_url("https://anthropic.com/opus")
print(f"Node ID: {result['nodeId']}")

# Get nodes
nodes = client.get_nodes(page=1, limit=20)
print(f"Total nodes: {nodes['pagination']['total']}")

# Search
results = client.search_advanced(
    "machine learning",
    segment="A",
    contentType="T",
    hasMetadata=True
)
print(f"Search results: {results['total']}")
```

---

## Best Practices

### 1. Use Pagination for Large Datasets

Always use pagination when retrieving large result sets to reduce memory usage and improve performance:

```bash
curl "http://localhost:3000/api/nodes?page=1&limit=50"
```

### 2. Cache Import Results

Check if a URL is already imported before re-importing:

```bash
curl "http://localhost:3000/api/import/check?url=https://example.com"
```

### 3. Handle Rate Limits

Implement exponential backoff for rate limit errors:

```javascript
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.response?.status === 429 && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}
```

### 4. Use SSE for Real-Time Updates

Subscribe to Server-Sent Events instead of polling for updates:

```javascript
const eventSource = new EventSource('http://localhost:3000/api/events');
eventSource.addEventListener('node:created', handleNodeCreated);
```

### 5. Monitor Health Endpoints

Use health endpoints for application monitoring:

```bash
# Liveness probe (is the app running?)
curl http://localhost:3000/health/live

# Readiness probe (is the app ready to serve traffic?)
curl http://localhost:3000/health/ready

# Full health check (detailed diagnostics)
curl http://localhost:3000/health/full
```

### 6. Validate Input

Always validate input before sending to the API. The API uses Zod schemas for validation and returns detailed error messages.

### 7. Handle Async Operations

Import and Phase 2 enrichment are async operations. Use the queue API to track progress:

```javascript
// Import URL
const { nodeId, phase2: { jobId } } = await importUrl(url);

// Poll for job completion
const job = await pollJob(jobId);
if (job.status === 'complete') {
  // Phase 2 enrichment completed
  const enrichedNode = await getNode(nodeId);
}
```

### 8. Backup Regularly

Create regular backups of the database:

```bash
# Create backup
curl -X POST http://localhost:3000/api/backup

# List backups
curl http://localhost:3000/api/backups

# Restore from backup
curl -X POST http://localhost:3000/api/restore \
  -H "Content-Type: application/json" \
  -d '{"filename": "decant-backup-2024-01-16T15-30-00.db"}'
```

---

## Support

For issues, questions, or contributions, please refer to the project documentation or create an issue in the repository.

**Version:** 1.0.0
**Last Updated:** 2024-01-30
