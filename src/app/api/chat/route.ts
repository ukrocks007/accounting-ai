import { NextRequest, NextResponse } from "next/server";
import { isUnexpected } from "@azure-rest/ai-inference";
import {
  createModelClient,
  getModelRequestParams,
} from "../../../utils/modelUtils";
import { dbManager } from "../../../lib/dbManager";

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
async function getTableSchema() {
  return await dbManager.getSchema();
}

async function executeQuery(query: string) {
  return await dbManager.executeQuery(query);
}

async function getDataSummary() {
  try {
    const stats = await dbManager.getStatistics();
    const statements = await dbManager.getStatements({ limit: 1 });
    const earliestDate = statements.length > 0 ? statements[0].date : null;
    const latestDate = statements.length > 0 ? statements[0].date : null;

    return {
      total_transactions: stats.statementsCount,
      total_credits: stats.totalCredits,
      total_debits: stats.totalDebits,
      earliest_date: earliestDate,
      latest_date: latestDate,
    };
  } catch (error) {
    console.error("Error getting data summary:", error);
    throw error;
  }
}

// Tools available to the LLM
const tools: Tool[] = [
  {
    name: "get_database_schema",
    description:
      "Get the schema/structure of the database tables and sample data to understand what data is available",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "execute_sql_query",
    description:
      "Execute a SQL SELECT query on the database and return the results. Only SELECT statements are allowed.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "The SQL SELECT query to execute. Must be a valid SELECT statement. Example: 'SELECT * FROM statements WHERE type = \"credit\" LIMIT 10'",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_data_summary",
    description:
      "Get a summary of the financial data including total transactions, credits, debits, and date range",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "validate_sql_query",
    description:
      "Validate a SQL query before execution to check for syntax and security issues",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The SQL query to validate",
        },
      },
      required: ["query"],
    },
  },
  // {
  //   name: "search_document_content",
  //   description: "Search through uploaded document content using RAG (Retrieval-Augmented Generation) to find relevant information from large documents that have been processed",
  //   parameters: {
  //     type: "object",
  //     properties: {
  //       query: {
  //         type: "string",
  //         description: "The search query to find relevant content from uploaded documents"
  //       }
  //     },
  //     required: ["query"]
  //   }
  // }
];

async function validateSqlQuery(query: string) {
  const cleanQuery = query.trim().toLowerCase();

  // Basic validation
  if (!cleanQuery.startsWith("select")) {
    return {
      valid: false,
      error: "Only SELECT queries are allowed",
      suggestion: "Start your query with SELECT",
    };
  }

  // Check for forbidden keywords
  const forbiddenKeywords = [
    "drop",
    "delete",
    "insert",
    "update",
    "alter",
    "create",
    "truncate",
    "exec",
    "execute",
  ];
  for (const keyword of forbiddenKeywords) {
    if (cleanQuery.includes(keyword)) {
      return {
        valid: false,
        error: `Query contains forbidden keyword: ${keyword}`,
        suggestion: "Only SELECT statements are allowed for data retrieval",
      };
    }
  }

  // Basic syntax check (simple validation)
  if (!cleanQuery.includes("from")) {
    return {
      valid: false,
      error: "Query must include FROM clause",
      suggestion: "Add a FROM clause to specify which table(s) to query",
    };
  }

  return {
    valid: true,
    message: "Query validation passed",
    query: query,
  };
}

