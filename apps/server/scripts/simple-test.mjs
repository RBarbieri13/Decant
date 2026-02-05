/**
 * Simple test of extractors without app initialization
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { YouTubeExtractor } from '../src/services/extractors/youtube_extractor.js';
import { GitHubExtractor } from '../src/services/extractors/github_extractor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get API keys from database
function getApiKeys() {
    const dbPath = path.join(__dirname, '..', 'data', 'document.db');
    const db = new Database(dbPath, { readonly: true });

    const options = db.prepare(`
        SELECT name, value
        FROM options
        WHERE name IN ('youtube ApiKey', 'geminiApiKey', 'youtubeApiKey', 'githubAccessToken')
    `).all();

    db.close();

    const keys = {};
    options.forEach(opt => {
        keys[opt.name] = opt.value;
    });

    return keys;
}

async function testYouTube() {
    console.log('\n🎬 Testing YouTube Extractor');
    console.log('='.repeat(80));

    const keys = getApiKeys();
    const extractor = new YouTubeExtractor();
    const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

    try {
        const result = await extractor.extract(url, {
            apiKeys: { youtube: keys.youtubeApiKey }
        });

        console.log('✅ Success:', result.success);
        console.log('Method:', result.metadata.extractionMethod);
        console.log('API Used:', result.metadata.apiUsed || 'None');
        console.log('Confidence:', result.metadata.confidence);

        if (result.data) {
            console.log('\n📊 Data:');
            console.log('  Video ID:', result.data.videoId);
            console.log('  Title:', result.data.title);
            console.log('  Channel:', result.data.channelName);
            console.log('  Duration:', result.data.duration, 'seconds');
            console.log('  Views:', result.data.views?.toLocaleString());
            console.log('  Published:', result.data.publishedAt);
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

async function testGitHub() {
    console.log('\n📦 Testing GitHub Extractor');
    console.log('='.repeat(80));

    const keys = getApiKeys();
    const extractor = new GitHubExtractor();
    const url = 'https://github.com/zadam/trilium';

    try {
        const result = await extractor.extract(url, {
            apiKeys: { github: keys.githubAccessToken }
        });

        console.log('✅ Success:', result.success);
        console.log('Method:', result.metadata.extractionMethod);
        console.log('API Used:', result.metadata.apiUsed || 'None');
        console.log('Confidence:', result.metadata.confidence);

        if (result.data) {
            console.log('\n📊 Data:');
            console.log('  Repository:', `${result.data.repoOwner}/${result.data.repoName}`);
            console.log('  Description:', result.data.description);
            console.log('  Stars:', result.data.stars?.toLocaleString());
            console.log('  Forks:', result.data.forks?.toLocaleString());
            console.log('  Language:', result.data.language);
            console.log('  License:', result.data.license || 'None');
            console.log('  Last Commit:', result.data.lastCommit);
            console.log('  README length:', result.data.readme?.length || 0, 'chars');
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// Run tests
console.log('🧪 Testing Phase 2 Content Extractors');
console.log('='.repeat(80));

const keys = getApiKeys();
console.log('\n📦 API Keys:');
console.log('  YouTube:', keys.youtubeApiKey ? '✅' : '❌');
console.log('  GitHub:', keys.githubAccessToken ? '✅' : '❌');
console.log('  Gemini:', keys.geminiApiKey ? '✅' : '❌');

await testYouTube();
await testGitHub();

console.log('\n' + '='.repeat(80));
console.log('✅ Tests completed!');
