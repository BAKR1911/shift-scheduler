import { NextRequest, NextResponse } from "next/server";
import { readJson, writeJson } from "@/lib/data";
import { checkAuth, unauthorizedResponse } from "@/lib/auth";
import type { ScheduleEntry, Settings } from "@/lib/scheduler";

interface ScheduleData {
  entries: ScheduleEntry[];
  cumulativeStats: Record<number, { totalHours: number; totalDays: number; weekendDays: number; saturdays: number; fridays: number; offWeeks: number }>;
  generatedMonths: string[];
}

const FILE = "schedule.json";
const SETTINGS_FILE = "settings.json";

function getDefaultSettings(): Settings {
  return {
    shifts: {
      Weekday: { start: "05:00 PM", end: "10:00 PM", hours: 5 },
      Thursday: { start: "05:00 PM", end: "10:00 PM", hours: 5 },
      Friday: { start: "01:00 PM", end: "10:00 PM", hours: 9 },
      Saturday: { start: "01:00 PM", end: "10:00 PM", hours: 9 },
    },
    weekStart: "Saturday",
    holidays: [],
  };
}

// PUT: Toggle holiday for specific date
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  if (!checkAuth(request)) return unauthorizedResponse();
  try {
    const { date } = await params;
    const body = await request.json();
    const { isHoliday } = body;

    if (typeof isHoliday !== "boolean") {
      return NextResponse.json({ error: "isHoliday (boolean) is required" }, { status: 400 });
    }

    const scheduleData = readJson<ScheduleData>(FILE, { entries: [], cumulativeStats: {}, generatedMonths: [] });
    const entryIdx = scheduleData.entries.findIndex((e) => e.date === date);

    if (entryIdx === -1) {
      return NextResponse.json({ error: "No schedule entry found for this date" }, { status: 404 });
    }

    scheduleData.entries[entryIdx].isHoliday = isHoliday;

    // Also update settings holidays list
    const settings = readJson<Settings>(SETTINGS_FILE, getDefaultSettings());
    if (isHoliday) {
      if (!settings.holidays.includes(date)) {
        settings.holidays.push(date);
      }
    } else {
      settings.holidays = settings.holidays.filter((h) => h !== date);
    }
    writeJson(SETTINGS_FILE, settings);
    writeJson(FILE, scheduleData);

    return NextResponse.json({ entry: scheduleData.entries[entryIdx] });
  } catch (error) {
    console.error("Error toggling holiday:", error);
    return NextResponse.json({ error: "Failed to toggle holiday" }, { status: 500 });
  }
}

// DELETE: Delete specific shift entry
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  if (!checkAuth(request)) return unauthorizedResponse();
  try {
    const { date } = await params;
    const scheduleData = readJson<ScheduleData>(FILE, { entries: [], cumulativeStats: {}, generatedMonths: [] });

    const before = scheduleData.entries.length;
    scheduleData.entries = scheduleData.entries.filter((e) => e.date !== date);

    if (scheduleData.entries.length === before) {
      return NextResponse.json({ error: "No entry found for this date" }, { status: 404 });
    }

    writeJson(FILE, scheduleData);

    return NextResponse.json({ success: true, message: `Deleted entry for ${date}` });
  } catch (error) {
    console.error("Error deleting entry:", error);
    return NextResponse.json({ error: "Failed to delete entry" }, { status: 500 });
  }
}
