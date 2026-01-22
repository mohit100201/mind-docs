"use client";
import React, { useState } from "react";
import Image from "next/image";
import {
  Folder, Lock, Search, FileText, GraduationCap,
  LayoutDashboard, LogOut, ChevronRight, Award,
  BookOpen, Users, ArrowLeft, Bell
} from "lucide-react";

import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth } from "@/lib/firebase/firebase";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { seedAcademicData } from "@/lib/firebase/seedAcademicData";



/* ================= TYPES ================= */

type FileItem = {
  name: string;
  size: string;
};

type SubFolder = {
  title: string;
  locked: boolean;
  files: FileItem[];
};

type ClassData = {
  id: string;
  title: string;
  category: string;
  subFolders: SubFolder[];
};

type NavState =
  | { level: "main"; classData: null; folderData: null }
  | { level: "sub"; classData: ClassData; folderData: null }
  | { level: "files"; classData: ClassData; folderData: SubFolder };

/* ================= DATA ================= */

const ACADEMIC_DATA: ClassData[] = [
  {
    id: "class-11",
    title: "Class 11 Psychology",
    category: "Foundation Academic",
    subFolders: [
      {
        title: "Detailed Notes",
        locked: true,
        files: [
          { name: "What_is_Psychology_Ch1.pdf", size: "1.2MB" },
          { name: "Methods_of_Enquiry_Ch2.pdf", size: "2.4MB" }
        ]
      },
      {
        title: "Flowcharts",
        locked: true,
        files: [
          { name: "Human_Development_Visual.pdf", size: "0.8MB" },
          { name: "Sensory_Attentional_Processes.pdf", size: "1.1MB" }
        ]
      }
    ]
  },
  {
    id: "class-12",
    title: "Class 12 Psychology",
    category: "Board Excellence",
    subFolders: [
      {
        title: "Detailed Notes",
        locked: false,
        files: [
          { name: "Self_and_Personality.pdf", size: "2.5MB" },
          { name: "Psychological_Disorders.pdf", size: "3.2MB" }
        ]
      },
      {
        title: "Flashcards",
        locked: false,
        files: [
          { name: "Therapeutic_Approaches_Recall.pdf", size: "1.5MB" }
        ]
      },
      {
        title: "MCQ Practice",
        locked: true,
        files: []
      },
      {
        title: "Case Base Practice",
        locked: true,
        files: []
      }
    ]
  }
];

/* ================= COMPONENT ================= */

