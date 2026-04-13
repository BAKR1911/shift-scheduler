import { NextRequest, NextResponse } from "next/server";
import { readJson, writeJson } from "@/lib/data";
import { checkAuth, unauthorizedResponse } from "@/lib/auth";
import type { ScheduleEntry } from "@/lib/scheduler";

interface ScheduleData {
  entries: ScheduleEntry[];
  cumulativeStats: Record<number, { totalHours: number; totalDays: number; weekendDays: number; saturdays: number; fridays: number; offWeeks: number }>;
  generatedMonths: string[];
}

const FILE = "schedule.json";

// POST: Swap two employees' shifts
export async function POST(request: NextRequest) {
  if (!checkAuth(request)) return unauthorizedResponse();
  try {
    const body = await request.json();
    const { empIdxA, empIdxB, month } = body;

    if (empIdxA === undefined || empIdxB === undefined) {
      return NextResponse.json({ error: "empIdxA and empIdxB are required" }, { status: 400 });
    }

    if (empIdxA === empIdxB) {
      return NextResponse.json({ error: "Cannot swap employee with themselves" }, { status: 400 });
    }

    const scheduleData = readJson<ScheduleData>(FILE, { entries: [], cumulativeStats: {}, generatedMonths: [] });

    let entries = scheduleData.entries;

    // Filter by month if provided
    if (month) {
      const prefix = `${month}`;
      entries = entries.filter((e) => e.date.startsWith(prefix));
    }

    // Find all entries for empIdxA and empIdxB
    const aEntries = scheduleData.entries.filter((e) => e.empIdx === empIdxA);
    const bEntries = scheduleData.entries.filter((e) => e.empIdx === empIdxB);

    if (aEntries.length === 0 && bEntries.length === 0) {
      return NextResponse.json({ error: "No entries found for either employee" }, { status: 404 });
    }

    // Perform the swap
    const swappedCount = { a: 0, b: 0 };

    for (const entry of scheduleData.entries) {
      if (entry.empIdx === empIdxA) {
        entry.empIdx = empIdxB;
        // Keep names from the other employee's entries
        const bEntry = bEntries.find(
          (be) => be.weekNum === entry.weekNum
        );
        if (bEntry) {
          entry.empName = bEntry.empName;
          entry.empHrid = bEntry.empHrid;
        }
        swappedCount.a++;
      } else if (entry.empIdx === empIdxB) {
        entry.empIdx = empIdxA;
        const aEntry = aEntries.find(
          (ae) => ae.weekNum === entry.weekNum
        );
        if (aEntry) {
          entry.empName = aEntry.empName;
          entry.empHrid = aEntry.empHrid;
        }
        swappedCount.b++;
      }
    }

    // Also swap off person references
    for (const entry of scheduleData.entries) {
      if (entry.offPersonIdx === empIdxA) {
        entry.offPersonIdx = empIdxB;
        // Find B's name from entries where B is the off person
        const bOff = scheduleData.entries.find(
          (e) => e.offPersonIdx === empIdxA && e.date !== entry.date
        );
        if (bEntries.length > 0) {
          entry.offPerson = bEntries[0].empName;
          entry.offPersonHrid = bEntries[0].empHrid;
        }
      } else if (entry.offPersonIdx === empIdxB) {
        entry.offPersonIdx = empIdxA;
        if (aEntries.length > 0) {
          entry.offPerson = aEntries[0].empName;
          entry.offPersonHrid = aEntries[0].empHrid;
        }
      }
    }

    writeJson(FILE, scheduleData);

    return NextResponse.json({
      success: true,
      swappedA: swappedCount.a,
      swappedB: swappedCount.b,
      message: `Swapped ${swappedCount.a + swappedCount.b} entries`,
    });
  } catch (error) {
    console.error("Error swapping employees:", error);
    return NextResponse.json({ error: "Failed to swap employees" }, { status: 500 });
  }
}
