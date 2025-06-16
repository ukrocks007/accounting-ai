import { NextRequest, NextResponse } from "next/server";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { isUnexpected } from "@azure-rest/ai-inference";
import fs from "fs";
import path from "path";
import { createModelClient, getModelRequestParams } from "../../../utils/modelUtils";
import { getRelevantContext } from "../../../utils/embeddings";

// Tool interface for the LLM
interface Tool {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

// Database utility functions
async function openDatabase() {
  return await open({
    filename: "./database.sqlite",
    driver: sqlite3.Database,
  });
}

async function getTableSchema() {
  const db = await openDatabase();
  try {
    // Get schema for statements table
    const statementsSchema = await db.all("PRAGMA table_info(statements)");
    
    // Get sample data
    const sampleData = await db.all("SELECT * FROM statements LIMIT 5");
    
    // Get table names
    const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table'");
    
    await db.close();
    return { 
      tables,
      statements_schema: statementsSchema,
      sample_data: sampleData 
    };
  } catch (error) {
    await db.close();
    throw error;
  }
}

async function executeQuery(query: string) {
  const db = await openDatabase();
  try {
    // Security: Only allow SELECT queries to prevent data modification
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery.startsWith('select')) {
      throw new Error('Only SELECT queries are allowed for security reasons');
    }
    
    // Additional security checks
    const forbiddenKeywords = ['drop', 'delete', 'insert', 'update', 'alter', 'create', 'truncate'];
    for (const keyword of forbiddenKeywords) {
      if (cleanQuery.includes(keyword)) {
        throw new Error(`Query contains forbidden keyword: ${keyword}. Only SELECT queries are allowed.`);
      }
    }
    
    console.log('Executing SQL query:', query);
    const results = await db.all(query);
    console.log('Query results:', results.length, 'rows returned');
    await db.close();
    return results;
  } catch (error) {
    await db.close();
    console.error('SQL execution error:', error);
    throw error;
  }
}

async function getDataSummary() {
  const db = await openDatabase();
  try {
    const summary = await db.get(`
      SELECT 
        COUNT(*) as total_transactions,
        SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END) as total_credits,
        SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END) as total_debits,
        MIN(date) as earliest_date,
        MAX(date) as latest_date
      FROM statements
    `);
    await db.close();
    return summary;
  } catch (error) {
    await db.close();
    throw error;
  }
}

// Tools available to the LLM
const tools: Tool[] = [
  {
    name: "get_database_schema",
    description: "Get the schema/structure of the database tables and sample data to understand what data is available",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "execute_sql_query",
    description: "Execute a SQL SELECT query on the database and return the results. Only SELECT statements are allowed.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The SQL SELECT query to execute. Must be a valid SELECT statement. Example: 'SELECT * FROM statements WHERE type = \"credit\" LIMIT 10'"
        }
      },
      required: ["query"]
    }
  },
  {
    name: "get_data_summary",
    description: "Get a summary of the financial data including total transactions, credits, debits, and date range",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "validate_sql_query",
    description: "Validate a SQL query before execution to check for syntax and security issues",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The SQL query to validate"
        }
      },
      required: ["query"]
    }
  },
  {
    name: "search_document_content",
    description: "Search through uploaded document content using RAG (Retrieval-Augmented Generation) to find relevant information from large documents that have been processed",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query to find relevant content from uploaded documents"
        }
      },
      required: ["query"]
    }
  }
];

async function validateSqlQuery(query: string) {
  const cleanQuery = query.trim().toLowerCase();
  
  // Basic validation
  if (!cleanQuery.startsWith('select')) {
    return {
      valid: false,
      error: 'Only SELECT queries are allowed',
      suggestion: 'Start your query with SELECT'
    };
  }
  
  // Check for forbidden keywords
  const forbiddenKeywords = ['drop', 'delete', 'insert', 'update', 'alter', 'create', 'truncate', 'exec', 'execute'];
  for (const keyword of forbiddenKeywords) {
    if (cleanQuery.includes(keyword)) {
      return {
        valid: false,
        error: `Query contains forbidden keyword: ${keyword}`,
        suggestion: 'Only SELECT statements are allowed for data retrieval'
      };
    }
  }
  
  // Basic syntax check (simple validation)
  if (!cleanQuery.includes('from')) {
    return {
      valid: false,
      error: 'Query must include FROM clause',
      suggestion: 'Add a FROM clause to specify which table(s) to query'
    };
  }
  
  return {
    valid: true,
    message: 'Query validation passed',
    query: query
  };
}

