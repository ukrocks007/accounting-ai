import { dbManager } from "../dbManager";

// Database utility functions
export async function getTableSchema() {
  return await dbManager.getSchema();
}

export async function executeQuery(query: string) {
  return await dbManager.executeQuery(query);
}

export async function getDataSummary() {
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

export async function validateSqlQuery(query: string) {
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
