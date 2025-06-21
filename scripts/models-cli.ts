#!/usr/bin/env node

// CLI utility to test and manage LLM providers

import { 
  listAvailableModels, 
  checkAllProvidersAvailability, 
  getOllamaModels,
  generateCompletion,
  generateEmbedding,
  getModelInfo
} from '../src/utils/modelUtils';
import { MODEL_CONFIGS } from '../src/constants/models';
import { ChatMessage } from '../src/utils/providers';

async function main() {
  const command = process.argv[2];
  
  switch (command) {
    case 'list':
      await listModels();
      break;
    case 'check':
      await checkProviders();
      break;
    case 'ollama':
      await listOllamaModels();
      break;
    case 'test':
      const provider = process.argv[3];
      await testProvider(provider);
      break;
    case 'info':
      const apiType = process.argv[3] as 'upload' | 'chat' | 'embedding' || 'chat';
      showModelInfo(apiType);
      break;
    default:
      showHelp();
  }
}

function showHelp() {
  console.log(`
LLM Provider Management CLI

Usage:
  npm run models <command> [options]

Commands:
  list              List all available model configurations
  check             Check availability of all providers
  ollama            List available Ollama models
  test <provider>   Test a specific provider (github, ollama, openai, etc.)
  info <api_type>   Show info for current model (upload, chat, embedding)

Examples:
  npm run models list
  npm run models check
  npm run models test ollama
  npm run models info chat

Environment Variables:
  GITHUB_TOKEN      - GitHub Models API token
  OLLAMA_ENDPOINT   - Ollama endpoint (default: http://localhost:11434/api/generate)
  OPENAI_API_KEY    - OpenAI API key
  ANTHROPIC_API_KEY - Anthropic API key
  GOOGLE_API_KEY    - Google API key
  `);
}

async function listModels() {
  console.log('📋 Available Model Configurations:\n');
  
  const models = listAvailableModels();
  
  console.log('🎯 Active Models:');
  Object.entries(models.active).forEach(([type, config]) => {
    console.log(`  ${type}: ${config.model} (${config.provider})`);
  });
  
  console.log('\n📦 Available Models by Provider:');
  Object.entries(models.providers).forEach(([provider, modelKeys]) => {
    if (modelKeys.length > 0) {
      console.log(`  ${provider}:`);
      modelKeys.forEach(key => {
        const config = MODEL_CONFIGS.ALTERNATIVE_MODELS[key as keyof typeof MODEL_CONFIGS.ALTERNATIVE_MODELS];
        console.log(`    - ${key}: ${config.model}`);
      });
    }
  });
}

async function checkProviders() {
  console.log('🔍 Checking Provider Availability...\n');
  
  const availability = await checkAllProvidersAvailability();
  
  Object.entries(availability).forEach(([provider, available]) => {
    const status = available ? '✅' : '❌';
    console.log(`${status} ${provider}: ${available ? 'Available' : 'Not available'}`);
  });
  
  console.log('\n💡 Tips:');
  if (!availability.ollama) {
    console.log('  - To use Ollama: Install and start Ollama (https://ollama.ai)');
  }
  if (!availability.github) {
    console.log('  - To use GitHub Models: Set GITHUB_TOKEN environment variable');
  }
  if (!availability.openai) {
    console.log('  - To use OpenAI: Set OPENAI_API_KEY environment variable');
  }
}

async function listOllamaModels() {
  console.log('🦙 Ollama Models:\n');
  
  try {
    const models = await getOllamaModels();
    
    if (models.length === 0) {
      console.log('❌ No Ollama models found. Make sure Ollama is running and has models installed.');
      console.log('\n💡 To install models:');
      console.log('  ollama pull llama3.2');
      console.log('  ollama pull mistral');
      console.log('  ollama pull codellama');
    } else {
      console.log('📦 Available models:');
      models.forEach(model => {
        console.log(`  - ${model}`);
      });
      
      console.log('\n💡 To use a model, update your environment or model config.');
    }
  } catch (error) {
    console.error('❌ Failed to connect to Ollama:', error);
    console.log('\n💡 Make sure Ollama is running: ollama serve');
  }
}

async function testProvider(provider: string) {
  if (!provider) {
    console.error('❌ Please specify a provider to test');
    return;
  }
  
  console.log(`🧪 Testing ${provider} provider...\n`);
  
  // Find a model config for this provider
  const modelKey = Object.keys(MODEL_CONFIGS.ALTERNATIVE_MODELS).find(key =>
    MODEL_CONFIGS.ALTERNATIVE_MODELS[key as keyof typeof MODEL_CONFIGS.ALTERNATIVE_MODELS].provider === provider
  );
  
  if (!modelKey) {
    console.error(`❌ No model configuration found for provider: ${provider}`);
    return;
  }
  
  // Temporarily override the environment to use this model
  const originalEnv = process.env.CHAT_MODEL;
  process.env.CHAT_MODEL = modelKey;
  
  try {
    const testMessages: ChatMessage[] = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Say "Hello from " followed by your model name in exactly 5 words.' }
    ];
    
    console.log('📤 Sending test message...');
    const response = await generateCompletion(testMessages, 'chat');
    
    console.log('✅ Response received:');
    console.log(`💬 ${response.choices[0].message.content}`);
    
    if (response.usage) {
      console.log(`📊 Tokens: ${response.usage.total_tokens} (${response.usage.prompt_tokens} prompt + ${response.usage.completion_tokens} completion)`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Restore original environment
    if (originalEnv) {
      process.env.CHAT_MODEL = originalEnv;
    } else {
      delete process.env.CHAT_MODEL;
    }
  }
}

function showModelInfo(apiType: 'upload' | 'chat' | 'embedding') {
  console.log(`ℹ️  Current ${apiType} model configuration:\n`);
  
  const info = getModelInfo(apiType);
  
  Object.entries(info).forEach(([key, value]) => {
    const displayKey = key.replace(/([A-Z])/g, ' $1').toLowerCase();
    console.log(`  ${displayKey}: ${value}`);
  });
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the CLI
main().catch(console.error);
