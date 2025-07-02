// Model configuration constants for LLM API calls

export type ProviderType = 'github' | 'ollama' | 'openai' | 'anthropic' | 'google' | 'azure';

export interface ModelConfig {
  model: string;
  temperature: number;
  top_p?: number;
  max_tokens: number;
  endpoint: string;
  credential: string;
  provider: ProviderType;
  apiVersion?: string; // For Azure and other providers that need versioning
  streaming?: boolean; // Whether the provider supports streaming
}

// Default model configurations for different API endpoints
export const MODEL_CONFIGS = {
  // Configuration for file upload processing
  UPLOAD_PROCESSOR: {
    model: "llama3:8b",
    temperature: 0.8,
    top_p: 0.1,
    max_tokens: 4096,
    endpoint: process.env.OLLAMA_ENDPOINT || "http://localhost:11434",
    credential: "", // Ollama doesn't require credentials
    provider: "ollama" as ProviderType,
    streaming: false // Set to false for more reliable processing
  } as ModelConfig,

  // Configuration for chat conversations
  CHAT_ASSISTANT: {
    model: "openai/gpt-4.1",
    temperature: 0.1,
    max_tokens: 4096,
    endpoint: "https://models.github.ai/inference",
    credential: process.env["GITHUB_TOKEN"] || "",
    provider: "github" as ProviderType,
    streaming: true
  } as ModelConfig,

  // Configuration for embedding generation
  EMBEDDING_PROCESSOR: {
    model: process.env.EMBEDDING_MODEL || "text-embedding-3-small",
    temperature: 0,
    max_tokens: 8191, // Max tokens for embeddings
    endpoint: process.env.EMBEDDING_ENDPOINT || "https://models.inference.ai.azure.com",
    credential: process.env["GITHUB_TOKEN"] || "",
    provider: "github" as ProviderType,
    streaming: false
  } as ModelConfig,

  // Alternative model configurations (can be switched by changing the active config)
  ALTERNATIVE_MODELS: {
    // GitHub Models
    GITHUB_GPT_4O: {
      model: "gpt-4o",
      temperature: 0.7,
      max_tokens: 4096,
      endpoint: "https://models.github.ai/inference",
      credential: process.env["GITHUB_TOKEN"] || "",
      provider: "github" as ProviderType,
      streaming: true
    } as ModelConfig,

    GITHUB_CLAUDE_3_5_SONNET: {
      model: "Anthropic/claude-3-5-sonnet-20241022",
      temperature: 0.7,
      max_tokens: 4096,
      endpoint: "https://models.github.ai/inference",
      credential: process.env["GITHUB_TOKEN"] || "",
      provider: "github" as ProviderType,
      streaming: true
    } as ModelConfig,

    // Local Ollama Models
    OLLAMA_LLAMA_3_2: {
      model: "llama3.2",
      temperature: 0.7,
      max_tokens: 4096,
      endpoint: process.env.OLLAMA_ENDPOINT || "http://localhost:11434/api/generate",
      credential: "", // Ollama doesn't require credentials for local instances
      provider: "ollama" as ProviderType,
      streaming: true
    } as ModelConfig,

    OLLAMA_MISTRAL: {
      model: "mistral",
      temperature: 0.7,
      max_tokens: 4096,
      endpoint: process.env.OLLAMA_ENDPOINT || "http://localhost:11434/api/generate",
      credential: "",
      provider: "ollama" as ProviderType,
      streaming: true
    } as ModelConfig,

    OLLAMA_CODELLAMA: {
      model: "codellama",
      temperature: 0.3,
      max_tokens: 4096,
      endpoint: process.env.OLLAMA_ENDPOINT || "http://localhost:11434/api/generate",
      credential: "",
      provider: "ollama" as ProviderType,
      streaming: true
    } as ModelConfig,

    OLLAMA_QWEN: {
      model: "qwen2.5",
      temperature: 0.7,
      max_tokens: 4096,
      endpoint: process.env.OLLAMA_ENDPOINT || "http://localhost:11434/api/generate",
      credential: "",
      provider: "ollama" as ProviderType,
      streaming: true
    } as ModelConfig,

    // OpenAI Direct
    GPT_4: {
      model: "gpt-4",
      temperature: 0.7,
      max_tokens: 4096,
      endpoint: "https://api.openai.com/v1",
      credential: process.env["OPENAI_API_KEY"] || "",
      provider: "openai" as ProviderType,
      streaming: true
    } as ModelConfig,

    GPT_4O: {
      model: "gpt-4o",
      temperature: 0.7,
      max_tokens: 4096,
      endpoint: "https://api.openai.com/v1",
      credential: process.env["OPENAI_API_KEY"] || "",
      provider: "openai" as ProviderType,
      streaming: true
    } as ModelConfig,
    
    // Anthropic Direct
    CLAUDE: {
      model: "claude-3-sonnet-20240229",
      temperature: 0.7,
      max_tokens: 4096,
      endpoint: "https://api.anthropic.com/v1",
      credential: process.env["ANTHROPIC_API_KEY"] || "",
      provider: "anthropic" as ProviderType,
      streaming: true
    } as ModelConfig,
    
    CLAUDE_3_5_SONNET: {
      model: "claude-3-5-sonnet-20241022",
      temperature: 0.7,
      max_tokens: 4096,
      endpoint: "https://api.anthropic.com/v1",
      credential: process.env["ANTHROPIC_API_KEY"] || "",
      provider: "anthropic" as ProviderType,
      streaming: true
    } as ModelConfig,
    
    // Google Gemini Models
    GEMINI: {
      model: "gemini-2.0-flash",
      temperature: 0.7,
      max_tokens: 8192,
      endpoint: "https://generativelanguage.googleapis.com/v1",
      credential: process.env["GOOGLE_API_KEY"] || "",
      provider: "google" as ProviderType,
      streaming: true
    } as ModelConfig,

    GEMINI_2_5_FLASH: {
      model: "gemini-2.5-flash",
      temperature: 0.7,
      max_tokens: 8192,
      endpoint: "https://generativelanguage.googleapis.com/v1",
      credential: process.env["GOOGLE_API_KEY"] || "",
      provider: "google" as ProviderType,
      streaming: true
    } as ModelConfig,

    GEMINI_2_5_PRO: {
      model: "gemini-2.5-pro",
      temperature: 0.7,
      max_tokens: 8192,
      endpoint: "https://generativelanguage.googleapis.com/v1",
      credential: process.env["GOOGLE_API_KEY"] || "",
      provider: "google" as ProviderType,
      streaming: true
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
