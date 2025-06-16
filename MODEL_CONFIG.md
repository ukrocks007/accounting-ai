# Model Configuration Guide

This document explains how to configure and switch between different AI models in the Accounting AI application.

## Overview

The application supports configurable AI models for different API endpoints:
- **Upload API**: Processes financial documents (Excel, CSV, PDF)
- **Chat API**: Handles conversational queries about financial data

## Default Models

By default, both APIs use:
- **Model**: `meta/Llama-4-Scout-17B-16E-Instruct`
- **Provider**: GitHub Models API
- **Endpoint**: `https://models.github.ai/inference`

## Supported Models

### GitHub Models (Default)
- `meta/Llama-4-Scout-17B-16E-Instruct` - High-performance instruction-following model

### OpenAI Models
- `gpt-4` - Advanced reasoning and analysis
- `gpt-3.5-turbo` - Fast and cost-effective

### Anthropic Models
- `claude-3-sonnet-20240229` - Balanced performance and safety
- `claude-3-haiku-20240307` - Fast and efficient

### Google Models
- `gemini-pro` - Multimodal capabilities
- `gemini-pro-vision` - Image and text processing

## Configuration

### Environment Variables

Create a `.env` file with your API keys:

```env
# GitHub Models (Default)
GITHUB_TOKEN=your_github_token_here

# OpenAI
OPENAI_API_KEY=your_openai_key_here

# Anthropic
ANTHROPIC_API_KEY=your_anthropic_key_here

# Google
GOOGLE_API_KEY=your_google_api_key_here
```

### Model Selection

Override default models using environment variables:

```env
# For upload processing
UPLOAD_MODEL=GPT_4
# or
UPLOAD_MODEL=CLAUDE
# or  
UPLOAD_MODEL=GEMINI

# For chat assistant
CHAT_MODEL=GPT_4
# or
CHAT_MODEL=CLAUDE
# or
CHAT_MODEL=GEMINI
```

### Per-API Configuration

Each API endpoint can use a different model:

```env
# Use GPT-4 for document processing
UPLOAD_MODEL=GPT_4

# Use Claude for chat conversations  
CHAT_MODEL=CLAUDE
```

## Code Configuration

### Constants File

Model configurations are defined in `src/constants/models.ts`:

```typescript
export const MODEL_CONFIGS = {
  UPLOAD_PROCESSOR: {
    model: "meta/Llama-4-Scout-17B-16E-Instruct",
    temperature: 0.8,
    top_p: 0.1,
    max_tokens: 4096,
    endpoint: "https://models.github.ai/inference",
    credential: process.env["GITHUB_TOKEN"] || ""
  },
  
  CHAT_ASSISTANT: {
    model: "meta/Llama-4-Scout-17B-16E-Instruct", 
    temperature: 0.1,
    max_tokens: 4096,
    endpoint: "https://models.github.ai/inference",
    credential: process.env["GITHUB_TOKEN"] || ""
  }
};
```

### Adding New Models

To add a new model configuration:

1. Update `MODEL_CONFIGS.ALTERNATIVE_MODELS` in `src/constants/models.ts`
2. Add the corresponding environment variable handling
3. Include the API key in your `.env` file

Example:

```typescript
ALTERNATIVE_MODELS: {
  NEW_MODEL: {
    model: "provider/model-name",
    temperature: 0.7,
    max_tokens: 4096,
    endpoint: "https://api.provider.com/v1",
    credential: process.env["PROVIDER_API_KEY"] || ""
  }
}
```

## Usage Examples

### Development
```bash
# Use default models
npm run dev

# Use specific models
UPLOAD_MODEL=GPT_4 CHAT_MODEL=CLAUDE npm run dev
```

### Production
```bash
# Set in production environment
export UPLOAD_MODEL=GPT_4
export CHAT_MODEL=CLAUDE
npm run build && npm start
```

## Model Characteristics

### Upload Processing
- **Higher temperature** (0.8) for creative document parsing
- **top_p sampling** for balanced output diversity
- Optimized for structured data extraction

### Chat Assistant  
- **Lower temperature** (0.1) for consistent, factual responses
- Optimized for reasoning and analysis
- Tool usage for database queries

## Troubleshooting

### Model Not Found
- Verify the model name matches the provider's API
- Check that the API key has access to the requested model

### API Key Issues
- Ensure environment variables are properly set
- Verify API keys have sufficient permissions/credits

### Performance Issues
- Consider using faster models (e.g., GPT-3.5-turbo vs GPT-4)
- Adjust temperature and max_tokens for your use case

## Best Practices

1. **Test thoroughly** when switching models
2. **Monitor costs** - different models have different pricing
3. **Consider latency** requirements for your use case
4. **Backup configurations** - keep multiple model options ready
5. **Environment separation** - use different models for dev/prod

## Monitoring

Use the utility functions to get model information:

```typescript
import { getModelInfo } from '../utils/modelUtils';

console.log('Upload model:', getModelInfo('upload'));
console.log('Chat model:', getModelInfo('chat'));
```
