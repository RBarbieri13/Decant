# X/Twitter Metadata Extraction Pipeline

> How Decant imports, extracts, and stores metadata from X/Twitter posts.

---

## High-Level Flow

```
User pastes X link
        │
        ▼
┌──────────────────┐
│  Import          │    Validates URL, checks cache,
│  Orchestrator    │    detects x.com/twitter.com domain
│  (orchestrator.ts)│
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Extractor       │    Sorted by priority — TwitterExtractor (100)
│  Registry        │    wins for x.com / twitter.com URLs
│  (index.ts)      │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Twitter         │    5-tier fallback chain
│  Extractor       │    (see below)
│  (twitter.ts)    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Quality         │    Determines 'full' / 'partial' / 'minimal'
│  Assessment      │    based on what data came back
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Upsert Node     │    Creates or updates node in SQLite
│  (nodes.ts)      │    Only updates if new quality >= existing quality
└──────────────────┘
```

---

## The 5-Tier Fallback Chain

When the orchestrator hands a URL to `TwitterExtractor.extract()`, it cascades through up to 5 extraction methods. The **first one that succeeds wins** — the rest are skipped.

### Tier 1: X API v2 (Official)

| Detail | Value |
|--------|-------|
| **Endpoint** | `https://api.x.com/2/tweets/{tweetId}` |
| **Auth** | Bearer Token (`X_API_BEARER_TOKEN` env var or encrypted keystore) |
| **Timeout** | 30 seconds |
| **Rate limit** | 450 requests / 15 minutes (with 50-request safety margin = effective 400) |
| **Cost** | Free tier available from X Developer Portal |

**What it returns:**
- Full tweet text
- Author name, handle, profile image, follower count
- Engagement metrics: likes, retweets, replies, quotes
- Hashtags and @mentions (structured from `entities`)
- Media URLs (images, video thumbnails)
- Timestamps (`created_at`)
- Conversation ID, attachments

**API call details:**
```
GET https://api.x.com/2/tweets/{tweetId}
  ?tweet.fields=text,author_id,created_at,public_metrics,entities,attachments,conversation_id
  &user.fields=name,username,profile_image_url,public_metrics
  &media.fields=url,preview_image_url,type
  &expansions=author_id,attachments.media_keys

Headers:
  Authorization: Bearer {token}
```

**Triggers fallback when:**
- Bearer token not configured
- Rate limit approaching (>400 requests in window)
- API returns errors without data
- API returns no data object
- Network/timeout failure

**Source file:** [twitter.ts](decant-standalone/src/backend/services/extractors/twitter.ts) — `fetchFromXApi()` (line 120)

---

### Tier 2: Apify Tweet Scraper (Paid service)

| Detail | Value |
|--------|-------|
| **Actor** | `apidojo~tweet-scraper` |
| **Base URL** | `https://api.apify.com/v2` |
| **Auth** | API key (`APIFY_API_KEY` env var or config) |
| **Timeout** | 60 seconds total (3-second poll interval) |
| **Cost** | Apify free tier available; paid tiers for volume |

**How it works:**
1. **Start actor run** — `POST /acts/apidojo~tweet-scraper/runs?token={key}` with `{ startUrls: [tweetUrl], maxItems: 1 }`
2. **Poll for completion** — `GET /actor-runs/{runId}?token={key}` every 3 seconds until status is `SUCCEEDED`, `FAILED`, or `ABORTED`
3. **Fetch results** — `GET /datasets/{datasetId}/items?token={key}&limit=1`

**What it returns:**
- `full_text` or `text` (prefers `full_text`)
- Author: `user.screen_name`, `user.name`, `user.followers_count`
- Engagement: `favorite_count`, `retweet_count`, `reply_count`, `quote_count`
- Hashtags and mentions from `entities`
- Media URLs from `extended_entities` (preferred) or `entities.media`
- Retweet detection via `retweeted_status` presence
- Quote tweet URL via `quoted_status_permalink.expanded`

**Triggers fallback when:**
- `APIFY_API_KEY` not configured → returns `null` immediately
- Actor start fails (non-200 response)
- Poll timeout (>60 seconds)
- Run status is `FAILED` or `ABORTED`
- Dataset returns no items or `noResults` flag

**Source file:** [apify-twitter.ts](decant-standalone/src/backend/services/extractors/apify-twitter.ts) — `fetchTweetViaApify()` (line 54)

---

### Tier 3: FxTwitter API (Free, no auth)

| Detail | Value |
|--------|-------|
| **Endpoint** | `https://api.fxtwitter.com/{handle}/status/{tweetId}` |
| **Auth** | None required |
| **Timeout** | 15 seconds |
| **Cost** | Free (open-source third-party service) |

**How it works:**
1. Extract author handle from the URL path (e.g., `x.com/elonmusk/status/123` → `elonmusk`)
2. Single GET request to `https://api.fxtwitter.com/{handle}/status/{tweetId}`
3. Parse JSON response

