# Multi-Provider LLM Configuration Guide

This document explains how to configure and use multiple LLM providers in the accounting-ai application, including GitHub Models, local Ollama models, and other cloud providers.

## Available Providers

### 1. GitHub Models (Default) 🚀
- **Provider**: `github`
- **Requirements**: GitHub token with access to GitHub Models
- **Models**: GPT-4o, Claude 3.5 Sonnet, Llama 3.3 70B, and more
- **Setup**: Set `GITHUB_TOKEN` environment variable

### 2. Local Ollama Models 🦙
- **Provider**: `ollama`
- **Requirements**: Ollama installed and running locally
- **Models**: Llama 3.2, Mistral, CodeLlama, Qwen 2.5, and more
- **Setup**: Install Ollama and pull models

### 3. OpenAI Direct 🤖
- **Provider**: `openai`
- **Requirements**: OpenAI API key
- **Models**: GPT-4, GPT-4o, GPT-3.5-turbo
- **Setup**: Set `OPENAI_API_KEY` environment variable

### 4. Anthropic Direct 🧠
- **Provider**: `anthropic`
- **Requirements**: Anthropic API key
- **Models**: Claude 3 Sonnet, Claude 3.5 Sonnet
- **Setup**: Set `ANTHROPIC_API_KEY` environment variable

### 5. Google Direct 🔍
- **Provider**: `google`
- **Requirements**: Google API key
- **Models**: Gemini Pro, Gemini 2.0 Flash
- **Setup**: Set `GOOGLE_API_KEY` environment variable

## Environment Variables

Create a `.env.local` file in your project root with the following variables:

```bash
# GitHub Models (Default)
GITHUB_TOKEN=your_github_token_here

# Ollama (Local)
OLLAMA_ENDPOINT=http://localhost:11434/api/generate

# OpenAI Direct
OPENAI_API_KEY=your_openai_api_key_here

# Anthropic Direct
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Google Direct
GOOGLE_API_KEY=your_google_api_key_here

# Model Overrides (Optional)
UPLOAD_MODEL=OLLAMA_LLAMA_3_2    # Use Ollama for file processing
CHAT_MODEL=GITHUB_GPT_4O         # Use GitHub GPT-4o for chat
EMBEDDING_MODEL=text-embedding-3-small
```

## Setting Up Ollama

### Installation
```bash
# macOS
brew install ollama

# Or download from https://ollama.ai
```

### Starting Ollama
```bash
ollama serve
```

### Installing Models
```bash
# Install popular models
ollama pull llama3.2          # 3B parameters, fast
ollama pull mistral           # 7B parameters, good balance
ollama pull codellama         # Code-focused model
ollama pull qwen2.5           # Multilingual model

# List installed models
ollama list
```

### Available Ollama Models
- **llama3.2**: Latest Llama model, good for general tasks
- **mistral**: Excellent performance/speed ratio
- **codellama**: Specialized for code generation
- **qwen2.5**: Strong multilingual capabilities
- **phi3**: Microsoft's efficient small model
- **gemma**: Google's open model

## Using the CLI Tool

The project includes a CLI tool to manage and test providers:

```bash
# List all available models
npm run models list

# Check provider availability
npm run models check

# List Ollama models
npm run models ollama

# Test a specific provider
npm run models test github
npm run models test ollama
npm run models test openai

# Show current model info
npm run models info chat
npm run models info upload
npm run models info embedding
```

## Switching Models

### Method 1: Environment Variables
```bash
# Use Ollama for chat
export CHAT_MODEL=OLLAMA_LLAMA_3_2

# Use OpenAI for file processing
export UPLOAD_MODEL=GPT_4O

# Use GitHub for embeddings
export EMBEDDING_MODEL=text-embedding-3-small
```

### Method 2: Code Configuration
Edit `src/constants/models.ts` to change default models:

```typescript
export const MODEL_CONFIGS = {
  CHAT_ASSISTANT: {
    model: "llama3.2",           // Change this
    provider: "ollama",          // And this
    endpoint: "http://localhost:11434/api/generate",
    // ... other config
  }
}
```

## Performance Comparison

| Provider | Speed | Cost | Quality | Local |
|----------|-------|------|---------|-------|
| Ollama   | ⭐⭐⭐⭐⭐ | 🆓 | ⭐⭐⭐⭐ | ✅ |
| GitHub   | ⭐⭐⭐⭐ | 🆓 | ⭐⭐⭐⭐⭐ | ❌ |
| OpenAI   | ⭐⭐⭐ | 💰💰💰 | ⭐⭐⭐⭐⭐ | ❌ |
| Anthropic| ⭐⭐⭐ | 💰💰 | ⭐⭐⭐⭐⭐ | ❌ |
| Google   | ⭐⭐⭐⭐ | 💰 | ⭐⭐⭐⭐ | ❌ |

## Recommended Configurations

### Development Setup
- **Chat**: Ollama Llama 3.2 (fast, free, good quality)
- **File Processing**: GitHub Models (reliable, free)
- **Embeddings**: GitHub text-embedding-3-small (free, good quality)

### Production Setup
- **Chat**: GitHub GPT-4o (reliable, high quality)
- **File Processing**: GitHub Claude 3.5 Sonnet (excellent reasoning)
- **Embeddings**: GitHub text-embedding-3-small (consistent)

### Privacy-Focused Setup
- **Everything**: Local Ollama models (no data leaves your machine)

## Troubleshooting

### Ollama Issues
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Restart Ollama service
ollama stop
ollama serve

# Check available models
ollama list
```

### GitHub Models Issues
- Verify your GitHub token has access to GitHub Models
- Check rate limits in GitHub settings
- Ensure the token isn't expired

### General Issues
```bash
# Check provider availability
npm run models check

# Test specific provider
npm run models test ollama

# Check current configuration
npm run models info chat
```

## API Response Format

All providers return responses in a standardized OpenAI-compatible format:

```typescript
{
  choices: [{
    message: {
      role: 'assistant',
      content: 'Response text'
    },
    finish_reason: 'stop'
  }],
  usage: {
    prompt_tokens: 10,
    completion_tokens: 20,
    total_tokens: 30
  }
}
```

## Adding New Providers

To add a new provider:

1. Add provider type to `ProviderType` in `src/constants/models.ts`
2. Implement provider class in `src/utils/providers.ts`
3. Add model configurations to `MODEL_CONFIGS.ALTERNATIVE_MODELS`
4. Update the factory function `createProviderClient`

## Security Considerations

- **API Keys**: Store in environment variables, never commit to code
- **Local Models**: Ollama models run entirely on your machine
- **Network**: Ollama can be configured to only listen on localhost
- **Data**: Consider which providers you trust with your data

## Performance Tips

1. **Use Ollama for development**: Faster iteration, no API costs
2. **Cache embeddings**: Embeddings are expensive to generate
3. **Choose appropriate model sizes**: Smaller models for simple tasks
4. **Use streaming**: For better user experience with long responses
5. **Monitor usage**: Track API costs and rate limits

## Next Steps

1. Install and configure your preferred providers
2. Test the setup using the CLI tool
3. Choose models based on your use case and requirements
4. Monitor performance and adjust as needed
