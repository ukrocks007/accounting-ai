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
    model: "meta/Llama-4-Scout-17B-16E-Instruct",
    temperature: 0.8,
    top_p: 0.1,
    max_tokens: 4096,
    endpoint: "https://models.github.ai/inference",
    credential: process.env["GITHUB_TOKEN"] || ""
  } as ModelConfig,

  // Configuration for chat conversations
  CHAT_ASSISTANT: {
    model: "meta/Llama-4-Scout-17B-16E-Instruct",
    temperature: 0.1,
    max_tokens: 4096,
    endpoint: "https://models.github.ai/inference",
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
export function getModelConfig(configName: 'UPLOAD_PROCESSOR' | 'CHAT_ASSISTANT'): ModelConfig {
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
export function getActiveModelConfig(apiType: 'upload' | 'chat'): ModelConfig {
  const envModelOverride = process.env[`${apiType.toUpperCase()}_MODEL`];
  
  if (envModelOverride && envModelOverride in MODEL_CONFIGS.ALTERNATIVE_MODELS) {
    return MODEL_CONFIGS.ALTERNATIVE_MODELS[envModelOverride as keyof typeof MODEL_CONFIGS.ALTERNATIVE_MODELS];
  }
  
  return apiType === 'upload' 
    ? MODEL_CONFIGS.UPLOAD_PROCESSOR 
    : MODEL_CONFIGS.CHAT_ASSISTANT;
}