async function executeToolCall(toolName: string, parameters: any) {
  console.log(`Executing tool: ${toolName} with parameters:`, parameters);
  
  try {
    switch (toolName) {
      case "get_database_schema":
        const schema = await getTableSchema();
        console.log('Database schema retrieved successfully');
        return schema;
      
      case "execute_sql_query":
        if (!parameters.query) {
          throw new Error('SQL query parameter is required');
        }
        const results = await executeQuery(parameters.query);
        console.log(`SQL query executed successfully, returned ${results.length} rows`);
        return {
          query: parameters.query,
          results: results,
          row_count: results.length
        };
      
      case "get_data_summary":
        const summary = await getDataSummary();
        console.log('Data summary retrieved');
        return summary;
      
      case "validate_sql_query":
        if (!parameters.query) {
          throw new Error('SQL query parameter is required for validation');
        }
        const validation = await validateSqlQuery(parameters.query);
        console.log('SQL query validation completed');
        return validation;
      
      case "search_document_content":
        if (!parameters.query) {
          throw new Error('Search query parameter is required');
        }
        try {
          const relevantContext = await getRelevantContext(parameters.query, 3);
          console.log(`Document search completed for query: "${parameters.query}"`);
          return {
            query: parameters.query,
            found_content: relevantContext ? true : false,
            content: relevantContext || "No relevant content found in uploaded documents.",
            message: relevantContext ? "Found relevant content from uploaded documents" : "No relevant content found"
          };
        } catch (error) {
          console.error('RAG search error:', error);
          return {
            query: parameters.query,
            found_content: false,
            content: "Error occurred while searching document content. RAG system may not be properly configured.",
            error: error instanceof Error ? error.message : "Unknown error"
          };
        }
      
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  } catch (error) {
    console.error(`Error executing tool ${toolName}:`, error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();

    if (!query) {
      return NextResponse.json({ error: "No query provided." }, { status: 400 });
    }

    // Get model client and parameters for chat
    const client = createModelClient('chat');
    const modelParams = getModelRequestParams('chat');
    // Initial conversation with the LLM
    let messages: any[] = [
      {
        role: "system",
        content: `You are a helpful financial data analyst that can analyze bank statements and financial transactions stored in a SQLite database, and search through uploaded document content using RAG. 

        IMPORTANT: You have access to several tools that you MUST use to gather information before answering questions:

        1. get_database_schema - Understand the database structure and see sample data  
        2. get_data_summary - Get high-level summary of the financial data
        3. execute_sql_query - Run SELECT queries to get specific data
        4. validate_sql_query - Validate SQL queries before execution
        5. search_document_content - Search through uploaded document content using RAG

        CRITICAL WORKFLOW for answering questions:
        1. Determine if the question is about:
           - Transaction data (use database tools)
           - Document content/details (use RAG search)
           - Both (combine approaches)
        2. For transaction analysis: Start with get_database_schema, then use SQL queries
        3. For document content: Use search_document_content with relevant search terms
        4. Always use tools to get actual data - never make assumptions

        DATABASE STRUCTURE:
        - statements table: Contains transaction data (id, date, description, amount, type)
        - The table contains all uploaded financial transaction data

        RAG DOCUMENT SEARCH:
        - Use search_document_content to find specific information from uploaded documents
        - Especially useful for large PDFs that have been processed with RAG
        - Search for terms, conditions, fees, policies, or any specific content

        SQL QUERY GUIDELINES:
        - Only SELECT queries are allowed (no INSERT, UPDATE, DELETE, DROP, etc.)
        - Use aggregation functions (SUM, COUNT, AVG, etc.) for calculations
        - Format dates appropriately and handle different date formats
        - Use CASE statements for conditional logic
        - Use LIKE operator for pattern matching in descriptions

        EXAMPLE QUERIES:
        - Total credits: "SELECT SUM(amount) FROM statements WHERE type = 'credit'"
        - Transaction count by type: "SELECT type, COUNT(*) FROM statements GROUP BY type"
        - Transactions above amount: "SELECT * FROM statements WHERE amount > 100 ORDER BY amount DESC"
        - Search descriptions: "SELECT * FROM statements WHERE description LIKE '%grocery%'"

        EXAMPLE DOCUMENT SEARCHES:
        - "account fees and charges"
        - "interest rate information"
        - "terms and conditions"
        - "overdraft policies"

        Remember: 
        - You MUST use the execute_sql_query tool to run queries and get actual data
        - Never make assumptions about data - always query first
        - Provide insights based on the actual query results
        - If a query fails, adjust it and try again`
      },
      {
        role: "user",
        content: query
      }
    ];

    let maxIterations = 10; // Increased to allow for more tool interactions
    let currentIteration = 0;

    while (currentIteration < maxIterations) {
      console.log(`Chat iteration ${currentIteration + 1}/${maxIterations}`);
      
      const response = await client.path("/chat/completions").post({
        body: {
          messages,
          ...modelParams,
          tools: tools.map(tool => ({
            type: "function",
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters
            }
          })),
          tool_choice: currentIteration === 0 ? "auto" : "auto" // Let the model decide when to use tools
        },
      });

      if (isUnexpected(response)) {
        throw new Error(`LLM API error: ${response.body.error}`);
      }

      const assistantMessage = response.body.choices[0].message;
      messages.push(assistantMessage);

      console.log('Assistant message received:', {
        hasContent: !!assistantMessage.content,
        hasToolCalls: !!(assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0),
        toolCallCount: assistantMessage.tool_calls?.length || 0
      });

      // Check if the assistant wants to call a tool
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        console.log('Processing tool calls:', assistantMessage.tool_calls.map((tc: any) => tc.function.name));
        
        // Execute all tool calls
        for (const toolCall of assistantMessage.tool_calls) {
          const toolName = toolCall.function.name;
          const parameters = JSON.parse(toolCall.function.arguments || "{}");
          
          try {
            const toolResult = await executeToolCall(toolName, parameters);
            
            // Add the tool result back to the conversation
            messages.push({
              role: "tool",
              content: JSON.stringify(toolResult, null, 2),
              tool_call_id: toolCall.id
            });
            
            console.log(`Tool ${toolName} executed successfully`);
          } catch (error) {
            const errorMsg = `Error executing ${toolName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
            console.error(errorMsg);
            
            messages.push({
              role: "tool",
              content: errorMsg,
              tool_call_id: toolCall.id
            });
          }
        }
        
        currentIteration++;
        continue; // Continue the conversation loop
      } else {
        // No more tool calls, we have the final answer
        console.log('Final answer received, ending conversation');
        return NextResponse.json({
          answer: assistantMessage.content,
          iterations: currentIteration + 1
        });
      }
    }

    return NextResponse.json({
      answer: "I apologize, but I reached the maximum number of iterations while processing your question. Please try asking a simpler question.",
      iterations: currentIteration
    });

  } catch (error: unknown) {
    console.error("Chat API error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to process chat request: ${errorMessage}` },
      { status: 500 }
    );
  }
}
