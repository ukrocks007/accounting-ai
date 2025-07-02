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
        choices?: Array<{ 
          message: { 
            content: string | null; 
            tool_calls?: Array<{
              id: string;
              type: 'function';
              function: {
                name: string;
                arguments: string;
              };
            }>;
          }; 
          finish_reason?: string;
        }>;
        data?: Array<{ embedding: number[] }>;
        error?: string;
      };
    }>;
  };
}

// Message types for better type safety
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatResponse {
  choices: Array<{
    message: {
      role: 'assistant';
      content: string | null;
      tool_calls?: ToolCall[];
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface LLMTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: string;
      properties: Record<string, unknown>;
      required: string[];
    };
  };
}

export interface GenerateCompletionOptions {
  tools?: LLMTool[];
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
}

export interface ProviderClient {
  generateCompletion(messages: ChatMessage[], config: ModelConfig, options?: GenerateCompletionOptions): Promise<ChatResponse>;
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

  async generateCompletion(messages: ChatMessage[], config: ModelConfig, options?: GenerateCompletionOptions): Promise<ChatResponse> {
    const client = this.client as AzureAIClientLike;
    
    const requestBody: Record<string, unknown> = {
      messages,
      model: config.model,
      temperature: config.temperature,
      max_tokens: config.max_tokens,
      ...(config.top_p && { top_p: config.top_p })
    };

    // Add tool support
    if (options?.tools) {
      requestBody.tools = options.tools;
      if (options.tool_choice) {
        requestBody.tool_choice = options.tool_choice;
      }
    }

    const response = await client.path("/chat/completions").post({
      body: requestBody
    });

    if (response.status !== "200") {
      throw new Error(`GitHub API error: ${response.body?.error || 'Unknown error'}`);
    }

    const choice = response.body.choices?.[0];
    const message = choice?.message;

    // Handle tool calls if present
    let toolCalls: ToolCall[] | undefined;
    if (message?.tool_calls) {
      toolCalls = message.tool_calls.map((tc: any) => ({
        id: tc.id,
        type: 'function' as const,
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments
        }
      }));
    }

