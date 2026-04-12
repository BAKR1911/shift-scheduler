"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar, Users, Settings, Plus, Trash2, RefreshCw,
  CalendarDays, Clock, Sun, Moon, X, ArrowLeftRight, AlertTriangle,
  CheckCircle, Info, ChevronDown, ChevronUp, FileSpreadsheet, BarChart3,
  Sparkles, Eye, EyeOff, LogOut, User, Shield, KeyRound, Lock, HeadphonesIcon,
  Pencil
} from "lucide-react";

// ===== Types =====
interface Employee {
  id: number;
  name: string;
  hrid: string;
  active: boolean;
}

interface ShiftConfig {
  start: string;
  end: string;
  hours: number;
}

interface SettingsData {
  shifts: Record<string, ShiftConfig>;
  weekStart: string;
  holidays: string[];
  summerTime: boolean;
  summerShifts: Record<string, ShiftConfig>;
}

interface ScheduleEntry {
  date: string;
  dayName: string;
  dayType: string;
  empIdx: number;
  empName: string;
  empHrid: string;
  start: string;
  end: string;
  hours: number;
  offPerson: string;
  offPersonIdx: number;
  offPersonHrid: string;
  weekNum: number;
  isHoliday: boolean;
  isManual: boolean;
}

interface LocalStats {
  days: number;
  hours: number;
  weekend: number;
  sat: number;
  fri: number;
  offWeeks: number;
  lastDayIdx: number;
}

interface CumulativeStats {
  totalHours: number;
  totalDays: number;
  weekendDays: number;
  saturdays: number;
  fridays: number;
  offWeeks: number;
}

interface BalanceInfo {
  status: "green" | "yellow" | "red";
  variance: number;
  average: number;
  avgAbsDeviation: number;
  max: number;
  min: number;
}

// ===== Helper =====
function getDayTypeColor(dayType: string) {
  switch (dayType) {
    case "Saturday": return "bg-blue-100 text-blue-800 border-blue-200";
    case "Friday": return "bg-amber-100 text-amber-800 border-amber-200";
    case "Thursday": return "bg-cyan-100 text-cyan-800 border-cyan-200";
    default: return "bg-emerald-100 text-emerald-800 border-emerald-200";
  }
}

function getDayTypeBadge(dayType: string, isHoliday?: boolean) {
  if (isHoliday) return { label: "HOL", color: "bg-red-500 text-white" };
  switch (dayType) {
    case "Saturday": return { label: "Sat", color: "bg-blue-500 text-white" };
    case "Friday": return { label: "Fri", color: "bg-amber-500 text-white" };
    case "Thursday": return { label: "Thu", color: "bg-cyan-500 text-white" };
    default: return { label: "WD", color: "bg-emerald-500 text-white" };
  }
}

function getWeekNumber(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const sat = new Date(d);
  while (sat.getDay() !== 6) sat.setDate(sat.getDate() - 1);
  return sat.toISOString().substring(0, 10);
}

