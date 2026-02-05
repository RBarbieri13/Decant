# Phase 2 Extractors - Testing Guide

## ✅ Implementation Status

**All Phase 2 extractors have been successfully implemented and your API keys are configured!**

### API Keys Configured ✅
- ✅ YouTube API Key: `***aJuo` (Google Cloud)
- ✅ GitHub Token: `***u7Ob` (GitHub PAT)
- ✅ Gemini API Key: `***O-Xk` (Google AI Studio)
- ✅ Firecrawl API Key: `***4310` (Firecrawl.dev)
- ✅ Gemini Tier: `auto` (smart selection)

### Implemented Extractors ✅
1. **YouTube Extractor** - Video metadata + transcription
2. **GitHub Extractor** - Repository data + README
3. **Firecrawl Extractor** - Articles, PDFs, documentation
4. **Gemini Processor** - AI analysis, summarization, taxonomy
5. **Media Processor** - Video/audio with visual element extraction
6. **Extractor Factory** - Smart routing orchestrator

---

## How to Test

### Option 1: Via Trilium Web UI (Recommended)

1. **Start the Trilium server**:
   ```bash
   cd /Users/robert.barbieri/.claude/projects-workspace/Decant
   pnpm run server:start
   ```

2. **Open in browser**:
   ```
   http://localhost:8080
   ```

3. **Import via UI**:
   - The AI Import feature should be available in the Decant interface
   - Try importing these URLs:
     - YouTube: `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
     - GitHub: `https://github.com/zadam/trilium`
     - Article: Any article URL

### Option 2: Via API with Authentication

The AI Import API requires authentication. You need to:

1. **Create an ETAPI token** in Trilium:
   - Go to Options → ETAPI
   - Create a new token
   - Note the token value

2. **Test with curl**:
   ```bash
   curl -X POST http://localhost:8080/api/ai-import \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_ETAPI_TOKEN" \
     -d '{"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "options": {"skipCategorization": true}}'
   ```

### Option 3: Via Decant Standalone (If Available)

If you have the Decant standalone app:

1. **Start the Trilium server** (backend):
   ```bash
   pnpm run server:start
   ```

2. **Launch Decant standalone**:
   ```bash
   cd decant-standalone
   pnpm start
   ```

3. **Import URLs** through the Decant UI

---

## What the Extractors Do

### YouTube Videos
**Extracts**:
- ✅ Video metadata (title, description, duration, views)
- ✅ Channel information
- ✅ Thumbnails
- ✅ Published date, tags, category
- ✅ **With Gemini**: Full transcript + visual elements (slides, code shown on screen)

**Cost**: Free (YouTube API) + ~$0.10-0.50 per video for transcript (Gemini)

### GitHub Repositories
**Extracts**:
- ✅ Repository metadata (stars, forks, language)
- ✅ README content
- ✅ Topics, license, last commit date
- ✅ Language breakdown
- ✅ **With Gemini**: AI summary of README

**Cost**: Free

### Articles & PDFs
**Extracts**:
- ✅ Full article text (clean markdown)
- ✅ Metadata (title, author, date, site name)
- ✅ Reading time estimate
- ✅ **With Gemini**: AI summary, taxonomy, key concepts
- ✅ **PDFs**: Automatic text extraction

**Cost**: ~$0.001 per article (Firecrawl) + ~$0.01 for AI analysis (Gemini)

---

## Expected Results

### YouTube Example
```json
{
  "success": true,
  "data": {
    "videoId": "dQw4w9WgXcQ",
    "title": "Rick Astley - Never Gonna Give You Up (Official Video)",
    "channelName": "Rick Astley",
    "duration": 213,
    "views": 1500000000,
    "thumbnails": {
      "high": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"
    },
    "summary": "Classic 1987 pop hit...",
    "taxonomy": ["Music > Pop > 1980s > Dance Pop"],
    "keyConcepts": ["Rick Astley", "Never Gonna Give You Up", "80s music"]
  },
  "metadata": {
    "extractionMethod": "api_premium",
    "apiUsed": "YouTube Data API + Gemini",
    "confidence": 0.9,
    "cost": 0.1234
  }
}
```

### GitHub Example
```json
{
  "success": true,
  "data": {
    "repoOwner": "zadam",
    "repoName": "trilium",
    "description": "Build your personal knowledge base with Trilium Notes",
    "stars": 25000,
    "forks": 1800,
    "language": "JavaScript",
    "readme": "# Trilium Notes\n\nTrilium Notes is a hierarchical note taking application...",
    "summary": "Trilium is an open-source note-taking app...",
    "taxonomy": ["Software > Knowledge Management > Note Taking"],
    "keyConcepts": ["notes", "knowledge base", "hierarchical"]
  },
  "metadata": {
    "extractionMethod": "api_premium",
    "apiUsed": "GitHub REST API + Gemini",
    "confidence": 1.0,
    "cost": 0.05
  }
}
```

---

## Troubleshooting

### "Logged in session not found" (401 Error)
**Solution**: The API requires authentication. Use Option 1 (Web UI) or create an ETAPI token for Option 2.

### Extractor Returns Fallback Data
**Possible Causes**:
1. API key invalid or expired
2. Rate limit exceeded
3. Network timeout

**Check API Keys**:
```bash
cd /Users/robert.barbieri/.claude/projects-workspace/Decant/apps/server
echo "SELECT name, substr(value, 1, 20) || '...' as value FROM options WHERE name LIKE '%ApiKey' OR name LIKE '%Token';" | sqlite3 data/document.db
```

### No Gemini Analysis
**Cause**: Gemini API key missing or quota exceeded

**Check**:
- Gemini API quota: https://aistudio.google.com/app/apikey
- Free tier: 15 requests/minute, 1,500/day

### Firecrawl Returns 429
**Cause**: Rate limit exceeded (3,000 credits/month on Hobby plan)

**Solution**: Wait for monthly reset or upgrade plan

---

## Cost Monitoring

### Typical Monthly Costs (100-200 imports)

| Service | Cost | Usage |
|---------|------|-------|
| Firecrawl | $16/mo | Fixed (3,000 credits) |
| Gemini | $5-10/mo | Pay-as-you-go |
| YouTube | $0 | Free (10,000 quota/day) |
| GitHub | $0 | Free (5,000 req/hr with token) |
| **Total** | **~$21-26/mo** | For 100-200 items |

### Per-Item Costs
- YouTube (metadata only): Free
- YouTube (with transcript): ~$0.10-0.50
- GitHub repo: Free
- Article (with AI): ~$0.01-0.02
- PDF (with AI): ~$0.02-0.05

---

## Next Steps

1. **Test via Web UI** (easiest):
   - Start server: `pnpm run server:start`
   - Open: http://localhost:8080
   - Import a YouTube video or GitHub repo

2. **Monitor Costs**:
   - Check Firecrawl usage: https://www.firecrawl.dev/app/usage
   - Check Gemini usage: https://aistudio.google.com/app/apikey

3. **Production Deployment**:
   - API keys are stored securely in database
   - Not synced across devices (`isSynced: false`)
   - Marked as secrets (not exposed in logs)

---

## Support

If you encounter issues:

1. Check server logs: `tail -f /tmp/trilium-test.log`
2. Verify API keys are configured: See "Troubleshooting" section above
3. Test individual extractors: See scripts/test-extractors.ts (requires modification for direct testing)

**Your Phase 2 extractors are ready to use!** 🎉

Just start the server and begin importing URLs through the Trilium/Decant interface.
