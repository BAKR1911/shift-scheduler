import { NextRequest, NextResponse } from "next/server";
import { readJson, writeJson } from "@/lib/data";

interface AuthData {
  username: string;
  password: string;
  email: string;
  token: string;
}

const AUTH_FILE = "auth.json";

function generateToken(): string {
  const array = new Uint8Array(32);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < 32; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

function readAuthData(): AuthData {
  return readJson<AuthData>(AUTH_FILE, {
    username: "abubakr.ahmed",
    password: "devopt",
    email: "abubakr.ahmed@helpdesk.com",
    token: "",
  });
}

function writeAuthData(data: AuthData): void {
  writeJson(AUTH_FILE, data);
}

/**
 * Validates a token from the Authorization header.
 * Returns true if authenticated, false otherwise.
 */
export function checkAuth(request: NextRequest): boolean {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader) return false;

    const token = authHeader.replace("Bearer ", "");
    if (!token) return false;

    const authData = readAuthData();
    return authData.token === token && authData.token !== "";
  } catch {
    return false;
  }
}

/**
 * Returns an unauthorized response. Use this when checkAuth fails.
 */
export function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/**
 * Authenticates a user with username and password.
 * Returns { success: true, token, username, email } on success.
 * Returns { error: string } on failure.
 */
export function authenticateUser(username: string, password: string): { success: true; token: string; username: string; email: string } | { error: string } {
  const authData = readAuthData();

  if (username !== authData.username || password !== authData.password) {
    return { error: "Invalid credentials" };
  }

  const token = generateToken();
  authData.token = token;
  writeAuthData(authData);

  return {
    success: true,
    token,
    username: authData.username,
    email: authData.email,
  };
}

/**
 * Logs out a user by clearing their token.
 */
export function logoutUser(token: string): boolean {
  const authData = readAuthData();

  if (authData.token !== token || authData.token === "") {
    return false;
  }

  authData.token = "";
  writeAuthData(authData);
  return true;
}

/**
 * Changes a user's password.
 */
export function changePassword(
  token: string,
  currentPassword: string,
  newPassword: string
): { success: true } | { error: string } {
  const authData = readAuthData();

  if (authData.token !== token || authData.token === "") {
    return { error: "Unauthorized" };
  }

  if (currentPassword !== authData.password) {
    return { error: "Current password is incorrect" };
  }

  if (!newPassword || newPassword.length < 4) {
    return { error: "New password must be at least 4 characters" };
  }

  authData.password = newPassword;
  writeAuthData(authData);

  return { success: true };
}

/**
 * Checks if a token is currently valid.
 */
export function checkToken(token: string): { authenticated: boolean; username?: string; email?: string } {
  const authData = readAuthData();

  if (authData.token === token && authData.token !== "") {
    return {
      authenticated: true,
      username: authData.username,
      email: authData.email,
    };
  }

  return { authenticated: false };
}

/**
 * Simulates sending a password reset email.
 */
export function resetPassword(email: string): { success: boolean; message: string } {
  const authData = readAuthData();

  // Simulate - just check if email matches
  if (email && email.toLowerCase() === authData.email.toLowerCase()) {
    return {
      success: true,
      message: "Password reset link sent to your email",
    };
  }

  // Even if email doesn't match, return success (security best practice)
  return {
    success: true,
    message: "If the email exists, a password reset link has been sent",
  };
}
