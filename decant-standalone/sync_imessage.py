#!/usr/bin/env python3
"""
Direct iMessage to Decant sync script in Python
Bypasses Node.js module issues by implementing sync logic in Python
"""

import sqlite3
import re
import os
import json
import hashlib
import subprocess
from datetime import datetime
from urllib.parse import urlparse, ParseResult
from pathlib import Path
import asyncio
import httpx
from bs4 import BeautifulSoup
from anthropic import Anthropic

# Constants
IMESSAGE_DB_PATH = Path.home() / "Library/Messages/chat.db"
# Try the web version first, then fall back to Electron app path
DECANT_DB_PATH = Path.home() / ".decant/data/decant.db"
if not DECANT_DB_PATH.exists():
    DECANT_DB_PATH = Path.home() / "Library/Application Support/Decant/decant.db"

IMESSAGE_CHAT_ID = 117
APPLE_EPOCH = 978307200


def copy_imessage_database() -> str:
    """Copy iMessage database to temp location (permission workaround)"""
    temp_path = "/tmp/chat_copy.db"
    try:
        subprocess.run([
            "osascript", "-e",
            f'do shell script "cp {IMESSAGE_DB_PATH} {temp_path}"'
        ], check=True, capture_output=True)
        return temp_path
    except Exception as e:
        print(f"❌ Failed to copy iMessage database: {e}")
        raise


def apple_timestamp_to_iso(timestamp: int) -> str:
    """Convert Apple timestamp (nanoseconds since Jan 1, 2001) to ISO datetime"""
    seconds = timestamp / 1_000_000_000
    unix_timestamp = seconds + APPLE_EPOCH
    return datetime.fromtimestamp(unix_timestamp).isoformat()


def extract_urls(text: str | None, blob: bytes | None) -> list[str]:
    """Extract URLs from message text and binary blob"""
    urls = set()
    url_pattern = r'https?://[^\s<>"{|}\\^`\[\]\x00-\x1f]+'

    # Extract from text field
    if text:
        urls.update(re.findall(url_pattern, text))

    # Extract from binary blob
    if blob:
        try:
            blob_text = blob.decode('utf-8', errors='ignore')
            urls.update(re.findall(url_pattern, blob_text))
        except:
            pass

    # Clean and normalize
    cleaned = []
    for url in urls:
        url = url.rstrip("WHttpURL/").rstrip("WHttpURL").rstrip(".,;:!?)")
        if url.startswith("http") and url not in cleaned:
            cleaned.append(url)

    return cleaned


def get_domain(url: str) -> str:
    """Extract domain from URL"""
    try:
        parsed = urlparse(url)
        return parsed.netloc.lower() or "unknown"
    except:
        return "unknown"


def get_new_imessage_messages(since_rowid: int = 0) -> list[dict]:
    """Get new messages from iMessage"""
    temp_path = copy_imessage_database()

    try:
        conn = sqlite3.connect(temp_path)
        conn.row_factory = sqlite3.Row

        cursor = conn.execute("""
            SELECT m.ROWID, m.text, m.attributedBody, m.date
            FROM message m
            JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
            WHERE cmj.chat_id = ? AND m.ROWID > ?
            ORDER BY m.ROWID
        """, (IMESSAGE_CHAT_ID, since_rowid))

        messages = []
        for row in cursor:
            urls = extract_urls(row['text'], row['attributedBody'])
            if urls:
                for url in urls:
                    messages.append({
                        'imessage_rowid': row['ROWID'],
                        'url': url,
                        'domain': get_domain(url),
                        'source_date': apple_timestamp_to_iso(row['date']),
                    })

        conn.close()
        return messages

    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


