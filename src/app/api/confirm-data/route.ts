import { NextRequest, NextResponse } from "next/server";
import { dbManager, StatementRow } from "../../../lib/dbManager";

// Interface for legacy compatibility
interface StatementRowLegacy {
  date: string;
  description: string;
  amount: number;
  type: "credit" | "debit";
}

async function saveToDatabase(rows: StatementRowLegacy[]) {
  const statements: Omit<StatementRow, 'id' | 'created_at'>[] = rows.map(row => ({
    date: row.date,
    description: row.description,
    amount: row.amount,
    type: row.type,
    source: 'manual'
  }));

  await dbManager.saveStatements(statements, true); // Clear existing data
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
