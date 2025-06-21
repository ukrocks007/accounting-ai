import {
  getTableSchema,
  executeQuery,
  getDataSummary,
  validateSqlQuery,
} from "./database-operations";

interface ToolParameters {
  query?: string;
  [key: string]: unknown;
}

export async function executeToolCall(toolName: string, parameters: ToolParameters) {
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
        
        // Check if this is a transaction query and format appropriately
        const isTransactionQuery = parameters.query.toLowerCase().includes('select') && 
                                   parameters.query.toLowerCase().includes('statements');
        
        return {
          query: parameters.query,
          results: results,
          row_count: results.length,
          is_transaction_data: isTransactionQuery,
          formatted_results: isTransactionQuery ? results : undefined
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

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  } catch (error) {
    console.error(`Error executing tool ${toolName}:`, error);
    throw error;
  }
}