**What it returns:**
- Tweet text, creation timestamp
- Author: name, screen_name, follower count
- Engagement: likes, retweets, replies, quotes
- Media: array of `{ url, type, thumbnail_url }`
- Quote tweet: URL and text
- Hashtags and mentions (parsed from tweet text via regex `#(\w+)` and `@(\w+)`)

**Triggers fallback when:**
- HTTP response is not OK
- Response code is not 200 or `tweet` object is missing
- Network/timeout failure

**Caveat:** FxTwitter is a third-party open-source project with no SLA. It could go down or change its API without notice.

**Source file:** [fxtwitter-fallback.ts](decant-standalone/src/backend/services/extractors/fxtwitter-fallback.ts) — `fetchTweetViaFxTwitter()` (line 79)

---

### Tier 4: Twitter oEmbed API (Official, no auth)

| Detail | Value |
|--------|-------|
| **Endpoint** | `https://publish.twitter.com/oembed?url={tweetUrl}` |
| **Auth** | None required |
| **Timeout** | 15 seconds |
| **Cost** | Free (official Twitter endpoint) |

**How it works:**
1. Call `https://publish.twitter.com/oembed?url={tweetUrl}&omit_script=true&lang=en`
2. Response includes an HTML `<blockquote>` containing the tweet
3. Parse the `<p>` tag inside the blockquote to extract tweet text
4. Strip HTML tags and decode entities (`&amp;` → `&`, `&lt;` → `<`, etc.)
5. Extract author handle from `author_url`

**What it returns:**
- Tweet text (extracted from HTML via regex)
- Author name (`author_name`) and handle (from `author_url`)
- Hashtags and mentions (parsed from text via regex)

**What it does NOT return:**
- Engagement metrics (likes, retweets, etc.) — **not available**
- Media URLs — **not available**
- Follower count — **not available**
- Timestamps — **not available in structured form**

**Triggers fallback when:**
- HTTP response is not OK
- Response missing `html` or `author_name`
- Network/timeout failure

**Source file:** [twitter-oembed-fallback.ts](decant-standalone/src/backend/services/extractors/twitter-oembed-fallback.ts) — `fetchTweetViaOEmbed()` (line 110)

---

### Tier 5: HTML OG Meta Tags (Last resort)

| Detail | Value |
|--------|-------|
| **Target** | The tweet URL itself (fetched as HTML) |
| **Auth** | None |
| **User-Agent** | Googlebot (to maximize content served by X) |
| **Timeout** | 15 seconds |
| **Parser** | cheerio (server-side HTML parser) |
| **Cost** | Free |

**How it works:**
1. Fetch the tweet URL directly with a Googlebot user-agent string
2. Parse HTML with cheerio
3. Extract Open Graph meta tags: `og:title`, `og:description`, `og:image`, `og:site_name`
4. Fall back to `twitter:title`, `twitter:description`, `twitter:image` namespace
5. Extract author handle from URL path

**What it returns:**
- Title (from `og:title` or `twitter:title`)
- Description (from `og:description` or `twitter:description`)
- Image (from `og:image` or `twitter:image`)
- Author handle (parsed from URL path)

**What it does NOT return:**
- Engagement metrics — **not available**
- Follower count — **not available**
- Hashtags/mentions — **not parsed**
- Full tweet text — **only the OG description, which may be truncated**

**Returns null when:**
- Fetch fails or returns non-200
- HTML is less than 100 characters
- Neither `title` nor `description` found in meta tags

**Source file:** [twitter-og-fallback.ts](decant-standalone/src/backend/services/extractors/twitter-og-fallback.ts) — `fetchTweetViaOgTags()` (line 42)

---

### Tier 6: Blank Result (Total failure)

If all 5 tiers fail, the extractor returns a valid but empty result:
- `extractedFields` = `{ tweetId }` only
- `metadata.notes` = `["X API unavailable, all fallbacks failed — blank"]`
- The node is still created in the database — it just has no content

---

## Shared Data Model: `TwitterFields`

All 5 tiers map their responses to a single interface before being stored. This is defined in [base.ts](decant-standalone/src/backend/services/extractors/base.ts) (line 321):

```typescript
interface TwitterFields {
  tweetId: string;              // Tweet numeric ID
  authorHandle: string | null;  // e.g., "elonmusk"
  authorName: string | null;    // e.g., "Elon Musk"
  authorFollowers: number | null;
  tweetText: string | null;     // Full tweet text
  likeCount: number | null;
  retweetCount: number | null;
  replyCount: number | null;
  quoteCount: number | null;
  isRetweet: boolean;
  isQuoteTweet: boolean;
  quotedTweetUrl: string | null;
  mediaUrls: string[];          // Image/video URLs
  hashtags: string[];           // Without # prefix
  mentions: string[];           // Without @ prefix
  postedAt: string | null;      // ISO timestamp
}
```

### Data availability by tier

