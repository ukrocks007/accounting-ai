/**
 * Gemini AI SDK Configuration and Utilities
 */

import { GoogleGenerativeAI, GenerativeModel, SafetySetting, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { ModelConfig } from '../constants/models';

export interface GeminiConfig {
  apiKey: string;
  model: string;
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;
  safetySettings?: SafetySetting[];
}

export class GeminiClient {
  private genAI: GoogleGenerativeAI;
  private config: GeminiConfig;

  constructor(config: GeminiConfig) {
    this.config = config;
    this.genAI = new GoogleGenerativeAI(config.apiKey);
  }

  /**
   * Get a configured Gemini model instance
   */
  getModel(options?: {
    systemInstruction?: string;
    tools?: any[];
  }): GenerativeModel {
    const generationConfig = {
      temperature: this.config.temperature || 0.7,
      maxOutputTokens: this.config.maxOutputTokens || 8192,
      ...(this.config.topP && { topP: this.config.topP }),
      ...(this.config.topK && { topK: this.config.topK })
    };

    const safetySettings: SafetySetting[] = this.config.safetySettings || [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
    ];

    const modelParams: any = {
      model: this.config.model,
      generationConfig,
      safetySettings,
    };

    if (options?.systemInstruction) {
      modelParams.systemInstruction = options.systemInstruction;
    }

    if (options?.tools) {
      modelParams.tools = options.tools;
    }

    return this.genAI.getGenerativeModel(modelParams);
  }

  /**
   * Create Gemini client from ModelConfig
   */
  static fromModelConfig(config: ModelConfig): GeminiClient {
    return new GeminiClient({
      apiKey: config.credential,
      model: config.model,
      temperature: config.temperature,
      maxOutputTokens: config.max_tokens,
      topP: config.top_p
    });
  }

  /**
   * Get available Gemini models
   */
  static getAvailableModels(): string[] {
    return [
      'gemini-2.0-flash',
      'gemini-pro-vision' // For multimodal tasks
    ];
  }

  /**
   * Validate API key
   */
  async validateApiKey(): Promise<boolean> {
    try {
      const model = this.getModel();
      console.log("Validating Gemini API key...", model);
      const result = await model.generateContent('Hello');
      return !!result.response.text();
    } catch (error) {
      console.error('Gemini API key validation failed:', error);
      return false;
    }
  }

  /**
   * Get model info
   */
  async getModelInfo(): Promise<any> {
    try {
      // Note: This is a placeholder as the SDK doesn't have a direct method for model info
      return {
        model: this.config.model,
        maxTokens: this.config.maxOutputTokens,
        temperature: this.config.temperature
      };
    } catch (error) {
      console.error('Failed to get model info:', error);
      throw error;
    }
  }
}

/**
 * Default system instructions for different use cases
 */
export const GEMINI_SYSTEM_INSTRUCTIONS = {
  ACCOUNTING_ASSISTANT: `You are an AI accounting assistant specialized in financial data analysis and document processing. 
You help users analyze financial statements, transaction data, and generate insights about their financial information.
Always be accurate, professional, and provide clear explanations for your analysis.`,

  DOCUMENT_PROCESSOR: `You are a document processing AI that extracts and structures information from financial documents.
Focus on accuracy and maintaining data integrity when parsing documents like bank statements, invoices, and receipts.`,

  CHAT_ASSISTANT: `You are a helpful AI assistant for an accounting application. 
Provide clear, accurate responses about financial topics and help users understand their financial data.
If you're unsure about something, ask for clarification rather than making assumptions.`
};

/**
 * Helper function to create a configured Gemini client for different use cases
 */
export function createGeminiClient(
  useCase: 'upload' | 'chat' | 'embedding' | 'analysis',
  customConfig?: Partial<GeminiConfig>
): GeminiClient {
  const apiKey = process.env.GOOGLE_API_KEY || '';
  
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY environment variable is required for Gemini');
  }

  const baseConfigs = {
    upload: {
      model: 'gemini-2.0-flash',
      temperature: 0.3,
      maxOutputTokens: 8192
    },
    chat: {
      model: 'gemini-2.0-flash',
      temperature: 0.7,
      maxOutputTokens: 8192
    },
    embedding: {
      model: 'gemini-2.0-flash',
      temperature: 0,
      maxOutputTokens: 1024
    },
    analysis: {
      model: 'gemini-2.0-flash',
      temperature: 0.1,
      maxOutputTokens: 8192
    }
  };

  const config: GeminiConfig = {
    apiKey,
    ...baseConfigs[useCase],
    ...customConfig
  };

  return new GeminiClient(config);
}
