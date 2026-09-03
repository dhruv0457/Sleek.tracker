import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    error: {
      code: "not_found",
      message: "The requested API endpoint does not exist.",
      resolution: "Check the API documentation at /api/docs or /openapi.json for valid endpoints."
    }
  }, { status: 404 });
}

export async function POST() {
  return NextResponse.json({
    error: {
      code: "not_found",
      message: "The requested API endpoint does not exist.",
      resolution: "Check the API documentation at /api/docs or /openapi.json for valid endpoints."
    }
  }, { status: 404 });
}

export async function PUT() {
  return NextResponse.json({
    error: {
      code: "not_found",
      message: "The requested API endpoint does not exist."
    }
  }, { status: 404 });
}

export async function DELETE() {
  return NextResponse.json({
    error: {
      code: "not_found",
      message: "The requested API endpoint does not exist."
    }
  }, { status: 404 });
}
