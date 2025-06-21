// Utility functions for model management

import { MODEL_CONFIGS, ModelConfig, getActiveModelConfig, ProviderType } from '../constants/models';
import ModelClient from "@azure-rest/ai-inference";
import { AzureKeyCredential } from "@azure/core-auth";
import { createProviderClient, checkProviderAvailability, ProviderClient } from './providers';
import { ChatMessage, ChatResponse } from './providers';

/**
 * Create a configured model client for a specific API type
 * @deprecated Use createProviderClient instead for better provider support
 */
export function createModelClient(apiType: 'upload' | 'chat' | 'embedding') {
  const config = getActiveModelConfig(apiType);
  
  // For backward compatibility, only support GitHub/Azure providers
  if (config.provider !== 'github' && config.provider !== 'azure') {
    console.warn(`Legacy createModelClient doesn't support ${config.provider} provider. Use createUniversalClient instead.`);
  }
  
  return ModelClient(config.endpoint, new AzureKeyCredential(config.credential));
}

/**
 * Create a universal client that supports all providers
 */
export function createUniversalClient(apiType: 'upload' | 'chat' | 'embedding'): ProviderClient {
  const config = getActiveModelConfig(apiType);
  return createProviderClient(config);
}

/**
 * Get model request parameters for a specific API type
 */
export function getModelRequestParams(apiType: 'upload' | 'chat' | 'embedding') {
  const config = getActiveModelConfig(apiType);
  return {
    model: config.model,
    temperature: config.temperature,
    max_tokens: config.max_tokens,
    ...(config.top_p && { top_p: config.top_p })
  };
}

/**
 * List all available model configurations
 */
export function listAvailableModels() {
  return {
    active: {
      upload: getActiveModelConfig('upload'),
      chat: getActiveModelConfig('chat'),
      embedding: getActiveModelConfig('embedding')
    },
    available: Object.keys(MODEL_CONFIGS.ALTERNATIVE_MODELS),
    providers: {
      github: Object.keys(MODEL_CONFIGS.ALTERNATIVE_MODELS).filter(key => 
        MODEL_CONFIGS.ALTERNATIVE_MODELS[key as keyof typeof MODEL_CONFIGS.ALTERNATIVE_MODELS].provider === 'github'),
      ollama: Object.keys(MODEL_CONFIGS.ALTERNATIVE_MODELS).filter(key => 
        MODEL_CONFIGS.ALTERNATIVE_MODELS[key as keyof typeof MODEL_CONFIGS.ALTERNATIVE_MODELS].provider === 'ollama'),
      openai: Object.keys(MODEL_CONFIGS.ALTERNATIVE_MODELS).filter(key => 
        MODEL_CONFIGS.ALTERNATIVE_MODELS[key as keyof typeof MODEL_CONFIGS.ALTERNATIVE_MODELS].provider === 'openai'),
      anthropic: Object.keys(MODEL_CONFIGS.ALTERNATIVE_MODELS).filter(key => 
        MODEL_CONFIGS.ALTERNATIVE_MODELS[key as keyof typeof MODEL_CONFIGS.ALTERNATIVE_MODELS].provider === 'anthropic'),
      google: Object.keys(MODEL_CONFIGS.ALTERNATIVE_MODELS).filter(key => 
        MODEL_CONFIGS.ALTERNATIVE_MODELS[key as keyof typeof MODEL_CONFIGS.ALTERNATIVE_MODELS].provider === 'google')
    }
  };
}

/**
 * Check availability of all configured providers
 */
export async function checkAllProvidersAvailability(): Promise<Record<ProviderType, boolean>> {
  const providers: ProviderType[] = ['github', 'ollama', 'openai', 'anthropic', 'google', 'azure'];
  const results: Record<ProviderType, boolean> = {} as Record<ProviderType, boolean>;

  for (const provider of providers) {
    // Find a model config for this provider
    const modelKey = Object.keys(MODEL_CONFIGS.ALTERNATIVE_MODELS).find(key =>
      MODEL_CONFIGS.ALTERNATIVE_MODELS[key as keyof typeof MODEL_CONFIGS.ALTERNATIVE_MODELS].provider === provider
    );

    if (modelKey) {
      const config = MODEL_CONFIGS.ALTERNATIVE_MODELS[modelKey as keyof typeof MODEL_CONFIGS.ALTERNATIVE_MODELS];
      results[provider] = await checkProviderAvailability(config);
    } else {
      // Check default configs
      const defaultConfigs = [MODEL_CONFIGS.UPLOAD_PROCESSOR, MODEL_CONFIGS.CHAT_ASSISTANT, MODEL_CONFIGS.EMBEDDING_PROCESSOR];
      const defaultConfig = defaultConfigs.find(config => config.provider === provider);
      
      if (defaultConfig) {
        results[provider] = await checkProviderAvailability(defaultConfig);
      } else {
        results[provider] = false;
      }
    }
  }

  return results;
}

/**
 * Get available Ollama models from local instance
 */
export async function getOllamaModels(): Promise<string[]> {
  try {
    const ollamaConfig = MODEL_CONFIGS.ALTERNATIVE_MODELS.OLLAMA_LLAMA_3_2;
    const baseUrl = new URL(ollamaConfig.endpoint).origin;
    
    const response = await fetch(`${baseUrl}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Ollama models: ${response.statusText}`);
    }

    const data = await response.json() as { models?: Array<{ name: string }> };
    return data.models?.map((model) => model.name) || [];
  } catch (error: unknown) {
    console.warn('Failed to fetch Ollama models:', error);
    return [];
  }
}

/**
 * Validate if a model configuration is properly set up
 */
export function validateModelConfig(config: ModelConfig): boolean {
  return !!(
    config.model &&
    config.endpoint &&
    config.credential &&
    config.temperature !== undefined &&
    config.max_tokens
  );
}

/**
 * Get model info for logging/debugging
 */
export function getModelInfo(apiType: 'upload' | 'chat' | 'embedding') {
  const config = getActiveModelConfig(apiType);
  return {
    apiType,
    model: config.model,
    provider: config.provider,
    temperature: config.temperature,
    max_tokens: config.max_tokens,
    endpoint: config.endpoint,
    hasCredential: !!config.credential,
    streaming: config.streaming || false
  };
}

/**
 * Generate completion using the universal provider system
 */
export async function generateCompletion(
  messages: ChatMessage[], 
  apiType: 'upload' | 'chat' | 'embedding' = 'chat'
): Promise<ChatResponse> {
  const client = createUniversalClient(apiType);
  const config = getActiveModelConfig(apiType);
  
  try {
    return await client.generateCompletion(messages, config);
  } catch (error: unknown) {
    console.error(`Error generating completion with ${config.provider} provider:`, error);
    throw error;
  }
}

/**
 * Generate embedding using the universal provider system
 */
export async function generateEmbedding(
  text: string, 
  apiType: 'embedding' = 'embedding'
): Promise<number[]> {
  const client = createUniversalClient(apiType);
  const config = getActiveModelConfig(apiType);
  
  if (!client.generateEmbedding) {
    throw new Error(`Provider ${config.provider} does not support embedding generation`);
  }
  
  try {
    return await client.generateEmbedding(text, config);
  } catch (error) {
    console.error(`Error generating embedding with ${config.provider} provider:`, error);
    throw error;
  }
}
