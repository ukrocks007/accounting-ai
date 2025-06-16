// Utility functions for model management

import { MODEL_CONFIGS, ModelConfig, getActiveModelConfig } from '../constants/models';
import ModelClient from "@azure-rest/ai-inference";
import { AzureKeyCredential } from "@azure/core-auth";

/**
 * Create a configured model client for a specific API type
 */
export function createModelClient(apiType: 'upload' | 'chat' | 'embedding') {
  const config = getActiveModelConfig(apiType);
  return ModelClient(config.endpoint, new AzureKeyCredential(config.credential));
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
    available: Object.keys(MODEL_CONFIGS.ALTERNATIVE_MODELS)
  };
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
    temperature: config.temperature,
    max_tokens: config.max_tokens,
    endpoint: config.endpoint,
    hasCredential: !!config.credential
  };
}
