import { NextRequest, NextResponse } from "next/server";
import { readJson, writeJson } from "@/lib/data";
import { checkAuth, unauthorizedResponse } from "@/lib/auth";
import type { Settings } from "@/lib/scheduler";

const FILE = "settings.json";

function getDefaultSettings(): Settings {
  return {
    shifts: {
      Weekday: { start: "05:00 PM", end: "10:00 PM", hours: 5 },
      Thursday: { start: "05:00 PM", end: "10:00 PM", hours: 5 },
      Friday: { start: "01:00 PM", end: "10:00 PM", hours: 9 },
      Saturday: { start: "01:00 PM", end: "10:00 PM", hours: 9 },
      Holiday: { start: "10:00 AM", end: "10:00 PM", hours: 12 },
    },
    summerTime: false,
    summerShifts: {
      Weekday: { start: "05:00 PM", end: "11:00 PM", hours: 6 },
      Thursday: { start: "05:00 PM", end: "11:00 PM", hours: 6 },
      Friday: { start: "01:00 PM", end: "11:00 PM", hours: 10 },
      Saturday: { start: "01:00 PM", end: "11:00 PM", hours: 10 },
    },
    weekStart: "Saturday",
    holidays: [],
  };
}

// GET: Return settings
export async function GET(request: NextRequest) {
  if (!checkAuth(request)) return unauthorizedResponse();
  try {
    const settings = readJson<Settings>(FILE, getDefaultSettings());
    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Error reading settings:", error);
    return NextResponse.json({ error: "Failed to read settings" }, { status: 500 });
  }
}

// PUT: Update settings
export async function PUT(request: NextRequest) {
  if (!checkAuth(request)) return unauthorizedResponse();
  try {
    const body = await request.json();
    const { shifts, weekStart, holidays, summerTime, summerShifts } = body;

    const settings = readJson<Settings>(FILE, getDefaultSettings());

    if (shifts) {
      for (const [key, value] of Object.entries(shifts)) {
        if (!value.start || !value.end || typeof value.hours !== "number") {
          return NextResponse.json(
            { error: `Invalid shift configuration for ${key}` },
            { status: 400 }
          );
        }
      }
      settings.shifts = shifts;
    }

    if (weekStart) settings.weekStart = weekStart;
    if (Array.isArray(holidays)) settings.holidays = holidays;
    if (typeof summerTime === "boolean") settings.summerTime = summerTime;
    if (summerShifts) {
      for (const [key, value] of Object.entries(summerShifts)) {
        if (!value.start || !value.end || typeof value.hours !== "number") {
          return NextResponse.json(
            { error: `Invalid summer shift configuration for ${key}` },
            { status: 400 }
          );
        }
      }
      settings.summerShifts = summerShifts;
    }

    writeJson(FILE, settings);

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
