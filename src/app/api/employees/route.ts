import { NextRequest, NextResponse } from "next/server";
import { readJson, writeJson } from "@/lib/data";
import { checkAuth, unauthorizedResponse } from "@/lib/auth";
import type { Employee } from "@/lib/scheduler";

const FILE = "employees.json";

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

// GET: Return all employees
export async function GET(request: NextRequest) {
  if (!checkAuth(request)) return unauthorizedResponse();
  try {
    const employees = readJson<Employee[]>(FILE, getDefaultEmployees());
    return NextResponse.json({ employees });
  } catch (error) {
    console.error("Error reading employees:", error);
    return NextResponse.json({ error: "Failed to read employees" }, { status: 500 });
  }
}

// POST: Add new employee
export async function POST(request: NextRequest) {
  if (!checkAuth(request)) return unauthorizedResponse();
  try {
    const body = await request.json();
    const { name, hrid } = body;

    if (!name || !hrid) {
      return NextResponse.json({ error: "Name and HRID are required" }, { status: 400 });
    }

    const employees = readJson<Employee[]>(FILE, getDefaultEmployees());
    const maxId = employees.reduce((max, e) => Math.max(max, e.id), 0);

    const newEmployee: Employee = {
      id: maxId + 1,
      name: name.trim(),
      hrid: hrid.trim(),
      active: true,
    };

    employees.push(newEmployee);
    writeJson(FILE, employees);

    return NextResponse.json({ employee: newEmployee }, { status: 201 });
  } catch (error) {
    console.error("Error adding employee:", error);
    return NextResponse.json({ error: "Failed to add employee" }, { status: 500 });
  }
}

// PUT: Update employee (name, hrid, or active status)
export async function PUT(request: NextRequest) {
  if (!checkAuth(request)) return unauthorizedResponse();
  try {
    const body = await request.json();
    const { id, name, hrid, active } = body;

    if (!id) {
      return NextResponse.json({ error: "Employee ID is required" }, { status: 400 });
    }

    const employees = readJson<Employee[]>(FILE, getDefaultEmployees());
    const idx = employees.findIndex((e) => e.id === id);

    if (idx === -1) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    if (name !== undefined && name.trim() !== "") employees[idx].name = name.trim();
    if (hrid !== undefined && hrid.trim() !== "") employees[idx].hrid = hrid.trim();
    if (active !== undefined) employees[idx].active = active;

    writeJson(FILE, employees);

    return NextResponse.json({ employee: employees[idx] });
  } catch (error) {
    console.error("Error updating employee:", error);
    return NextResponse.json({ error: "Failed to update employee" }, { status: 500 });
  }
}

// DELETE: Remove employee
export async function DELETE(request: NextRequest) {
  if (!checkAuth(request)) return unauthorizedResponse();
  try {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get("id"));

    if (!id) {
      return NextResponse.json({ error: "Employee ID is required" }, { status: 400 });
    }

    let employees = readJson<Employee[]>(FILE, getDefaultEmployees());
    const idx = employees.findIndex((e) => e.id === id);

    if (idx === -1) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const removed = employees.splice(idx, 1)[0];
    writeJson(FILE, employees);

    return NextResponse.json({ employee: removed });
  } catch (error) {
    console.error("Error deleting employee:", error);
    return NextResponse.json({ error: "Failed to delete employee" }, { status: 500 });
  }
}
