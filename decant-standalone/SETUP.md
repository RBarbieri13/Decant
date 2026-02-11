# Decant Setup Guide

Quick start guide for setting up and running Decant.

## Prerequisites

- **Node.js 18+** (required for ES modules)
- **npm** or **pnpm** (package manager)
- **OpenAI API key** (required for AI import features)

Check your versions:
```bash
node --version    # Should be v18.0.0 or higher
npm --version     # Should be 9.0.0 or higher
```

---

## Installation

### 1. Clone and Install Dependencies

```bash
# Navigate to the decant-standalone directory
cd decant-standalone

# Install dependencies
npm install
```

### 2. Configure Environment Variables

A `.env` file has been created for you from `.env.example`. You need to configure your OpenAI API key.

**Option A: Using the .env file (Recommended)**

1. Open the `.env` file in the root directory:
   ```bash
   nano .env
   # or use your preferred editor
   ```

2. Find the `OPENAI_API_KEY` line (around line 59):
   ```bash
   # OPENAI_API_KEY=sk-proj-your-key-here
   ```

3. Uncomment the line and add your OpenAI API key:
   ```bash
   OPENAI_API_KEY=sk-proj-YOUR_ACTUAL_API_KEY_HERE
   ```

4. Save the file and exit.

**Option B: Using environment variables**

Alternatively, you can set the environment variable directly:

```bash
# Linux/macOS
export OPENAI_API_KEY=sk-proj-YOUR_ACTUAL_API_KEY_HERE

# Windows (PowerShell)
$env:OPENAI_API_KEY="sk-proj-YOUR_ACTUAL_API_KEY_HERE"

# Windows (Command Prompt)
set OPENAI_API_KEY=sk-proj-YOUR_ACTUAL_API_KEY_HERE
```

**Option C: Using the encrypted keystore (via UI)**

After starting the application, you can also configure the API key through the settings UI. The key will be stored in an encrypted format at `~/.decant/config/keys.enc`.

---

## Getting Your OpenAI API Key

1. Visit [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign in or create an account
3. Navigate to "API Keys"
4. Click "Create new secret key"
5. Copy the key (it starts with `sk-proj-` or `sk-`)
6. **Important**: Save it immediately - you won't be able to see it again!

---

## Running the Application

### Development Mode

Start both the backend server and frontend development server:

```bash
npm run dev
```

This will:
- Start the Express server on `http://localhost:3000`
- Start the Vite development server with hot-reload
- Open your browser automatically

### Production Mode

Build and run in production:

```bash
# Build the application
npm run build

# Start the production server
npm start
```

The application will be available at `http://localhost:3000` (or your configured PORT).

---

## Verifying Configuration

### Check if the API key is loaded correctly

1. Start the server:
   ```bash
   npm run dev:server
   ```

2. Look for these log messages:
   ```
   Configuration loaded { ... hasOpenAIKey: true ... }
   ```

3. If you see `hasOpenAIKey: false`, your API key is not loaded correctly. Check:
   - Is the `.env` file in the root directory?
   - Is `OPENAI_API_KEY` uncommented in `.env`?
   - Is the key value correct (starts with `sk-`)?

### Test the import functionality

1. Start the full application:
   ```bash
   npm run dev
   ```

2. Navigate to the import section in the UI
3. Try importing a URL or pasting content
4. If configured correctly, the AI classification should work

---

## Troubleshooting

### "No OPENAI_API_KEY configured" warning

**Symptom**: You see this warning in the server logs:
```
⚠ No OPENAI_API_KEY configured - AI features will be disabled
```

**Solution**:
1. Ensure you've created the `.env` file
2. Uncomment the `OPENAI_API_KEY` line
3. Add your actual API key
4. Restart the server

### "OpenAI API key not configured" error during import

**Symptom**: Import fails with an error about missing API key.

**Solution**: Follow the steps in "Getting Your OpenAI API Key" above and configure it properly.

### API key is set but not working

**Checklist**:
1. ✅ Is the key in the correct format? (starts with `sk-`)
2. ✅ Have you restarted the server after setting the key?
3. ✅ Is the `.env` file in the `decant-standalone` directory (not a subdirectory)?
4. ✅ Is the key valid and has not been revoked?
5. ✅ Does your OpenAI account have credits/billing set up?

### Test your API key directly

```bash
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer YOUR_API_KEY_HERE"
```

If this fails, your API key is invalid or your account needs billing setup.

---

## Additional Configuration

The `.env` file contains many other configuration options. Here are some common ones:

### Port Configuration
```bash
PORT=3000  # Change to run on a different port
```

### Database Location
```bash
DATABASE_PATH=./data/decant.db  # Custom database location
```

### Logging
```bash
LOG_LEVEL=debug  # Set to 'debug' for verbose logs
LOG_PRETTY=true  # Pretty-print logs (vs JSON)
```

### OpenAI Model Selection
```bash
OPENAI_MODEL=gpt-4o-mini  # Or gpt-4o, gpt-3.5-turbo, etc.
```

### Security (Optional but Recommended for Production)
```bash
# Generate a secure master key for encrypting stored API keys
DECANT_MASTER_KEY=your-32-character-minimum-secret-key

# Generate one with:
openssl rand -base64 32
```

See `.env.example` for all available configuration options.

---

## Next Steps

Once configured and running:

1. **Explore the UI**: Navigate to `http://localhost:3000`
2. **Import content**: Try importing URLs or pasting content
3. **Test AI features**: Create bookmarks and let AI classify them
4. **Configure settings**: Visit the settings page for additional options
5. **Read the docs**: Check out `DEVELOPMENT.md` for advanced topics

---

## Need Help?

- **Documentation**: See `docs/` directory for detailed guides
- **API Reference**: See `docs/API.md`
- **Development**: See `DEVELOPMENT.md`
- **Troubleshooting**: See `docs/TROUBLESHOOTING.md`

For issues or questions, please open an issue on the project repository.
