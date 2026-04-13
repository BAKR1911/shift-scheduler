import { NextRequest, NextResponse } from "next/server";
import { readJson } from "@/lib/data";
import { checkAuth, unauthorizedResponse } from "@/lib/auth";
import { computeLocalStats, computeOffWeeks } from "@/lib/scheduler";
import type { Employee, Settings, ScheduleEntry, CumulativeStats } from "@/lib/scheduler";
import ExcelJS from "exceljs";

interface ScheduleData {
  entries: ScheduleEntry[];
  cumulativeStats: Record<number, CumulativeStats>;
  generatedMonths: string[];
}

const SCHEDULE_FILE = "schedule.json";
const EMP_FILE = "employees.json";
const SETTINGS_FILE = "settings.json";

const MONTH_NAMES = ["", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

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

// GET: Export schedule as Excel
export async function GET(request: NextRequest) {
  if (!checkAuth(request)) return unauthorizedResponse();
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");

    const employees = readJson<Employee[]>(EMP_FILE, getDefaultEmployees());
    const scheduleData = readJson<ScheduleData>(SCHEDULE_FILE, {
      entries: [], cumulativeStats: {}, generatedMonths: [],
    });
    const settings = readJson<Settings>(SETTINGS_FILE, getDefaultSettings());

    const activeEmployees = employees.filter((e) => e.active);
    const n = activeEmployees.length;

    // Filter entries by month if provided
    let entries = scheduleData.entries;
    let period = "All Months";
    if (month) {
      const prefix = month;
      entries = entries.filter((e) => e.date.startsWith(prefix));
      const [y, m] = prefix.split("-");
      period = `${MONTH_NAMES[Number(m)]} ${y}`;
    }

    if (entries.length === 0) {
      return NextResponse.json({ error: "No entries to export" }, { status: 404 });
    }

    const localStats = computeLocalStats(entries, n);

    // Compute OFF weeks properly per employee for this period
    const offWeeksMap = computeOffWeeks(entries, n);

    const wb = new ExcelJS.Workbook();
    wb.creator = "IT Helpdesk Shift Scheduler";
    wb.created = new Date();

    // Colors
    const PRIMARY = "1B2A4A";
    const BLUE = "1D4ED8";
    const GREEN = "059669";
    const RED = "DC2626";
    const AMBER = "D97706";
    const LIGHT_BLUE = "D6E4F0";
    const LIGHT_GREEN = "E8F5E9";
    const LIGHT_RED = "FEE2E2";
    const LIGHT_AMBER = "FEF3C7";
    const LIGHT_CYAN = "E0F2FE";
    const LIGHT_GRAY = "F1F5F9";
    const LIGHT_PURPLE = "F3E8FF";
    const N600 = "64748B";

    // =============================================
    // SHEET 1: DAILY SCHEDULE
    // =============================================
    const ws1 = wb.addWorksheet("Schedule", {
      properties: { tabColor: { argb: BLUE } },
    });

    const colW = [5, 14, 14, 12, 24, 12, 14, 14, 10, 20, 12];
    colW.forEach((w, i) => {
      ws1.getColumn(i + 1).width = w;
    });

    // Title
    ws1.mergeCells("A1:K1");
    const titleCell = ws1.getCell("A1");
    titleCell.value = `IT Helpdesk - Shift Schedule (${period})`;
    titleCell.font = { size: 16, bold: true, color: { argb: PRIMARY } };
    titleCell.alignment = { vertical: "middle" };
    ws1.getRow(1).height = 36;

    // KPIs
    const totalHrs = entries.reduce((sum, e) => sum + e.hours, 0);
    const nWeeks = new Set(entries.map((e) => `${e.date.substring(0, 7)}-W${e.weekNum}`)).size;
    const holidays = entries.filter((e) => e.isHoliday).length;

    const kpis = [
      { label: "Weeks", value: nWeeks },
      { label: "Work Days", value: entries.length },
      { label: "Holidays", value: holidays },
      { label: "Total Hours", value: `${totalHrs.toFixed(1)}h` },
    ];

    const kpiRow = ws1.getRow(3);
    kpiRow.height = 36;
    kpis.forEach((kpi, i) => {
      const col = i * 3 + 1;
      ws1.mergeCells(3, col, 3, col + 1);
      const valCell = ws1.getCell(3, col);
      valCell.value = String(kpi.value);
      valCell.font = { size: 20, bold: true, color: { argb: PRIMARY } };
      valCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_BLUE } };
      valCell.alignment = { horizontal: "center", vertical: "middle" };
      valCell.border = {
        top: { style: "thin", color: { argb: "E2E8F0" } },
        left: { style: "thin", color: { argb: "E2E8F0" } },
        bottom: { style: "thin", color: { argb: "E2E8F0" } },
        right: { style: "thin", color: { argb: "E2E8F0" } },
      };

      ws1.mergeCells(4, col, 4, col + 1);
      const lblCell = ws1.getCell(4, col);
      lblCell.value = kpi.label;
      lblCell.font = { size: 9, color: { argb: N600 } };
      lblCell.alignment = { horizontal: "center" };
    });

    // Headers
    const headerRow = 6;
    const headers = ["#", "Date", "Day", "Type", "Employee", "HRID", "Start", "End", "Hours", "OFF Person", "OFF HRID"];
    const hdrRow = ws1.getRow(headerRow);
    hdrRow.height = 28;
    headers.forEach((h, ci) => {
      const cell = hdrRow.getCell(ci + 1);
      cell.value = h;
      cell.font = { size: 11, bold: true, color: { argb: "FFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PRIMARY } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin", color: { argb: PRIMARY } },
        left: { style: "thin", color: { argb: PRIMARY } },
        bottom: { style: "medium", color: { argb: PRIMARY } },
        right: { style: "thin", color: { argb: PRIMARY } },
      };
    });

    // Data rows grouped by week
    let row = headerRow + 1;
    let entryNum = 0;

    const weekGroups: Record<string, ScheduleEntry[]> = {};
    for (const e of entries) {
      const wk = `${e.date.substring(0, 7)}-W${e.weekNum}`;
      if (!weekGroups[wk]) weekGroups[wk] = [];
      weekGroups[wk].push(e);
    }

    const sortedWeekKeys = Object.keys(weekGroups).sort();
    let weekIndex = 0;

    for (const wk of sortedWeekKeys) {
      const weekEntries = weekGroups[wk];
      const wn = weekEntries[0].weekNum;
      const wh = weekEntries.reduce((s, e) => s + e.hours, 0);
      const offPerson = weekEntries[0].offPerson;

      // Week header row
      ws1.mergeCells(row, 1, row, 11);
      const weekCell = ws1.getCell(row, 1);
      weekCell.value = `Week ${weekIndex + 1}: ${weekEntries[0].date} >> ${weekEntries[weekEntries.length - 1].date}  |  ${weekEntries.length} days  |  ${wh.toFixed(1)}h  |  OFF: ${offPerson}`;
      weekCell.font = { size: 11, bold: true, color: { argb: "FFFFFF" } };
      weekCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } };
      weekCell.alignment = { vertical: "middle" };
      ws1.getRow(row).height = 26;
      row++;
      weekIndex++;

      for (const e of weekEntries) {
        entryNum++;
        const dt = e.dayType;
        const isHol = e.isHoliday;
        // Holiday gets red background, Saturday blue, Friday amber, Thursday cyan, else green
        const typeColor = isHol ? LIGHT_RED : dt === "Saturday" ? LIGHT_BLUE : dt === "Friday" ? LIGHT_AMBER : dt === "Thursday" ? LIGHT_CYAN : LIGHT_GREEN;
        const rowFill = wn % 2 === 0 ? "FFFFFF" : LIGHT_GRAY;

        const typeLabel = isHol ? "Holiday" : dt;

        const vals = [
          entryNum, e.date, e.dayName, typeLabel, e.empName, e.empHrid,
          e.start, e.end, e.hours, e.offPerson, e.offPersonHrid,
        ];

        const dataRow = ws1.getRow(row);
        dataRow.height = 22;
        vals.forEach((val, ci) => {
          const cell = dataRow.getCell(ci + 1);
          cell.value = val;
          cell.border = {
            top: { style: "thin", color: { argb: "E2E8F0" } },
            left: { style: "thin", color: { argb: "E2E8F0" } },
            bottom: { style: "thin", color: { argb: "E2E8F0" } },
            right: { style: "thin", color: { argb: "E2E8F0" } },
          };
          cell.alignment = { horizontal: "center", vertical: "middle" };

          if (ci === 3) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: typeColor } };
            if (isHol) cell.font = { color: { argb: RED }, bold: true };
          } else if (ci === 9) {
            cell.font = { color: { argb: RED }, bold: true };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_PURPLE } };
            cell.alignment = { horizontal: "left", vertical: "middle" };
          } else if (ci === 4) {
            cell.font = { bold: true };
            cell.alignment = { horizontal: "left", vertical: "middle" };
          } else {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowFill } };
          }

          if (ci === 8 && typeof val === "number") {
            cell.numFmt = "0.0";
          }
        });
        row++;
      }
    }

    ws1.views = [{ state: "frozen", ySplit: headerRow }];

    // =============================================
    // SHEET 2: EMPLOYEE SUMMARY
    // =============================================
    const ws2 = wb.addWorksheet("Employee Summary", {
      properties: { tabColor: { argb: GREEN } },
    });

    [5, 24, 12, 14, 14, 14, 14, 14, 14].forEach((w, i) => {
      ws2.getColumn(i + 1).width = w;
    });

    ws2.mergeCells("A1:I1");
    ws2.getCell("A1").value = `IT Helpdesk - Employee Summary (${period})`;
    ws2.getCell("A1").font = { size: 16, bold: true, color: { argb: PRIMARY } };
    ws2.getRow(1).height = 36;

    const summaryHeaders = ["#", "Employee Name", "HRID", "Work Days", "Total Hours", "Sat Days", "Fri Days", "Weekend Days", "OFF Weeks"];
    const shRow = ws2.getRow(4);
    shRow.height = 28;
    summaryHeaders.forEach((h, ci) => {
      const cell = shRow.getCell(ci + 1);
      cell.value = h;
      cell.font = { size: 11, bold: true, color: { argb: "FFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PRIMARY } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });

    activeEmployees.forEach((emp, i) => {
      const r = 5 + i;
      const ls = localStats[i] || { days: 0, hours: 0, weekend: 0, sat: 0, fri: 0, offWeeks: 0 };
      const offW = offWeeksMap[i] || 0;
      const fill = i % 2 === 0 ? "FFFFFF" : LIGHT_GRAY;
      const vals = [i + 1, emp.name, emp.hrid, ls.days, Math.round(ls.hours * 10) / 10, ls.sat, ls.fri, ls.weekend, offW];
      const dataRow = ws2.getRow(r);
      dataRow.height = 22;
      vals.forEach((val, ci) => {
        const cell = dataRow.getCell(ci + 1);
        cell.value = val;
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
          top: { style: "thin", color: { argb: "E2E8F0" } },
          left: { style: "thin", color: { argb: "E2E8F0" } },
          bottom: { style: "thin", color: { argb: "E2E8F0" } },
          right: { style: "thin", color: { argb: "E2E8F0" } },
        };
        if (ci === 1) cell.alignment = { horizontal: "left", vertical: "middle" };
        if (ci === 4) { cell.numFmt = "0.0"; cell.font = { color: { argb: BLUE }, bold: true }; }
        if (ci === 8) cell.font = { color: { argb: RED }, bold: true };
      });
    });

    // Variance info
    const allHrs = activeEmployees.map((_, i) => localStats[i]?.hours || 0);
    const variance = allHrs.length > 0 ? Math.max(...allHrs) - Math.min(...allHrs) : 0;
    const avgHrs = allHrs.length > 0 ? allHrs.reduce((a, b) => a + b, 0) / allHrs.length : 0;

    const vr = 5 + activeEmployees.length + 1;
    ws2.getCell(vr, 2).value = "Average Hours / Person";
    ws2.getCell(vr, 2).font = { bold: true };
    ws2.getCell(vr, 2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_BLUE } };
    ws2.getCell(vr, 5).value = Math.round(avgHrs * 10) / 10;
    ws2.getCell(vr, 5).font = { color: { argb: BLUE }, bold: true };
    ws2.getCell(vr, 5).fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_BLUE } };
    ws2.getCell(vr, 5).numFmt = "0.0";
    ws2.getCell(vr, 5).alignment = { horizontal: "center" };

    ws2.getCell(vr + 1, 2).value = "Hours Variance (Max-Min)";
    ws2.getCell(vr + 1, 2).font = { bold: true };
    ws2.getCell(vr + 1, 2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_BLUE } };
    ws2.getCell(vr + 1, 5).value = Math.round(variance * 10) / 10;
    ws2.getCell(vr + 1, 5).font = { color: { argb: RED }, bold: true };
    ws2.getCell(vr + 1, 5).fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_BLUE } };
    ws2.getCell(vr + 1, 5).numFmt = "0.0";
    ws2.getCell(vr + 1, 5).alignment = { horizontal: "center" };

    // =============================================
    // SHEET 3: CUMULATIVE BALANCE
    // =============================================
    const ws3 = wb.addWorksheet("Cumulative Balance", {
      properties: { tabColor: { argb: AMBER } },
    });

    [5, 24, 12, 14, 14, 14, 14, 14].forEach((w, i) => {
      ws3.getColumn(i + 1).width = w;
    });

    ws3.mergeCells("A1:H1");
    ws3.getCell("A1").value = "IT Helpdesk - Cumulative Balance (All Months)";
    ws3.getCell("A1").font = { size: 16, bold: true, color: { argb: PRIMARY } };
    ws3.getRow(1).height = 36;

    let row3 = 3;
    for (const monthKey of scheduleData.generatedMonths.sort()) {
      const [y, m] = monthKey.split("-");
      const monthLabel = `${MONTH_NAMES[Number(m)]} ${y}`;
      const monthEntries = scheduleData.entries.filter((e) => e.date.startsWith(monthKey));
      const mLocalStats = computeLocalStats(monthEntries, n);
      const mOffWeeks = computeOffWeeks(monthEntries, n);

      ws3.mergeCells(row3, 1, row3, 8);
      ws3.getCell(row3, 1).value = `${monthLabel} - Summary`;
      ws3.getCell(row3, 1).font = { size: 13, bold: true, color: { argb: PRIMARY } };
      row3++;

      const cumHeaders = ["#", "Employee", "HRID", "Work Days", "Total Hours", "Weekends", "Sat Days", "OFF Weeks"];
      cumHeaders.forEach((h, ci) => {
        const cell = ws3.getCell(row3, ci + 1);
        cell.value = h;
        cell.font = { size: 11, bold: true, color: { argb: "FFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PRIMARY } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });
      row3++;

      const cumHrs: number[] = [];
      activeEmployees.forEach((emp, i) => {
        const hrs = mLocalStats[i]?.hours || 0;
        cumHrs.push(hrs);
        const offW = mOffWeeks[i] || 0;
        const fill = i % 2 === 0 ? "FFFFFF" : LIGHT_GRAY;
        const vals = [i + 1, emp.name, emp.hrid, mLocalStats[i]?.days || 0, Math.round(hrs * 10) / 10, mLocalStats[i]?.weekend || 0, mLocalStats[i]?.sat || 0, offW];
        vals.forEach((val, ci) => {
          const cell = ws3.getCell(row3, ci + 1);
          cell.value = val;
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
          cell.alignment = { horizontal: "center", vertical: "middle" };
          cell.border = {
            top: { style: "thin", color: { argb: "E2E8F0" } },
            left: { style: "thin", color: { argb: "E2E8F0" } },
            bottom: { style: "thin", color: { argb: "E2E8F0" } },
            right: { style: "thin", color: { argb: "E2E8F0" } },
          };
          if (ci === 4) cell.numFmt = "0.0";
          if (ci === 7) cell.font = { color: { argb: RED } };
        });
        row3++;
      });

      const cVar = cumHrs.length > 0 ? Math.max(...cumHrs) - Math.min(...cumHrs) : 0;
      const cAvg = cumHrs.length > 0 ? cumHrs.reduce((a, b) => a + b, 0) / cumHrs.length : 0;
      ws3.mergeCells(row3, 1, row3, 8);
      ws3.getCell(row3, 1).value = `Variance: ${cVar.toFixed(1)}h | Avg: ${cAvg.toFixed(1)}h`;
      ws3.getCell(row3, 1).font = { size: 10, color: { argb: N600 } };
      for (let c = 1; c <= 8; c++) {
        ws3.getCell(row3, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_BLUE } };
      }
      row3 += 2;
    }

    // Generate buffer
    const buffer = await wb.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="IT_Helpdesk_Schedule_${month || "All"}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Error exporting Excel:", error);
    return NextResponse.json({ error: "Failed to export Excel file" }, { status: 500 });
  }
}