async def fetch_metadata(url: str, timeout: int = 10) -> dict:
    """Fetch metadata from URL"""
    metadata = {
        'title': None,
        'description': None,
        'author': None,
        'thumbnail_url': None,
        'content_type': None,
    }

    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=timeout) as client:
            response = await client.get(url, headers={
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            })

            content_type = response.headers.get('content-type', '').lower()
            metadata['content_type'] = content_type.split(';')[0].strip()

            if 'text/html' not in content_type:
                return metadata

            soup = BeautifulSoup(response.text, 'html.parser')

            # Extract title
            og_title = soup.find('meta', property='og:title')
            twitter_title = soup.find('meta', attrs={'name': 'twitter:title'})
            metadata['title'] = (
                og_title.get('content') if og_title else
                twitter_title.get('content') if twitter_title else
                (soup.title.string if soup.title else None)
            )[:500] if metadata.get('title') else None

            # Extract description
            og_desc = soup.find('meta', property='og:description')
            twitter_desc = soup.find('meta', attrs={'name': 'twitter:description'})
            meta_desc = soup.find('meta', attrs={'name': 'description'})
            metadata['description'] = (
                og_desc.get('content') if og_desc else
                twitter_desc.get('content') if twitter_desc else
                meta_desc.get('content') if meta_desc else None
            )[:1000] if metadata.get('description') else None

            # Extract author
            og_author = soup.find('meta', property='og:author')
            twitter_creator = soup.find('meta', attrs={'name': 'twitter:creator'})
            meta_author = soup.find('meta', attrs={'name': 'author'})
            metadata['author'] = (
                og_author.get('content') if og_author else
                twitter_creator.get('content') if twitter_creator else
                meta_author.get('content') if meta_author else None
            )[:200] if metadata.get('author') else None

            # Extract image
            og_image = soup.find('meta', property='og:image')
            twitter_image = soup.find('meta', attrs={'name': 'twitter:image'})
            metadata['thumbnail_url'] = og_image.get('content') if og_image else twitter_image.get('content') if twitter_image else None

    except Exception as e:
        metadata['content_type'] = f'error: {str(e)[:100]}'

    return metadata


async def enrich_urls(urls: list[dict], concurrency: int = 5) -> list[dict]:
    """Enrich multiple URLs concurrently"""
    semaphore = asyncio.Semaphore(concurrency)

    async def fetch_with_limit(item):
        async with semaphore:
            metadata = await fetch_metadata(item['url'])
            return {**item, **metadata}

    return await asyncio.gather(*[fetch_with_limit(item) for item in urls])


def categorize_batch(items: list[dict], api_key: str) -> list[dict]:
    """Categorize items using Claude"""
    client = Anthropic(api_key=api_key)

    prompt = """You are extracting metadata from URLs for a knowledge base.

For each URL, extract:
1. title - Clean, descriptive title
2. description - 1-2 sentence description
3. keywords - 3-5 comma-separated keywords
4. category - One of: AI Tools & Products, AI News & Announcements, AI Research & Papers, Tutorials & Learning, AI Development & Code, Demos & Showcases, Business & Finance, Food & Restaurants, Personal & Lifestyle, Work & Productivity, Other
5. subcategory - Specific subcategory
6. use_case - How someone would use this
7. tags - Array of 3-7 tags
8. summary - One-line summary

Respond ONLY with JSON array:
```json
[
  {
    "url": "https://...",
    "title": "...",
    "description": "...",
    "keywords": "key1, key2, key3",
    "category": "...",
    "subcategory": "...",
    "use_case": "...",
    "tags": ["tag1", "tag2"],
    "summary": "..."
  }
]
```

URLs to analyze:
"""

    for item in items:
        prompt += f"\n\nURL: {item['url']}\nDomain: {item['domain']}"
        if item.get('title'):
            prompt += f"\nTitle: {item['title']}"
        if item.get('description'):
            prompt += f"\nDescription: {item['description'][:300]}"

    response = client.messages.create(
        model="claude-opus-4-20250514",
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}]
    )

    content = response.content[0].text
    if "```json" in content:
        content = content.split("```json")[1].split("```")[0].strip()
    elif "```" in content:
        content = content.split("```")[1].split("```")[0].strip()

    categorizations = json.loads(content)
    url_to_cat = {cat['url']: cat for cat in categorizations}

    results = []
    for item in items:
        cat = url_to_cat.get(item['url'], {
            'title': item.get('title', 'Untitled'),
            'description': item.get('description', ''),
            'keywords': item['domain'],
            'category': 'Other',
            'subcategory': '',
            'use_case': '',
            'tags': [item['domain']],
            'summary': f"Resource from {item['domain']}"
        })
        results.append({**item, **cat})

    return results