    // Ensure we return the correct format
    return {
      choices: [{
        message: {
          role: 'assistant' as const,
          content: message?.content || null,
          ...(toolCalls && { tool_calls: toolCalls })
        },
        finish_reason: choice?.finish_reason || 'stop'
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

  async generateCompletion(messages: ChatMessage[], config: ModelConfig, options?: GenerateCompletionOptions): Promise<ChatResponse> {
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
    // Note: Ollama doesn't support tools natively, so we return basic response
    return {
      choices: [{
        message: {
          role: 'assistant' as const,
          content: result.response || null
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

  async generateCompletion(messages: ChatMessage[], config: ModelConfig, options?: GenerateCompletionOptions): Promise<ChatResponse> {
    // Convert our ChatMessage format to OpenAI format
    const openAIMessages = messages.map(msg => {
      if (msg.role === 'tool') {
        return {
          role: 'tool' as const,
          content: msg.content,
          tool_call_id: msg.tool_call_id!
        };
      } else if (msg.role === 'assistant' && msg.tool_calls) {
        return {
          role: 'assistant' as const,
          content: msg.content,
          tool_calls: msg.tool_calls
        };
      }
      return {
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content
      };
    });

    const requestParams: any = {
      model: config.model,
      messages: openAIMessages,
      temperature: config.temperature,
      max_tokens: config.max_tokens,
      ...(config.top_p && { top_p: config.top_p })
    };

    // Add tool support
    if (options?.tools) {
      requestParams.tools = options.tools;
      if (options.tool_choice) {
        requestParams.tool_choice = options.tool_choice;
      }
    }

    const response = await this.client.chat.completions.create(requestParams);

    // Convert tool calls if present
    let toolCalls: ToolCall[] | undefined;
    if (response.choices[0]?.message?.tool_calls) {
      toolCalls = response.choices[0].message.tool_calls.map(tc => ({
        id: tc.id,
        type: 'function' as const,
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments
        }
      }));
    }

    return {
      choices: [{
        message: {
          role: 'assistant' as const,
          content: response.choices[0]?.message?.content || null,
          ...(toolCalls && { tool_calls: toolCalls })
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

  async generateCompletion(messages: ChatMessage[], config: ModelConfig, options?: GenerateCompletionOptions): Promise<ChatResponse> {
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
    // Note: Anthropic doesn't support tools in the same way, so we return basic response
    return {
      choices: [{
        message: {
          role: 'assistant' as const,
          content: result.content[0]?.text || null
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
 * Google Provider using official Gemini SDK
 */
import { GoogleGenerativeAI, GenerativeModel, GenerationConfig } from '@google/generative-ai';

export class GoogleProvider implements ProviderClient {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor(config: ModelConfig) {
    this.genAI = new GoogleGenerativeAI(config.credential);
    
    const generationConfig: GenerationConfig = {
      temperature: config.temperature,
      maxOutputTokens: config.max_tokens,
      ...(config.top_p && { topP: config.top_p })
    };

    this.model = this.genAI.getGenerativeModel({ 
      model: config.model,
      generationConfig
    });
  }

  async generateCompletion(messages: ChatMessage[], config: ModelConfig, options?: GenerateCompletionOptions): Promise<ChatResponse> {
    try {
      // Convert messages to Gemini format
      const history = messages.slice(0, -1).map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));

      const lastMessage = messages[messages.length - 1];
      
      // Start chat session with history
      const chat = this.model.startChat({
        history: history.length > 0 ? history : undefined
      });

      // Generate content
      const result = await chat.sendMessage(lastMessage.content);
      const response = await result.response;
      const text = response.text();

      return {
        choices: [{
          message: {
            role: 'assistant' as const,
            content: text
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 0, // Gemini doesn't provide detailed token counts in free tier
          completion_tokens: 0,
          total_tokens: 0
        }
      };
    } catch (error) {
      console.error('Google Provider Error:', error);
      throw new Error(`Google Gemini API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateCompletionWithTools(messages: ChatMessage[], tools: any[], config: ModelConfig, options?: GenerateCompletionOptions): Promise<ChatResponse> {
    try {
      // For tool usage, we'll use function calling if available
      const functionDeclarations = tools.map(tool => ({
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters
      }));

      const toolConfig = { functionDeclarations };
      
      // Create model with tools
      const modelWithTools = this.genAI.getGenerativeModel({ 
        model: config.model,
        tools: [toolConfig],
        generationConfig: {
          temperature: config.temperature,
          maxOutputTokens: config.max_tokens,
          ...(config.top_p && { topP: config.top_p })
        }
      });

      const history = messages.slice(0, -1).map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));

      const lastMessage = messages[messages.length - 1];
      
      const chat = modelWithTools.startChat({
        history: history.length > 0 ? history : undefined
      });

      const result = await chat.sendMessage(lastMessage.content);
      const response = await result.response;

      // Check for function calls
      const functionCalls = response.functionCalls();
      
      if (functionCalls && functionCalls.length > 0) {
        return {
          choices: [{
            message: {
              role: 'assistant' as const,
              content: null,
              tool_calls: functionCalls.map((call, index) => ({
                id: `call_${index}`,
                type: 'function' as const,
                function: {
                  name: call.name,
                  arguments: JSON.stringify(call.args)
                }
              }))
            },
            finish_reason: 'tool_calls'
          }],
          usage: {
            prompt_tokens: 0, // Gemini SDK doesn't provide detailed token counts consistently
            completion_tokens: 0,
            total_tokens: 0
          }
        };
      }

      // Regular text response
      const text = response.text();
      return {
        choices: [{
          message: {
            role: 'assistant' as const,
            content: text
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        }
      };
    } catch (error) {
      console.error('Google Provider Tool Error:', error);
      throw new Error(`Google Gemini API tool error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
