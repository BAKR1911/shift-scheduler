import { NextRequest, NextResponse } from "next/server";
import { checkToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json({ authenticated: false });
    }

    const token = authHeader.replace("Bearer ", "");
    const result = checkToken(token);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Auth check error:", error);
    return NextResponse.json({ authenticated: false });
  }
}
