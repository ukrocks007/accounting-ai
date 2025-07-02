import { NextRequest, NextResponse } from "next/server";
import { generateCompletion } from "@/utils/modelUtils";

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();
    
    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Test the upload processor (which should be configured for Ollama)
    const testMessages = [
      {
        role: "system" as const,
        content: `You are a financial document processor. Extract transaction data from the provided content and return it as a JSON object.

        Each transaction should have these exact fields:
        - date: string (YYYY-MM-DD format)
        - description: string (transaction description)
        - amount: number (always positive, regardless of credit/debit)
        - type: string (either "credit" for money received or "debit" for money spent)

        Return only valid JSON, no additional text.`
      },
      {
        role: "user" as const,
        content: message
      }
    ];

    const startTime = Date.now();
    const response = await generateCompletion(testMessages, 'upload');
    const endTime = Date.now();

    const content = response.choices[0]?.message?.content;
    
    if (!content) {
      return NextResponse.json(
        { error: "No response from model" },
        { status: 500 }
      );
    }

    // Try to parse JSON from response
    let parsedJson = null;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedJson = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      // JSON parsing failed, but we still have a response
    }

    return NextResponse.json({
      success: true,
      response: content,
      parsedJson,
      processingTime: endTime - startTime,
      message: "Ollama test completed successfully"
    });

  } catch (error) {
    console.error('Ollama test error:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Unknown error occurred",
        details: "Make sure Ollama is running and llama3:8b model is installed"
      },
      { status: 500 }
    );
  }
}
