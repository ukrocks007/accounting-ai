#!/usr/bin/env node

/**
 * Test script to verify Ollama configuration with Llama3:8b
 */

const { generateCompletion } = require('../src/utils/modelUtils');

async function testOllamaConnection() {
  console.log('🔍 Testing Ollama connection with Llama3:8b...\n');

  try {
    // Test basic connection
    const response = await fetch('http://localhost:11434/api/tags');
    if (!response.ok) {
      throw new Error('Ollama server not accessible');
    }
    
    const models = await response.json();
    console.log('✅ Ollama server is running');
    console.log('📦 Available models:', models.models?.map(m => m.name).join(', ') || 'None');
    
    // Check if llama3:8b is available
    const hasLlama3 = models.models?.some(m => m.name.includes('llama3:8b'));
    if (!hasLlama3) {
      console.log('⚠️  Llama3:8b model not found. Run: ollama pull llama3:8b');
      return;
    }
    
    console.log('✅ Llama3:8b model is available\n');

    // Test model generation
    console.log('🧠 Testing model generation...');
    const testMessages = [
      {
        role: 'system',
        content: 'You are a helpful financial document processor. Respond with a simple JSON object.'
      },
      {
        role: 'user',
        content: 'Extract transaction data from this sample: "2024-01-15 Grocery Store -$25.50 Purchase". Return JSON with date, description, amount, and type fields.'
      }
    ];

    const startTime = Date.now();
    const result = await generateCompletion(testMessages, 'upload');
    const endTime = Date.now();
    
    console.log('✅ Model generation successful');
    console.log(`⏱️  Processing time: ${endTime - startTime}ms`);
    console.log('📄 Response:', result.choices[0]?.message?.content || 'No response');
    
    // Test JSON parsing
    try {
      const responseText = result.choices[0]?.message?.content || '';
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log('✅ JSON parsing successful:', parsed);
      } else {
        console.log('⚠️  Response does not contain valid JSON');
      }
    } catch (e) {
      console.log('⚠️  JSON parsing failed:', e.message);
    }

    console.log('\n🎉 Ollama configuration test completed successfully!');
    console.log('💡 You can now upload financial documents and they will be processed using Llama3:8b');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n🔧 Troubleshooting steps:');
    console.log('1. Make sure Ollama is running: ollama serve');
    console.log('2. Pull the model: ollama pull llama3:8b');
    console.log('3. Test manually: ollama run llama3:8b "Hello"');
    console.log('4. Check if port 11434 is accessible');
    process.exit(1);
  }
}

// Run the test
testOllamaConnection().catch(console.error);
