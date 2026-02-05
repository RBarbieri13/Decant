/**
 * Test Phase 2 Extractors
 *
 * Direct test of extractor functionality without HTTP layer
 */

import { extractorFactory } from '../src/services/extractors/index.js';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test URLs
const TEST_URLS = {
    youtube: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    github: 'https://github.com/zadam/trilium',
    article: 'https://example.com'
};

// Get API keys from database
function getApiKeys(): Record<string, string> {
    const dbPath = path.join(__dirname, '..', 'data', 'document.db');
    const db = new Database(dbPath, { readonly: true });

    const options = db.prepare(`
        SELECT name, value
        FROM options
        WHERE name IN ('firecrawlApiKey', 'geminiApiKey', 'youtubeApiKey', 'githubAccessToken', 'geminiTier')
    `).all() as Array<{ name: string; value: string }>;

    db.close();

    const keys: Record<string, string> = {};
    options.forEach(opt => {
        keys[opt.name] = opt.value;
    });

    return keys;
}

async function testExtractor(name: string, url: string) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Testing: ${name}`);
    console.log(`URL: ${url}`);
    console.log('='.repeat(80));

    const keys = getApiKeys();

    const extractorOptions = {
        apiKeys: {
            firecrawl: keys.firecrawlApiKey,
            gemini: keys.geminiApiKey,
            youtube: keys.youtubeApiKey,
            github: keys.githubAccessToken
        },
        geminiTier: (keys.geminiTier || 'auto') as 'pro' | 'flash' | 'auto',
        timeout: 30000,
        useFallback: true
    };

    try {
        const startTime = Date.now();
        const result = await extractorFactory.extract(url, extractorOptions);
        const endTime = Date.now();

        console.log(`\n✅ Extraction completed in ${endTime - startTime}ms`);
        console.log(`\nResult:`)
        console.log(`  Success: ${result.success}`);
        console.log(`  Method: ${result.metadata.extractionMethod}`);
        console.log(`  API Used: ${result.metadata.apiUsed || 'None'}`);
        console.log(`  Confidence: ${result.metadata.confidence}`);
        console.log(`  Cost: $${(result.metadata.cost || 0).toFixed(4)}`);

        if (result.success && result.data) {
            console.log(`\n📊 Extracted Data:`) ;
            console.log(`  Title: ${result.data.title || 'N/A'}`);

            if (result.data.summary) {
                console.log(`  Summary: ${result.data.summary.substring(0, 100)}...`);
            }

            if (result.data.taxonomy) {
                console.log(`  Taxonomy: ${result.data.taxonomy.join(', ')}`);
            }

            if (result.data.keyConcepts) {
                console.log(`  Key Concepts: ${result.data.keyConcepts.join(', ')}`);
            }

            if (result.data.videoId) {
                console.log(`  Video ID: ${result.data.videoId}`);
                console.log(`  Duration: ${result.data.duration}s`);
                console.log(`  Views: ${result.data.views?.toLocaleString() || 'N/A'}`);
            }

            if (result.data.repoOwner) {
                console.log(`  Repository: ${result.data.repoOwner}/${result.data.repoName}`);
                console.log(`  Stars: ${result.data.stars?.toLocaleString() || 'N/A'}`);
                console.log(`  Language: ${result.data.language || 'N/A'}`);
            }

            if (result.data.transcript) {
                console.log(`  Transcript length: ${result.data.transcript.length} chars`);
            }

            if (result.data.visualElements) {
                console.log(`  Visual Elements:`);
                if (result.data.visualElements.slideText) {
                    console.log(`    - ${result.data.visualElements.slideText.length} slides`);
                }
                if (result.data.visualElements.codeSnippets) {
                    console.log(`    - ${result.data.visualElements.codeSnippets.length} code snippets`);
                }
            }
        } else if (result.error) {
            console.log(`\n❌ Error:`)
            console.log(`  Code: ${result.error.code}`);
            console.log(`  Message: ${result.error.message}`);
            console.log(`  Recoverable: ${result.error.recoverable}`);
        }

    } catch (error) {
        console.error(`\n❌ Test failed:`, error);
    }
}

async function main() {
    console.log('🧪 Testing Phase 2 Content Extractors');
    console.log('=====================================\n');

    // Check API keys
    const keys = getApiKeys();
    console.log('📦 API Keys configured:');
    console.log(`  Firecrawl: ${keys.firecrawlApiKey ? '✅ Yes' : '❌ No'}`);
    console.log(`  Gemini: ${keys.geminiApiKey ? '✅ Yes' : '❌ No'}`);
    console.log(`  YouTube: ${keys.youtubeApiKey ? '✅ Yes' : '❌ No'}`);
    console.log(`  GitHub: ${keys.githubAccessToken ? '✅ Yes' : '❌ No'}`);
    console.log(`  Gemini Tier: ${keys.geminiTier || 'auto'}`);

    // Test each extractor
    await testExtractor('YouTube Video', TEST_URLS.youtube);
    await testExtractor('GitHub Repository', TEST_URLS.github);
    // await testExtractor('Article', TEST_URLS.article); // Skip for now - example.com is basic

    console.log(`\n${'='.repeat(80)}`);
    console.log('✅ All tests completed!');
    console.log('='.repeat(80));
}

main().catch(console.error);
