import fs from "fs";
import * as XLSX from 'xlsx';
import * as Papa from 'papaparse';
import pdfParse from 'pdf-parse';

/* load 'fs' for readFile and writeFile support */
XLSX.set_fs(fs);

export interface ProcessedFileData {
  text?: string;
  csvData?: Record<string, unknown>[];
  error?: string;
}

export async function processFileByType(filepath: string, fileExtension: string): Promise<ProcessedFileData> {
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
        resolve({ csvData: results.data as Record<string, unknown>[] });
      },
      error: (error: unknown) => {
        resolve({ error: `CSV parsing error: ${error instanceof Error ? error.message : 'Unknown error'}` });
      }
    });
  });
}

async function processExcelFile(filepath: string): Promise<ProcessedFileData> {
  const workbook = XLSX.readFile(filepath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const csvData = XLSX.utils.sheet_to_json(worksheet);
  return { csvData: csvData as Record<string, unknown>[] };
}
