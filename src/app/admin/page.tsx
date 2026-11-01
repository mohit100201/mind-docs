"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth } from "@/lib/firebase/firebase";
import {
  getAllUsers,
  isUserAdmin,
  syncUserProfile,
  createNewUserByAdmin,
  deleteUserRecord,
  UserProfile,
  getUserCreationTimeMs,
  formatCreationDate,
} from "@/lib/firebase/adminService";
import {
  AcademicPdfItem,
  DETAILED_NOTES_CATALOG,
  FLASHCARDS_CATALOG,
  syncAllAcademicPdfs,
} from "@/lib/firebase/academicContent";
import { getLivePdfsList } from "@/lib/firebase/pdfStorageService";
import { PdfManagerTab } from "@/components/admin/PdfManagerTab";
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  FileText,
  Layers,
  Search,
  CheckCircle,
  AlertCircle,
  LogOut,
  RefreshCw,
  X,
  Unlock,
  Eye,
  EyeOff,
  GraduationCap,
  Copy,
  Check,
  Trash2,
  Calendar,
  Clock,
  ArrowDown,
} from "lucide-react";

export default function AdminPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  // Users state
  const [adminTab, setAdminTab] = useState<"users" | "materials">("users");
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "student" | "admin">("all");
  const [hasPermissionError, setHasPermissionError] = useState(false);
  const [copiedRules, setCopiedRules] = useState(false);

  // Notifications
  const [alertMessage, setAlertMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Modal states
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form state: Add user
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("Mohit@123");
  const [newUserRole, setNewUserRole] = useState<"student" | "admin">("student");
  const [newUserAllowedPdfs, setNewUserAllowedPdfs] = useState<string[]>([]);
  const [newUserAllowedFlashcards, setNewUserAllowedFlashcards] = useState<string[]>([]);
  const [notesCatalog, setNotesCatalog] = useState<AcademicPdfItem[]>(DETAILED_NOTES_CATALOG);
  const [flashcardsCatalog, setFlashcardsCatalog] = useState<AcademicPdfItem[]>(FLASHCARDS_CATALOG);
  const [showPassword, setShowPassword] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // Sync state
  const [isSyncingPdfs, setIsSyncingPdfs] = useState(false);

  // Auto-dismiss alerts
  useEffect(() => {
    if (alertMessage) {
      const timer = setTimeout(() => setAlertMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [alertMessage]);

  // Auth Guard
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      try {
        if (!user) {
          setIsAdmin(false);
          router.replace("/login");
          return;
        }

        setCurrentUser(user);

        // Check if user is admin by email first
        const adminByEmail = isUserAdmin(user.email);
        const profile = await syncUserProfile(
          user.uid,
          user.email || "",
          user.displayName || "Admin"
        );
        const adminVerified = adminByEmail || isUserAdmin(user.email, profile.role);

        if (!adminVerified) {
          setIsAdmin(false);
          router.replace("/dashboard");
          return;
        }

        setIsAdmin(true);
        await loadUsers();
      } catch (err: unknown) {
        console.error("Admin verification error:", err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, [router]);

  const loadUsers = async () => {
    try {
      const list = await getAllUsers();
      setUsers(list);
      setHasPermissionError(false);

      // Also refresh live PDF catalogs
      try {
        const liveList = await getLivePdfsList();
        const liveNotes = liveList.filter((p) => p.section === "detailnotes");
        const liveFlash = liveList.filter((p) => p.section === "flashcards");
        if (liveNotes.length > 0) setNotesCatalog(liveNotes);
        if (liveFlash.length > 0) setFlashcardsCatalog(liveFlash);
      } catch {
        // Fallback to static
      }
    } catch (err: unknown) {
      const errorObj = err as { message?: string; code?: string };
      console.error("Error loading users:", err);
      if (
        errorObj.message?.includes("Missing or insufficient permissions") ||
        errorObj.code === "permission-denied"
      ) {
        setHasPermissionError(true);
      } else {
        setAlertMessage({
          type: "error",
          text: "Could not load users: " + (errorObj.message || "Unknown error"),
        });
      }
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.replace("/login");
  };

  const handleSyncPdfs = async () => {
    setIsSyncingPdfs(true);
    try {
      const res = await syncAllAcademicPdfs();
      setAlertMessage({
        type: "success",
        text: `Successfully synced ${res.count} PDFs & Flashcards to Firestore!`,
      });
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setAlertMessage({
        type: "error",
        text: "Failed to sync PDFs: " + (errorObj.message || "Check Firestore security rules."),
      });
    } finally {
      setIsSyncingPdfs(false);
    }
  };

  // Handle Delete User Confirmation
  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);

    try {
      await deleteUserRecord(userToDelete.uid);
      setUsers((prev) => prev.filter((u) => u.uid !== userToDelete.uid));
      setAlertMessage({
        type: "success",
        text: `Removed ${userToDelete.displayName || userToDelete.email || "user"} from Firestore!`,
      });
      setUserToDelete(null);
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setAlertMessage({
        type: "error",
        text: "Failed to delete user from Firestore: " + (errorObj.message || "Unknown error"),
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle Add User Submit
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword.trim()) {
      setAlertMessage({ type: "error", text: "Please fill in all required fields." });
      return;
    }

    setIsCreatingUser(true);
    try {
      const createdUser = await createNewUserByAdmin({
        name: newUserName.trim(),
        email: newUserEmail.trim(),
        password: newUserPassword,
        role: newUserRole,
        allowedPdfs: newUserAllowedPdfs,
        allowedFlashCards: newUserAllowedFlashcards,
      });

      setUsers((prev) => [createdUser, ...prev]);
      setAlertMessage({
        type: "success",
        text: `User ${createdUser.email} created successfully!`,
      });

      // Reset form
      setNewUserName("");
      setNewUserEmail("");
      setNewUserPassword("Mohit@123");
      setNewUserRole("student");
      setNewUserAllowedPdfs([]);
      setNewUserAllowedFlashcards([]);
      setShowAddUserModal(false);
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setAlertMessage({
        type: "error",
        text: "Failed to create user: " + (errorObj.message || "Check Firestore security rules."),
      });
    } finally {
      setIsCreatingUser(false);
    }
  };

  // Toggle helpers for Add User
  const toggleNewUserPdf = (id: string) => {
    setNewUserAllowedPdfs((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleNewUserFlashcard = (id: string) => {
    setNewUserAllowedFlashcards((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Filtered users: matches name, email, or UID, sorted in decreasing order of registration time
  const filteredUsers = useMemo(() => {
    return users
      .filter((u) => {
        const queryLower = searchQuery.toLowerCase().trim();
        const matchesSearch =
          !queryLower ||
          (u.displayName || "").toLowerCase().includes(queryLower) ||
          (u.email || "").toLowerCase().includes(queryLower);
        const matchesRole =
          roleFilter === "all" ? true : u.role === roleFilter;
        return matchesSearch && matchesRole;
      })
      .sort((a, b) => getUserCreationTimeMs(b) - getUserCreationTimeMs(a));
  }, [users, searchQuery, roleFilter]);

  const recommendedRules = `rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read and write
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}`;

  const copyRulesToClipboard = () => {
    navigator.clipboard.writeText(recommendedRules);
    setCopiedRules(true);
    setTimeout(() => setCopiedRules(false), 3000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <RefreshCw className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-600 font-semibold">Verifying Admin Access...</p>
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-red-100 max-w-md text-center">
          <AlertCircle className="w-14 h-14 text-rose-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-800">Access Denied</h2>
          <p className="text-slate-500 mt-2 text-sm">
            You must be logged in as an administrator to access this area.
          </p>
          <button
            onClick={() => router.push("/login")}
            className="mt-6 px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
      {/* Top Banner Alert */}
      {alertMessage && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg border text-sm font-semibold transition-all ${
            alertMessage.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          {alertMessage.type === "success" ? (
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span>{alertMessage.text}</span>
          <button
            onClick={() => setAlertMessage(null)}
            className="ml-2 hover:opacity-75"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation Bar */}
      <header className="h-20 bg-white border-b border-slate-200 px-6 sm:px-10 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-100 font-black">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              PsychEd Admin Console
              <span className="text-[10px] uppercase tracking-wider bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                Admin
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              User Management & Access Control
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <div className="hidden md:flex flex-col text-right">
            <span className="text-xs font-bold text-slate-800">
              {currentUser?.displayName || "Admin User"}
            </span>
            <span className="text-[11px] text-slate-400">
              {currentUser?.email}
            </span>
          </div>

          <div className="hidden md:block h-6 w-px bg-slate-200"></div>

          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs sm:text-sm rounded-xl transition-all"
          >
            <GraduationCap className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">Student Dashboard</span>
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 font-semibold text-xs sm:text-sm rounded-xl transition-all border border-rose-100"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 sm:p-10 space-y-8">
        {/* Firestore Security Rules Warning Banner */}
        {hasPermissionError && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-3xl p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-amber-100 text-amber-700 rounded-2xl shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-amber-900">
                  Firebase Security Rules Need to Be Updated
                </h3>
                <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                  Firestore returned <code>Missing or insufficient permissions</code>. Open your <strong>Firebase Console &gt; Firestore Database &gt; Rules</strong> tab and update the rules:
                </p>

                <div className="relative mt-3">
                  <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl text-xs overflow-x-auto font-mono">
                    {recommendedRules}
                  </pre>
                  <button
                    onClick={copyRulesToClipboard}
                    className="absolute top-2.5 right-2.5 flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm"
                  >
                    {copiedRules ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedRules ? "Copied!" : "Copy Rules"}</span>
                  </button>
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <button
                    onClick={loadUsers}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Retry Loading Users
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-3 border-b border-slate-200/80 pb-3">
          <button
            onClick={() => setAdminTab("users")}
            className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold transition-all ${
              adminTab === "users"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
                : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>User Management</span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-black ${
                adminTab === "users"
                  ? "bg-indigo-700 text-white"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {users.length}
            </span>
          </button>

          <button
            onClick={() => setAdminTab("materials")}
            className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold transition-all ${
              adminTab === "materials"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
                : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Study Materials (PDFs)</span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-black ${
                adminTab === "materials"
                  ? "bg-indigo-700 text-white"
                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
              }`}
            >
              Upload &amp; Delete
            </span>
          </button>
        </div>

        {/* ================= TAB 1: USER MANAGEMENT ================= */}
        {adminTab === "users" && (
          <div className="space-y-8">
            {/* Welcome and Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Total Users
              </span>
              <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <p className="text-3xl font-black text-slate-800">{users.length}</p>
            <p className="text-xs text-slate-400 mt-1">Active accounts in Firestore</p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Students
              </span>
              <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
                <GraduationCap className="w-5 h-5" />
              </div>
            </div>
            <p className="text-3xl font-black text-slate-800">
              {users.filter((u) => u.role !== "admin").length}
            </p>
            <p className="text-xs text-slate-400 mt-1">Enrolled students</p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Detailed Notes
              </span>
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
                <FileText className="w-5 h-5" />
              </div>
            </div>
            <p className="text-3xl font-black text-slate-800">
              {DETAILED_NOTES_CATALOG.length}
            </p>
            <p className="text-xs text-slate-400 mt-1">Class 12 Chapters</p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Flashcards
              </span>
              <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
                <Layers className="w-5 h-5" />
              </div>
            </div>
            <p className="text-3xl font-black text-slate-800">
              {FLASHCARDS_CATALOG.length}
            </p>
            <p className="text-xs text-slate-400 mt-1">Revision Decks</p>
          </div>
        </div>

        {/* Action Header */}
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex flex-col sm:flex-row gap-3 items-center flex-1">
            {/* Search Bar */}
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by student name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 placeholder:text-slate-400 font-medium"
              />
            </div>

            {/* Role Filter */}
            <div className="w-full sm:w-auto">
              <select
                value={roleFilter}
                onChange={(e) =>
                  setRoleFilter(e.target.value as "all" | "student" | "admin")
                }
                className="w-full sm:w-auto px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium text-slate-700"
              >
                <option value="all">All Roles</option>
                <option value="student">Students Only</option>
                <option value="admin">Admins Only</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSyncPdfs}
              disabled={isSyncingPdfs}
              title="Ensure all 14 curriculum PDFs and Flashcards are registered in Firestore"
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-all border border-slate-200 disabled:opacity-60"
            >
              <RefreshCw
                className={`w-4 h-4 ${isSyncingPdfs ? "animate-spin" : ""}`}
              />
              <span>{isSyncingPdfs ? "Syncing..." : "Sync PDF Catalog"}</span>
            </button>

            <button
              onClick={() => setShowAddUserModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-md shadow-indigo-100 transition-all"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add New User</span>
            </button>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-base font-bold text-slate-800">
                Users & Permissions ({filteredUsers.length})
              </h3>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-lg border border-indigo-100/80">
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                <span>Sorted by Newest Registered First</span>
              </span>
            </div>
            <button
              onClick={loadUsers}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh List
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-100 text-xs uppercase font-bold text-slate-400">
                <tr>
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 text-indigo-700 font-bold">
                      <span>Registered</span>
                      <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
                    </span>
                  </th>
                  <th className="px-6 py-4">Detailed Notes</th>
                  <th className="px-6 py-4">Flashcards</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400">
                      {hasPermissionError ? (
                        <span className="text-amber-600 font-semibold">
                          Could not read users due to Firestore Security Rules. Please update your Rules above and click Retry.
                        </span>
                      ) : (
                        <span>No users found. Click <strong>Add New User</strong> to create one!</span>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const notesCount = (u.allowedPdfs || []).length;
                    const flashCount = (u.allowedFlashCards || []).length;
                    const isAdm = u.role === "admin";
                    const initialLetter = (u.displayName || u.email || "S")[0].toUpperCase();

                    return (
                      <tr key={u.uid} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center font-bold uppercase shrink-0">
                              {initialLetter}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 text-sm">
                                {u.displayName || "Enrolled Student"}
                              </p>
                              {u.email ? (
                                <p className="text-xs text-slate-500 font-medium">
                                  {u.email}
                                </p>
                              ) : (
                                <p className="text-xs text-indigo-600 font-medium">
                                  Click Assign Access to add email
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                              isAdm
                                ? "bg-purple-100 text-purple-700 border border-purple-200"
                                : "bg-blue-100 text-blue-700 border border-blue-200"
                            }`}
                          >
                            {isAdm ? (
                              <ShieldCheck className="w-3.5 h-3.5" />
                            ) : (
                              <GraduationCap className="w-3.5 h-3.5" />
                            )}
                            {isAdm ? "Administrator" : "Student"}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <div className="inline-flex items-center gap-1.5 text-xs text-slate-600 font-medium bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                            <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                            <span>{formatCreationDate(u)}</span>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          {isAdm ? (
                            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                              Full Access (All Notes)
                            </span>
                          ) : (
                            <span
                              className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${
                                notesCount > 0
                                  ? "bg-slate-100 text-slate-800 border-slate-200"
                                  : "bg-slate-50 text-slate-400 border-slate-100"
                              }`}
                            >
                              {notesCount} / {DETAILED_NOTES_CATALOG.length} Chapters
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-4">
                          {isAdm ? (
                            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                              Full Access (All Flashcards)
                            </span>
                          ) : (
                            <span
                              className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${
                                flashCount > 0
                                  ? "bg-slate-100 text-slate-800 border-slate-200"
                                  : "bg-slate-50 text-slate-400 border-slate-100"
                              }`}
                            >
                              {flashCount} / {FLASHCARDS_CATALOG.length} Decks
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              onClick={() =>
                                router.push(
                                  `/admin/assign/${encodeURIComponent(u.uid)}`
                                )
                              }
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl transition-all border border-indigo-100 shadow-2xs"
                            >
                              <Unlock className="w-3.5 h-3.5" />
                              <span>Assign Access</span>
                            </button>

                            {!isAdm && (
                              <button
                                onClick={() => setUserToDelete(u)}
                                title="Delete user from Firestore"
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all border border-transparent hover:border-rose-100"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )}

    {/* ================= TAB 2: STUDY MATERIALS (PDFs) ================= */}
    {adminTab === "materials" && <PdfManagerTab />}
  </main>

      {/* ================= MODAL: CONFIRM DELETE USER ================= */}
      {userToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl border border-slate-100">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-black text-slate-900">
              Delete User Record?
            </h3>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
              Are you sure you want to remove{" "}
              <strong className="text-slate-800">
                {userToDelete.displayName || userToDelete.email || "this student"}
              </strong>{" "}
              from Firestore? All of their permissions and study access will be removed immediately.
            </p>

            <div className="flex items-center justify-end gap-3 mt-8">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteUser}
                className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-rose-100 disabled:opacity-60 transition-all flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete from Firestore</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD NEW USER ================= */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-8 shadow-2xl border border-slate-100 my-8">
            <div className="flex items-center justify-between pb-6 border-b border-slate-100">
              <div>
                <h3 className="text-xl font-black text-slate-900">Add New User</h3>
                <p className="text-xs text-slate-400 font-medium">
                  Create a new student or admin account and assign initial PDF permissions.
                </p>
              </div>
              <button
                onClick={() => setShowAddUserModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-6 mt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Priya Sharma"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 placeholder:text-slate-400 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. priya@gmail.com"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 placeholder:text-slate-400 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="Min 6 characters"
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 placeholder:text-slate-400 font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Role *
                  </label>
                  <select
                    value={newUserRole}
                    onChange={(e) =>
                      setNewUserRole(e.target.value as "student" | "admin")
                    }
                    className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium text-slate-700"
                  >
                    <option value="student">Student</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
              </div>

              {/* PDF Permissions Assignment Section */}
              <div className="border-t border-slate-100 pt-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-800">
                    Assign PDF Permissions
                  </h4>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setNewUserAllowedPdfs(notesCatalog.map((p) => p.id));
                        setNewUserAllowedFlashcards(flashcardsCatalog.map((p) => p.id));
                      }}
                      className="text-xs font-bold text-indigo-600 hover:underline"
                    >
                      Grant All
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => {
                        setNewUserAllowedPdfs([]);
                        setNewUserAllowedFlashcards([]);
                      }}
                      className="text-xs font-bold text-slate-400 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Detailed Notes Checkboxes */}
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    📘 Detailed Notes (Class 12)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1 border border-slate-100 rounded-xl bg-slate-50/50">
                    {notesCatalog.map((note) => {
                      const checked = newUserAllowedPdfs.includes(note.id);
                      return (
                        <label
                          key={note.id}
                          className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer border text-xs transition-all ${
                            checked
                              ? "bg-indigo-50/80 border-indigo-200 text-indigo-900 font-semibold"
                              : "bg-white border-slate-100 text-slate-600 hover:bg-slate-100/50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleNewUserPdf(note.id)}
                            className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="line-clamp-2 leading-tight">{note.title}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Flashcards Checkboxes */}
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    🗂️ Flashcards Decks (Class 12)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1 border border-slate-100 rounded-xl bg-slate-50/50">
                    {flashcardsCatalog.map((fc) => {
                      const checked = newUserAllowedFlashcards.includes(fc.id);
                      return (
                        <label
                          key={fc.id}
                          className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer border text-xs transition-all ${
                            checked
                              ? "bg-amber-50/80 border-amber-200 text-amber-900 font-semibold"
                              : "bg-white border-slate-100 text-slate-600 hover:bg-slate-100/50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleNewUserFlashcard(fc.id)}
                            className="mt-0.5 rounded text-amber-600 focus:ring-amber-500"
                          />
                          <span className="line-clamp-2 leading-tight">{fc.title}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingUser}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-100 disabled:opacity-60 transition-all flex items-center gap-2"
                >
                  {isCreatingUser ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create User & Assign Access</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
