// ============================================================
// LLM Provider Health Check
// ============================================================

import { hasProvider, getProvider } from '../services/llm/provider.js';
import { config } from '../config/index.js';
import { log } from '../logger/index.js';
import { ComponentHealth, LLMProviderHealthDetails } from './types.js';

/**
 * Check LLM provider health
 * Non-critical: Degraded state is acceptable for read-only operations
 */
export async function checkLLMProviderHealth(): Promise<ComponentHealth> {
  const startTime = Date.now();
  const lastChecked = new Date().toISOString();

  try {
    // Check if API key is configured
    const hasApiKey = !!config.OPENAI_API_KEY;

    if (!hasApiKey) {
      return {
        status: 'degraded',
        message: 'OpenAI API key not configured',
        lastChecked,
        latencyMs: Date.now() - startTime,
        details: {
          providerName: 'openai',
          hasApiKey: false,
          model: config.OPENAI_MODEL,
        } as LLMProviderHealthDetails,
      };
    }

    // Check if provider is initialized
    const isInitialized = hasProvider();

    if (!isInitialized) {
      return {
        status: 'degraded',
        message: 'LLM provider not initialized',
        lastChecked,
        latencyMs: Date.now() - startTime,
        details: {
          providerName: 'openai',
          hasApiKey: true,
          model: config.OPENAI_MODEL,
        } as LLMProviderHealthDetails,
      };
    }

    // Optional: Ping the provider with a minimal request
    // This is disabled by default to avoid costs and rate limits
    // Uncomment to enable active health checks:
    /*
    const provider = getProvider();
    await provider.complete(
      [{ role: 'user', content: 'ping' }],
      { maxTokens: 1 }
    );
    */

    return {
      status: 'healthy',
      message: 'LLM provider ready',
      lastChecked,
      latencyMs: Date.now() - startTime,
      details: {
        providerName: 'openai',
        hasApiKey: true,
        model: config.OPENAI_MODEL,
      } as LLMProviderHealthDetails,
    };
  } catch (error) {
    log.error('LLM provider health check failed', {
      err: error,
      module: 'health',
    });

    return {
      status: 'degraded',
      message:
        error instanceof Error ? error.message : 'LLM provider check failed',
      lastChecked,
      latencyMs: Date.now() - startTime,
      details: {
        providerName: 'openai',
        hasApiKey: !!config.OPENAI_API_KEY,
        model: config.OPENAI_MODEL,
      } as LLMProviderHealthDetails,
    };
  }
}