export default function PsychEdDashboard() {
  const [nav, setNav] = useState<NavState>({
    level: "main",
    classData: null,
    folderData: null
  });
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push("/login"); // 🔒 protect dashboard
      } else {
        setUser(currentUser);
      }
    });

    return () => unsub();
  }, [router]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  useEffect(()=>{
    seedAcademicData()
  },[])



  const goBack = () => {
    if (nav.level === "files") {
      setNav({ level: "sub", classData: nav.classData, folderData: null });
    } else if (nav.level === "sub") {
      setNav({ level: "main", classData: null, folderData: null });
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 font-sans">

      {/* ================= SIDEBAR ================= */}
      <aside className="w-96 bg-white border-r hidden xl:flex flex-col shadow-sm">
        <div className="p-8 border-b bg-gradient-to-b from-indigo-50/30 to-white">
          <div className="relative w-36 h-36 mx-auto mb-6 group">
            <div className="absolute inset-0 bg-indigo-600 rounded-[2.5rem] rotate-3 opacity-10 group-hover:rotate-6 transition-transform"></div>
            <div className="relative w-36 h-36">
              <Image
                src="/saloni.png"
                alt="Saloni Dangayach"
                fill
                className="rounded-[2.5rem] object-cover border-4 border-white shadow-md"
              />
            </div>
            <div className="absolute -bottom-2 -right-2 bg-green-500 text-white p-2 rounded-full border-4 border-white shadow-lg">
              <Award size={18} />
            </div>
          </div>

          <h1 className="text-2xl font-black text-center text-slate-800 tracking-tight">Saloni Dangayach</h1>
          <p className="text-[10px] text-center text-indigo-600 font-black uppercase tracking-[0.2em] mt-1">
            PsychEd by Healora
          </p>
        </div>

        <div className="p-6 flex-1 space-y-8 overflow-y-auto">
          {/* Stats Section */}
          <div className="space-y-4">
            <SidebarStat icon={<Users size={16} />} title="100+ Sessions" sub="Clinical Counseling" color="bg-indigo-50 text-indigo-600" />
            <SidebarStat icon={<GraduationCap size={16} />} title="MSc Clinical Psych" sub="CHRIST University, Delhi NCR" color="bg-rose-50 text-rose-600" />
            <SidebarStat icon={<Award size={16} />} title="School Counselor" sub="Gurukul Public School, Jaipur" color="bg-emerald-50 text-emerald-600" />
          </div>

          <nav className="space-y-2 pt-6 border-t border-slate-100">
            <NavItem icon={<LayoutDashboard size={18} />} label="Dashboard" active={nav.level === "main"} />
            <NavItem icon={<FileText size={18} />} label="Resource Library" active={nav.level !== "main"} />
          </nav>
        </div>
      </aside>

      {/* ================= MAIN ================= */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-20 bg-white border-b px-8 flex items-center justify-between shadow-sm shrink-0">
          <div className="flex items-center gap-4">
            {nav.level !== "main" && (
              <button onClick={goBack} className="p-2 rounded-full hover:bg-slate-100 transition-colors">
                <ArrowLeft size={20} className="text-slate-600" />
              </button>
            )}

            <h2 className="font-bold text-slate-800">
              Welcome back, {user?.displayName?.split(" ")[0] ?? "Student"}!
            </h2>

          </div>

          <div className="flex items-center gap-4">
            <button className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
              <Bell size={20} />
            </button>
            <div className="h-8 w-px bg-slate-200 mx-2"></div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-5 py-2.5 bg-rose-50 text-rose-600 rounded-xl font-bold text-sm hover:bg-rose-100 transition-all border border-rose-100 shadow-sm"
            >
              <LogOut size={16} /> Logout
            </button>

          </div>
        </header>

        <div className="flex-1 p-10 overflow-y-auto">

          {/* MAIN LEVEL: CLASS CARDS */}
          {nav.level === "main" && (
            <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
              {ACADEMIC_DATA.map(cls => (
                <div
                  key={cls.id}
                  onClick={() => setNav({ level: "sub", classData: cls, folderData: null })}
                  className="p-10 bg-white rounded-[3rem] border border-slate-100 cursor-pointer shadow-sm hover:shadow-2xl hover:shadow-indigo-100 transition-all group text-center"
                >
                  <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                    <BookOpen size={40} />
                  </div>
                  <h3 className="text-3xl font-black text-slate-800 tracking-tight">{cls.title}</h3>
                  <p className="text-slate-400 font-medium mt-2">{cls.category}</p>
                  <div className="inline-flex items-center gap-2 text-indigo-600 font-bold mt-8 py-2 px-4 bg-indigo-50 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    Access Content <ChevronRight size={16} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* SUB LEVEL: FOLDER CARDS */}
          {nav.level === "sub" && (
            <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto animate-in fade-in zoom-in-95 duration-300">
              {nav.classData.subFolders.map((sub, i) => (
                <div
                  key={i}
                  onClick={() =>
                    !sub.locked &&
                    setNav({ level: "files", classData: nav.classData as ClassData, folderData: sub })
                  }
                  className={`p-8 bg-white border border-slate-100 rounded-[2.5rem] shadow-sm transition-all group ${sub.locked ? "opacity-60 cursor-not-allowed grayscale" : "cursor-pointer hover:shadow-xl hover:-translate-y-1"
                    }`}
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className={`p-4 rounded-2xl ${sub.locked ? "bg-slate-100 text-slate-400" : "bg-indigo-50 text-indigo-600"}`}>
                      <Folder size={32} />
                    </div>
                    {sub.locked && (
                      <div className="bg-amber-100 p-2 rounded-xl text-amber-600 shadow-sm">
                        <Lock size={18} />
                      </div>
                    )}
                  </div>
                  <h4 className="text-2xl font-black text-slate-800">{sub.title}</h4>
                  <p className="text-sm text-slate-400 font-medium mt-2">
                    {sub.locked ? "Restricted Content" : `${sub.files.length} Resources Available`}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* FILE LEVEL: PDF LIST */}
          {nav.level === "files" && (
            <div className="max-w-4xl mx-auto space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="mb-8">
                <h3 className="text-3xl font-black text-slate-800">{nav.folderData.title}</h3>
                <p className="text-slate-400 font-medium tracking-tight">Select a document to view or download.</p>
              </div>
              {nav.folderData.files.map((file, i) => (
                <div key={i} className="flex justify-between items-center p-6 bg-white border border-slate-100 rounded-[2rem] hover:border-indigo-500 transition-all shadow-sm group">
                  <div className="flex items-center gap-5">
                    <div className="p-3 bg-rose-50 text-rose-500 rounded-2xl group-hover:bg-rose-500 group-hover:text-white transition-colors">
                      <FileText size={24} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{file.name}</p>
                      <p className="text-xs text-slate-400 font-medium">{file.size}</p>
                    </div>
                  </div>
                  <button className="px-6 py-2.5 bg-white border-2 border-slate-900 rounded-xl font-bold text-sm hover:bg-slate-900 hover:text-white transition-all">
                    View PDF
                  </button>
                </div>
              ))}
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

/* ================= HELPERS ================= */

function NavItem({ icon, label, active }: { icon: React.ReactNode, label: string, active: boolean }) {
  return (
    <button className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-bold transition-all ${active ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-slate-400 hover:bg-slate-50 hover:text-slate-700"
      }`}>
      {icon} <span className="text-sm">{label}</span>
    </button>
  );
}

function SidebarStat({ icon, title, sub, color }: { icon: React.ReactNode, title: string, sub: string, color: string }) {
  return (
    <div className="flex gap-4 items-start">
      <div className={`${color} p-2 rounded-xl shadow-sm`}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-bold text-slate-800">{title}</p>
        <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">{sub}</p>
      </div>
    </div>
  );
}