// Provider implementations for different LLM APIs

import { ModelConfig } from '../constants/models';
import ModelClient from "@azure-rest/ai-inference";
import { AzureKeyCredential } from "@azure/core-auth";
import OpenAI from 'openai';

// Azure AI client interface
interface AzureAIClientLike {
  path(path: string): {
    post(options: { body: Record<string, unknown> }): Promise<{
      status: string;
      body: {
        choices?: Array<{ message: { content: string } }>;
        data?: Array<{ embedding: number[] }>;
        error?: string;
      };
    }>;
  };
}

// Message types for better type safety
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  choices: Array<{
    message: {
      role: 'assistant';
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ProviderClient {
  generateCompletion(messages: ChatMessage[], config: ModelConfig): Promise<ChatResponse>;
  generateEmbedding?(text: string, config: ModelConfig): Promise<number[]>;
}

/**
 * GitHub Models Provider (using Azure AI Inference SDK)
 */
export class GitHubProvider implements ProviderClient {
  private client: unknown;

  constructor(config: ModelConfig) {
    this.client = ModelClient(config.endpoint, new AzureKeyCredential(config.credential));
  }

  async generateCompletion(messages: ChatMessage[], config: ModelConfig): Promise<ChatResponse> {
    const client = this.client as AzureAIClientLike;
    const response = await client.path("/chat/completions").post({
      body: {
        messages,
        model: config.model,
        temperature: config.temperature,
        max_tokens: config.max_tokens,
        ...(config.top_p && { top_p: config.top_p })
      }
    });

    if (response.status !== "200") {
      throw new Error(`GitHub API error: ${response.body?.error || 'Unknown error'}`);
    }

    // Ensure we return the correct format
    return {
      choices: [{
        message: {
          role: 'assistant' as const,
          content: response.body.choices?.[0]?.message?.content || ''
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      }
    };
  }

  async generateEmbedding(text: string, config: ModelConfig): Promise<number[]> {
    const client = this.client as AzureAIClientLike;
    const response = await client.path("/embeddings").post({
      body: {
        model: config.model,
        input: text
      }
    });

    if (response.status !== "200") {
      throw new Error(`GitHub Embedding API error: ${response.body?.error || 'Unknown error'}`);
    }

    return response.body.data?.[0]?.embedding || [];
  }
}

/**
 * Ollama Provider for local models
 */
export class OllamaProvider implements ProviderClient {
  private baseUrl: string;

  constructor(config: ModelConfig) {
    // Extract base URL from endpoint
    const url = new URL(config.endpoint);
    this.baseUrl = `${url.protocol}//${url.host}`;
  }

  async generateCompletion(messages: ChatMessage[], config: ModelConfig): Promise<ChatResponse> {
    // Convert messages to Ollama format
    const prompt = this.convertMessagesToPrompt(messages);

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: config.temperature,
          num_predict: config.max_tokens,
          ...(config.top_p && { top_p: config.top_p })
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const result = await response.json() as {
      response: string;
      done: boolean;
      prompt_eval_count?: number;
      eval_count?: number;
    };
    
    // Convert Ollama response to OpenAI-like format
    return {
      choices: [{
        message: {
          role: 'assistant' as const,
          content: result.response || ''
        },
        finish_reason: result.done ? 'stop' : 'length'
      }],
      usage: {
        prompt_tokens: result.prompt_eval_count || 0,
        completion_tokens: result.eval_count || 0,
        total_tokens: (result.prompt_eval_count || 0) + (result.eval_count || 0)
      }
    };
  }

  async generateEmbedding(text: string, config: ModelConfig): Promise<number[]> {
    const response = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        prompt: text
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama Embedding API error: ${response.statusText}`);
    }

    const result = await response.json();
    return result.embedding;
  }

  private convertMessagesToPrompt(messages: ChatMessage[]): string {
    return messages.map(msg => {
      if (msg.role === 'system') {
        return `System: ${msg.content}`;
      } else if (msg.role === 'user') {
        return `Human: ${msg.content}`;
      } else if (msg.role === 'assistant') {
        return `Assistant: ${msg.content}`;
      }
      return msg.content;
    }).join('\n\n') + '\n\nAssistant: ';
  }
}

/**
 * OpenAI Provider
 */
export class OpenAIProvider implements ProviderClient {
  private client: OpenAI;

  constructor(config: ModelConfig) {
    this.client = new OpenAI({
      apiKey: config.credential,
      baseURL: config.endpoint.endsWith('/v1') ? config.endpoint : `${config.endpoint}/v1`
    });
  }

  async generateCompletion(messages: ChatMessage[], config: ModelConfig): Promise<ChatResponse> {
    const response = await this.client.chat.completions.create({
      model: config.model,
      messages,
      temperature: config.temperature,
      max_tokens: config.max_tokens,
      ...(config.top_p && { top_p: config.top_p })
    });

    return {
      choices: [{
        message: {
          role: 'assistant' as const,
          content: response.choices[0]?.message?.content || ''
        },
        finish_reason: response.choices[0]?.finish_reason || 'stop'
      }],
      usage: {
        prompt_tokens: response.usage?.prompt_tokens || 0,
        completion_tokens: response.usage?.completion_tokens || 0,
        total_tokens: response.usage?.total_tokens || 0
      }
    };
  }

  async generateEmbedding(text: string, config: ModelConfig): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: config.model,
      input: text
    });

    return response.data[0].embedding;
  }
}

/**
 * Anthropic Provider
 */
export class AnthropicProvider implements ProviderClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: ModelConfig) {
    this.apiKey = config.credential;
    this.baseUrl = config.endpoint;
  }

  async generateCompletion(messages: ChatMessage[], config: ModelConfig): Promise<ChatResponse> {
    // Convert OpenAI format to Anthropic format
    const systemMessage = messages.find(m => m.role === 'system');
    const userMessages = messages.filter(m => m.role !== 'system');

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.max_tokens,
        temperature: config.temperature,
        system: systemMessage?.content,
        messages: userMessages
      })
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.statusText}`);
    }

    const result = await response.json() as {
      content: Array<{ text: string }>;
      stop_reason: string;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    
    // Convert to OpenAI-like format
    return {
      choices: [{
        message: {
          role: 'assistant' as const,
          content: result.content[0]?.text || ''
        },
        finish_reason: result.stop_reason || 'stop'
      }],
      usage: {
        prompt_tokens: result.usage?.input_tokens || 0,
        completion_tokens: result.usage?.output_tokens || 0,
        total_tokens: (result.usage?.input_tokens || 0) + (result.usage?.output_tokens || 0)
      }
    };
  }
}

/**
 * Google Provider
 */
export class GoogleProvider implements ProviderClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: ModelConfig) {
    this.apiKey = config.credential;
    this.baseUrl = config.endpoint;
  }

  async generateCompletion(messages: ChatMessage[], config: ModelConfig): Promise<ChatResponse> {
    // Convert OpenAI format to Google format
    const contents = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    const response = await fetch(`${this.baseUrl}/models/${config.model}:generateContent?key=${this.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: config.temperature,
          maxOutputTokens: config.max_tokens,
          ...(config.top_p && { topP: config.top_p })
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Google API error: ${response.statusText}`);
    }

    const result = await response.json() as {
      candidates: Array<{
        content: { parts: Array<{ text: string }> };
        finishReason: string;
      }>;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
      };
    };
    
    // Convert to OpenAI-like format
    return {
      choices: [{
        message: {
          role: 'assistant' as const,
          content: result.candidates[0]?.content?.parts[0]?.text || ''
        },
        finish_reason: result.candidates[0]?.finishReason || 'stop'
      }],
      usage: {
        prompt_tokens: result.usageMetadata?.promptTokenCount || 0,
        completion_tokens: result.usageMetadata?.candidatesTokenCount || 0,
        total_tokens: result.usageMetadata?.totalTokenCount || 0
      }
    };
  }
}

/**
 * Factory function to create the appropriate provider client
 */
export function createProviderClient(config: ModelConfig): ProviderClient {
  switch (config.provider) {
    case 'github':
      return new GitHubProvider(config);
    case 'ollama':
      return new OllamaProvider(config);
    case 'openai':
      return new OpenAIProvider(config);
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'google':
      return new GoogleProvider(config);
    case 'azure':
      return new GitHubProvider(config); // Azure uses same SDK as GitHub
    default:
      throw new Error(`Unsupported provider: ${config.provider}`);
  }
}

/**
 * Helper function to check if a provider is available
 */
export async function checkProviderAvailability(config: ModelConfig): Promise<boolean> {
  try {
    switch (config.provider) {
      case 'ollama':
        const response = await fetch(`${new URL(config.endpoint).origin}/api/tags`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000) // 5 second timeout
        });
        return response.ok;
      
      case 'github':
      case 'openai':
      case 'anthropic':
      case 'google':
      case 'azure':
        return !!config.credential; // Just check if credentials are provided
      
      default:
        return false;
    }
  } catch (error) {
    console.warn(`Provider ${config.provider} is not available:`, error);
    return false;
  }
}
