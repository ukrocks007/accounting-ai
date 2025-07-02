# Accounting AI 🤖💰

An intelligent accounting assistant powered by AI that helps you analyze financial data, upload bank statements, and get insights through natural language conversations.

## Features

- 📊 **File Upload & Processing**: Upload Excel (.xls, .xlsx), CSV, and PDF bank statements
- 💬 **AI Chat Interface**: Ask questions about your financial data in natural language
- 🔍 **Smart Data Analysis**: Get insights, trends, and summaries of your transactions
- 📈 **Transaction Management**: Automatically parse and store transaction data
- 🧠 **RAG (Retrieval-Augmented Generation)**: Intelligent search through large document content
- 🛡️ **Secure Database**: SQLite database with read-only query protection
- 🎨 **Modern UI**: Clean, responsive interface built with Tailwind CSS
- 🤖 **Multi-Model AI Support**: OpenAI, GitHub Models, Ollama, Anthropic, and **Google Gemini**

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, SQLite Database
- **AI Integration**: 
  - Azure AI Inference API
  - OpenAI GPT models
  - **Google Gemini (Latest)**
  - GitHub Models
  - Ollama (Local models)
  - Anthropic Claude
- **Vector Database**: Pinecone for RAG functionality
- **File Processing**: XLSX for Excel files, PDF parsing
- **Database**: SQLite3 with sqlite package

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm, yarn, pnpm, or bun package manager

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd accounting-ai
```

2. Install dependencies:
```bash
npm install
# or
yarn install
# or
pnpm install
```

3. Set up environment variables:
Create a `.env` file in the root directory:

**Basic Setup (Required):**
```env
GITHUB_TOKEN=your_github_pat_token
```

**Google Gemini Setup (Recommended):**
```env
# For Google Gemini AI (Latest and most capable)
GOOGLE_API_KEY=your_google_ai_studio_api_key
```

**Alternative AI Providers (Optional):**
```env
# OpenAI (if you prefer OpenAI models)
OPENAI_API_KEY=your_openai_api_key

# Anthropic Claude (if you prefer Claude models)
ANTHROPIC_API_KEY=your_anthropic_api_key

# Ollama (for local models)
OLLAMA_ENDPOINT=http://localhost:11434
```

**RAG Setup (Optional - for large document processing):**
```env
# For RAG functionality with large documents
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX_NAME=accounting-documents
```

> **Note**: 
> - For **Gemini setup**, see [GEMINI_SETUP.md](./GEMINI_SETUP.md) for detailed configuration
> - For **RAG features**, see [RAG_SETUP.md](./RAG_SETUP.md) for setup instructions
> - For **Ollama local models**, see [OLLAMA_SETUP.md](./OLLAMA_SETUP.md)

4. Run the development server:
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Testing Your Setup

Test your AI configuration with these commands:

```bash
# Test Gemini AI (recommended)
npm run test-gemini

# Test Ollama (if using local models)
npm run test-ollama

# Test RAG functionality
npm run test-rag
```

## Usage

### Uploading Files

1. Click on the file upload area or drag and drop your files
2. Supported formats: `.xls`, `.xlsx`, `.csv`, `.pdf`
3. Click "Upload" to process the file
4. **Large Documents**: Files with text over 4096 characters are automatically processed with RAG
5. Your transaction data will be automatically parsed and stored

### Chatting with Your Data

The AI assistant can answer two types of questions:

**Transaction Data Questions:**
- "What's my total spending this month?"
- "Show me my largest expenses"
- "Find all transactions over $500"
- "What's my average transaction amount?"

**Document Content Questions (RAG-powered):**
- "What are the account fees mentioned in my statement?"
- "Find information about overdraft policies"
- "What interest rates are specified?"
- "Search for terms and conditions"

**Combined Questions:**
- "Based on the fee structure, how much did I pay in fees?"
- "Compare my spending to the limits mentioned in the document"

## API Endpoints

- `POST /api/upload` - Upload and process financial documents
- `POST /api/chat` - Chat with AI about your financial data

## Database Schema

The application uses SQLite with a `statements` table containing:
- Transaction ID
- Date
- Description
- Amount
- Type (credit/debit)
- Account information

## Development

### Scripts

- `npm run dev` - Start development server with debugging
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── chat/          # AI chat endpoint
│   │   └── upload/        # File upload endpoint
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx          # Main application page
└── uploads/              # Uploaded files storage
```

## Security Features

- Read-only database queries to prevent data modification
- Input sanitization and validation
- Secure file upload handling
- Environment variable protection for API keys

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support, please open an issue in the GitHub repository or contact the development team.
