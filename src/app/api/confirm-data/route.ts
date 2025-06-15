import { NextRequest, NextResponse } from "next/server";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

interface StatementRow {
  date: string;
  description: string;
  amount: number;
  type: "credit" | "debit";
}

async function saveToDatabase(rows: StatementRow[]) {
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

export async function POST(request: NextRequest) {
  try {
    const { data } = await request.json();

    if (!data || !Array.isArray(data)) {
      return NextResponse.json({ error: "Invalid data format." }, { status: 400 });
    }

    await saveToDatabase(data);

    return NextResponse.json({
      message: "Data saved successfully to database.",
      count: data.length,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: errorMessage || "Failed to save data." },
      { status: 500 }
    );
  }
}
