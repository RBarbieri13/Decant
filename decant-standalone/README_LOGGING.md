# Structured Logging with Pino

This application uses [Pino](https://getpino.io/) for structured logging, providing fast, production-ready logging with JSON output.

## Quick Start

### Development Mode
```bash
# Pretty-printed, colorized output with debug logs
pnpm run dev:server
```

Output will look like:
```
[12:00:00.000] INFO: Initializing database...
[12:00:00.123] INFO: Database initialized successfully
[12:00:00.456] INFO: Decant server running at http://localhost:3000
```

### Production Mode
```bash
# JSON output for log aggregation
NODE_ENV=production pnpm run start
```

Output will be JSON:
```json
{"level":"info","time":"2026-01-28T12:00:00.000Z","msg":"Decant server running at http://localhost:3000"}
```

## Environment Variables

| Variable | Values | Default | Description |
|----------|--------|---------|-------------|
| `LOG_LEVEL` | trace, debug, info, warn, error, fatal | `debug` (dev) / `info` (prod) | Minimum log level to output |
| `LOG_FORMAT` | json, pretty | `pretty` (dev) / `json` (prod) | Output format |
| `NODE_ENV` | development, production | `development` | Environment mode |

## Examples

### Custom Configuration
```bash
# Debug logs in JSON format (useful for testing log parsing)
LOG_LEVEL=debug LOG_FORMAT=json pnpm run dev:server

# Only errors and warnings
LOG_LEVEL=warn pnpm run start

# Maximum verbosity
LOG_LEVEL=trace pnpm run dev:server
```

## Features

### Automatic Request Logging
Every HTTP request is automatically logged with:
- Unique request ID (available as `req.id` and in `X-Request-ID` header)
- HTTP method, URL, status code
- Response time in milliseconds
- Contextual log level (errors for 5xx, warnings for 4xx)

Example:
```json
{
  "level": "info",
  "time": "2026-01-28T12:00:00.000Z",
  "request": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "method": "POST",
    "url": "/api/import"
  },
  "response": {
    "statusCode": 200
  },
  "responseTimeMs": 1234,
  "msg": "POST /api/import 200"
}
```

### Structured Context
All logs include structured context for filtering and analysis:

```typescript
log.info('Import complete', {
  nodeId: '123',
  url: 'https://example.com',
  segment: 'T',
  module: 'import'
});
```

Output:
```json
{
  "level": "info",
  "time": "2026-01-28T12:00:00.000Z",
  "nodeId": "123",
  "url": "https://example.com",
  "segment": "T",
  "module": "import",
  "msg": "Import complete"
}
```

### Error Serialization
Errors are automatically serialized with stack traces:

```typescript
try {
  await operation();
} catch (error) {
  log.error('Operation failed', { err: error, context: 'additional info' });
}
```

Output includes:
```json
{
  "level": "error",
  "time": "2026-01-28T12:00:00.000Z",
  "err": {
    "message": "Operation failed",
    "name": "Error",
    "stack": "Error: Operation failed\n    at ..."
  },
  "context": "additional info",
  "msg": "Operation failed"
}
```

## Filtering Logs

### Using grep (development mode)
```bash
# Filter by module
pnpm run dev:server 2>&1 | grep "import"

# Filter by level
pnpm run dev:server 2>&1 | grep "ERROR"
```

### Using jq (production mode)
```bash
# Filter by module
pnpm run start 2>&1 | jq 'select(.module == "import")'

# Filter by level
pnpm run start 2>&1 | jq 'select(.level == "error")'

# Filter by request ID
pnpm run start 2>&1 | jq 'select(.requestId == "550e8400-e29b-41d4-a716-446655440000")'

# Pretty print JSON logs
pnpm run start 2>&1 | jq '.'
```

## Verification

Run the verification script to check the logging implementation:

```bash
chmod +x scripts/verify-logging.sh
./scripts/verify-logging.sh
```

This will check:
- Dependencies are installed
- Logger files exist
- No console.log usage in backend code
- Environment variable support
- Request logging integration
- Documentation

## Documentation

- **[LOGGING_GUIDE.md](docs/LOGGING_GUIDE.md)** - Developer guide for using the logger
- **[STRUCTURED_LOGGING_IMPLEMENTATION.md](STRUCTURED_LOGGING_IMPLEMENTATION.md)** - Implementation details and architecture

## Integration with Log Aggregation

The JSON output format is compatible with popular log aggregation services:

- **Datadog**: Use the Datadog Agent or HTTP API
- **Splunk**: Use the HTTP Event Collector (HEC)
- **AWS CloudWatch**: Use the CloudWatch Logs agent
- **Elasticsearch**: Use Filebeat or Logstash
- **Grafana Loki**: Use Promtail

Example Datadog integration:
```bash
# Install Datadog Agent and configure to read JSON logs
# Then start with JSON output
NODE_ENV=production LOG_FORMAT=json pnpm run start | \
  tee /var/log/decant/app.log
```

## Performance

Pino is one of the fastest Node.js loggers:
- Minimal overhead (~10-20% faster than alternatives)
- Async logging (doesn't block your app)
- Efficient JSON serialization
- Automatic log filtering by level

## Best Practices

1. **Use appropriate log levels**: Debug for development, info for production events, error for failures
2. **Include context**: Always add relevant context (module, operation, IDs)
3. **Don't log sensitive data**: Never log API keys, passwords, or personal information
4. **Use structured data**: Pass objects, not concatenated strings
5. **Log operation boundaries**: Log when operations start and complete
6. **Include module names**: Use consistent module names for easy filtering

## Common Issues

### Logs not appearing
- Check `LOG_LEVEL` - it may be set too high
- Verify you're importing from `./backend/logger/index.js`
- Check that the logger middleware is applied in server.ts

### Too many logs
- Increase `LOG_LEVEL` to `info` or `warn`
- Remove debug logs from hot code paths
- Use conditional logging for expensive operations

### JSON parsing errors
- Ensure `LOG_FORMAT=json` in production
- Don't mix console.log with logger output
- Verify output is being written to stdout/stderr

## Migration from console.log

If you find old code using `console.log`:

```typescript
// Old
console.log('Operation complete', data);

// New
log.info('Operation complete', { data });
```

```typescript
// Old
console.error('Failed:', error);

// New
log.error('Failed', { err: error });
```

The logger provides the same convenience API with better structure!
