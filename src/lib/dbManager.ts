import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";
import path from "path";

// Database interfaces
export interface StatementRow {
  id?: number;
  date: string;
  description: string;
  amount: number;
  type: "credit" | "debit";
  source?: string;
  created_at?: string;
}

export interface ProcessingJob {
  id?: number;
  filename: string;
  fileType: string;
  uploadDate: string;
  status: "pending" | "processing" | "completed" | "failed";
  totalChunks: number;
  processedAt?: string;
  errorMessage?: string;
  createdAt?: string;
  retryCount?: number;
  lastRetryAt?: string;
  maxRetries?: number;
}

export interface TableSchema {
  name: string;
  type: string;
  notnull: number;
  dflt_value: any;
  pk: number;
}

export interface DatabaseSchema {
  tables: { name: string }[];
  statements_schema: TableSchema[];
  processing_jobs_schema?: TableSchema[];
  sample_data: StatementRow[];
}

/**
 * Database Manager Class
 * Provides centralized database operations and connection management
 */
export class DatabaseManager {
  private static instance: DatabaseManager;
  private dbPath: string;

  private constructor() {
    this.dbPath = path.join(process.cwd(), "database.sqlite");
  }

  /**
   * Get singleton instance of DatabaseManager
   */
  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  /**
   * Open database connection
   */
  private async openDatabase(): Promise<Database> {
    return await open({
      filename: this.dbPath,
      driver: sqlite3.Database,
    });
  }

