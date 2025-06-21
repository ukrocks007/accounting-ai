import { jsonrepair } from "jsonrepair";
import { isUnexpected } from "@azure-rest/ai-inference";
import { createModelClient, getModelRequestParams } from "../../utils/modelUtils";
import { processDocumentForBackgroundProcessing } from "../../utils/documentProcessor";
import { processFileByType } from "./file-processors";

export async function processFileWithLLM(filepath: string, fileExtension: string, filename: string) {
  // First, process the file based on its type to extract structured data
  const processedData = await processFileByType(filepath, fileExtension);
  
  if (processedData.error) {
    throw new Error(processedData.error);
  }

  // Get model client and parameters for upload processing
  const client = createModelClient('upload');
  const modelParams = getModelRequestParams('upload');

  let contentToProcess = '';
  let ragProcessed = false;
  
  if (processedData.csvData) {
    // For structured data (CSV, Excel), convert to a readable format for the LLM
    contentToProcess = JSON.stringify(processedData.csvData, null, 2);
  } else if (processedData.text) {
    // For PDF, use the extracted text
    contentToProcess = processedData.text;
    
    // Check if text is large and should be processed with background processing
    if (contentToProcess.length > 4096) {
      try {
        const ragResult = await processDocumentForBackgroundProcessing(
          contentToProcess,
          filename,
          fileExtension
        );
        ragProcessed = ragResult.stored;
        
        if (ragProcessed) {
          return {
            extractedData: [],
            ragProcessed: true,
            backgroundProcessing: {
              enabled: true,
              checkStatusEndpoint: "/api/background-process?action=status"
            }
          };
        }
      } catch (ragError) {
        console.error('RAG processing failed, falling back to direct processing:', ragError);
      }
    }
  }

  if (!contentToProcess) {
    throw new Error('No content could be extracted from the file');
  }

  // Process with LLM
  const messages = [
    {
      role: "system" as const,
      content: `You are a financial document processor. Extract transaction data from the provided content and return it as a JSON array.

      Each transaction should have these exact fields:
      - date: string (YYYY-MM-DD format)
      - description: string (transaction description)
      - amount: number (always positive, regardless of credit/debit)
      - type: string (either "credit" for money received or "debit" for money spent)

      Important rules:
      1. Amount should always be a positive number
      2. Use "credit" for money coming in (deposits, income, transfers in)
      3. Use "debit" for money going out (expenses, withdrawals, transfers out)
      4. Date must be in YYYY-MM-DD format
      5. Return only valid JSON array, no additional text
      6. If no transactions found, return empty array []
      
      Example format:
      [
        {
          "date": "2024-01-15",
          "description": "Salary deposit",
          "amount": 5000.00,
          "type": "credit"
        },
        {
          "date": "2024-01-16", 
          "description": "Grocery store purchase",
          "amount": 125.50,
          "type": "debit"
        }
      ]`
    },
    {
      role: "user" as const,
      content: `Extract transaction data from this financial document:\n\n${contentToProcess.substring(0, 4000)}`
    }
  ];

  const response = await client.path("/chat/completions").post({
    body: {
      messages,
      ...modelParams,
      temperature: 0.1, // Low temperature for consistent output
    },
  });

  if (isUnexpected(response)) {
    throw new Error(`LLM API error: ${response.body.error}`);
  }

  const content = response.body.choices[0].message.content;
  if (!content) {
    throw new Error('No response from LLM');
  }

  try {
    // Clean and repair JSON
    const cleanedJson = content.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
    const repairedJson = jsonrepair(cleanedJson);
    const extractedData = JSON.parse(repairedJson);

    return {
      extractedData: Array.isArray(extractedData) ? extractedData : [],
      ragProcessed,
      backgroundProcessing: ragProcessed ? {
        enabled: true,
        checkStatusEndpoint: "/api/background-process?action=status"
      } : undefined
    };
  } catch (parseError) {
    console.error('JSON parsing failed:', parseError);
    console.error('Raw content:', content);
    return {
      extractedData: [],
      ragProcessed,
      backgroundProcessing: ragProcessed ? {
        enabled: true,
        checkStatusEndpoint: "/api/background-process?action=status"
      } : undefined
    };
  }
}
