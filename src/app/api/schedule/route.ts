import { NextRequest, NextResponse } from "next/server";
import { readJson, writeJson } from "@/lib/data";
import { checkAuth, unauthorizedResponse } from "@/lib/auth";
import { generateScheduleForMonth, generateScheduleForWeek, recalcScheduleHours, computeLocalStats, computeOffWeeks } from "@/lib/scheduler";
import type { Employee, Settings, ScheduleEntry, CumulativeStats } from "@/lib/scheduler";

interface ScheduleData {
  entries: ScheduleEntry[];
  cumulativeStats: Record<number, CumulativeStats>;
  generatedMonths: string[];
}

const FILE = "schedule.json";
const EMP_FILE = "employees.json";
const SETTINGS_FILE = "settings.json";

function getDefaultEmployees(): Employee[] {
  return [
    { id: 1, name: "Islam Rabia", hrid: "102843", active: true },
    { id: 2, name: "Mustafa Ali", hrid: "114831", active: true },
    { id: 3, name: "Mohamed Rashwan", hrid: "147956", active: true },
    { id: 4, name: "Mahmoud Rabia", hrid: "102054", active: true },
    { id: 5, name: "Mohamed Aahrar", hrid: "137254", active: true },
    { id: 6, name: "Abo Bakr", hrid: "141866", active: true },
    { id: 7, name: "Ahmed Khyr", hrid: "113319", active: true },
    { id: 8, name: "Ahmed Hisham", hrid: "92458", active: true },
  ];
}

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

function getDefaultScheduleData(): ScheduleData {
  return { entries: [], cumulativeStats: {}, generatedMonths: [] };
}

// GET: Return schedule data
export async function GET(request: NextRequest) {
  if (!checkAuth(request)) return unauthorizedResponse();
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");
    const year = searchParams.get("year");

    const scheduleData = readJson<ScheduleData>(FILE, getDefaultScheduleData());
    let entries = scheduleData.entries;

    if (month && year) {
      let prefix: string;
      if (month.includes("-")) {
        prefix = month;
      } else {
        prefix = `${year}-${String(month).padStart(2, "0")}`;
      }
      entries = entries.filter((e) => e.date.startsWith(prefix));
    } else if (month) {
      const prefix = month.includes("-") ? month : `2026-${String(month).padStart(2, "0")}`;
      entries = entries.filter((e) => e.date.startsWith(prefix));
    }

    const employees = readJson<Employee[]>(EMP_FILE, getDefaultEmployees());
    const activeCount = employees.filter((e) => e.active).length;
    const localStats = computeLocalStats(entries, activeCount);

    return NextResponse.json({
      entries,
      cumulativeStats: scheduleData.cumulativeStats,
      generatedMonths: scheduleData.generatedMonths,
      localStats,
    });
  } catch (error) {
    console.error("Error reading schedule:", error);
    return NextResponse.json({ error: "Failed to read schedule" }, { status: 500 });
  }
}