function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatHolidayDisplay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// ===== Login Component =====
function LoginScreen({
  onLogin,
  loginError,
  loginLoading,
  setLoginUsername,
  setLoginPassword,
  setShowForgotPassword,
  showPassword,
  setShowPassword,
  loginUsername,
  loginPassword,
}: {
  onLogin: () => void;
  loginError: string;
  loginLoading: boolean;
  setLoginUsername: (v: string) => void;
  setLoginPassword: (v: string) => void;
  setShowForgotPassword: (v: boolean) => void;
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
  loginUsername: string;
  loginPassword: string;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <div className="w-full max-w-md">
        {/* Logo/Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#0F172A] to-[#1D4ED8] shadow-lg mb-4">
            <HeadphonesIcon className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            IT Helpdesk Shift Scheduler
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Sign in to access the scheduling system
          </p>
        </div>

        {/* Login Card */}
        <Card className="shadow-lg border-slate-200 dark:border-slate-800">
          <CardContent className="p-6">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onLogin();
              }}
              className="space-y-4"
            >
              {/* Username */}
              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Username
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="Enter your username"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    className="pl-10 h-11"
                    autoComplete="username"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="pl-10 pr-10 h-11"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {loginError && (
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                  <span className="text-sm text-red-700 dark:text-red-300">{loginError}</span>
                </div>
              )}

              {/* Submit */}
              <Button
                type="submit"
                disabled={loginLoading}
                className="w-full h-11 bg-gradient-to-r from-[#0F172A] to-[#1D4ED8] hover:from-[#0F172A]/90 hover:to-[#1D4ED8]/90 text-white font-semibold text-sm"
              >
                {loginLoading ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Signing in...
                  </span>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            {/* Forgot Password */}
            <div className="mt-4 text-center">
              <button
                onClick={() => setShowForgotPassword(true)}
                className="text-sm text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                Forgot Password?
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 mt-6">
          IT Helpdesk Shift Scheduler &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

// ===== Main Component =====
export default function ShiftSchedulerPage() {
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();

  // ===== Auth State =====
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authUsername, setAuthUsername] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);

  // Authenticated fetch wrapper
  const authFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers || {});
    if (authToken) {
      headers.set("Authorization", `Bearer ${authToken}`);
    }
    return fetch(url, { ...options, headers });
  }, [authToken]);

  // ===== Check auth on mount =====
  useEffect(() => {
    const checkAuth = async () => {
      const savedToken = localStorage.getItem("auth_token");
      const savedUser = localStorage.getItem("auth_user");
      const savedEmail = localStorage.getItem("auth_email");

      if (savedToken && savedUser) {
        try {
          const res = await fetch("/api/auth/check", {
            headers: { Authorization: `Bearer ${savedToken}` },
          });
          const data = await res.json();
          if (data.authenticated) {
            setAuthToken(savedToken);
            setAuthUsername(savedUser);
            setAuthEmail(savedEmail || "");
            setIsAuthenticated(true);
          } else {
            localStorage.removeItem("auth_token");
            localStorage.removeItem("auth_user");
            localStorage.removeItem("auth_email");
          }
        } catch {
          // Auth check failed, will show login
        }
      }
      setAuthChecking(false);
    };
    checkAuth();
  }, []);

  // ===== Auth Actions =====
  const handleLogin = async () => {
    setLoginError("");
    setLoginLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem("auth_token", data.token);
        localStorage.setItem("auth_user", data.username);
        localStorage.setItem("auth_email", data.email || "");
        setAuthToken(data.token);
        setAuthUsername(data.username);
        setAuthEmail(data.email || "");
        setIsAuthenticated(true);
        setLoginUsername("");
        setLoginPassword("");
        toast({ title: "Welcome back!", description: `Signed in as ${data.username}` });
      } else {
        setLoginError(data.error || "Invalid credentials");
      }
    } catch {
      setLoginError("Connection error. Please try again.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (authToken) {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${authToken}` },
        });
      }
    } catch {
      // Ignore logout errors
    }
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    localStorage.removeItem("auth_email");
    setAuthToken(null);
    setAuthUsername("");
    setAuthEmail("");
    setIsAuthenticated(false);
    setEntries([]);
    setEmployees([]);
    setSettings(null);
    setBalance(null);
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({ title: "Error", description: "All fields are required", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "New passwords do not match", variant: "destructive" });
      return;
    }
    if (newPassword.length < 4) {
      toast({ title: "Error", description: "New password must be at least 4 characters", variant: "destructive" });
      return;
    }
    setChangePasswordLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "Success", description: "Password changed successfully" });
        setShowChangePassword(false);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast({ title: "Error", description: data.error || "Failed to change password", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to change password", variant: "destructive" });
    } finally {
      setChangePasswordLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!forgotEmail) {
      toast({ title: "Error", description: "Email is required", variant: "destructive" });
      return;
    }
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "Email Sent", description: data.message });
        setShowForgotPassword(false);
        setForgotEmail("");
      } else {
        toast({ title: "Error", description: data.error || "Failed to send reset email", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to send reset email", variant: "destructive" });
    }
  };

  // ===== Data state =====
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [localStats, setLocalStats] = useState<Record<number, LocalStats>>({});
  const [cumulativeStats, setCumulativeStats] = useState<Record<number, CumulativeStats>>({});
  const [generatedMonths, setGeneratedMonths] = useState<string[]>([]);
  const [balance, setBalance] = useState<BalanceInfo | null>(null);

  // UI state
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Modals
  const [showSettings, setShowSettings] = useState(false);
  const [showEmployees, setShowEmployees] = useState(false);
  const [showAddShift, setShowAddShift] = useState(false);
  const [showStats, setShowStats] = useState(false);

  // Swap state
  const [swapMode, setSwapMode] = useState(false);
  const [swapFirst, setSwapFirst] = useState<{ idx: number; name: string } | null>(null);

  // Employee management
  const [newEmpName, setNewEmpName] = useState("");
  const [newEmpHrid, setNewEmpHrid] = useState("");
  const [editingEmpId, setEditingEmpId] = useState<number | null>(null);
  const [editEmpName, setEditEmpName] = useState("");
  const [editEmpHrid, setEditEmpHrid] = useState("");

  // Add shift
  const [addShiftDate, setAddShiftDate] = useState("");
  const [addShiftEmp, setAddShiftEmp] = useState("");

  // Settings editing
  const [editSettings, setEditSettings] = useState<SettingsData | null>(null);
  const [newHolidayDate, setNewHolidayDate] = useState("");

  // Week collapse
  const [collapsedWeeks, setCollapsedWeeks] = useState<Set<string>>(new Set());

  // ===== Data Fetching =====
  const fetchData = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setLoading(true);
      const [empRes, schedRes, settingsRes] = await Promise.all([
        authFetch("/api/employees"),
        authFetch(`/api/schedule?month=${selectedMonth}&year=${selectedYear}`),
        authFetch("/api/settings"),
      ]);

      if (empRes.status === 401) { handleLogout(); return; }
      if (schedRes.status === 401) { handleLogout(); return; }
      if (settingsRes.status === 401) { handleLogout(); return; }

      if (empRes.ok) {
        const empData = await empRes.json();
        setEmployees(empData.employees || []);
      }
      if (schedRes.ok) {
        const schedData = await schedRes.json();
        setEntries(schedData.entries || []);
        setCumulativeStats(schedData.cumulativeStats || {});
        setGeneratedMonths(schedData.generatedMonths || []);
        setLocalStats(schedData.localStats || {});
      }
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        setSettings(settingsData.settings || null);
      }
    } catch (err) {
      console.error("Fetch error:", err);
      toast({ title: "Error", description: "Failed to load data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear, toast, isAuthenticated, authFetch]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [fetchData, isAuthenticated]);

  // Fetch balance/reports
  useEffect(() => {
    if (!isAuthenticated) return;
    authFetch("/api/reports")
      .then((r) => {
        if (r.status === 401) { handleLogout(); return; }
        return r.json();
      })
      .then((data) => {
        if (data && data.balance) setBalance(data.balance);
      })
      .catch(() => {});
  }, [isAuthenticated, authFetch]);

  // ===== Actions =====
  const generateMonth = async () => {
    setGenerating(true);
    try {
      const [y, m] = selectedMonth.split("-");
      const res = await authFetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "month", year: Number(y), month: Number(m) }),
      });
      if (res.status === 401) { handleLogout(); return; }
      const data = await res.json();
      if (res.ok) {
        toast({ title: "Success", description: `Generated ${data.generated} shift entries for ${MONTHS[Number(m) - 1]} ${y}` });
        fetchData();
      } else {
        toast({ title: "Error", description: data.error || "Generation failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to generate schedule", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const generateWeek = async () => {
    const now = new Date();
    const sat = new Date(now);
    while (sat.getDay() !== 6) sat.setDate(sat.getDate() - 1);
    const weekStart = sat.toISOString().substring(0, 10);

    setGenerating(true);
    try {
      const res = await authFetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "week", weekStart }),
      });
      if (res.status === 401) { handleLogout(); return; }
      const data = await res.json();
      if (res.ok) {
        toast({ title: "Success", description: `Generated ${data.generated} entries for this week` });
        fetchData();
      } else {
        toast({ title: "Error", description: data.error || "Generation failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to generate week", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const recalcHours = async () => {
    setGenerating(true);
    try {
      const res = await authFetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "recalc" }),
      });
      if (res.status === 401) { handleLogout(); return; }
      if (res.ok) {
        toast({ title: "Success", description: "Hours recalculated based on current settings" });
        fetchData();
      } else {
        toast({ title: "Error", description: "Recalculation failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to recalculate", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const clearSchedule = async () => {
    try {
      const res = await authFetch(`/api/schedule?month=${selectedMonth}`, { method: "DELETE" });
      if (res.status === 401) { handleLogout(); return; }
      if (res.ok) {
        toast({ title: "Success", description: `Cleared schedule for ${selectedMonth}` });
        fetchData();
      }
    } catch {
      toast({ title: "Error", description: "Failed to clear", variant: "destructive" });
    }
  };

  const toggleHoliday = async (date: string, current: boolean) => {
    try {
      const res = await authFetch(`/api/schedule/${date}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isHoliday: !current }),
      });
      if (res.status === 401) { handleLogout(); return; }
      if (res.ok) {
        toast({ title: "Updated", description: `${date} ${!current ? "marked as holiday" : "unmarked as holiday"}` });
        fetchData();
      }
    } catch {
      toast({ title: "Error", description: "Failed to toggle holiday", variant: "destructive" });
    }
  };

  const deleteEntry = async (date: string) => {
    try {
      const res = await authFetch(`/api/schedule/${date}`, { method: "DELETE" });
      if (res.status === 401) { handleLogout(); return; }
      if (res.ok) {
        toast({ title: "Deleted", description: `Entry for ${date} removed` });
        fetchData();
      }
    } catch {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
    }
  };

  const swapEmployees = async (empIdxA: number, empIdxB: number) => {
    try {
      const res = await authFetch("/api/schedule/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empIdxA, empIdxB }),
      });
      if (res.status === 401) { handleLogout(); return; }
      const data = await res.json();
      if (res.ok) {
        toast({ title: "Swapped", description: data.message });
        setSwapMode(false);
        setSwapFirst(null);
        fetchData();
      } else {
        toast({ title: "Error", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to swap", variant: "destructive" });
    }
  };

  const addManualShift = async () => {
    if (!addShiftDate || !addShiftEmp) {
      toast({ title: "Error", description: "Date and employee are required", variant: "destructive" });
      return;
    }
    try {
      const emp = employees.find((e) => e.id === Number(addShiftEmp));
      const res = await authFetch("/api/schedule/add-shift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: addShiftDate,
          empIdx: Number(addShiftEmp),
          empName: emp?.name,
          empHrid: emp?.hrid,
        }),
      });
      if (res.status === 401) { handleLogout(); return; }
      if (res.ok) {
        toast({ title: "Added", description: "Manual shift added" });
        setShowAddShift(false);
        setAddShiftDate("");
        setAddShiftEmp("");
        fetchData();
      } else {
        const data = await res.json();
        toast({ title: "Error", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to add shift", variant: "destructive" });
    }
  };

  const addEmployee = async () => {
    if (!newEmpName || !newEmpHrid) {
      toast({ title: "Error", description: "Name and HRID are required", variant: "destructive" });
      return;
    }
    try {
      const res = await authFetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newEmpName, hrid: newEmpHrid }),
      });
      if (res.status === 401) { handleLogout(); return; }
      if (res.ok) {
        toast({ title: "Added", description: `${newEmpName} added to team` });
        setNewEmpName("");
        setNewEmpHrid("");
        fetchData();
      }
    } catch {
      toast({ title: "Error", description: "Failed to add employee", variant: "destructive" });
    }
  };

  const editEmployee = async (id: number, name: string, hrid: string) => {
    if (!name || !hrid) {
      toast({ title: "Error", description: "Name and HRID are required", variant: "destructive" });
      return;
    }
    try {
      const res = await authFetch("/api/employees", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name, hrid }),
      });
      if (res.status === 401) { handleLogout(); return; }
      if (res.ok) {
        toast({ title: "Updated", description: `${name} updated successfully` });
        setEditingEmpId(null);
        setEditEmpName("");
        setEditEmpHrid("");
        fetchData();
      } else {
        const data = await res.json();
        toast({ title: "Error", description: data.error || "Failed to update employee", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to update employee", variant: "destructive" });
    }
  };

  const deleteEmployee = async (id: number, name: string) => {
    try {
      const res = await authFetch(`/api/employees?id=${id}`, { method: "DELETE" });
      if (res.status === 401) { handleLogout(); return; }
      if (res.ok) {
        toast({ title: "Removed", description: `${name} removed from team` });
        fetchData();
      }
    } catch {
      toast({ title: "Error", description: "Failed to remove", variant: "destructive" });
    }
  };

  const toggleEmployeeActive = async (id: number, active: boolean) => {
    try {
      const res = await authFetch("/api/employees", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, active: !active }),
      });
      if (res.status === 401) { handleLogout(); return; }
      if (res.ok) {
        toast({ title: "Updated", description: `Employee ${!active ? "activated" : "deactivated"}` });
        fetchData();
      }
    } catch {
      toast({ title: "Error", description: "Failed to update", variant: "destructive" });
    }
  };

  const saveSettings = async () => {
    if (!editSettings) return;
    try {
      const res = await authFetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editSettings),
      });
      if (res.status === 401) { handleLogout(); return; }
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
        setShowSettings(false);
        toast({ title: "Saved", description: "Settings updated successfully" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to save settings", variant: "destructive" });
    }
  };

  const exportExcel = () => {
    const url = `/api/export?month=${selectedMonth}&token=${authToken}`;
    window.open(url, "_blank");
    toast({ title: "Exporting", description: "Excel file download started" });
  };

  // ===== Group entries by week =====
  const activeEmployees = employees.filter((e) => e.active);
  const weekGroups: { key: string; entries: ScheduleEntry[]; label: string }[] = [];

  const filteredEntries = entries.filter((e) => e.date.startsWith(selectedMonth));
  const weekMap = new Map<string, ScheduleEntry[]>();

  for (const entry of filteredEntries) {
    const wk = getWeekNumber(entry.date);
    if (!weekMap.has(wk)) weekMap.set(wk, []);
    weekMap.get(wk)!.push(entry);
  }

  let weekIndex = 0;
  for (const [key, weekEntries] of weekMap) {
    const sorted = weekEntries.sort((a, b) => a.date.localeCompare(b.date));
    const totalHrs = sorted.reduce((s, e) => s + e.hours, 0);
    const offPerson = sorted[0]?.offPerson || "N/A";
    weekGroups.push({
      key,
      entries: sorted,
      label: `Week ${weekIndex + 1}: ${formatDateDisplay(sorted[0].date)} \u2192 ${formatDateDisplay(sorted[sorted.length - 1].date)} | ${sorted.length} days | ${totalHrs.toFixed(1)}h | OFF: ${offPerson}`,
    });
    weekIndex++;
  }

  // Stats calculations
  const totalHours = filteredEntries.reduce((s, e) => s + e.hours, 0);
  const totalDays = filteredEntries.length;
  const totalHolidays = filteredEntries.filter((e) => e.isHoliday).length;
  const totalWeeks = weekGroups.length;

  // ===== Auth Checking State =====
  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 text-slate-400 animate-spin" />
          <span className="text-slate-500 text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <LoginScreen
          onLogin={handleLogin}
          loginError={loginError}
          loginLoading={loginLoading}
          setLoginUsername={setLoginUsername}
          setLoginPassword={setLoginPassword}
          setShowForgotPassword={setShowForgotPassword}
          showPassword={showPassword}
          setShowPassword={setShowPassword}
          loginUsername={loginUsername}
          loginPassword={loginPassword}
        />
        {/* Forgot Password Dialog */}
        <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" /> Reset Password
              </DialogTitle>
              <DialogDescription>Enter your email to receive a password reset link</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <div>
                <Label className="text-xs">Email Address</Label>
                <Input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="your.email@helpdesk.com"
                  className="mt-1"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowForgotPassword(false)}>Cancel</Button>
              <Button onClick={handleResetPassword} className="bg-blue-600 hover:bg-blue-700 text-white">Send Reset Link</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // ===== Authenticated Scheduler Render =====
  return (
    <TooltipProvider>
      <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
        {/* ===== HEADER ===== */}
        <header className="bg-[#0F172A] text-white sticky top-0 z-50 shadow-lg">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <CalendarDays className="h-6 w-6 text-blue-400" />
                <h1 className="text-lg sm:text-xl font-bold tracking-tight">
                  IT Helpdesk Shift Scheduler
                </h1>
                {balance && (
                  <Badge
                    variant="outline"
                    className={`ml-2 hidden sm:inline-flex ${
                      balance.status === "green"
                        ? "border-green-500 text-green-400 bg-green-500/10"
                        : balance.status === "yellow"
                        ? "border-yellow-500 text-yellow-400 bg-yellow-500/10"
                        : "border-red-500 text-red-400 bg-red-500/10"
                    }`}
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {balance.variance.toFixed(1)}h variance
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Month selector */}
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-[140px] bg-slate-800 border-slate-600 text-white h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => {
                      const m = String(i + 1).padStart(2, "0");
                      return (
                        <SelectItem key={m} value={`${selectedYear}-${m}`}>
                          {MONTHS[i]} {selectedYear}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>

                {/* Year selector */}
                <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
                  <SelectTrigger className="w-[90px] bg-slate-800 border-slate-600 text-white h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2025, 2026, 2027, 2028].map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Settings */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-slate-300 hover:text-white hover:bg-slate-700"
                      onClick={() => {
                        const defaults: SettingsData = {
                          shifts: {
                            Weekday: { start: "05:00 PM", end: "10:00 PM", hours: 5 },
                            Thursday: { start: "05:00 PM", end: "10:00 PM", hours: 5 },
                            Friday: { start: "01:00 PM", end: "10:00 PM", hours: 9 },
                            Saturday: { start: "01:00 PM", end: "10:00 PM", hours: 9 },
                            Holiday: { start: "10:00 AM", end: "10:00 PM", hours: 12 },
                          },
                          weekStart: "Saturday",
                          holidays: [],
                          summerTime: false,
                          summerShifts: {
                            Weekday: { start: "05:00 PM", end: "11:00 PM", hours: 6 },
                            Thursday: { start: "05:00 PM", end: "11:00 PM", hours: 6 },
                            Friday: { start: "01:00 PM", end: "11:00 PM", hours: 10 },
                            Saturday: { start: "01:00 PM", end: "11:00 PM", hours: 10 },
                          },
                        };
                        setEditSettings(settings ? JSON.parse(JSON.stringify(settings)) : defaults);
                        setNewHolidayDate("");
                        setShowSettings(true);
                      }}
                    >
                      <Settings className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Settings</TooltipContent>
                </Tooltip>

                {/* Employees */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-slate-300 hover:text-white hover:bg-slate-700"
                      onClick={() => setShowEmployees(true)}
                    >
                      <Users className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Manage Employees</TooltipContent>
                </Tooltip>

                {/* Stats */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-slate-300 hover:text-white hover:bg-slate-700"
                      onClick={() => setShowStats(true)}
                    >
                      <BarChart3 className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Statistics & Reports</TooltipContent>
                </Tooltip>

                {/* Theme toggle */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-slate-300 hover:text-white hover:bg-slate-700"
                      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                    >
                      {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Toggle Theme</TooltipContent>
                </Tooltip>

                {/* Profile Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-slate-300 hover:text-white hover:bg-slate-700"
                    >
                      <Shield className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="px-2 py-1.5">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{authUsername}</p>
                      {authEmail && <p className="text-xs text-slate-500 dark:text-slate-400">{authEmail}</p>}
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => { setShowChangePassword(true); }} className="cursor-pointer">
                      <KeyRound className="h-4 w-4 mr-2" />
                      Change Password
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600 focus:text-red-600">
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </header>

        {/* ===== TOOLBAR ===== */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-2">
            <div className="flex flex-wrap gap-2">
              <Button onClick={generateMonth} disabled={generating} className="bg-blue-600 hover:bg-blue-700 text-white">
                <Sparkles className="h-4 w-4 mr-1.5" />
                {generating ? "Generating..." : "Generate Month"}
              </Button>
              <Button onClick={generateWeek} disabled={generating} variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50">
                <Calendar className="h-4 w-4 mr-1.5" />
                This Week
              </Button>
              <Button onClick={() => { setAddShiftDate(""); setAddShiftEmp(""); setShowAddShift(true); }} variant="outline">
                <Plus className="h-4 w-4 mr-1.5" />
                Add Shift
              </Button>
              <Button onClick={recalcHours} disabled={generating} variant="outline">
                <RefreshCw className="h-4 w-4 mr-1.5" />
                Recalc Hours
              </Button>
              <Button
                onClick={() => { setSwapMode(!swapMode); setSwapFirst(null); }}
                variant={swapMode ? "default" : "outline"}
                className={swapMode ? "bg-purple-600 text-white" : "border-purple-300 text-purple-700"}
              >
                <ArrowLeftRight className="h-4 w-4 mr-1.5" />
                {swapMode ? "Cancel Swap" : "Swap Mode"}
              </Button>
              <Button onClick={exportExcel} disabled={filteredEntries.length === 0} variant="outline" className="border-emerald-300 text-emerald-700">
                <FileSpreadsheet className="h-4 w-4 mr-1.5" />
                Export Excel
              </Button>
              <Button onClick={clearSchedule} disabled={filteredEntries.length === 0} variant="outline" className="border-red-300 text-red-700 hover:bg-red-50">
                <Trash2 className="h-4 w-4 mr-1.5" />
                Clear
              </Button>
            </div>
          </div>
        </div>

        {/* ===== STATS ROW ===== */}
        <div className="max-w-7xl mx-auto w-full px-4 mt-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="shadow-sm">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">{totalWeeks}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Weeks</div>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">{totalDays}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Work Days</div>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-amber-600">{totalHolidays}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Holidays</div>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">{totalHours.toFixed(1)}h</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Total Hours</div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ===== SWAP BANNER ===== */}
        {swapMode && (
          <div className="max-w-7xl mx-auto w-full px-4 mt-3">
            <div className="bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg p-3 flex items-center gap-3">
              <ArrowLeftRight className="h-5 w-5 text-purple-600 flex-shrink-0" />
              <span className="text-sm text-purple-800 dark:text-purple-200">
                {swapFirst
                  ? `Selected: ${swapFirst.name}. Now click another employee to swap all shifts.`
                  : "Click on an employee name in the schedule to start swapping."}
              </span>
              <Button size="sm" variant="ghost" onClick={() => { setSwapMode(false); setSwapFirst(null); }} className="ml-auto text-purple-600">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ===== SCHEDULE TABLE ===== */}
        <main className="max-w-7xl mx-auto w-full px-4 mt-4 mb-8 flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <RefreshCw className="h-8 w-8 text-slate-400 animate-spin" />
                <span className="text-slate-500 text-sm">Loading schedule...</span>
              </div>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <CalendarDays className="h-16 w-16 text-slate-300 dark:text-slate-600 mb-4" />
              <h2 className="text-xl font-semibold text-slate-600 dark:text-slate-300 mb-2">
                No Schedule Generated
              </h2>
              <p className="text-slate-400 dark:text-slate-500 mb-6 max-w-md">
                Click &quot;Generate Month&quot; to create a balanced shift schedule for {MONTHS[Number(selectedMonth.split("-")[1]) - 1]} {selectedYear}
              </p>
              <Button onClick={generateMonth} disabled={generating} className="bg-blue-600 hover:bg-blue-700 text-white">
                <Sparkles className="h-4 w-4 mr-1.5" />
                Generate Schedule
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {weekGroups.map((week) => {
                const isCollapsed = collapsedWeeks.has(week.key);
                const weekEntries = week.entries;
                const offPerson = weekEntries[0]?.offPerson || "N/A";

                return (
                  <Card key={week.key} className="shadow-sm overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-[#1B2A4A] to-[#1D4ED8] text-white px-4 py-2.5 cursor-pointer flex items-center justify-between"
                      onClick={() => {
                        const next = new Set(collapsedWeeks);
                        if (isCollapsed) next.delete(week.key);
                        else next.add(week.key);
                        setCollapsedWeeks(next);
                      }}
                    >
                      <div className="flex items-center gap-3">
                        {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                        <span className="font-semibold text-sm">{week.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-red-500/80 text-white border-0 text-xs">
                          OFF: {offPerson}
                        </Badge>
                      </div>
                    </div>

                    {!isCollapsed && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                              <th className="px-3 py-2 text-left w-8 text-xs text-slate-500">#</th>
                              <th className="px-3 py-2 text-left w-28 text-xs text-slate-500">Date</th>
                              <th className="px-3 py-2 text-left w-24 text-xs text-slate-500">Day</th>
                              <th className="px-3 py-2 text-center w-14 text-xs text-slate-500">Type</th>
                              <th className="px-3 py-2 text-left text-xs text-slate-500">Employee</th>
                              <th className="px-3 py-2 text-left w-20 text-xs text-slate-500 hidden sm:table-cell">HRID</th>
                              <th className="px-3 py-2 text-center w-20 text-xs text-slate-500 hidden md:table-cell">Start</th>
                              <th className="px-3 py-2 text-center w-20 text-xs text-slate-500 hidden md:table-cell">End</th>
                              <th className="px-3 py-2 text-center w-16 text-xs text-slate-500">Hours</th>
                              <th className="px-3 py-2 text-center w-24 text-xs text-slate-500">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {weekEntries.map((entry, idx) => {
                              const badge = getDayTypeBadge(entry.dayType, entry.isHoliday);

                              return (
                                <tr
                                  key={entry.date}
                                  className={`border-b border-slate-100 dark:border-slate-800 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors ${
                                    entry.isHoliday ? "bg-amber-50/50 dark:bg-amber-950/10" : ""
                                  } ${idx % 2 === 1 ? "bg-slate-50/50 dark:bg-slate-900/50" : ""}`}
                                >
                                  <td className="px-3 py-2 text-slate-400 text-xs">{idx + 1}</td>
                                  <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-200 text-xs">
                                    {formatDateDisplay(entry.date)}
                                  </td>
                                  <td className="px-3 py-2 text-slate-600 dark:text-slate-300 text-xs">{entry.dayName}</td>
                                  <td className="px-3 py-2 text-center">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${badge.color}`}>
                                      {badge.label}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2">
                                    <button
                                      className={`font-semibold text-sm transition-colors ${
                                        swapMode
                                          ? "text-purple-600 dark:text-purple-400 hover:text-purple-800 cursor-pointer underline decoration-dotted decoration-2 underline-offset-2"
                                          : "text-slate-800 dark:text-slate-100 cursor-default"
                                      } ${swapFirst && swapFirst.idx === entry.empIdx ? "ring-2 ring-purple-400 rounded px-1" : ""}`}
                                      onClick={(e) => {
                                        if (!swapMode) return;
                                        e.stopPropagation();
                                        if (!swapFirst) {
                                          setSwapFirst({ idx: entry.empIdx, name: entry.empName });
                                        } else if (swapFirst.idx !== entry.empIdx) {
                                          swapEmployees(swapFirst.idx, entry.empIdx);
                                        }
                                      }}
                                    >
                                      {entry.empName}
                                      {entry.isManual && (
                                        <span className="ml-1.5 text-[9px] font-normal text-purple-500 border border-purple-300 rounded px-1">
                                          Manual
                                        </span>
                                      )}
                                    </button>
                                  </td>
                                  <td className="px-3 py-2 text-slate-500 dark:text-slate-400 text-xs hidden sm:table-cell">{entry.empHrid}</td>
                                  <td className="px-3 py-2 text-slate-500 dark:text-slate-400 text-xs text-center hidden md:table-cell">{entry.start}</td>
                                  <td className="px-3 py-2 text-slate-500 dark:text-slate-400 text-xs text-center hidden md:table-cell">{entry.end}</td>
                                  <td className="px-3 py-2 text-center">
                                    <span className="font-bold text-blue-600 dark:text-blue-400">{entry.hours}</span>
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            className={`h-7 w-7 ${entry.isHoliday ? "text-amber-600 bg-amber-50" : "text-slate-400"}`}
                                            onClick={() => toggleHoliday(entry.date, entry.isHoliday)}
                                          >
                                            <AlertTriangle className="h-3.5 w-3.5" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>{entry.isHoliday ? "Remove holiday" : "Mark as holiday"}</TooltipContent>
                                      </Tooltip>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
                                            onClick={() => deleteEntry(entry.date)}
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Delete entry</TooltipContent>
                                      </Tooltip>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </main>

        {/* ===== SETTINGS MODAL ===== */}
        <Dialog open={showSettings} onOpenChange={setShowSettings}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" /> Shift Settings
              </DialogTitle>
              <DialogDescription>Configure shift times, holidays, and scheduling rules</DialogDescription>
            </DialogHeader>
            {editSettings && (
              <div className="space-y-5 mt-2">
                {/* Shift Times */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-slate-700 dark:text-slate-200">Shift Times</h3>
                  {Object.entries(editSettings.shifts).map(([key, shift]) => (
                    <div key={key} className="grid grid-cols-3 gap-2 items-center">
                      <Label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        {key === "Weekday" ? "Weekday (Sun-Wed)" : key === "Holiday" ? "Holiday (Official Off)" : key}
                      </Label>
                      <Input
                        value={shift.start}
                        onChange={(e) => {
                          editSettings.shifts[key].start = e.target.value;
                          setEditSettings({ ...editSettings });
                        }}
                        className="h-8 text-xs"
                        placeholder="05:00 PM"
                      />
                      <Input
                        value={shift.end}
                        onChange={(e) => {
                          editSettings.shifts[key].end = e.target.value;
                          setEditSettings({ ...editSettings });
                        }}
                        className="h-8 text-xs"
                        placeholder="10:00 PM"
                      />
                    </div>
                  ))}
                </div>
                <Separator />
                {/* Shift Hours */}
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm text-slate-700 dark:text-slate-200">Shift Hours</h3>
                  {Object.entries(editSettings.shifts).map(([key, shift]) => (
                    <div key={key} className="flex items-center justify-between">
                      <Label className="text-xs text-slate-600 dark:text-slate-300">
                        {key === "Weekday" ? "Weekday (Sun-Wed)" : key === "Holiday" ? "Holiday (Official Off)" : key}
                      </Label>
                      <Input
                        type="number"
                        value={shift.hours}
                        onChange={(e) => {
                          editSettings.shifts[key].hours = Number(e.target.value);
                          setEditSettings({ ...editSettings });
                        }}
                        className="w-20 h-8 text-xs text-center"
                        min={1}
                        max={12}
                      />
                    </div>
                  ))}
                </div>

                <Separator />

                {/* Summer Time Toggle */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-sm text-slate-700 dark:text-slate-200">Summer Time</h3>
                      <p className="text-xs text-slate-400">Enable extended summer shift hours</p>
                    </div>
                    <Switch
                      checked={editSettings.summerTime}
                      onCheckedChange={(checked) => {
                        setEditSettings({ ...editSettings, summerTime: checked });
                      }}
                    />
                  </div>
                  {editSettings.summerTime && editSettings.summerShifts && (
                    <div className="space-y-3 pl-0">
                      <h4 className="font-medium text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                        <Sun className="h-3.5 w-3.5" />
                        Summer Shift Times
                      </h4>
                      {Object.entries(editSettings.summerShifts).map(([key, shift]) => (
                        <div key={key} className="grid grid-cols-3 gap-2 items-center">
                          <Label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                            {key === "Weekday" ? "Weekday (Sun-Wed)" : key}
                          </Label>
                          <Input
                            value={shift.start}
                            onChange={(e) => {
                              editSettings.summerShifts[key].start = e.target.value;
                              setEditSettings({ ...editSettings });
                            }}
                            className="h-8 text-xs"
                            placeholder="05:00 PM"
                          />
                          <Input
                            value={shift.end}
                            onChange={(e) => {
                              editSettings.summerShifts[key].end = e.target.value;
                              setEditSettings({ ...editSettings });
                            }}
                            className="h-8 text-xs"
                            placeholder="11:00 PM"
                          />
                        </div>
                      ))}
                      {/* Summer shift hours */}
                      {Object.entries(editSettings.summerShifts).map(([key, shift]) => (
                        <div key={`hrs-${key}`} className="flex items-center justify-between">
                          <Label className="text-xs text-slate-600 dark:text-slate-300">
                            {key === "Weekday" ? "Weekday (Sun-Wed)" : key} hours
                          </Label>
                          <Input
                            type="number"
                            value={shift.hours}
                            onChange={(e) => {
                              editSettings.summerShifts[key].hours = Number(e.target.value);
                              setEditSettings({ ...editSettings });
                            }}
                            className="w-20 h-8 text-xs text-center"
                            min={1}
                            max={12}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Holiday Management */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Holiday Dates
                  </h3>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={newHolidayDate}
                      onChange={(e) => setNewHolidayDate(e.target.value)}
                      className="h-8 text-xs flex-1"
                    />
                    <Button
                      size="sm"
                      className="h-8 bg-amber-600 hover:bg-amber-700 text-white"
                      onClick={() => {
                        if (!newHolidayDate) {
                          toast({ title: "Error", description: "Please select a date", variant: "destructive" });
                          return;
                        }
                        if (editSettings.holidays.includes(newHolidayDate)) {
                          toast({ title: "Error", description: "Date already exists", variant: "destructive" });
                          return;
                        }
                        setEditSettings({
                          ...editSettings,
                          holidays: [...editSettings.holidays, newHolidayDate].sort(),
                        });
                        setNewHolidayDate("");
                      }}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add
                    </Button>
                  </div>
                  {editSettings.holidays.length > 0 ? (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {editSettings.holidays.map((hDate) => (
                        <div
                          key={hDate}
                          className="flex items-center justify-between bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2"
                        >
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3.5 w-3.5 text-amber-500" />
                            <span className="text-xs font-medium text-amber-800 dark:text-amber-200">
                              {formatHolidayDisplay(hDate)}
                            </span>
                            <span className="text-[10px] text-amber-500">{hDate}</span>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-red-400 hover:text-red-600 hover:bg-red-50"
                            onClick={() => {
                              setEditSettings({
                                ...editSettings,
                                holidays: editSettings.holidays.filter((d) => d !== hDate),
                              });
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No holidays configured. Add dates above.</p>
                  )}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSettings(false)}>Cancel</Button>
              <Button onClick={saveSettings} className="bg-blue-600 hover:bg-blue-700 text-white">Save Settings</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ===== EMPLOYEES MODAL ===== */}
        <Dialog open={showEmployees} onOpenChange={setShowEmployees}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" /> Team Members
              </DialogTitle>
              <DialogDescription>Manage your team roster</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              <div className="flex gap-2">
                <Input
                  value={newEmpName}
                  onChange={(e) => setNewEmpName(e.target.value)}
                  placeholder="Full Name"
                  className="h-8 text-sm"
                />
                <Input
                  value={newEmpHrid}
                  onChange={(e) => setNewEmpHrid(e.target.value)}
                  placeholder="HRID"
                  className="h-8 w-24 text-sm"
                />
                <Button onClick={addEmployee} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white h-8">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <Separator />

              <div className="space-y-2">
                {employees.map((emp, idx) => (
                  <div
                    key={emp.id}
                    className={`flex items-center justify-between p-2 rounded-lg border ${
                      emp.active
                        ? "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                        : "border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20 opacity-60"
                    }`}
                  >
                    {editingEmpId === emp.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-xs text-slate-400 w-5">{idx + 1}</span>
                        <div className="flex flex-col gap-1 flex-1">
                          <Input
                            value={editEmpName}
                            onChange={(e) => setEditEmpName(e.target.value)}
                            className="h-7 text-xs"
                            placeholder="Name"
                          />
                          <Input
                            value={editEmpHrid}
                            onChange={(e) => setEditEmpHrid(e.target.value)}
                            className="h-7 text-xs w-32"
                            placeholder="HRID"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400 w-5">{idx + 1}</span>
                        <div>
                          <div className="font-medium text-sm">{emp.name}</div>
                          <div className="text-xs text-slate-500">HRID: {emp.hrid}</div>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      {editingEmpId === emp.id ? (
                        <>
                          <Button
                            size="sm"
                            className="h-7 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                            onClick={() => editEmployee(emp.id, editEmpName, editEmpHrid)}
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Save
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-slate-400 hover:text-slate-600"
                            onClick={() => {
                              setEditingEmpId(null);
                              setEditEmpName("");
                              setEditEmpHrid("");
                            }}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-blue-400 hover:text-blue-600 hover:bg-blue-50"
                            onClick={() => {
                              setEditingEmpId(emp.id);
                              setEditEmpName(emp.name);
                              setEditEmpHrid(emp.hrid);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <div className="flex items-center gap-1.5">
                            <Switch
                              checked={emp.active}
                              onCheckedChange={() => toggleEmployeeActive(emp.id, emp.active)}
                              className="scale-75"
                            />
                            <span className="text-[10px] text-slate-400">{emp.active ? "Active" : "Inactive"}</span>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
                            onClick={() => deleteEmployee(emp.id, emp.name)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEmployees(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ===== ADD SHIFT MODAL ===== */}
        <Dialog open={showAddShift} onOpenChange={setShowAddShift}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" /> Add Manual Shift
              </DialogTitle>
              <DialogDescription>Add a shift outside the rotation</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <div>
                <Label className="text-xs">Date</Label>
                <Input
                  type="date"
                  value={addShiftDate}
                  onChange={(e) => setAddShiftDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Employee</Label>
                <Select value={addShiftEmp} onValueChange={setAddShiftEmp}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeEmployees.map((emp) => (
                      <SelectItem key={emp.id} value={String(emp.id)}>
                        {emp.name} ({emp.hrid})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddShift(false)}>Cancel</Button>
              <Button onClick={addManualShift} className="bg-blue-600 hover:bg-blue-700 text-white">Add Shift</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ===== STATS MODAL ===== */}
        <Dialog open={showStats} onOpenChange={setShowStats}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" /> Statistics & Reports
              </DialogTitle>
              <DialogDescription>Employee balance and distribution overview</DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="summary" className="mt-2">
              <TabsList>
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="cumulative">Cumulative</TabsTrigger>
                <TabsTrigger value="weekly">Weekly Matrix</TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="mt-4">
                {balance && (
                  <div className={`rounded-lg p-4 mb-4 ${
                    balance.status === "green"
                      ? "bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800"
                      : balance.status === "yellow"
                      ? "bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800"
                      : "bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800"
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className={`h-5 w-5 ${
                        balance.status === "green" ? "text-green-600" : balance.status === "yellow" ? "text-yellow-600" : "text-red-600"
                      }`} />
                      <span className="font-semibold">
                        {balance.status === "green" ? "Well Balanced" : balance.status === "yellow" ? "Slight Imbalance" : "Significant Imbalance"}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-slate-500 text-xs">Variance</div>
                        <div className="font-bold">{balance.variance.toFixed(1)}h</div>
                      </div>
                      <div>
                        <div className="text-slate-500 text-xs">Average</div>
                        <div className="font-bold">{balance.average.toFixed(1)}h</div>
                      </div>
                      <div>
                        <div className="text-slate-500 text-xs">Range</div>
                        <div className="font-bold">{balance.min.toFixed(1)}h – {balance.max.toFixed(1)}h</div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800">
                        <th className="px-3 py-2 text-left text-xs">#</th>
                        <th className="px-3 py-2 text-left text-xs">Employee</th>
                        <th className="px-3 py-2 text-center text-xs">Days</th>
                        <th className="px-3 py-2 text-center text-xs">Hours</th>
                        <th className="px-3 py-2 text-center text-xs">Sat</th>
                        <th className="px-3 py-2 text-center text-xs">Fri</th>
                        <th className="px-3 py-2 text-center text-xs">Weekend</th>
                        <th className="px-3 py-2 text-center text-xs">OFF Wks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeEmployees.map((emp, i) => {
                        const ls = localStats[i] || { days: 0, hours: 0, weekend: 0, sat: 0, fri: 0, offWeeks: 0 };
                        return (
                          <tr key={emp.id} className="border-b border-slate-100 dark:border-slate-800">
                            <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                            <td className="px-3 py-2 font-medium">{emp.name}</td>
                            <td className="px-3 py-2 text-center">{ls.days}</td>
                            <td className="px-3 py-2 text-center font-bold text-blue-600">{ls.hours.toFixed(1)}</td>
                            <td className="px-3 py-2 text-center">{ls.sat}</td>
                            <td className="px-3 py-2 text-center">{ls.fri}</td>
                            <td className="px-3 py-2 text-center">{ls.weekend}</td>
                            <td className="px-3 py-2 text-center text-red-500 font-medium">{ls.offWeeks || 0}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </TabsContent>

              <TabsContent value="cumulative" className="mt-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800">
                        <th className="px-3 py-2 text-left text-xs">Employee</th>
                        <th className="px-3 py-2 text-center text-xs">Total Days</th>
                        <th className="px-3 py-2 text-center text-xs">Total Hours</th>
                        <th className="px-3 py-2 text-center text-xs">Weekends</th>
                        <th className="px-3 py-2 text-center text-xs">Sat</th>
                        <th className="px-3 py-2 text-center text-xs">OFF Weeks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeEmployees.map((emp, i) => {
                        const cs = cumulativeStats[i];
                        return (
                          <tr key={emp.id} className="border-b border-slate-100 dark:border-slate-800">
                            <td className="px-3 py-2 font-medium">{emp.name}</td>
                            <td className="px-3 py-2 text-center">{cs?.totalDays || 0}</td>
                            <td className="px-3 py-2 text-center font-bold text-blue-600">{(cs?.totalHours || 0).toFixed(1)}</td>
                            <td className="px-3 py-2 text-center">{cs?.weekendDays || 0}</td>
                            <td className="px-3 py-2 text-center">{cs?.saturdays || 0}</td>
                            <td className="px-3 py-2 text-center text-red-500 font-medium">{cs?.offWeeks || 0}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </TabsContent>

              <TabsContent value="weekly" className="mt-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800">
                        <th className="px-2 py-2 text-left sticky left-0 bg-slate-100 dark:bg-slate-800 z-10">Employee</th>
                        {weekGroups.map((wk, wIdx) => (
                          <th key={wk.key} className="px-2 py-2 text-center min-w-[60px]">
                            W{wIdx + 1}
                            <div className="text-[9px] text-slate-400 font-normal">{wk.entries[0]?.date.substring(8)}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {activeEmployees.map((emp, i) => (
                        <tr key={emp.id} className="border-b border-slate-100 dark:border-slate-800">
                          <td className="px-2 py-2 font-medium sticky left-0 bg-white dark:bg-slate-950 z-10 whitespace-nowrap">
                            {emp.name.substring(0, 15)}
                          </td>
                          {weekGroups.map((wk) => {
                            const weekEmpEntries = wk.entries.filter((e) => e.empIdx === i);
                            const days = weekEmpEntries.length;
                            const hrs = weekEmpEntries.reduce((s, e) => s + e.hours, 0);
                            const isOff = wk.entries[0]?.offPersonIdx === i;

                            return (
                              <td key={wk.key} className={`px-2 py-2 text-center ${
                                isOff ? "bg-red-50 dark:bg-red-950/30 text-red-500 font-medium" : ""
                              }`}>
                                {isOff ? (
                                  <span className="text-[10px] font-bold">OFF</span>
                                ) : days > 0 ? (
                                  <div>
                                    <div className="font-bold">{days}d</div>
                                    <div className="text-slate-400">{hrs.toFixed(0)}h</div>
                                  </div>
                                ) : (
                                  <span className="text-slate-300">&mdash;</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowStats(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ===== CHANGE PASSWORD DIALOG ===== */}
        <Dialog open={showChangePassword} onOpenChange={setShowChangePassword}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" /> Change Password
              </DialogTitle>
              <DialogDescription>Update your account password</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <div>
                <Label className="text-xs">Current Password</Label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="mt-1"
                  autoComplete="current-password"
                />
              </div>
              <div>
                <Label className="text-xs">New Password</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1"
                  autoComplete="new-password"
                />
              </div>
              <div>
                <Label className="text-xs">Confirm New Password</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1"
                  autoComplete="new-password"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowChangePassword(false); setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); }}>Cancel</Button>
              <Button onClick={handleChangePassword} disabled={changePasswordLoading} className="bg-blue-600 hover:bg-blue-700 text-white">
                {changePasswordLoading ? <RefreshCw className="h-4 w-4 animate-spin mr-1.5" /> : null}
                Update Password
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ===== FOOTER ===== */}
        <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-3 mt-auto">
          <div className="max-w-7xl mx-auto px-4 flex items-center justify-between text-xs text-slate-400">
            <span>IT Helpdesk Shift Scheduler v2</span>
            <span>{activeEmployees.length} active employees &bull; Week starts Saturday &bull; Signed in as {authUsername}</span>
          </div>
        </footer>
      </div>
    </TooltipProvider>
  );
}
