import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { jsonrepair } from "jsonrepair";
import ModelClient, { isUnexpected } from "@azure-rest/ai-inference";
import { AzureKeyCredential } from "@azure/core-auth";

async function saveToDatabase(
  rows: Array<{
    date: string;
    description: string;
    amount: number;
    type: "credit" | "debit";
  }>
) {
  const db = await open({
    filename: "./database.sqlite",
    driver: sqlite3.Database,
  });

  // Create main statements table if it doesn't exist
  await db.exec(`CREATE TABLE IF NOT EXISTS statements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT,
    description TEXT,
    amount REAL,
    type TEXT
  )`);

  // Clear existing data (since we're not tracking files anymore)
  await db.run('DELETE FROM statements');

  const insertStatement = `INSERT INTO statements (date, description, amount, type) VALUES (?, ?, ?, ?)`;

  for (const row of rows) {
    await db.run(
      insertStatement,
      row.date,
      row.description,
      row.amount,
      row.type
    );
  }

  await db.close();
}

async function processFileWithLLM(filepath: string) {
  const fileBuffer = fs.readFileSync(filepath);

  const client = ModelClient(
    "https://models.github.ai/inference",
    new AzureKeyCredential(process.env["GITHUB_TOKEN"] || "")
  );

  const response = await client.path("/chat/completions").post({
    body: {
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant. Process the uploaded Excel file and extract rows of statements. Make sure you only return the rows in JSON format and nothing else.
          The file is an Excel file containing financial statements. In case you are not able to give a response, return an empty array. In case of overflow, return as many rows as you can but
          make sure to return a valid JSON format.
          The return JSON looks like this:
          {
            "overflow": true | false,
            rows: [
                {
                "date": "2023-01-01",
                "description": "Sample transaction",
                "amount": 100.0,
                "type": "credit" | "debit"
                }
            ]
        }
`,
        },
        {
          role: "user",
          content: fileBuffer.toString("base64"),
        },
      ],
      temperature: 0.8,
      top_p: 0.1,
      max_tokens: 4096,
      model: "meta/Llama-4-Scout-17B-16E-Instruct",
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
        (lastRow.credit || lastRow.debit)
      ) {
        return parsedResult.rows;
      } else {
        return parsedResult.rows.slice(0, -1); // Remove the last row if it doesn't have valid data
      }
    }
  } catch (error) {
    throw new Error("Failed to parse or repair JSON response");
  }
}

export async function POST(request: NextRequest) {
  try {
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

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    fs.writeFileSync(filepath, buffer);

    const rows = await processFileWithLLM(filepath);
    await saveToDatabase(rows);

    return NextResponse.json({
      message: "File processed and data saved successfully.",
      file: {
        filename,
        originalname: file.name,
        size: file.size,
        path: filepath,
      },
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