  /**
   * Initialize all database tables
   */
  public async initializeTables(): Promise<void> {
    const db = await this.openDatabase();

    try {
      // Create statements table
      await db.exec(`CREATE TABLE IF NOT EXISTS statements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
        source TEXT DEFAULT 'manual',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Create processing_jobs table
      await db.exec(`CREATE TABLE IF NOT EXISTS processing_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT UNIQUE NOT NULL,
        file_type TEXT NOT NULL,
        upload_date TEXT NOT NULL,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
        total_chunks INTEGER NOT NULL DEFAULT 0,
        processed_at TEXT,
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        retry_count INTEGER DEFAULT 0,
        last_retry_at TEXT,
        max_retries INTEGER DEFAULT 3
      )`);

      // Create document_chunks table for storing chunks without Pinecone
      await db.exec(`CREATE TABLE IF NOT EXISTS document_chunks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        text_content TEXT NOT NULL,
        file_type TEXT,
        upload_date TEXT,
        chunk_size INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(filename, chunk_index),
        FOREIGN KEY(filename) REFERENCES processing_jobs(filename) ON DELETE CASCADE
      )`);

      // Create indexes for better performance
      await db.exec(
        `CREATE INDEX IF NOT EXISTS idx_statements_date ON statements(date)`
      );
      await db.exec(
        `CREATE INDEX IF NOT EXISTS idx_statements_type ON statements(type)`
      );
      await db.exec(
        `CREATE INDEX IF NOT EXISTS idx_statements_source ON statements(source)`
      );
      await db.exec(
        `CREATE INDEX IF NOT EXISTS idx_processing_jobs_status ON processing_jobs(status)`
      );
      await db.exec(
        `CREATE INDEX IF NOT EXISTS idx_processing_jobs_filename ON processing_jobs(filename)`
      );
      await db.exec(
        `CREATE INDEX IF NOT EXISTS idx_document_chunks_filename ON document_chunks(filename)`
      );
      await db.exec(
        `CREATE INDEX IF NOT EXISTS idx_document_chunks_filename_index ON document_chunks(filename, chunk_index)`
      );

      // Create triggers for updated_at timestamps
      await db.exec(`CREATE TRIGGER IF NOT EXISTS statements_updated_at 
        AFTER UPDATE ON statements 
        BEGIN 
          UPDATE statements SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; 
        END`);

      await db.exec(`CREATE TRIGGER IF NOT EXISTS processing_jobs_updated_at 
        AFTER UPDATE ON processing_jobs 
        BEGIN 
          UPDATE processing_jobs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; 
        END`);
    } finally {
      await db.close();
    }
  }

  /**
   * Execute a raw SQL query (for SELECT operations only)
   */
  public async executeQuery(query: string): Promise<any[]> {
    const db = await this.openDatabase();

    try {
      // Security: Only allow SELECT queries
      const cleanQuery = query.trim().toLowerCase();
      if (!cleanQuery.startsWith("select")) {
        throw new Error("Only SELECT queries are allowed for security reasons");
      }

      // Additional security checks
      const forbiddenKeywords = [
        "drop",
        "delete",
        "insert",
        "update",
        "alter",
        "create",
        "truncate",
      ];
      for (const keyword of forbiddenKeywords) {
        if (cleanQuery.includes(keyword)) {
          throw new Error(
            `Query contains forbidden keyword: ${keyword}. Only SELECT queries are allowed.`
          );
        }
      }

      console.log("Executing SQL query:", query);
      const results = await db.all(query);
      console.log("Query results:", results.length, "rows returned");
      return results;
    } finally {
      await db.close();
    }
  }

  /**
   * Get database schema information
   */
  public async getSchema(): Promise<DatabaseSchema> {
    const db = await this.openDatabase();

    try {
      // Get all table names
      const tables = await db.all(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
      );

      // Get statements table schema
      const statementsSchema = await db.all("PRAGMA table_info(statements)");

      // Get processing_jobs table schema
      const processingJobsSchema = await db.all(
        "PRAGMA table_info(processing_jobs)"
      );

      // Get sample data from statements
      const sampleData = await db.all("SELECT * FROM statements LIMIT 5");

      return {
        tables,
        statements_schema: statementsSchema,
        processing_jobs_schema: processingJobsSchema,
        sample_data: sampleData,
      };
    } finally {
      await db.close();
    }
  }

  // ===== STATEMENTS OPERATIONS =====

  /**
   * Save statements to database
   */
  public async saveStatements(
    statements: Omit<StatementRow, "id" | "created_at">[],
    clearExisting: boolean = false
  ): Promise<void> {
    await this.initializeTables();
    const db = await this.openDatabase();

    try {
      await db.run("BEGIN TRANSACTION");

      // Clear existing data if requested
      if (clearExisting) {
        await db.run("DELETE FROM statements");
      }

      const insertStatement = `INSERT INTO statements (date, description, amount, type, source) VALUES (?, ?, ?, ?, ?)`;

      for (const statement of statements) {
        await db.run(
          insertStatement,
          statement.date,
          statement.description,
          statement.amount,
          statement.type,
          statement.source || "manual"
        );
      }

      await db.run("COMMIT");
      console.log(`Saved ${statements.length} statements to database`);
    } catch (error) {
      await db.run("ROLLBACK");
      throw error;
    } finally {
      await db.close();
    }
  }

  /**
   * Get statements with optional filtering
   */
  public async getStatements(filters?: {
    startDate?: string;
    endDate?: string;
    type?: "credit" | "debit";
    minAmount?: number;
    maxAmount?: number;
    limit?: number;
    offset?: number;
  }): Promise<StatementRow[]> {
    const db = await this.openDatabase();

    try {
      let query = "SELECT * FROM statements WHERE 1=1";
      const params: any[] = [];

      if (filters?.startDate) {
        query += " AND date >= ?";
        params.push(filters.startDate);
      }

      if (filters?.endDate) {
        query += " AND date <= ?";
        params.push(filters.endDate);
      }

      if (filters?.type) {
        query += " AND type = ?";
        params.push(filters.type);
      }

      if (filters?.minAmount !== undefined) {
        query += " AND amount >= ?";
        params.push(filters.minAmount);
      }

      if (filters?.maxAmount !== undefined) {
        query += " AND amount <= ?";
        params.push(filters.maxAmount);
      }

      query += " ORDER BY date DESC, created_at DESC";

      if (filters?.limit) {
        query += " LIMIT ?";
        params.push(filters.limit);

        if (filters?.offset) {
          query += " OFFSET ?";
          params.push(filters.offset);
        }
      }

      return await db.all(query, params);
    } finally {
      await db.close();
    }
  }

  /**
   * Get a single statement by ID
   */
  public async getStatementById(id: number): Promise<StatementRow | null> {
    const db = await this.openDatabase();

    try {
      const statement = await db.get("SELECT * FROM statements WHERE id = ?", [
        id,
      ]);
      return statement || null;
    } finally {
      await db.close();
    }
  }

  /**
   * Get total count of statements with optional filtering
   */
  public async getStatementsCount(filters?: {
    startDate?: string;
    endDate?: string;
    type?: "credit" | "debit";
    minAmount?: number;
    maxAmount?: number;
  }): Promise<number> {
    const db = await this.openDatabase();

    try {
      let query = "SELECT COUNT(*) as count FROM statements WHERE 1=1";
      const params: any[] = [];

      if (filters?.startDate) {
        query += " AND date >= ?";
        params.push(filters.startDate);
      }

      if (filters?.endDate) {
        query += " AND date <= ?";
        params.push(filters.endDate);
      }

      if (filters?.type) {
        query += " AND type = ?";
        params.push(filters.type);
      }

      if (filters?.minAmount !== undefined) {
        query += " AND amount >= ?";
        params.push(filters.minAmount);
      }

      if (filters?.maxAmount !== undefined) {
        query += " AND amount <= ?";
        params.push(filters.maxAmount);
      }

      const result = await db.get(query, params);
      return result.count || 0;
    } finally {
      await db.close();
    }
  }

  /**
   * Create a single statement
   */
  public async createStatement(
    statement: Omit<StatementRow, "id" | "created_at">
  ): Promise<number> {
    await this.initializeTables();
    const db = await this.openDatabase();

    try {
      const result = await db.run(
        `INSERT INTO statements (date, description, amount, type, source) VALUES (?, ?, ?, ?, ?)`,
        statement.date,
        statement.description,
        statement.amount,
        statement.type,
        statement.source || "manual"
      );

      return result.lastID as number;
    } finally {
      await db.close();
    }
  }

  /**
   * Update a statement by ID
   */
  public async updateStatement(
    id: number,
    updates: Partial<Omit<StatementRow, "id" | "created_at">>
  ): Promise<boolean> {
    const db = await this.openDatabase();

    try {
      const fields: string[] = [];
      const params: any[] = [];

      if (updates.date !== undefined) {
        fields.push("date = ?");
        params.push(updates.date);
      }

      if (updates.description !== undefined) {
        fields.push("description = ?");
        params.push(updates.description);
      }

      if (updates.amount !== undefined) {
        fields.push("amount = ?");
        params.push(updates.amount);
      }

      if (updates.type !== undefined) {
        fields.push("type = ?");
        params.push(updates.type);
      }

      if (updates.source !== undefined) {
        fields.push("source = ?");
        params.push(updates.source);
      }

      if (fields.length === 0) {
        return false; // No updates to make
      }

      params.push(id);
      const query = `UPDATE statements SET ${fields.join(", ")} WHERE id = ?`;

      const result = await db.run(query, params);
      return (result.changes || 0) > 0;
    } finally {
      await db.close();
    }
  }

  /**
   * Delete a single statement by ID
   */
  public async deleteStatement(id: number): Promise<boolean> {
    const db = await this.openDatabase();

    try {
      const result = await db.run("DELETE FROM statements WHERE id = ?", [id]);
      return (result.changes || 0) > 0;
    } finally {
      await db.close();
    }
  }

  /**
   * Delete statements by ID or criteria
   */
  public async deleteStatements(criteria: {
    ids?: number[];
    source?: string;
  }): Promise<number> {
    const db = await this.openDatabase();

    try {
      let query = "DELETE FROM statements WHERE ";
      const params: any[] = [];
      const conditions: string[] = [];

      if (criteria.ids && criteria.ids.length > 0) {
        conditions.push(`id IN (${criteria.ids.map(() => "?").join(", ")})`);
        params.push(...criteria.ids);
      }

      if (criteria.source) {
        conditions.push("source = ?");
        params.push(criteria.source);
      }

      if (conditions.length === 0) {
        throw new Error("At least one deletion criteria must be provided");
      }

      query += conditions.join(" AND ");

      const result = await db.run(query, params);
      return result.changes || 0;
    } finally {
      await db.close();
    }
  }

  // ===== PROCESSING JOBS OPERATIONS =====

  /**
   * Add a processing job
   */
  public async addProcessingJob(
    job: Omit<ProcessingJob, "id" | "createdAt" | "processedAt">
  ): Promise<void> {
    await this.initializeTables();
    const db = await this.openDatabase();

    try {
      // Check if job already exists
      const existingJob = await db.get(
        "SELECT status FROM processing_jobs WHERE filename = ?",
        [job.filename]
      );

      if (existingJob) {
        if (existingJob.status === "completed") {
          console.log(`Job for ${job.filename} already completed, skipping`);
          return;
        } else if (existingJob.status === "processing") {
          console.log(`Job for ${job.filename} already processing, skipping`);
          return;
        }
        // If pending or failed, we'll update/retry
      }

      await db.run(
        `INSERT OR REPLACE INTO processing_jobs 
         (filename, file_type, upload_date, status, total_chunks) 
         VALUES (?, ?, ?, ?, ?)`,
        [
          job.filename,
          job.fileType,
          job.uploadDate,
          job.status || "pending",
          job.totalChunks,
        ]
      );

      console.log(`Added processing job for ${job.filename}`);
    } finally {
      await db.close();
    }
  }

  /**
   * Get processing jobs with optional filtering
   */
  public async getProcessingJobs(filters?: {
    status?: ProcessingJob["status"];
    filename?: string;
    limit?: number;
  }): Promise<ProcessingJob[]> {
    await this.initializeTables();
    const db = await this.openDatabase();

    try {
      let query = `SELECT 
        id, filename, file_type as fileType, upload_date as uploadDate, 
        status, total_chunks as totalChunks, processed_at as processedAt,
        error_message as errorMessage, created_at as createdAt, retry_count as retryCount,
        last_retry_at as lastRetryAt, max_retries as maxRetries
        FROM processing_jobs WHERE 1=1`;
      const params: any[] = [];

      if (filters?.status) {
        query += " AND status = ?";
        params.push(filters.status);
      }

      if (filters?.filename) {
        query += " AND filename = ?";
        params.push(filters.filename);
      }

      query += " ORDER BY created_at ASC";

      if (filters?.limit) {
        query += " LIMIT ?";
        params.push(filters.limit);
      }

      return await db.all(query, params);
    } finally {
      await db.close();
    }
  }

  /**
   * Update processing job status
   */
  public async updateProcessingJobStatus(
    filename: string,
    status: ProcessingJob["status"],
    errorMessage?: string
  ): Promise<void> {
    const db = await this.openDatabase();

    try {
      await db.run(
        `UPDATE processing_jobs 
         SET status = ?, processed_at = CURRENT_TIMESTAMP, error_message = ?
         WHERE filename = ?`,
        [status, errorMessage || null, filename]
      );
    } finally {
      await db.close();
    }
  }

  /**
   * Delete processing jobs
   */
  public async deleteProcessingJobs(criteria: {
    ids?: number[];
    status?: ProcessingJob["status"];
    filename?: string;
  }): Promise<number> {
    const db = await this.openDatabase();

    try {
      let query = "DELETE FROM processing_jobs WHERE ";
      const params: any[] = [];
      const conditions: string[] = [];

      if (criteria.ids && criteria.ids.length > 0) {
        conditions.push(`id IN (${criteria.ids.map(() => "?").join(", ")})`);
        params.push(...criteria.ids);
      }

      if (criteria.status) {
        conditions.push("status = ?");
        params.push(criteria.status);
      }

      if (criteria.filename) {
        conditions.push("filename = ?");
        params.push(criteria.filename);
      }

      if (conditions.length === 0) {
        throw new Error("At least one deletion criteria must be provided");
      }

      query += conditions.join(" AND ");

      const result = await db.run(query, params);
      return result.changes || 0;
    } finally {
      await db.close();
    }
  }

  /**
   * Retry a failed processing job
   */
  public async retryProcessingJob(filename: string): Promise<boolean> {
    const db = await this.openDatabase();

    try {
      // Get current job info
      const job = await db.get(
        "SELECT retry_count, max_retries, status FROM processing_jobs WHERE filename = ?",
        [filename]
      );

      if (!job) {
        console.log(`Job ${filename} not found`);
        return false;
      }

      if (job.status !== "failed") {
        console.log(
          `Job ${filename} is not in failed status (current: ${job.status})`
        );
        return false;
      }

      const currentRetries = job.retry_count || 0;
      const maxRetries = job.max_retries || 3;

      if (currentRetries >= maxRetries) {
        console.log(
          `Job ${filename} has exceeded max retries (${currentRetries}/${maxRetries})`
        );
        return false;
      }

      // Reset job to pending and increment retry count
      await db.run(
        `UPDATE processing_jobs 
         SET status = 'pending', 
             retry_count = ?, 
             last_retry_at = CURRENT_TIMESTAMP,
             error_message = NULL
         WHERE filename = ?`,
        [currentRetries + 1, filename]
      );

      console.log(
        `Retrying job ${filename} (attempt ${currentRetries + 1}/${maxRetries})`
      );
      return true;
    } finally {
      await db.close();
    }
  }

  /**
   * Retry all failed jobs that haven't exceeded max retries
   */
  public async retryAllFailedJobs(): Promise<{
    retried: number;
    skipped: number;
  }> {
    const db = await this.openDatabase();

    try {
      // Get all failed jobs that can be retried
      const failedJobs = await db.all(`
        SELECT filename, retry_count, max_retries 
        FROM processing_jobs 
        WHERE status = 'failed' 
        AND (retry_count IS NULL OR retry_count < COALESCE(max_retries, 3))
      `);

      let retried = 0;
      let skipped = 0;

      for (const job of failedJobs) {
        const success = await this.retryProcessingJob(job.filename);
        if (success) {
          retried++;
        } else {
          skipped++;
        }
      }

      return { retried, skipped };
    } finally {
      await db.close();
    }
  }

  /**
   * Get retry-eligible failed jobs
   */
  public async getRetryEligibleJobs(): Promise<ProcessingJob[]> {
    const db = await this.openDatabase();

    try {
      const jobs = await db.all(`
        SELECT 
          id, filename, file_type as fileType, upload_date as uploadDate, 
          status, total_chunks as totalChunks, processed_at as processedAt,
          error_message as errorMessage, created_at as createdAt,
          retry_count as retryCount, last_retry_at as lastRetryAt,
          max_retries as maxRetries
        FROM processing_jobs 
        WHERE status = 'failed' 
        AND (retry_count IS NULL OR retry_count < COALESCE(max_retries, 3))
        ORDER BY created_at ASC
      `);

      return jobs;
    } finally {
      await db.close();
    }
  }

  /**
   * Set max retries for a specific job
   */
  public async setJobMaxRetries(
    filename: string,
    maxRetries: number
  ): Promise<void> {
    const db = await this.openDatabase();

    try {
      await db.run(
        "UPDATE processing_jobs SET max_retries = ? WHERE filename = ?",
        [maxRetries, filename]
      );
    } finally {
      await db.close();
    }
  }

  // ===== DOCUMENT CHUNKS OPERATIONS =====

  /**
   * Store document chunks in the database
   */
  public async storeDocumentChunks(
    filename: string,
    chunks: Array<{
      text: string;
      chunkIndex: number;
      fileType: string;
      uploadDate: string;
    }>
  ): Promise<void> {
    const db = await this.openDatabase();

    try {
      // Delete existing chunks for this file (if any)
      await db.run("DELETE FROM document_chunks WHERE filename = ?", [
        filename,
      ]);

      // Insert new chunks
      const stmt = await db.prepare(`
        INSERT INTO document_chunks (filename, chunk_index, text_content, file_type, upload_date, chunk_size) 
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const chunk of chunks) {
        await stmt.run([
          filename,
          chunk.chunkIndex,
          chunk.text,
          chunk.fileType,
          chunk.uploadDate,
          chunk.text.length,
        ]);
      }