| Field | Tier 1 (X API) | Tier 2 (Apify) | Tier 3 (FxTwitter) | Tier 4 (oEmbed) | Tier 5 (OG Tags) |
|-------|:-:|:-:|:-:|:-:|:-:|
| tweetText | Yes | Yes | Yes | Yes (from HTML) | Partial (og:description) |
| authorHandle | Yes | Yes | Yes | Yes (from URL) | Yes (from URL) |
| authorName | Yes | Yes | Yes | Yes | No |
| authorFollowers | Yes | Yes | Yes | No | No |
| likeCount | Yes | Yes | Yes | No | No |
| retweetCount | Yes | Yes | Yes | No | No |
| replyCount | Yes | Yes | Yes | No | No |
| quoteCount | Yes | Yes | Yes | No | No |
| mediaUrls | Yes | Yes | Yes | No | Partial (og:image) |
| hashtags | Yes (structured) | Yes (structured) | Yes (regex) | Yes (regex) | No |
| mentions | Yes (structured) | Yes (structured) | Yes (regex) | Yes (regex) | No |
| postedAt | Yes | Yes | Yes | No | No |
| isRetweet | No* | Yes | No | No | No |
| isQuoteTweet | No* | Yes | Yes | No | No |

*X API v2 can detect these but the current mapping doesn't extract them.

---

## AI Content Assembly

After extracting `TwitterFields`, the `buildContentForAi()` method (line 463 in twitter.ts) assembles a plain-text block for AI classification:

```
Tweet: {tweetText}
Author: {authorName} @{authorHandle}
Followers: {authorFollowers}
Hashtags: #{tag1}, #{tag2}
Mentions: @{user1}, @{user2}
Engagement: {likeCount} likes, {retweetCount} retweets, {replyCount} replies
Posted: {postedAt}
```

This text is stored as `content` on the node and passed to the Phase 1 classifier for topic/segment categorization.

---

## Extraction Quality Tracking

### Database columns (Migration 012)

```sql
ALTER TABLE nodes ADD COLUMN extraction_quality TEXT DEFAULT NULL;
ALTER TABLE nodes ADD COLUMN extraction_source TEXT DEFAULT NULL;
ALTER TABLE nodes ADD COLUMN extraction_notes TEXT DEFAULT NULL;

CREATE INDEX idx_nodes_extraction_quality
  ON nodes(extraction_quality) WHERE is_deleted = 0;
```

### Quality determination logic (orchestrator.ts)

```
if (scraped.content && scraped.title !== 'Untitled') → 'full'
else if (scraped.description || scraped.content)     → 'partial'
else                                                  → 'minimal'
```

### Typical quality by tier

| Tier | Typical Quality |
|------|----------------|
| 1 — X API v2 | `full` |
| 2 — Apify | `full` |
| 3 — FxTwitter | `full` |
| 4 — oEmbed | `partial` (no metrics, no media) |
| 5 — OG Tags | `partial` or `minimal` |
| 6 — Blank | `minimal` |

---

## Upsert & Quality Protection

When re-importing a URL that already exists:

1. `findNodeByUrl(url)` checks for an existing node
2. Quality ranks: `minimal = 0`, `partial = 1`, `full = 2`
3. **Only update if `newRank >= oldRank`** — never overwrite good data with degraded data
4. If skipped, logs: `"Skipping update — existing quality is better"`

### Admin re-scrape endpoint

```
POST /api/admin/rescrape-poor-quality
```

Finds all nodes where `extraction_quality = 'minimal' OR extraction_quality IS NULL`, re-imports each with force-refresh, and returns the count processed.

---

## Required Environment Variables

| Variable | Required By | Purpose |
|----------|------------|---------|
| `X_API_BEARER_TOKEN` | Tier 1 | Official X API v2 authentication |
| `APIFY_API_KEY` | Tier 2 | Apify actor execution |
| `DECANT_MASTER_KEY` | Keystore | AES-256-GCM encryption of stored API keys (min 32 chars) |

Tiers 3–5 require **no API keys** and work out of the box.

If no keys are configured at all, the chain starts at Tier 3 (FxTwitter) automatically.

---

## File Reference

| File | Role |
|------|------|
| [twitter.ts](decant-standalone/src/backend/services/extractors/twitter.ts) | Main extractor class, X API v2, fallback orchestration |
| [apify-twitter.ts](decant-standalone/src/backend/services/extractors/apify-twitter.ts) | Apify Tweet Scraper integration |
| [fxtwitter-fallback.ts](decant-standalone/src/backend/services/extractors/fxtwitter-fallback.ts) | FxTwitter free API fallback |
| [twitter-oembed-fallback.ts](decant-standalone/src/backend/services/extractors/twitter-oembed-fallback.ts) | Twitter oEmbed API fallback |
| [twitter-og-fallback.ts](decant-standalone/src/backend/services/extractors/twitter-og-fallback.ts) | HTML OG meta tag scraping |
| [base.ts](decant-standalone/src/backend/services/extractors/base.ts) | TwitterFields interface, BaseExtractor class |
| [index.ts](decant-standalone/src/backend/services/extractors/index.ts) | ExtractorRegistry (routes URLs to extractors) |
| [orchestrator.ts](decant-standalone/src/backend/services/import/orchestrator.ts) | Import pipeline, quality tracking, upsert logic |
| [012_add_extraction_quality.ts](decant-standalone/src/backend/database/migrations/012_add_extraction_quality.ts) | Migration adding quality columns |