def insert_into_decant(items: list[dict]) -> int:
    """Insert categorized items into Decant database"""
    import uuid

    # Use timeout to handle database locks
    conn = sqlite3.connect(DECANT_DB_PATH, timeout=30.0)
    conn.row_factory = sqlite3.Row

    inserted = 0
    for item in items:
        try:
            node_id = str(uuid.uuid4())
            title = item.get('title') or item.get('url')
            url = item['url']
            source_domain = item['domain']
            short_description = item.get('description', '')[:500]
            ai_summary = item.get('summary', '')
            metadata_tags = json.dumps(item.get('tags', []))
            key_concepts = item.get('keywords', '')

            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO nodes (
                    id, title, url, source_domain,
                    short_description, ai_summary,
                    phrase_description, metadata_tags
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                node_id, title, url, source_domain,
                short_description, ai_summary,
                item.get('summary', ''), metadata_tags
            ))
            conn.commit()

            # Store key_concepts in the key_concepts table if it exists
            if key_concepts:
                try:
                    cursor = conn.cursor()
                    cursor.execute("""
                        INSERT INTO key_concepts (id, node_id, concept)
                        VALUES (?, ?, ?)
                    """, (str(uuid.uuid4()), node_id, key_concepts))
                    conn.commit()
                except:
                    pass

            inserted += 1
            print(f"  ✅ {title}")

        except sqlite3.IntegrityError as e:
            print(f"  ⏭️  Skipped (duplicate): {item.get('url', 'Unknown URL')}")
        except Exception as e:
            print(f"  ❌ Error inserting {item.get('title', item.get('url', 'Unknown'))}: {str(e)}")

    conn.close()
    return inserted


def get_sync_state(conn: sqlite3.Connection) -> int:
    """Get the last synced iMessage rowid from settings"""
    try:
        cursor = conn.execute("SELECT value FROM settings WHERE key = 'last_imessage_rowid'")
        result = cursor.fetchone()
        return int(result[0]) if result else 0
    except:
        return 0


def update_sync_state(conn: sqlite3.Connection, last_rowid: int):
    """Update last synced iMessage rowid in settings"""
    try:
        conn.execute("""
            INSERT OR REPLACE INTO settings (key, value)
            VALUES ('last_imessage_rowid', ?)
        """, (str(last_rowid),))
        conn.commit()
    except:
        pass


async def main():
    """Main sync function"""
    api_key = os.environ.get('ANTHROPIC_API_KEY')
    if not api_key:
        print('❌ ANTHROPIC_API_KEY environment variable not set')
        print('ℹ️  Sync without AI categorization - URLs will be imported with basic metadata')
        api_key = None

    print('🔄 Syncing iMessage to Decant...\n')

    # 1. Get sync state
    conn = sqlite3.connect(DECANT_DB_PATH)
    last_rowid = get_sync_state(conn)
    conn.close()
    print(f'📝 Last sync: rowid {last_rowid}\n')

    # 2. Get messages
    print('📨 Fetching messages from iMessage...')
    messages = get_new_imessage_messages(last_rowid)
    print(f'✅ Found {len(messages)} URLs\n')

    if not messages:
        print('ℹ️  No new messages to sync')
        return

    # 3. Enrich metadata
    print('🔍 Enriching metadata...')
    enriched = await enrich_urls(messages, concurrency=5)
    print(f'✅ Enriched {len(enriched)} URLs\n')

    # 4. Categorize (if API key available)
    if api_key:
        print('🤖 Categorizing with Claude...')
        categorized = categorize_batch(enriched, api_key)
        print(f'✅ Categorized {len(categorized)} URLs\n')
    else:
        print('⏭️  Skipping AI categorization (no API key)')
        categorized = [{**item, 'category': 'Other', 'summary': item.get('title', item['url'])} for item in enriched]

    # 5. Insert
    print('💾 Inserting into Decant...')
    inserted = insert_into_decant(categorized)
    print(f'✅ Inserted {inserted} items\n')

    # 6. Update sync state
    if categorized:
        max_rowid = max(m['imessage_rowid'] for m in categorized)
        conn = sqlite3.connect(DECANT_DB_PATH)
        update_sync_state(conn, max_rowid)
        conn.close()
        print(f'🎉 Sync complete! {inserted} items imported')


if __name__ == '__main__':
    asyncio.run(main())
