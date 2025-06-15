# Accounting AI 🤖💰

An intelligent accounting assistant powered by AI that helps you analyze financial data, upload bank statements, and get insights through natural language conversations.

## Features

- 📊 **File Upload & Processing**: Upload Excel (.xls, .xlsx), CSV, and PDF bank statements
- 💬 **AI Chat Interface**: Ask questions about your financial data in natural language
- 🔍 **Smart Data Analysis**: Get insights, trends, and summaries of your transactions
- 📈 **Transaction Management**: Automatically parse and store transaction data
- 🛡️ **Secure Database**: SQLite database with read-only query protection
- 🎨 **Modern UI**: Clean, responsive interface built with Tailwind CSS

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, SQLite Database
- **AI Integration**: Azure AI Inference API
- **File Processing**: XLSX for Excel files, Multer for file uploads
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
Create a `.env.local` file in the root directory and add your GitHub token:
```env
GITHUB_TOKEN=your_github_pat_token
```

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

## Usage

### Uploading Files

1. Click on the file upload area or drag and drop your files
2. Supported formats: `.xls`, `.xlsx`, `.csv`, `.pdf`
3. Click "Upload" to process the file
4. Your transaction data will be automatically parsed and stored

### Chatting with Your Data

Once you've uploaded files, you can:
- Ask questions like "What's my total spending this month?"
- Request analysis: "Show me my largest expenses"
- Get summaries: "Summarize my account activity"
- Query specific data: "Find all transactions over $500"

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
