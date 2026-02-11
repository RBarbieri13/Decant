# CORS Error Fix

## Problem
The "Not allowed by CORS" error was occurring when trying to import URLs in batch import mode.

## Root Cause
The Vite proxy configuration had `changeOrigin: true`, which was modifying the `Origin` header when forwarding requests to the backend. This caused the CORS middleware to reject requests because the origin didn't match the allowed origins in `.env`.

## Changes Made

### 1. Enhanced CORS Logging ([security.ts:39-56](src/backend/middleware/security.ts#L39-L56))
Added debug logging to help troubleshoot CORS issues:
- Logs when requests with no origin are allowed
- Logs when requests from allowed origins are accepted
- Logs the full list of allowed origins when blocking requests

### 2. Updated Vite Proxy Configuration ([vite.config.ts:16-24](vite.config.ts#L16-L24))
Changed proxy settings to preserve the original origin:
```typescript
changeOrigin: false, // Keep original origin for CORS (was: true)
secure: false,
ws: true, // Support WebSocket/SSE
```

## How to Apply the Fix

1. **Stop the development servers** (both frontend and backend):
   - Press `Ctrl+C` in both terminal windows running the dev servers

2. **Restart the servers**:
   ```bash
   # In one terminal (backend)
   npm run dev:server

   # In another terminal (frontend)
   npm run dev:client
   ```

3. **Verify the fix**:
   - Open the batch import dialog
   - Paste a URL and try importing
   - The CORS error should no longer appear

## Verification Steps

1. Check the backend logs for CORS debug messages:
   ```
   CORS: Allowing request from origin http://localhost:5173
   ```

2. Open browser DevTools Network tab and verify:
   - Request to `/api/batch-import` shows status 200 (not 403 or CORS error)
   - Response headers include `Access-Control-Allow-Origin: http://localhost:5173`

## Environment Configuration
Ensure your `.env` file has the correct CORS configuration:
```env
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

## Production Deployment
In production, the React app is served directly from Express (same origin), so CORS is not an issue. The changes here only affect development mode.

## Troubleshooting

If you still see CORS errors after applying this fix:

1. **Clear browser cache**: Hard refresh with `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows/Linux)

2. **Check environment variables**: Make sure `.env` is being loaded properly:
   ```bash
   node -e "require('dotenv').config(); console.log(process.env.CORS_ALLOWED_ORIGINS)"
   ```

3. **Check server logs**: Look for "CORS blocked request" messages with the actual origin being rejected

4. **Verify Vite proxy**: Ensure Vite dev server is running on port 5173 and backend on port 3000

5. **Check browser origin**: In DevTools Console, run:
   ```javascript
   console.log(window.location.origin)
   ```
   This should show `http://localhost:5173`
