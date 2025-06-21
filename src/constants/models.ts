// Model configuration constants for LLM API calls

export interface ModelConfig {
  model: string;
  temperature: number;
  top_p?: number;
  max_tokens: number;
  endpoint: string;
  credential: string;
}

// Default model configurations for different API endpoints
export const MODEL_CONFIGS = {
  // Configuration for file upload processing
  UPLOAD_PROCESSOR: {
    model: "meta/Llama-3.3-70B-Instruct",
    temperature: 0.8,
    top_p: 0.1,
    max_tokens: 4096,
    endpoint: "https://models.github.ai/inference",
    credential: process.env["GITHUB_TOKEN"] || ""
  } as ModelConfig,

  // Configuration for chat conversations
  CHAT_ASSISTANT: {
    model: "meta/Llama-3.3-70B-Instruct",
    temperature: 0.1,
    max_tokens: 4096,
    endpoint: "https://models.github.ai/inference",
    credential: process.env["GITHUB_TOKEN"] || ""
  } as ModelConfig,

  // Configuration for embedding generation
  EMBEDDING_PROCESSOR: {
    model: process.env.EMBEDDING_MODEL || "text-embedding-3-small",
    temperature: 0,
    max_tokens: 8191, // Max tokens for embeddings
    endpoint: process.env.EMBEDDING_ENDPOINT || "https://models.inference.ai.azure.com",
    credential: process.env["GITHUB_TOKEN"] || ""
  } as ModelConfig,

  // Alternative model configurations (can be switched by changing the active config)
  ALTERNATIVE_MODELS: {
    GPT_4: {
      model: "gpt-4",
      temperature: 0.7,
      max_tokens: 4096,
      endpoint: "https://api.openai.com/v1",
      credential: process.env["OPENAI_API_KEY"] || ""
    } as ModelConfig,
    
    CLAUDE: {
      model: "claude-3-sonnet-20240229",
      temperature: 0.7,
      max_tokens: 4096,
      endpoint: "https://api.anthropic.com/v1",
      credential: process.env["ANTHROPIC_API_KEY"] || ""
    } as ModelConfig,
    
    GEMINI: {
      model: "gemini-pro",
      temperature: 0.7,
      max_tokens: 4096,
      endpoint: "https://generativelanguage.googleapis.com/v1",
      credential: process.env["GOOGLE_API_KEY"] || ""
    } as ModelConfig
  }
} as const;

// Helper function to get model config by name
export function getModelConfig(configName: 'UPLOAD_PROCESSOR' | 'CHAT_ASSISTANT' | 'EMBEDDING_PROCESSOR'): ModelConfig {
  return MODEL_CONFIGS[configName];
}

// Helper function to create model client with config
export function createModelClientConfig(config: ModelConfig) {
  return {
    endpoint: config.endpoint,
    credential: config.credential,
    requestOptions: {
      model: config.model,
      temperature: config.temperature,
      max_tokens: config.max_tokens,
      ...(config.top_p && { top_p: config.top_p })
    }
  };
}

// Environment-based model selection
export function getActiveModelConfig(apiType: 'upload' | 'chat' | 'embedding'): ModelConfig {
  const envModelOverride = process.env[`${apiType.toUpperCase()}_MODEL`];
  
  if (envModelOverride && envModelOverride in MODEL_CONFIGS.ALTERNATIVE_MODELS) {
    return MODEL_CONFIGS.ALTERNATIVE_MODELS[envModelOverride as keyof typeof MODEL_CONFIGS.ALTERNATIVE_MODELS];
  }
  
  switch (apiType) {
    case 'upload':
      return MODEL_CONFIGS.UPLOAD_PROCESSOR;
    case 'chat':
      return MODEL_CONFIGS.CHAT_ASSISTANT;
    case 'embedding':
      return MODEL_CONFIGS.EMBEDDING_PROCESSOR;
    default:
      return MODEL_CONFIGS.CHAT_ASSISTANT;
  }
}
