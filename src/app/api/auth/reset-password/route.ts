import { NextRequest, NextResponse } from "next/server";
import { resetPassword } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const result = resetPassword(email);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
