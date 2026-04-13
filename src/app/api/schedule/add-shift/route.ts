import { NextRequest, NextResponse } from "next/server";
import { readJson, writeJson } from "@/lib/data";
import { checkAuth, unauthorizedResponse } from "@/lib/auth";
import type { ScheduleEntry, Settings, Employee } from "@/lib/scheduler";

interface ScheduleData {
  entries: ScheduleEntry[];
  cumulativeStats: Record<number, { totalHours: number; totalDays: number; weekendDays: number; saturdays: number; fridays: number; offWeeks: number }>;
  generatedMonths: string[];
}

const FILE = "schedule.json";
const EMP_FILE = "employees.json";
const SETTINGS_FILE = "settings.json";

const DAYS_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function getDayType(d: Date): string {
  const jsDay = d.getDay(); // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  if (jsDay === 6) return "Saturday"; // Saturday (9h)
  if (jsDay === 5) return "Friday";    // Friday (9h)
  if (jsDay === 4) return "Thursday";  // Thursday (5h)
  if (jsDay === 0) return "Weekday";   // Sunday = weekday shift (5h)
  return "Weekday";                     // Mon-Wed (5h)
}

// POST: Add manual shift
export async function POST(request: NextRequest) {
  if (!checkAuth(request)) return unauthorizedResponse();
  try {
    const body = await request.json();
    const { date, empIdx, empName, empHrid, note, hours, start, end } = body;

    if (!date || empIdx === undefined) {
      return NextResponse.json({ error: "date and empIdx are required" }, { status: 400 });
    }

    const settings = readJson<Settings>(SETTINGS_FILE, {
      shifts: {
        Weekday: { start: "05:00 PM", end: "10:00 PM", hours: 5 },
        Thursday: { start: "05:00 PM", end: "10:00 PM", hours: 5 },
        Friday: { start: "01:00 PM", end: "10:00 PM", hours: 9 },
        Saturday: { start: "01:00 PM", end: "10:00 PM", hours: 9 },
      },
      weekStart: "Saturday",
      holidays: [],
    });

    const employees = readJson<Employee[]>(EMP_FILE, []);
    const targetEmp = employees.find((e) => e.id === empIdx);

    const dayDate = new Date(date + "T00:00:00");
    const dayType = getDayType(dayDate);
    const shift = settings.shifts[dayType] || settings.shifts["Weekday"];

    const scheduleData = readJson<ScheduleData>(FILE, { entries: [], cumulativeStats: {}, generatedMonths: [] });

    // Check if entry already exists for this date
    const existingIdx = scheduleData.entries.findIndex((e) => e.date === date);
    if (existingIdx !== -1) {
      return NextResponse.json({ error: "An entry already exists for this date. Delete it first." }, { status: 409 });
    }

    // Determine week number by finding the Saturday before this date
    let weekStart = new Date(dayDate);
    while (weekStart.getDay() !== 6) {
      weekStart.setDate(weekStart.getDate() - 1);
    }
    const weekNum = Math.floor((dayDate.getTime() - weekStart.getTime()) / (7 * 86400000));

    const newEntry: ScheduleEntry = {
      date,
      dayName: DAYS_NAMES[dayDate.getDay()],
      dayType,
      empIdx,
      empName: empName || targetEmp?.name || "Unknown",
      empHrid: empHrid || targetEmp?.hrid || "",
      start: start || shift.start,
      end: end || shift.end,
      hours: hours || shift.hours,
      offPerson: note || "Manual",
      offPersonIdx: -1,
      offPersonHrid: "",
      weekNum,
      isHoliday: false,
      isManual: true,
    };

    scheduleData.entries.push(newEntry);
    // Sort entries by date
    scheduleData.entries.sort((a, b) => a.date.localeCompare(b.date));

    writeJson(FILE, scheduleData);

    return NextResponse.json({ entry: newEntry }, { status: 201 });
  } catch (error) {
    console.error("Error adding shift:", error);
    return NextResponse.json({ error: "Failed to add shift" }, { status: 500 });
  }
}
