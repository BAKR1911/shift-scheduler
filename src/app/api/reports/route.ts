import { NextRequest, NextResponse } from "next/server";
import { readJson } from "@/lib/data";
import { checkAuth, unauthorizedResponse } from "@/lib/auth";
import { computeLocalStats } from "@/lib/scheduler";
import type { Employee, Settings, ScheduleEntry, CumulativeStats } from "@/lib/scheduler";

interface ScheduleData {
  entries: ScheduleEntry[];
  cumulativeStats: Record<number, CumulativeStats>;
  generatedMonths: string[];
}

const SCHEDULE_FILE = "schedule.json";
const EMP_FILE = "employees.json";

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

// GET: Return employee statistics and balance reports
export async function GET(request: NextRequest) {
  if (!checkAuth(request)) return unauthorizedResponse();
  try {
    const employees = readJson<Employee[]>(EMP_FILE, getDefaultEmployees());
    const scheduleData = readJson<ScheduleData>(SCHEDULE_FILE, {
      entries: [],
      cumulativeStats: {},
      generatedMonths: [],
    });

    const activeEmployees = employees.filter((e) => e.active);
    const n = activeEmployees.length;

    // Per-month stats
    const monthStats: Record<string, Record<number, {
      days: number;
      hours: number;
      weekend: number;
      sat: number;
      fri: number;
    }>> = {};

    for (const monthKey of scheduleData.generatedMonths) {
      monthStats[monthKey] = {};
      for (let i = 0; i < n; i++) {
        monthStats[monthKey][i] = { days: 0, hours: 0, weekend: 0, sat: 0, fri: 0 };
      }
    }

    for (const entry of scheduleData.entries) {
      const monthKey = entry.date.substring(0, 7);
      if (!monthStats[monthKey]) {
        monthStats[monthKey] = {};
        for (let i = 0; i < n; i++) {
          monthStats[monthKey][i] = { days: 0, hours: 0, weekend: 0, sat: 0, fri: 0 };
        }
      }
      if (monthStats[monthKey][entry.empIdx]) {
        monthStats[monthKey][entry.empIdx].days += 1;
        monthStats[monthKey][entry.empIdx].hours += entry.hours;
        if (entry.dayType === "Saturday" || entry.dayType === "Friday") {
          monthStats[monthKey][entry.empIdx].weekend += 1;
        }
        if (entry.dayType === "Saturday") monthStats[monthKey][entry.empIdx].sat += 1;
        if (entry.dayType === "Friday") monthStats[monthKey][entry.empIdx].fri += 1;
      }
    }

    // Current month stats
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const currentEntries = scheduleData.entries.filter((e) => e.date.startsWith(currentMonth));
    const localStats = computeLocalStats(currentEntries, n);

    // Overall stats
    const overallLocalStats = computeLocalStats(scheduleData.entries, n);

    // Balance indicator
    const allHours = activeEmployees.map((_, i) => overallLocalStats[i]?.hours || 0);
    const maxHours = Math.max(...allHours, 0);
    const minHours = Math.min(...allHours, 0);
    const avgHours = n > 0 ? allHours.reduce((a, b) => a + b, 0) / n : 0;
    const variance = maxHours - minHours;
    const avgAbsDev = n > 0 ? allHours.reduce((sum, h) => sum + Math.abs(h - avgHours), 0) / n : 0;

    let balanceStatus: "green" | "yellow" | "red";
    if (variance <= 10) {
      balanceStatus = "green";
    } else if (variance <= 25) {
      balanceStatus = "yellow";
    } else {
      balanceStatus = "red";
    }

    // Weekly overview matrix
    const weeklyMatrix: Record<string, Record<number, { days: number; hours: number }>> = {};
    for (const entry of scheduleData.entries) {
      const weekKey = `${entry.date.substring(0, 7)}-W${entry.weekNum + 1}`;
      if (!weeklyMatrix[weekKey]) {
        weeklyMatrix[weekKey] = {};
        for (let i = 0; i < n; i++) {
          weeklyMatrix[weekKey][i] = { days: 0, hours: 0 };
        }
      }
      if (weeklyMatrix[weekKey][entry.empIdx]) {
        weeklyMatrix[weekKey][entry.empIdx].days += 1;
        weeklyMatrix[weekKey][entry.empIdx].hours += entry.hours;
      }
    }

    return NextResponse.json({
      employees: activeEmployees.map((e, i) => ({
        id: e.id,
        name: e.name,
        hrid: e.hrid,
        idx: i,
      })),
      localStats,
      cumulativeStats: scheduleData.cumulativeStats,
      overallStats: overallLocalStats,
      monthStats,
      weeklyMatrix,
      balance: {
        status: balanceStatus,
        variance: Math.round(variance * 10) / 10,
        average: Math.round(avgHours * 10) / 10,
        avgAbsDeviation: Math.round(avgAbsDev * 10) / 10,
        max: Math.round(maxHours * 10) / 10,
        min: Math.round(minHours * 10) / 10,
      },
      generatedMonths: scheduleData.generatedMonths,
      totalEntries: scheduleData.entries.length,
      currentMonth,
    });
  } catch (error) {
    console.error("Error generating reports:", error);
    return NextResponse.json({ error: "Failed to generate reports" }, { status: 500 });
  }
}