      await stmt.finalize();
      console.log(`Stored ${chunks.length} chunks for ${filename} in database`);
    } finally {
      await db.close();
    }
  }

  /**
   * Get all document chunks for a specific file
   */
  public async getDocumentChunks(filename: string): Promise<
    Array<{
      id: number;
      filename: string;
      chunkIndex: number;
      textContent: string;
      fileType: string;
      uploadDate: string;
      chunkSize: number;
      createdAt: string;
    }>
  > {
    const db = await this.openDatabase();

    try {
      return await db.all(
        `
        SELECT 
          id, filename, chunk_index as chunkIndex, text_content as textContent, 
          file_type as fileType, upload_date as uploadDate, chunk_size as chunkSize,
          created_at as createdAt
        FROM document_chunks 
        WHERE filename = ? 
        ORDER BY chunk_index ASC
      `,
        [filename]
      );
    } finally {
      await db.close();
    }
  }

  /**
   * Delete document chunks for a specific file
   */
  public async deleteDocumentChunks(filename: string): Promise<number> {
    const db = await this.openDatabase();

    try {
      const result = await db.run(
        "DELETE FROM document_chunks WHERE filename = ?",
        [filename]
      );
      return result.changes || 0;
    } finally {
      await db.close();
    }
  }

  /**
   * Get chunk statistics
   */
  public async getChunkStatistics(): Promise<{
    totalChunks: number;
    totalFiles: number;
    averageChunkSize: number;
    totalTextSize: number;
  }> {
    const db = await this.openDatabase();

    try {
      const stats = await db.get(`
        SELECT 
          COUNT(*) as totalChunks,
          COUNT(DISTINCT filename) as totalFiles,
          AVG(chunk_size) as averageChunkSize,
          SUM(chunk_size) as totalTextSize
        FROM document_chunks
      `);

      return {
        totalChunks: stats.totalChunks || 0,
        totalFiles: stats.totalFiles || 0,
        averageChunkSize: Math.round(stats.averageChunkSize || 0),
        totalTextSize: stats.totalTextSize || 0,
      };
    } finally {
      await db.close();
    }
  }

  /**
   * Search chunks by text content (simple text search)
   */
  public async searchDocumentChunks(searchTerms: string[]): Promise<
    Array<{
      filename: string;
      chunkIndex: number;
      textContent: string;
      fileType: string;
      uploadDate: string;
    }>
  > {
    const db = await this.openDatabase();

    try {
      // Create a LIKE query for each search term
      const conditions = searchTerms
        .map(() => "text_content LIKE ?")
        .join(" OR ");
      const params = searchTerms.map((term) => `%${term}%`);

      return await db.all(
        `
        SELECT 
          filename, chunk_index as chunkIndex, text_content as textContent, 
          file_type as fileType, upload_date as uploadDate
        FROM document_chunks 
        WHERE ${conditions}
        ORDER BY created_at DESC
      `,
        params
      );
    } finally {
      await db.close();
    }
  }

  // ===== UTILITY OPERATIONS =====

  /**
   * Get database connection for complex operations
   * WARNING: Remember to close the connection after use
   */
  public async getConnection(): Promise<Database> {
    return await this.openDatabase();
  }

  /**
   * Execute a transaction with automatic rollback on error
   */
  public async executeTransaction<T>(
    operation: (db: Database) => Promise<T>
  ): Promise<T> {
    const db = await this.openDatabase();

    try {
      await db.run("BEGIN TRANSACTION");
      const result = await operation(db);
      await db.run("COMMIT");
      return result;
    } catch (error) {
      await db.run("ROLLBACK");
      throw error;
    } finally {
      await db.close();
    }
  }

  /**
   * Backup database to a file
   */
  public async backupDatabase(backupPath: string): Promise<void> {
    const fs = await import("fs/promises");

    try {
      await fs.copyFile(this.dbPath, backupPath);
      console.log(`Database backed up to ${backupPath}`);
    } catch (error) {
      console.error("Backup failed:", error);
      throw error;
    }
  }

  /**
   * Get database statistics
   */
  public async getStatistics(): Promise<{
    statementsCount: number;
    processingJobsCount: number;
    pendingJobsCount: number;
    completedJobsCount: number;
    failedJobsCount: number;
    retryEligibleJobsCount: number;
    maxRetriesExceededCount: number;
    totalCredits: number;
    totalDebits: number;
    dbSizeKB: number;
  }> {
    const db = await this.openDatabase();

    try {
      const [
        statementsCount,
        processingJobsCount,
        pendingJobs,
        completedJobs,
        failedJobs,
        retryEligibleJobs,
        maxRetriesExceededJobs,
        totalCredits,
        totalDebits,
        dbSize,
      ] = await Promise.all([
        db.get("SELECT COUNT(*) as count FROM statements"),
        db.get("SELECT COUNT(*) as count FROM processing_jobs"),
        db.get(
          "SELECT COUNT(*) as count FROM processing_jobs WHERE status = 'pending'"
        ),
        db.get(
          "SELECT COUNT(*) as count FROM processing_jobs WHERE status = 'completed'"
        ),
        db.get(
          "SELECT COUNT(*) as count FROM processing_jobs WHERE status = 'failed'"
        ),
        db.get(`SELECT COUNT(*) as count FROM processing_jobs 
                WHERE status = 'failed' 
                AND (retry_count IS NULL OR retry_count < COALESCE(max_retries, 3))`),
        db.get(`SELECT COUNT(*) as count FROM processing_jobs 
                WHERE status = 'failed' 
                AND retry_count >= COALESCE(max_retries, 3)`),
        db.get(
          "SELECT SUM(amount) as total FROM statements WHERE type = 'credit'"
        ),
        db.get(
          "SELECT SUM(amount) as total FROM statements WHERE type = 'debit'"
        ),
        db.get(
          "SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()"
        ),
      ]);

      return {
        statementsCount: statementsCount?.count || 0,
        processingJobsCount: processingJobsCount?.count || 0,
        pendingJobsCount: pendingJobs?.count || 0,
        completedJobsCount: completedJobs?.count || 0,
        failedJobsCount: failedJobs?.count || 0,
        retryEligibleJobsCount: retryEligibleJobs?.count || 0,
        maxRetriesExceededCount: maxRetriesExceededJobs?.count || 0,
        totalCredits: totalCredits?.total || 0,
        totalDebits: totalDebits?.total || 0,
        dbSizeKB: Math.round((dbSize?.size || 0) / 1024),
      };
    } finally {
      await db.close();
    }
  }
}

// Export singleton instance for convenience
export const dbManager = DatabaseManager.getInstance();

// Legacy compatibility functions (deprecated - use dbManager directly)
export async function openDatabase() {
  console.warn(
    "openDatabase() is deprecated. Use dbManager.getConnection() instead."
  );
  return await dbManager.getConnection();
}
