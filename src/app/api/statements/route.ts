import { NextRequest, NextResponse } from "next/server";
import { DatabaseManager } from "@/lib/dbManager";

const dbManager = DatabaseManager.getInstance();

// GET /api/statements - Get paginated statements with optional filters
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Pagination parameters
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = (page - 1) * limit;

    // Filter parameters
    const filters = {
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
      type: searchParams.get("type") as "credit" | "debit" | undefined,
      minAmount: searchParams.get("minAmount") ? parseFloat(searchParams.get("minAmount")!) : undefined,
      maxAmount: searchParams.get("maxAmount") ? parseFloat(searchParams.get("maxAmount")!) : undefined,
      limit,
      offset,
    };

    // Get statements and total count
    const [statements, totalCount] = await Promise.all([
      dbManager.getStatements(filters),
      dbManager.getStatementsCount({
        startDate: filters.startDate,
        endDate: filters.endDate,
        type: filters.type,
        minAmount: filters.minAmount,
        maxAmount: filters.maxAmount,
      }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      success: true,
      data: statements,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching statements:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch statements" },
      { status: 500 }
    );
  }
}

// POST /api/statements - Create a new statement
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const { date, description, amount, type, source } = body;

    if (!date || !description || amount === undefined || !type) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: date, description, amount, type",
        },
        { status: 400 }
      );
    }

    if (!["credit", "debit"].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Type must be either "credit" or "debit"' },
        { status: 400 }
      );
    }

    const newStatementId = await dbManager.createStatement({
      date,
      description,
      amount: parseFloat(amount),
      type,
      source: source || "manual",
    });

    const newStatement = await dbManager.getStatementById(newStatementId);

    return NextResponse.json(
      {
        success: true,
        data: newStatement,
        message: "Statement created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating statement:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create statement" },
      { status: 500 }
    );
  }
}
