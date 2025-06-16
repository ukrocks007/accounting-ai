import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { jsonrepair } from "jsonrepair";
import { isUnexpected } from "@azure-rest/ai-inference";
import { createModelClient, getModelRequestParams } from "../../../utils/modelUtils";
import { processDocumentForRAG } from "../../../utils/embeddings";
import * as XLSX from 'xlsx';
/* load 'fs' for readFile and writeFile support */
XLSX.set_fs(fs);
import * as Papa from 'papaparse';
import pdfParse from 'pdf-parse';

interface ProcessedFileData {
  text?: string;
  csvData?: any[];
  error?: string;
}

async function processFileByType(filepath: string, fileExtension: string): Promise<ProcessedFileData> {
  try {
    switch (fileExtension.toLowerCase()) {
      case '.pdf':
        return await processPDFFile(filepath);
      case '.csv':
        return await processCSVFile(filepath);
      case '.xlsx':
      case '.xls':
        return await processExcelFile(filepath);
      default:
        return { error: `Unsupported file type: ${fileExtension}` };
    }
  } catch (error) {
    return { error: `Error processing ${fileExtension} file: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

async function processPDFFile(filepath: string): Promise<ProcessedFileData> {
  try {
    const fileBuffer = fs.readFileSync(filepath);
    const pdfData = await pdfParse(fileBuffer);
    return { text: pdfData.text };
  } catch (error) {
    console.error('PDF processing error:', error);
    return { error: `Failed to process PDF: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

async function processCSVFile(filepath: string): Promise<ProcessedFileData> {
  const fileContent = fs.readFileSync(filepath, 'utf8');
  return new Promise((resolve) => {
    Papa.parse(fileContent, {
      header: true,
      complete: (results) => {
        resolve({ csvData: results.data });
      },
      error: (error: any) => {
        resolve({ error: `CSV parsing error: ${error.message}` });
      }
    });
  });
}

async function processExcelFile(filepath: string): Promise<ProcessedFileData> {
  const workbook = XLSX.readFile(filepath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const csvData = XLSX.utils.sheet_to_json(worksheet);
  return { csvData };
}

async function processFileWithLLM(filepath: string, fileExtension: string, filename: string) {
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
    
    // Check if text is large and should be processed with RAG
    if (contentToProcess.length > 4096) {
      try {
        const ragResult = await processDocumentForRAG(
          contentToProcess,
          filename,
          fileExtension
        );
        
        if (ragResult.stored) {
          console.log(`Document ${filename} stored in RAG with ${ragResult.chunkCount} chunks`);
          ragProcessed = true;
          
          // For large documents, truncate the content sent to LLM but still process what we can
          contentToProcess = contentToProcess.substring(0, 4000) + "\n\n[Document is large and has been stored for RAG retrieval. Processing first 4000 characters for immediate extraction.]";
        }
      } catch (error) {
        console.error('RAG processing failed, continuing with truncated content:', error);
        contentToProcess = contentToProcess.substring(0, 4000) + "\n\n[Document truncated due to size]";
      }
    }
  } else {
    // Fallback: read file as base64 (for backwards compatibility)
    const fileBuffer = fs.readFileSync(filepath);
    contentToProcess = fileBuffer.toString("base64");
  }

  const response = await client.path("/chat/completions").post({
    body: {
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant. Process the uploaded financial statement file and extract rows of transactions. The file can be in various formats (CSV, Excel, PDF).

For structured data (CSV/Excel), you'll receive JSON data. For PDF, you'll receive extracted text. For other formats, you'll receive base64 encoded data.

Make sure you only return the transactions in JSON format and nothing else. Look for columns that represent:
- Date (various formats like MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD)
- Description/Transaction details/Memo
- Amount (positive or negative numbers, or separate debit/credit columns)
- Transaction type (debit/credit, or infer from amount sign)

In case you are not able to give a response, return an empty array. In case of overflow, return as many rows as you can but make sure to return a valid JSON format.

The return JSON looks like this:
{
  "overflow": true | false,
  "rows": [
    {
      "date": "2023-01-01",
      "description": "Sample transaction",
      "amount": 100.0,
      "type": "credit" | "debit"
    }
  ]
}

Important: 
- Convert all dates to YYYY-MM-DD format
- Ensure amounts are positive numbers
- Set type as "debit" for expenses/withdrawals and "credit" for income/deposits
- Clean up descriptions to remove extra spaces and characters`,
        },
        {
          role: "user",
          content: contentToProcess,
        },
      ],
      ...modelParams,
    },
  });

  if (isUnexpected(response)) {
    throw response.body.error;
  }

  const result = response.body.choices[0].message.content;

  try {
    const repairedJson = jsonrepair(result || "");
    const parsedResult = JSON.parse(repairedJson);

    if ((parsedResult?.rows || []).length) {
      const lastRow = parsedResult.rows[parsedResult.rows.length - 1];
      if (
        lastRow.date &&
        lastRow.description &&
        typeof lastRow.amount === 'number'
      ) {
        return { rows: parsedResult.rows, ragProcessed };
      } else {
        return { rows: parsedResult.rows.slice(0, -1), ragProcessed }; // Remove the last row if it doesn't have valid data
      }
    }
    return { rows: [], ragProcessed };
  } catch (error) {
    throw new Error("Failed to parse or repair JSON response");
  }
}

export async function POST(request: NextRequest) {
  try {
    debugger;
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }

    const uploadDir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filename = `${Date.now()}-${file.name}`;
    const filepath = path.join(uploadDir, filename);
    const fileExtension = path.extname(file.name);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    fs.writeFileSync(filepath, buffer);

    const result = await processFileWithLLM(filepath, fileExtension, filename);
    const { rows, ragProcessed } = result;

    // Return extracted data for review instead of saving immediately
    return NextResponse.json({
      message: ragProcessed 
        ? "File processed successfully. Large document has been stored for RAG retrieval. Please review the extracted data." 
        : "File processed successfully. Please review the extracted data.",
      file: {
        filename,
        originalname: file.name,
        size: file.size,
        path: filepath,
      },
      extractedData: rows,
      ragProcessed,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: errorMessage || "File upload failed." },
      { status: 500 }
    );
  }
}
