"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/firebase";
import {
  getUserByUid,
  updateUserAccess,
  isUserAdmin,
  UserProfile,
  formatCreationDate,
} from "@/lib/firebase/adminService";
import {
  DETAILED_NOTES_CATALOG,
  FLASHCARDS_CATALOG,
} from "@/lib/firebase/academicContent";
import {
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Save,
  BookOpen,
  Layers,
  GraduationCap,
  ShieldCheck,
  Check,
  RefreshCw,
  LogOut,
  Calendar,
  X,
  Sparkles,
  FileText,
} from "lucide-react";

export default function AssignAccessPage() {
  const params = useParams();
  const router = useRouter();
  const uid = (params?.uid as string) || "";

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Target Student State
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"student" | "admin">("student");
  const [selectedPdfs, setSelectedPdfs] = useState<string[]>([]);
  const [selectedFlashcards, setSelectedFlashcards] = useState<string[]>([]);

  // Alert
  const [alert, setAlert] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Auto dismiss alert
  useEffect(() => {
    if (alert) {
      const timer = setTimeout(() => setAlert(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [alert]);

  // Auth Guard
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setIsAdmin(false);
        router.replace("/login");
        return;
      }

      const userIsAdmin = isUserAdmin(user.email);
      if (!userIsAdmin) {
        setIsAdmin(false);
        router.replace("/dashboard");
        return;
      }

      setIsAdmin(true);

      // Fetch target user data
      if (uid) {
        try {
          const profile = await getUserByUid(decodeURIComponent(uid));
          if (profile) {
            setUserProfile(profile);
            setDisplayName(profile.displayName || "");
            setEmail(profile.email || "");
            setRole(profile.role || "student");
            setSelectedPdfs(profile.allowedPdfs || []);
            setSelectedFlashcards(profile.allowedFlashCards || []);
          } else {
            setAlert({
              type: "error",
              text: `Could not find student account with ID: ${uid}`,
            });
          }
        } catch (err: unknown) {
          const errObj = err as { message?: string };
          setAlert({
            type: "error",
            text: "Failed to load user: " + (errObj.message || "Unknown error"),
          });
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    });

    return () => unsub();
  }, [uid, router]);

  // Handlers for toggles
  const togglePdf = (pdfId: string) => {
    setSelectedPdfs((prev) =>
      prev.includes(pdfId)
        ? prev.filter((id) => id !== pdfId)
        : [...prev, pdfId]
    );
  };

  const toggleFlashcard = (fcId: string) => {
    setSelectedFlashcards((prev) =>
      prev.includes(fcId)
        ? prev.filter((id) => id !== fcId)
        : [...prev, fcId]
    );
  };

  const selectAllNotes = () => {
    setSelectedPdfs(DETAILED_NOTES_CATALOG.map((c) => c.id));
  };

  const deselectAllNotes = () => {
    setSelectedPdfs([]);
  };

  const selectAllFlashcards = () => {
    setSelectedFlashcards(FLASHCARDS_CATALOG.map((c) => c.id));
  };

  const deselectAllFlashcards = () => {
    setSelectedFlashcards([]);
  };

  const grantAllContent = () => {
    setSelectedPdfs(DETAILED_NOTES_CATALOG.map((c) => c.id));
    setSelectedFlashcards(FLASHCARDS_CATALOG.map((c) => c.id));
  };

  const revokeAllContent = () => {
    setSelectedPdfs([]);
    setSelectedFlashcards([]);
  };

  // Save handler
  const handleSave = async () => {
    if (!uid) return;
    setSaving(true);

    try {
      await updateUserAccess(decodeURIComponent(uid), {
        displayName: displayName.trim() || undefined,
        email: email.trim() || undefined,
        role: role,
        allowedPdfs: selectedPdfs,
        allowedFlashCards: selectedFlashcards,
      });

      setAlert({
        type: "success",
        text: `Permissions saved successfully for ${displayName || email || "Student"}!`,
      });

      // Update local profile representation
      setUserProfile((prev) =>
        prev
          ? {
              ...prev,
              displayName: displayName.trim() || prev.displayName,
              email: email.trim() || prev.email,
              role,
              allowedPdfs: selectedPdfs,
              allowedFlashCards: selectedFlashcards,
            }
          : null
      );
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      setAlert({
        type: "error",
        text: "Error updating permissions: " + (errObj.message || "Please check Firestore security rules."),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.replace("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <RefreshCw className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-600 font-semibold">Loading Student Content...</p>
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
            Administrator permissions are required to access this page.
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

  const notesCount = selectedPdfs.length;
  const totalNotes = DETAILED_NOTES_CATALOG.length;
  const flashCount = selectedFlashcards.length;
  const totalFlash = FLASHCARDS_CATALOG.length;
  const initialLetter = (displayName || email || "S")[0]?.toUpperCase() || "S";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col pb-28">
      {/* Alert Notification */}
      {alert && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg border text-sm font-semibold transition-all ${
            alert.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          {alert.type === "success" ? (
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span>{alert.text}</span>
          <button onClick={() => setAlert(null)} className="ml-2 hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Navbar */}
      <header className="h-20 bg-white border-b border-slate-200 px-6 sm:px-10 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-4">
          <Link
            href="/admin"
            className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl font-bold text-xs sm:text-sm transition-all border border-slate-200 hover:border-indigo-200"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to Console</span>
          </Link>
          <div className="h-6 w-px bg-slate-200"></div>
          <div>
            <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              Assign Academic Access
              <span className="text-[10px] uppercase tracking-wider bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                Class 12
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-medium hidden sm:block">
              Select notes and flashcards for this user
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-indigo-100 transition-all disabled:opacity-60"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{saving ? "Saving..." : "Save Permissions"}</span>
          </button>

          <button
            onClick={handleLogout}
            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl w-full mx-auto p-6 sm:p-10 space-y-8 flex-1">
        {/* Student Profile Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 sm:p-8">
          <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between">
            {/* User Meta */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white font-black text-2xl flex items-center justify-center shadow-md shadow-indigo-100 shrink-0">
                {initialLetter}
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-xl font-black text-slate-900">
                    {displayName || "Enrolled Student"}
                  </h2>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      role === "admin"
                        ? "bg-purple-100 text-purple-700 border border-purple-200"
                        : "bg-blue-100 text-blue-700 border border-blue-200"
                    }`}
                  >
                    {role === "admin" ? (
                      <ShieldCheck className="w-3 h-3" />
                    ) : (
                      <GraduationCap className="w-3 h-3" />
                    )}
                    {role === "admin" ? "Administrator" : "Student"}
                  </span>
                </div>
                <p className="text-sm text-slate-500 font-medium">
                  {email || "No email assigned"}
                </p>
                {userProfile && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 pt-0.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Registered: {formatCreationDate(userProfile)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Bulk Actions */}
            <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
              <button
                type="button"
                onClick={grantAllContent}
                className="flex-1 lg:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-xl border border-emerald-200 transition-all"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Grant All (14 Items)</span>
              </button>
              <button
                type="button"
                onClick={revokeAllContent}
                className="flex-1 lg:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl border border-slate-200 transition-all"
              >
                <X className="w-3.5 h-3.5 text-slate-500" />
                <span>Revoke All</span>
              </button>
            </div>
          </div>

          {/* Edit Fields Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-100">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Student Name"
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@example.com"
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Account Role
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRole("student")}
                  className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all flex items-center justify-center gap-1.5 ${
                    role === "student"
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>Student</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRole("admin")}
                  className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all flex items-center justify-center gap-1.5 ${
                    role === "admin"
                      ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Admin</span>
                </button>
              </div>
            </div>
          </div>

          {/* Access Progress Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-6 border-t border-slate-100">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
              <div className="flex items-center justify-between text-xs font-bold mb-2">
                <span className="text-slate-600 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-indigo-600" />
                  Detailed Notes Access
                </span>
                <span className="text-indigo-600">
                  {notesCount} / {totalNotes} Chapters
                </span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${(notesCount / totalNotes) * 100}%` }}
                ></div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
              <div className="flex items-center justify-between text-xs font-bold mb-2">
                <span className="text-slate-600 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-amber-600" />
                  Flashcards Decks Access
                </span>
                <span className="text-amber-600">
                  {flashCount} / {totalFlash} Decks
                </span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-amber-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${(flashCount / totalFlash) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 1: DETAILED NOTES */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-6 sm:px-8 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-50/70 to-indigo-50/30">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-xs">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-800">
                  Class 12 Detailed Notes ({notesCount}/{totalNotes})
                </h3>
                <p className="text-xs text-slate-500">
                  Comprehensive NCERT study material and chapter notes
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAllNotes}
                className="px-3.5 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all"
              >
                Select All 7 Notes
              </button>
              <button
                type="button"
                onClick={deselectAllNotes}
                className="px-3.5 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-all"
              >
                Deselect All
              </button>
            </div>
          </div>

          <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {DETAILED_NOTES_CATALOG.map((note, index) => {
              const isChecked = selectedPdfs.includes(note.id);
              return (
                <div
                  key={note.id}
                  onClick={() => togglePdf(note.id)}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-3.5 select-none ${
                    isChecked
                      ? "bg-indigo-50/60 border-indigo-500 shadow-xs"
                      : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                  }`}
                >
                  <div
                    className={`w-5 h-5 mt-0.5 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                      isChecked
                        ? "bg-indigo-600 border-indigo-600 text-white"
                        : "border-slate-300 bg-white"
                    }`}
                  >
                    {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200/80">
                        Chapter {index + 1}
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium">
                        Class 12
                      </span>
                    </div>
                    <p
                      className={`text-sm font-bold leading-tight ${
                        isChecked ? "text-indigo-950" : "text-slate-800"
                      }`}
                    >
                      {note.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-400">
                      <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{note.file}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION 2: FLASHCARDS */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-6 sm:px-8 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-50/70 to-amber-50/30">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500 text-white shadow-xs">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-800">
                  Class 12 Flashcards Decks ({flashCount}/{totalFlash})
                </h3>
                <p className="text-xs text-slate-500">
                  Active recall flashcards for fast chapter revision
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAllFlashcards}
                className="px-3.5 py-1.5 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-all"
              >
                Select All 7 Decks
              </button>
              <button
                type="button"
                onClick={deselectAllFlashcards}
                className="px-3.5 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-all"
              >
                Deselect All
              </button>
            </div>
          </div>

          <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {FLASHCARDS_CATALOG.map((deck, index) => {
              const isChecked = selectedFlashcards.includes(deck.id);
              return (
                <div
                  key={deck.id}
                  onClick={() => toggleFlashcard(deck.id)}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-3.5 select-none ${
                    isChecked
                      ? "bg-amber-50/60 border-amber-500 shadow-xs"
                      : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                  }`}
                >
                  <div
                    className={`w-5 h-5 mt-0.5 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                      isChecked
                        ? "bg-amber-500 border-amber-500 text-white"
                        : "border-slate-300 bg-white"
                    }`}
                  >
                    {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200/80">
                        Deck {index + 1}
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium">
                        Quick Recall
                      </span>
                    </div>
                    <p
                      className={`text-sm font-bold leading-tight ${
                        isChecked ? "text-amber-950" : "text-slate-800"
                      }`}
                    >
                      {deck.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-400">
                      <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{deck.file}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* Floating Sticky Bottom Bar for Instant Saving */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-6 sm:px-10 py-4 shadow-lg">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xs sm:text-sm font-semibold text-slate-700">
            <span className="px-3 py-1 bg-slate-100 rounded-lg text-slate-800 font-bold">
              {notesCount} Notes • {flashCount} Flashcards Selected
            </span>
            <span className="text-slate-400 hidden md:inline">
              for {displayName || email || "Student"}
            </span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Link
              href="/admin"
              className="flex-1 sm:flex-none text-center px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm rounded-xl transition-all"
            >
              Cancel
            </Link>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-indigo-100 transition-all disabled:opacity-60"
            >
              {saving ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>{saving ? "Saving Changes..." : "Save Permissions"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
