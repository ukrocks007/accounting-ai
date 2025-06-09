import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { jsonrepair } from 'jsonrepair';

async function saveToDatabase(rows: Array<{ date: string; description: string; debit: number, credit: number }>) {
  const db = await open({
    filename: './database.sqlite',
    driver: sqlite3.Database,
  });

  await db.exec(`CREATE TABLE IF NOT EXISTS statements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT,
    description TEXT,
    credit REAL,
    debit REAL
  )`);

  const insertStatement = `INSERT INTO statements (date, description, debit, credit) VALUES (?, ?, ?, ?)`;

  for (const row of rows) {
    await db.run(insertStatement, row.date, row.description, row.debit, row.credit);
  }
}

async function processFileWithLLM(filepath: string) {
  const fileBuffer = fs.readFileSync(filepath);
  debugger;
  const response = await fetch('https://models.github.ai/inference/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
    },
    body: JSON.stringify({
      messages: [
        {
          role: 'system',
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
          role: 'user',
          content: fileBuffer.toString('base64'),
        },
      ],
      temperature: 0.8,
      top_p: 0.1,
      max_tokens: 4096,
      model: 'meta/Llama-4-Maverick-17B-128E-Instruct-FP8',
    }),
  });

  const result = await response.json();
  try {
    const repairedJson = jsonrepair(result.choices[0].message.content);
    const parsedResult = JSON.parse(repairedJson);
    // if (response.ok) {
    if ((parsedResult?.rows || []).length) {
        const lastRow = parsedResult.rows[parsedResult.rows.length - 1];
        if (lastRow.date && lastRow.description && (lastRow.credit || lastRow.debit)) {
            return parsedResult.rows;
        } else {
            return parsedResult.rows.slice(0, -1); // Remove the last row if it doesn't have valid data
        }
    }
    // } else {
    //   throw new Error(parsedResult.error || 'Failed to process file with LLM');
    // }
  } catch (error) {
    throw new Error('Failed to parse or repair JSON response');
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 });
    }

    const uploadDir = path.join(process.cwd(), 'uploads');
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
      message: 'File processed and data saved successfully.',
      file: {
        filename,
        originalname: file.name,
        size: file.size,
        path: filepath,
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage || 'File upload failed.' }, { status: 500 });
  }
}
