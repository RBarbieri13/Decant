const { getNewIMessageMessages } = require('./src/main/services/imessage/connection');
const { extractMessagesFromData, flattenExtractedMessages } = require('./src/main/services/imessage/extractor');

try {
  console.log('🔍 Fetching messages from iMessage...');
  const messages = getNewIMessageMessages(0);
  console.log(`Found ${messages.length} messages`);
  
  if (messages.length > 0) {
    const extracted = extractMessagesFromData(messages);
    const urls = flattenExtractedMessages(extracted);
    console.log(`Found ${urls.length} URLs:`);
    urls.forEach(u => console.log(`  - ${u.url}`));
  }
} catch (error) {
  console.error('Error:', error.message);
}
