import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { processFileWithLLM } from "../../../lib/upload/llm-processor";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Check file size (50MB limit)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size exceeds 50MB limit" },
        { status: 400 }
      );
    }

    // Check file type
    const allowedTypes = ['.pdf', '.csv', '.xlsx', '.xls'];
    const fileExtension = path.extname(file.name).toLowerCase();
    
    if (!allowedTypes.includes(fileExtension)) {
      return NextResponse.json(
        { error: `Unsupported file type. Allowed: ${allowedTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Save file
    const timestamp = Date.now();
    const filename = `${timestamp}-${file.name}`;
    const filepath = path.join(uploadsDir, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filepath, buffer);

    try {
      // Process file with LLM
      const result = await processFileWithLLM(filepath, fileExtension, filename);

      return NextResponse.json({
        success: true,
        file: {
          filename: filename,
          originalName: file.name,
          size: file.size,
          type: fileExtension,
        },
        ...result,
      });
    } catch (processingError) {
      console.error("File processing error:", processingError);
      
      // Clean up uploaded file on processing error
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }

      return NextResponse.json(
        {
          error: `Failed to process file: ${
            processingError instanceof Error
              ? processingError.message
              : "Unknown processing error"
          }`,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      {
        error: `Upload failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      },
      { status: 500 }
    );
  }
}
