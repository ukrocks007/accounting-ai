import { NextRequest, NextResponse } from "next/server";
import { DatabaseManager } from "@/lib/dbManager";

const dbManager = DatabaseManager.getInstance();

// GET /api/statements/[id] - Get a single statement by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);

    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid statement ID" },
        { status: 400 }
      );
    }

    const statement = await dbManager.getStatementById(id);

    if (!statement) {
      return NextResponse.json(
        { success: false, error: "Statement not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: statement,
    });
  } catch (error) {
    console.error("Error fetching statement:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch statement" },
      { status: 500 }
    );
  }
}

// PUT /api/statements/[id] - Update a statement by ID
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);

    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid statement ID" },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Validate type if provided
    if (body.type && !["credit", "debit"].includes(body.type)) {
      return NextResponse.json(
        { success: false, error: 'Type must be either "credit" or "debit"' },
        { status: 400 }
      );
    }

    // Convert amount to number if provided
    if (body.amount !== undefined) {
      body.amount = parseFloat(body.amount);
      if (isNaN(body.amount)) {
        return NextResponse.json(
          { success: false, error: "Amount must be a valid number" },
          { status: 400 }
        );
      }
    }

    const updated = await dbManager.updateStatement(id, body);

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Statement not found or no changes made" },
        { status: 404 }
      );
    }

    const updatedStatement = await dbManager.getStatementById(id);

    return NextResponse.json({
      success: true,
      data: updatedStatement,
      message: "Statement updated successfully",
    });
  } catch (error) {
    console.error("Error updating statement:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update statement" },
      { status: 500 }
    );
  }
}

// DELETE /api/statements/[id] - Delete a statement by ID
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);

    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid statement ID" },
        { status: 400 }
      );
    }

    const deleted = await dbManager.deleteStatement(id);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Statement not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Statement deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting statement:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete statement" },
      { status: 500 }
    );
  }
}