// POST: Generate new schedule
export async function POST(request: NextRequest) {
  if (!checkAuth(request)) return unauthorizedResponse();
  try {
    const body = await request.json();
    const { mode, year, month, weekStart } = body;

    if (!mode) {
      return NextResponse.json({ error: "Mode is required (week or month)" }, { status: 400 });
    }

    const employees = readJson<Employee[]>(EMP_FILE, getDefaultEmployees());
    const settings = readJson<Settings>(SETTINGS_FILE, getDefaultSettings());
    const scheduleData = readJson<ScheduleData>(FILE, getDefaultScheduleData());

    const activeEmployees = employees.filter((e) => e.active);

    if (activeEmployees.length < 2) {
      return NextResponse.json(
        { error: "Need at least 2 active employees" },
        { status: 400 }
      );
    }

    let newEntries: ScheduleEntry[] = [];
    let newCumStats: Record<number, CumulativeStats> = {};

    if (mode === "month") {
      if (!year || !month) {
        return NextResponse.json({ error: "Year and month are required for month mode" }, { status: 400 });
      }

      const monthKey = `${year}-${String(month).padStart(2, "0")}`;
      const existingMonthEntries = scheduleData.entries.filter((e) => e.date.startsWith(monthKey));

      if (existingMonthEntries.length > 0) {
        // Remove existing entries for this month and re-compute cumulative stats
        const otherEntries = scheduleData.entries.filter((e) => !e.date.startsWith(monthKey));
        
        // Recompute cumulative stats from remaining entries
        const tempCumStats: Record<number, CumulativeStats> = {};
        for (let i = 0; i < activeEmployees.length; i++) {
          tempCumStats[i] = {
            totalHours: 0, totalDays: 0, weekendDays: 0,
            saturdays: 0, fridays: 0, offWeeks: 0,
          };
        }
        for (const e of otherEntries) {
          if (!tempCumStats[e.empIdx]) continue;
          tempCumStats[e.empIdx].totalHours += e.hours;
          tempCumStats[e.empIdx].totalDays += 1;
          if (e.dayType === "Saturday" || e.dayType === "Friday") tempCumStats[e.empIdx].weekendDays += 1;
          if (e.dayType === "Saturday") tempCumStats[e.empIdx].saturdays += 1;
          if (e.dayType === "Friday") tempCumStats[e.empIdx].fridays += 1;
        }

        // Count off weeks from remaining entries
        const offWeeks = computeOffWeeks(otherEntries, activeEmployees.length);
        for (const [ei, count] of Object.entries(offWeeks)) {
          tempCumStats[Number(ei)].offWeeks = count;
        }

        // Regenerate with clean cumulative stats, passing remaining entries for consecutive OFF prevention
        const result = generateScheduleForMonth(year, month, activeEmployees, settings, tempCumStats, otherEntries);
        newEntries = result.entries;
        newCumStats = result.cumulativeStats;

        scheduleData.entries = [...otherEntries, ...newEntries];
        scheduleData.cumulativeStats = newCumStats;
      } else {
        const result = generateScheduleForMonth(
          year, month, activeEmployees, settings,
          scheduleData.cumulativeStats, scheduleData.entries
        );
        newEntries = result.entries;
        newCumStats = result.cumulativeStats;

        scheduleData.entries = [...scheduleData.entries, ...newEntries];
        scheduleData.cumulativeStats = newCumStats;
      }

      const monthKey2 = `${year}-${String(month).padStart(2, "0")}`;
      if (!scheduleData.generatedMonths.includes(monthKey2)) {
        scheduleData.generatedMonths.push(monthKey2);
      }
    } else if (mode === "week") {
      if (!weekStart) {
        return NextResponse.json({ error: "weekStart date is required for week mode" }, { status: 400 });
      }

      const result = generateScheduleForWeek(weekStart, activeEmployees, settings, scheduleData.cumulativeStats, scheduleData.entries);
      newEntries = result.entries;
      newCumStats = result.cumulativeStats;

      const newDates = new Set(newEntries.map((e) => e.date));
      scheduleData.entries = [
        ...scheduleData.entries.filter((e) => !newDates.has(e.date)),
        ...newEntries,
      ];
      scheduleData.cumulativeStats = newCumStats;
    } else if (mode === "recalc") {
      scheduleData.entries = recalcScheduleHours(scheduleData.entries, settings);
      const cumStats: Record<number, CumulativeStats> = {};
      for (let i = 0; i < activeEmployees.length; i++) {
        cumStats[i] = {
          totalHours: 0, totalDays: 0, weekendDays: 0,
          saturdays: 0, fridays: 0, offWeeks: 0,
        };
      }
      for (const e of scheduleData.entries) {
        if (e.isManual) continue;
        if (!cumStats[e.empIdx]) continue;
        cumStats[e.empIdx].totalHours += e.hours;
        cumStats[e.empIdx].totalDays += 1;
        if (e.dayType === "Saturday" || e.dayType === "Friday") cumStats[e.empIdx].weekendDays += 1;
        if (e.dayType === "Saturday") cumStats[e.empIdx].saturdays += 1;
        if (e.dayType === "Friday") cumStats[e.empIdx].fridays += 1;
      }
      const offWeeks = computeOffWeeks(scheduleData.entries, activeEmployees.length);
      for (const [ei, count] of Object.entries(offWeeks)) {
        cumStats[Number(ei)].offWeeks = count;
      }
      scheduleData.cumulativeStats = cumStats;
    } else {
      return NextResponse.json({ error: "Invalid mode. Use 'week', 'month', or 'recalc'" }, { status: 400 });
    }

    writeJson(FILE, scheduleData);

    const localStats = computeLocalStats(scheduleData.entries, activeEmployees.length);

    return NextResponse.json({
      entries: scheduleData.entries,
      cumulativeStats: scheduleData.cumulativeStats,
      generatedMonths: scheduleData.generatedMonths,
      localStats,
      generated: newEntries.length,
    });
  } catch (error) {
    console.error("Error generating schedule:", error);
    const message = error instanceof Error ? error.message : "Failed to generate schedule";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE: Clear schedule data
export async function DELETE(request: NextRequest) {
  if (!checkAuth(request)) return unauthorizedResponse();
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");

    if (month) {
      const scheduleData = readJson<ScheduleData>(FILE, getDefaultScheduleData());
      scheduleData.entries = scheduleData.entries.filter((e) => !e.date.startsWith(month));
      scheduleData.generatedMonths = scheduleData.generatedMonths.filter((m) => m !== month);

      const employees = readJson<Employee[]>(EMP_FILE, getDefaultEmployees());
      const activeEmployees = employees.filter((e) => e.active);
      const cumStats: Record<number, CumulativeStats> = {};
      for (let i = 0; i < activeEmployees.length; i++) {
        cumStats[i] = {
          totalHours: 0, totalDays: 0, weekendDays: 0,
          saturdays: 0, fridays: 0, offWeeks: 0,
        };
      }
      for (const e of scheduleData.entries) {
        if (!cumStats[e.empIdx]) continue;
        cumStats[e.empIdx].totalHours += e.hours;
        cumStats[e.empIdx].totalDays += 1;
        if (e.dayType === "Saturday" || e.dayType === "Friday") cumStats[e.empIdx].weekendDays += 1;
        if (e.dayType === "Saturday") cumStats[e.empIdx].saturdays += 1;
        if (e.dayType === "Friday") cumStats[e.empIdx].fridays += 1;
      }
      const offWeeks = computeOffWeeks(scheduleData.entries, activeEmployees.length);
      for (const [ei, count] of Object.entries(offWeeks)) {
        cumStats[Number(ei)].offWeeks = count;
      }
      scheduleData.cumulativeStats = cumStats;

      writeJson(FILE, scheduleData);
      return NextResponse.json({ success: true, message: `Cleared schedule for ${month}` });
    } else {
      writeJson(FILE, getDefaultScheduleData());
      return NextResponse.json({ success: true, message: "Cleared all schedule data" });
    }
  } catch (error) {
    console.error("Error clearing schedule:", error);
    return NextResponse.json({ error: "Failed to clear" }, { status: 500 });
  }
}
