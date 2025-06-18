# Database Manager Documentation

The Database Manager is a centralized library that abstracts all database operations for the Accounting AI application. It provides a clean, type-safe interface for managing SQLite database operations.

## Features

- **Centralized Database Operations**: All database interactions go through a single manager
- **Type Safety**: Full TypeScript support with proper interfaces
- **Connection Management**: Automatic connection handling with proper cleanup
- **Transaction Support**: Built-in transaction management with automatic rollback
- **Schema Management**: Consolidated table creation and schema validation
- **Security**: Built-in query validation for SELECT operations
- **Performance**: Optimized with proper indexing and query optimization
- **Backup & Maintenance**: Database backup and maintenance utilities

## Architecture

### Core Components

1. **DatabaseManager Class**: Singleton class managing all database operations
2. **Type Interfaces**: Strongly typed interfaces for all data models
3. **Utility Scripts**: Command-line tools for database management
4. **Migration Support**: Automatic table creation and schema updates

### Tables

#### Statements Table
Stores financial transaction data:
- `id`: Primary key (auto-increment)
- `date`: Transaction date (YYYY-MM-DD format)
- `description`: Transaction description
- `amount`: Transaction amount (always positive)
- `type`: Transaction type ('credit' or 'debit')
- `source`: Data source ('manual', 'background_processed', etc.)
- `created_at`: Record creation timestamp
- `updated_at`: Record update timestamp

#### Processing Jobs Table
Manages background processing queue:
- `id`: Primary key (auto-increment)
- `filename`: Original filename
- `file_type`: File type/extension
- `upload_date`: Upload timestamp
- `status`: Job status ('pending', 'processing', 'completed', 'failed')
- `total_chunks`: Number of document chunks
- `processed_at`: Processing completion timestamp
- `error_message`: Error details if job failed
- `created_at`: Record creation timestamp
- `updated_at`: Record update timestamp

## Usage Examples

### Basic Setup

```typescript
import { dbManager, StatementRow } from '../lib/dbManager';

// Initialize database (creates tables if they don't exist)
await dbManager.initializeTables();
```

### Working with Statements

```typescript
// Save statements
const statements: Omit<StatementRow, 'id' | 'created_at'>[] = [
  {
    date: '2024-01-15',
    description: 'Office supplies',
    amount: 150.00,
    type: 'debit',
    source: 'manual'
  }
];

await dbManager.saveStatements(statements);

// Get statements with filtering
const recentStatements = await dbManager.getStatements({
  startDate: '2024-01-01',
  type: 'credit',
  limit: 50
});

// Delete statements
await dbManager.deleteStatements({ source: 'test_data' });
```

### Working with Processing Jobs

```typescript
// Add a processing job
await dbManager.addProcessingJob({
  filename: 'invoice_2024.pdf',
  fileType: 'pdf',
  uploadDate: '2024-01-15T10:30:00Z',
  status: 'pending',
  totalChunks: 25
});

// Get pending jobs
const pendingJobs = await dbManager.getProcessingJobs({ status: 'pending' });

// Update job status
await dbManager.updateProcessingJobStatus('invoice_2024.pdf', 'completed');
```

### Advanced Operations

```typescript
// Execute custom queries (SELECT only)
const results = await dbManager.executeQuery(
  'SELECT SUM(amount) as total FROM statements WHERE type = "credit"'
);

// Use transactions for complex operations
await dbManager.executeTransaction(async (db) => {
  // Multiple operations within a transaction
  await db.run('UPDATE statements SET source = ? WHERE source = ?', ['updated', 'old']);
  await db.run('INSERT INTO statements (date, description, amount, type) VALUES (?, ?, ?, ?)', 
               ['2024-01-15', 'Test', 100, 'credit']);
});

// Get database statistics
const stats = await dbManager.getStatistics();
console.log(`Total statements: ${stats.statementsCount}`);
console.log(`Net balance: $${stats.totalCredits - stats.totalDebits}`);
```

## Command Line Utilities

The database manager includes powerful CLI tools for managing your database:

### Basic Commands

```bash
# Show help
npm run db help

# Show database statistics
npm run db:stats

# Show database schema
npm run db:schema

# Initialize database
npm run db:init
```

