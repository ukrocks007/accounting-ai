import { NextRequest, NextResponse } from "next/server";
import { isUnexpected } from "@azure-rest/ai-inference";
import {
  createModelClient,
  getModelRequestParams,
} from "../../../utils/modelUtils";
import { getLLMFormattedTools } from "../../../lib/chat/tools";
import { executeToolCall } from "../../../lib/chat/tool-executor";
import { SYSTEM_PROMPT } from "../../../lib/chat/prompts";

interface ChatResponse {
  answer: string;
  iterations: number;
  data?: {
    transactions?: Record<string, unknown>[];
  };
  debug?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<ChatResponse | { error: string }>> {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messages: any[] = [
      {
        role: "system",
        content: SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: query,
      },
    ];

    const maxIterations = 5; // Reduced to prevent infinite loops
    let currentIteration = 0;
    let lastToolCalls: string[] = []; // Track recent tool calls to detect loops
    let extractedTransactions: Record<string, unknown>[] = []; // Track transaction data from tool calls

    while (currentIteration < maxIterations) {
      console.log(`Chat iteration ${currentIteration + 1}/${maxIterations}`);

      const response = await client.path("/chat/completions").post({
        body: {
          messages,
          ...modelParams,
          tools: getLLMFormattedTools(),
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

            // Extract transaction data if this was a SQL query for statements
            if (toolName === 'execute_sql_query' && 
                typeof toolResult === 'object' && 
                toolResult !== null && 
                'is_transaction_data' in toolResult && 
                toolResult.is_transaction_data &&
                'results' in toolResult) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              extractedTransactions = toolResult.results as any[];
            }

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
        
        // Prepare response data
        const responseData: ChatResponse = {
          answer: assistantMessage.content || "No response generated",
          iterations: currentIteration + 1,
        };

        // Include structured data if we have transaction data
        if (extractedTransactions.length > 0) {
          responseData.data = {
            transactions: extractedTransactions
          };
        }

        return NextResponse.json(responseData);
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