async function executeToolCall(toolName: string, parameters: any) {
  console.log(`Executing tool: ${toolName} with parameters:`, parameters);

  try {
    switch (toolName) {
      case "get_database_schema":
        const schema = await getTableSchema();
        console.log("Database schema retrieved successfully");
        return schema;

      case "execute_sql_query":
        if (!parameters.query) {
          throw new Error("SQL query parameter is required");
        }
        const results = await executeQuery(parameters.query);
        console.log(
          `SQL query executed successfully, returned ${results.length} rows`
        );
        return {
          query: parameters.query,
          results: results,
          row_count: results.length,
        };

      case "get_data_summary":
        const summary = await getDataSummary();
        console.log("Data summary retrieved");
        return summary;

      case "validate_sql_query":
        if (!parameters.query) {
          throw new Error("SQL query parameter is required for validation");
        }
        const validation = await validateSqlQuery(parameters.query);
        console.log("SQL query validation completed");
        return validation;

      // case "search_document_content":
      //   if (!parameters.query) {
      //     throw new Error('Search query parameter is required');
      //   }
      //   try {
      //     const relevantContext = await getRelevantContext(parameters.query, 3);
      //     console.log(`Document search completed for query: "${parameters.query}"`);
      //     return {
      //       query: parameters.query,
      //       found_content: relevantContext ? true : false,
      //       content: relevantContext || "No relevant content found in uploaded documents.",
      //       message: relevantContext ? "Found relevant content from uploaded documents" : "No relevant content found"
      //     };
      //   } catch (error) {
      //     console.error('RAG search error:', error);
      //     return {
      //       query: parameters.query,
      //       found_content: false,
      //       content: "Error occurred while searching document content. RAG system may not be properly configured.",
      //       error: error instanceof Error ? error.message : "Unknown error"
      //     };
      //   }

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
      return NextResponse.json(
        { error: "No query provided." },
        { status: 400 }
      );
    }

    // Get model client and parameters for chat
    const client = createModelClient("chat");
    const modelParams = getModelRequestParams("chat");

    // Initial conversation with the LLM
    let messages: any[] = [
      {
        role: "system",
        content: `You are a helpful financial data analyst that can analyze bank statements and financial transactions stored in a SQLite database.

        IMPORTANT: You have access to several tools that you MUST use to gather information before answering questions:

        1. get_database_schema - Understand the database structure and see sample data  
        2. get_data_summary - Get high-level summary of the financial data
        3. execute_sql_query - Run SELECT queries to get specific data
        4. validate_sql_query - Validate SQL queries before execution

        CRITICAL WORKFLOW for answering questions:
        1. For transaction analysis: Start with get_database_schema if you need to understand the structure
        2. Use execute_sql_query to get the actual data you need
        3. Once you have the data from tools, provide a clear answer based on the results
        4. DO NOT repeat the same tool call - if you get results, use them to answer

        AFTER USING TOOLS: Always provide a final answer based on the tool results. Do not make additional tool calls unless you need different data.

        DATABASE STRUCTURE:
        - statements table: Contains transaction data (id, date, description, amount, type, source, created_at, updated_at)
        - The 'type' column contains only two values: 'credit' (money received/income) and 'debit' (money spent/expenses)
        - The table contains all uploaded financial transaction data

        FINANCIAL TERMINOLOGY MAPPING - CRITICAL FOR QUERY BUILDING:
        When users ask for financial terms, map them to the correct database values:
        
        INCOME/MONEY RECEIVED queries should use type = 'credit':
        - "income statements" → SELECT * FROM statements WHERE type = 'credit'
        - "money received" → SELECT * FROM statements WHERE type = 'credit'  
        - "deposits" → SELECT * FROM statements WHERE type = 'credit'
        - "earnings" → SELECT * FROM statements WHERE type = 'credit'
        - "revenue" → SELECT * FROM statements WHERE type = 'credit'
        - "credits" → SELECT * FROM statements WHERE type = 'credit'
        
        EXPENSE/MONEY SPENT queries should use type = 'debit':
        - "expenses" → SELECT * FROM statements WHERE type = 'debit'
        - "spending" → SELECT * FROM statements WHERE type = 'debit'
        - "withdrawals" → SELECT * FROM statements WHERE type = 'debit'
        - "payments" → SELECT * FROM statements WHERE type = 'debit'
        - "debits" → SELECT * FROM statements WHERE type = 'debit'

        SQL QUERY GUIDELINES:
        - Only SELECT queries are allowed (no INSERT, UPDATE, DELETE, DROP, etc.)
        - Use aggregation functions (SUM, COUNT, AVG, etc.) for calculations
        - Format dates appropriately and handle different date formats
        - Use CASE statements for conditional logic
        - Use LIKE operator for pattern matching in descriptions
        - NEVER use type = 'income' - there is no such value in the database

        Remember: 
        - You MUST use the execute_sql_query tool to run queries and get actual data
        - Once you get results from a tool, analyze them and provide the answer
        - Never make assumptions about data - always query first
        - Do not repeat the same query unless it failed
        - Always map financial terminology correctly: income = credit, expenses = debit`,
      },
      {
        role: "user",
        content: query,
      },
    ];

    let maxIterations = 5; // Reduced to prevent infinite loops
    let currentIteration = 0;
    let lastToolCalls: string[] = []; // Track recent tool calls to detect loops

    while (currentIteration < maxIterations) {
      console.log(`Chat iteration ${currentIteration + 1}/${maxIterations}`);

      const response = await client.path("/chat/completions").post({
        body: {
          messages,
          ...modelParams,
          tools: tools.map((tool) => ({
            type: "function",
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters,
            },
          })),
          tool_choice: "auto",
        },
      });

      if (isUnexpected(response)) {
        throw new Error(`LLM API error: ${response.body.error}`);
      }

      const assistantMessage = response.body.choices[0].message;
      console.log(
        "Raw assistant message:",
        JSON.stringify(assistantMessage, null, 2)
      );

      messages.push(assistantMessage);

      // Check if the assistant wants to call a tool
      if (
        assistantMessage.tool_calls &&
        assistantMessage.tool_calls.length > 0
      ) {
        const currentToolCallSignatures = assistantMessage.tool_calls.map(
          (tc: any) =>
            `${tc.function.name}:${JSON.stringify(tc.function.arguments)}`
        );

        console.log("Current tool calls:", currentToolCallSignatures);
        console.log("Last tool calls:", lastToolCalls);

        // Check for infinite loop (same tool calls as last iteration)
        if (
          currentIteration > 0 &&
          JSON.stringify(currentToolCallSignatures) ===
            JSON.stringify(lastToolCalls)
        ) {
          console.log("Detected infinite loop - same tool calls repeated");
          return NextResponse.json({
            answer:
              "I apologize, but I encountered an issue processing your request. I was able to execute the query successfully, but there seems to be a communication issue. Based on the query results, I can see there is data in the database. Please try rephrasing your question or ask for specific details.",
            iterations: currentIteration + 1,
            debug: "Infinite loop detected",
          });
        }

        lastToolCalls = currentToolCallSignatures;

        // Execute all tool calls
        for (const toolCall of assistantMessage.tool_calls) {
          const toolName = toolCall.function.name;
          const parameters = JSON.parse(toolCall.function.arguments || "{}");

          console.log(
            `Executing tool: ${toolName} with parameters:`,
            parameters
          );

          try {
            const toolResult = await executeToolCall(toolName, parameters);
            console.log(`Tool ${toolName} result:`, toolResult);

            // Format the tool result more clearly for the LLM
            const formattedResult = {
              tool_name: toolName,
              success: true,
              data: toolResult,
              message: `Successfully executed ${toolName}`,
            };

            // Add the tool result back to the conversation
            messages.push({
              role: "tool",
              content: JSON.stringify(formattedResult, null, 2),
              tool_call_id: toolCall.id,
            });

            console.log(`Tool ${toolName} executed successfully`);
          } catch (error) {
            const errorMsg = `Error executing ${toolName}: ${
              error instanceof Error ? error.message : "Unknown error"
            }`;
            console.error(errorMsg);

            messages.push({
              role: "tool",
              content: JSON.stringify(
                {
                  tool_name: toolName,
                  success: false,
                  error: errorMsg,
                  message: `Failed to execute ${toolName}`,
                },
                null,
                2
              ),
              tool_call_id: toolCall.id,
            });
          }
        }

        currentIteration++;
        continue; // Continue the conversation loop
      } else {
        // No more tool calls, we have the final answer
        console.log("Final answer received:", assistantMessage.content);
        return NextResponse.json({
          answer: assistantMessage.content,
          iterations: currentIteration + 1,
        });
      }
    }

    // If we reach here, we've hit max iterations
    console.log("Reached maximum iterations");
    return NextResponse.json({
      answer:
        "I apologize, but I reached the maximum number of iterations while processing your question. The query was executed successfully, but I'm having trouble providing a final response. Please try asking a simpler question or rephrase your request.",
      iterations: currentIteration,
      debug: "Max iterations reached",
    });
  } catch (error: unknown) {
    console.error("Chat API error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to process chat request: ${errorMessage}` },
      { status: 500 }
    );
  }
}