### Data Operations

```bash
# Export statements to JSON
npm run db export-statements statements_backup.json

# Import statements from JSON
npm run db import-statements data.json

# Clear all statements
npm run db clear-statements

# Clear processing jobs
npm run db clear-jobs
```

### Maintenance Operations

```bash
# Backup database
npm run db:backup database_backup_$(date +%Y%m%d).db

# Optimize database
npm run db vacuum

# List processing jobs
npm run db list-jobs
npm run db list-jobs failed

# Retry failed jobs
npm run db retry-failed
```

## Migration from Legacy Code

### Before (Scattered Database Code)
```typescript
// Multiple files with repeated database connection logic
import sqlite3 from "sqlite3";
import { open } from "sqlite";

async function openDatabase() {
  return await open({
    filename: "./database.sqlite",
    driver: sqlite3.Database,
  });
}

// Repeated table creation
await db.exec(`CREATE TABLE IF NOT EXISTS statements ...`);
```

### After (Centralized Database Manager)
```typescript
import { dbManager } from '../lib/dbManager';

// Single line initialization
await dbManager.initializeTables();

// Type-safe operations
await dbManager.saveStatements(statements);
```

## Error Handling

The database manager includes comprehensive error handling:

```typescript
try {
  await dbManager.saveStatements(statements);
} catch (error) {
  if (error.message.includes('UNIQUE constraint failed')) {
    // Handle duplicate data
  } else {
    // Handle other errors
  }
}
```

## Performance Considerations

### Indexing
The database manager automatically creates indexes for:
- Statement dates
- Statement types
- Statement sources
- Processing job statuses
- Processing job filenames

### Connection Management
- Automatic connection cleanup
- Connection pooling for complex operations
- Transaction management with automatic rollback

### Query Optimization
- Prepared statements for all operations
- Efficient bulk operations
- Parameterized queries for security

## Security Features

### SQL Injection Protection
- All queries use parameterized statements
- Input validation and sanitization
- Query whitelist for SELECT operations

### Access Control
- Read-only query execution for external access
- Forbidden keyword detection
- Connection-level security

## Best Practices

### 1. Always Initialize Tables
```typescript
// At application startup
await dbManager.initializeTables();
```

### 2. Use Transactions for Multiple Operations
```typescript
await dbManager.executeTransaction(async (db) => {
  // Multiple related operations
});
```

### 3. Handle Errors Gracefully
```typescript
try {
  await dbManager.saveStatements(statements);
} catch (error) {
  console.error('Database operation failed:', error);
  // Implement appropriate error handling
}
```

### 4. Use Filtering for Large Datasets
```typescript
// Instead of loading all records
const statements = await dbManager.getStatements({
  startDate: '2024-01-01',
  limit: 100
});
```

### 5. Regular Maintenance
```bash
# Regular database optimization
npm run db vacuum

# Regular backups
npm run db:backup backup-$(date +%Y%m%d).db
```

## Troubleshooting

### Common Issues

1. **Database Locked Error**
   - Ensure all connections are properly closed
   - Use the database manager's connection handling

2. **Missing Tables**
   - Run `npm run db:init` to initialize tables
   - Check if `initializeTables()` is called at startup

3. **Performance Issues**
   - Use filtering in queries
   - Run `npm run db vacuum` to optimize
   - Check database size with `npm run db:stats`

4. **Type Errors**
   - Ensure imported interfaces match database schema
   - Update TypeScript definitions if schema changes

### Debug Mode

Enable detailed logging by setting environment variable:
```bash
DEBUG=database npm run dev
```

## Contributing

When adding new database operations:

1. Add methods to the DatabaseManager class
2. Include proper TypeScript interfaces
3. Add error handling and validation
4. Update CLI utilities if needed
5. Add tests for new functionality
6. Update this documentation

## File Structure

```
src/
├── lib/
│   └── dbManager.ts           # Main database manager
├── scripts/
│   ├── initDb.ts             # Database initialization
│   └── dbUtils.ts            # CLI utilities
└── utils/
    └── backgroundProcessor.ts # Updated to use dbManager
```

This centralized approach ensures consistency, maintainability, and type safety across the entire application.
