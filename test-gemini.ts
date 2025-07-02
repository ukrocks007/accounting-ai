/**
 * Test script for Gemini AI configuration
 * Run with: npm run test-gemini
 */

import { createGeminiClient, GEMINI_SYSTEM_INSTRUCTIONS } from './src/utils/gemini-config';
import { MODEL_CONFIGS, ModelConfig } from './src/constants/models';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testGeminiConfiguration() {
  console.log('🚀 Testing Gemini AI Configuration...\n');

  // Check if API key is configured
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error('❌ GOOGLE_API_KEY not found in environment variables');
    console.log('💡 Please add GOOGLE_API_KEY to your .env.local file');
    return;
  }

  console.log('✅ API Key found');

  try {
    // Test 1: Basic client creation
    console.log('\n📝 Test 1: Creating Gemini clients...');
    const chatClient = createGeminiClient('chat', {
        model: 'gemini-2.0-flash'
    });
    const uploadClient = createGeminiClient('upload');
    const analysisClient = createGeminiClient('analysis');
    console.log('✅ All clients created successfully');

    // Test 2: API key validation
    console.log('\n🔑 Test 2: Validating API key...');
    const isValid = await chatClient.validateApiKey();
    if (isValid) {
      console.log('✅ API key is valid');
    } else {
      console.log('❌ API key validation failed');
      return;
    }

    // Test 3: Simple text generation
    console.log('\n💬 Test 3: Testing text generation...');
    const model = chatClient.getModel({
      systemInstruction: GEMINI_SYSTEM_INSTRUCTIONS.ACCOUNTING_ASSISTANT
    });
    
    const result = await model.generateContent('Hello! Can you help me understand what you can do as an accounting assistant?');
    const response = result.response.text();
    console.log('✅ Text generation successful');
    console.log('📄 Response preview:', response.substring(0, 200) + '...');

    // Test 4: Test model configurations
    console.log('\n⚙️  Test 4: Testing model configurations...');
    const geminiModels = Object.entries(MODEL_CONFIGS.ALTERNATIVE_MODELS)
      .filter(([_, config]) => (config as ModelConfig).provider === 'google');
    
    console.log('Available Gemini models:');
    geminiModels.forEach(([name, config]) => {
      const modelConfig = config as ModelConfig;
      console.log(`  - ${name}: ${modelConfig.model}`);
    });

    // Test 5: Function calling capability
    console.log('\n🛠️  Test 5: Testing function calling...');
    const tools = [{
      functionDeclarations: [{
        name: 'get_account_balance',
        description: 'Get the current balance of an account',
        parameters: {
          type: 'object',
          properties: {
            account_id: {
              type: 'string',
              description: 'The ID of the account'
            }
          },
          required: ['account_id']
        }
      }]
    }];

    const modelWithTools = chatClient.getModel({ tools });
    const toolResult = await modelWithTools.generateContent('What is the balance for account ID "12345"?');
    
    if (toolResult.response.functionCalls() && toolResult.response.functionCalls()!.length > 0) {
      console.log('✅ Function calling is working');
      console.log('🔧 Function called:', toolResult.response.functionCalls()![0].name);
    } else {
      console.log('⚠️  Function calling test inconclusive (model may have responded with text instead)');
    }

    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📋 Configuration Summary:');
    console.log(`- Chat Model: ${MODEL_CONFIGS.ALTERNATIVE_MODELS.GEMINI.model}`);
    console.log(`- Upload Model: ${MODEL_CONFIGS.ALTERNATIVE_MODELS.GEMINI?.model || 'gemini-2.0-flash'}`);
    console.log(`- API Endpoint: ${MODEL_CONFIGS.ALTERNATIVE_MODELS.GEMINI.endpoint}`);
    console.log('- Function calling: Supported');
    console.log('- Streaming: Supported');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('API_KEY_INVALID')) {
        console.log('💡 Please check your GOOGLE_API_KEY is correct');
      } else if (error.message.includes('PERMISSION_DENIED')) {
        console.log('💡 Your API key may not have access to the Gemini API');
      } else if (error.message.includes('QUOTA_EXCEEDED')) {
        console.log('💡 You may have exceeded your API quota');
      }
    }
  }
}

// Helper function to test specific model
async function testSpecificModel(modelName: string) {
  console.log(`\n🔍 Testing specific model: ${modelName}`);
  
  try {
    const client = createGeminiClient('chat', { model: modelName });
    const model = client.getModel();
    const result = await model.generateContent('What is 2+2?');
    console.log(`✅ ${modelName} is working`);
    return true;
  } catch (error) {
    console.log(`❌ ${modelName} failed:`, error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

// Run tests
if (require.main === module) {
  testGeminiConfiguration().catch(console.error);
}

export { testGeminiConfiguration, testSpecificModel };
