// Tool interface for the LLM
export interface Tool {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, unknown>;
    required: string[];
  };
}

// Tools available to the LLM
export const tools: Tool[] = [
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
];

// Convert tools to LLM format
export const getLLMFormattedTools = () => {
  return tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
};
