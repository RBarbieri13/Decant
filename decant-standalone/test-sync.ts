import { getNewIMessageMessages } from './src/main/services/imessage/connection';
import { extractMessagesFromData, flattenExtractedMessages } from './src/main/services/imessage/extractor';

console.log('🔍 Fetching messages from iMessage...');
try {
  const messages = getNewIMessageMessages(0);
  console.log(`✅ Found ${messages.length} messages`);

  if (messages.length > 0) {
    const extracted = extractMessagesFromData(messages);
    const urls = flattenExtractedMessages(extracted);
    console.log(`\n📎 Found ${urls.length} URLs:`);
    urls.forEach((u, i) => {
      console.log(`  ${i + 1}. ${u.url}`);
      console.log(`     Domain: ${u.domain}`);
      console.log(`     Date: ${u.source_date}`);
    });
  } else {
    console.log('ℹ️ No messages found in iMessage (Chat ID 117)');
  }
} catch (error) {
  console.error('❌ Error:', error instanceof Error ? error.message : error);
}
