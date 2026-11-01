"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  FileText,
  Upload,
  Trash2,
  Eye,
  Search,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  X,
  Layers,
  Copy,
  Check,
  FileCheck,
  HardDrive,
  Pencil,
} from "lucide-react";
import { AcademicPdfItem } from "@/lib/firebase/academicContent";
import {
  getLivePdfsList,
  uploadPdfMaterial,
  deletePdfMaterial,
  updatePdfMaterialTitle,
  sanitizePdfFileName,
  generatePdfDocumentId,
} from "@/lib/firebase/pdfStorageService";
import { MobilePdfReader } from "@/components/MobilePdfReader";

export function PdfManagerTab() {
  const [materials, setMaterials] = useState<AcademicPdfItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [selectedSection, setSelectedSection] = useState<string>("all");

  // Notifications
  const [alert, setAlert] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadClass, setUploadClass] = useState<"twelfth" | "eleventh">("twelfth");
  const [uploadSection, setUploadSection] = useState<"detailnotes" | "flashcards">("detailnotes");
  const [uploadCustomId, setUploadCustomId] = useState("");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Delete modal state
  const [itemToDelete, setItemToDelete] = useState<AcademicPdfItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit / Rename modal state
  const [itemToEdit, setItemToEdit] = useState<AcademicPdfItem | null>(null);
  const [editedTitle, setEditedTitle] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Preview modal state
  const [previewItem, setPreviewItem] = useState<AcademicPdfItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-dismiss alert
  useEffect(() => {
    if (alert) {
      const timer = setTimeout(() => setAlert(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [alert]);

  // Load materials from Firestore
  const loadMaterials = async () => {
    try {
      setLoading(true);
      const items = await getLivePdfsList();
      setMaterials(items);
    } catch (err: unknown) {
      console.error("Failed to load PDF materials:", err);
      setAlert({
        type: "error",
        text: "Could not load materials from Firestore. Check permissions.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMaterials();
  }, []);

  // Handle file selection in upload form
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setAlert({ type: "error", text: "Please select a valid PDF file (.pdf)" });
      return;
    }

    setSelectedFile(file);

    // Auto-generate title if empty
    if (!uploadTitle.trim()) {
      let cleanName = file.name.replace(/\.pdf$/i, "").replace(/[-_]/g, " ").trim();
      // Capitalize first letters nicely
      cleanName = cleanName
        .split(" ")
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      setUploadTitle(cleanName);
    }

    // Auto-suggest ID if empty
    if (!uploadCustomId.trim()) {
      const suggested = generatePdfDocumentId(file.name, uploadSection);
      setUploadCustomId(suggested);
    }
  };

  // Submit Upload
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setAlert({ type: "error", text: "Please choose a PDF file to upload." });
      return;
    }
    if (!uploadTitle.trim()) {
      setAlert({ type: "error", text: "Please enter a title for the study material." });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const createdItem = await uploadPdfMaterial({
        file: selectedFile,
        title: uploadTitle.trim(),
        classLevel: uploadClass,
        section: uploadSection,
        customId: uploadCustomId.trim() || undefined,
        onProgress: (pct) => setUploadProgress(pct),
      });

      // Update state
      setMaterials((prev) => [
        createdItem,
        ...prev.filter((x) => x.id !== createdItem.id),
      ]);

      setAlert({
        type: "success",
        text: `"${createdItem.title}" uploaded and registered successfully!`,
      });

      // Reset form
      setShowUploadModal(false);
      setSelectedFile(null);
      setUploadTitle("");
      setUploadCustomId("");
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      console.error("Upload error:", err);
      setAlert({
        type: "error",
        text: `Upload failed: ${errObj.message || "Unknown error"}`,
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Submit Delete
  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;

    setIsDeleting(true);
    try {
      await deletePdfMaterial(itemToDelete.id, itemToDelete.storagePath);

      setMaterials((prev) => prev.filter((x) => x.id !== itemToDelete.id));

      setAlert({
        type: "success",
        text: `"${itemToDelete.title}" deleted from Firebase Storage & Firestore.`,
      });

      setItemToDelete(null);
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      console.error("Delete error:", err);
      setAlert({
        type: "error",
        text: `Delete failed: ${errObj.message || "Unknown error"}`,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Open Edit / Rename modal
  const openEditModal = (item: AcademicPdfItem) => {
    setItemToEdit(item);
    setEditedTitle(item.title);
  };

  // Submit Edit / Rename Title
  const handleSaveTitle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemToEdit) return;

    const newTitle = editedTitle.trim();
    if (!newTitle) {
      setAlert({ type: "error", text: "Please enter a valid title." });
      return;
    }

    setIsSavingEdit(true);
    try {
      await updatePdfMaterialTitle(itemToEdit.id, newTitle);

      setMaterials((prev) =>
        prev.map((m) => (m.id === itemToEdit.id ? { ...m, title: newTitle } : m))
      );

      setAlert({
        type: "success",
        text: `"${newTitle}" updated successfully!`,
      });

      setItemToEdit(null);
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      console.error("Update title error:", err);
      setAlert({
        type: "error",
        text: `Failed to update name: ${errObj.message || "Unknown error"}`,
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Copy path helper
  const copyPath = (path: string, id: string) => {
    navigator.clipboard.writeText(path);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Filtered materials
  const filteredMaterials = useMemo(() => {
    return materials.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.file.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        item.storagePath.toLowerCase().includes(q);

      const matchesClass =
        selectedClass === "all" ? true : item.class === selectedClass;
      const matchesSection =
        selectedSection === "all" ? true : item.section === selectedSection;

      return matchesSearch && matchesClass && matchesSection;
    });
  }, [materials, searchQuery, selectedClass, selectedSection]);

  // Counts
  const stats = useMemo(() => {
    const notesCount = materials.filter((m) => m.section === "detailnotes").length;
    const flashCount = materials.filter((m) => m.section === "flashcards").length;
    return {
      total: materials.length,
      notes: notesCount,
      flashcards: flashCount,
    };
  }, [materials]);

  return (
    <div className="space-y-6">
      {/* Alert toast */}
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

      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <HardDrive className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Total Documents
            </p>
            <h4 className="text-2xl font-black text-slate-900">{stats.total}</h4>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Detailed Notes
            </p>
            <h4 className="text-2xl font-black text-slate-900">{stats.notes}</h4>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Flashcard Decks
            </p>
            <h4 className="text-2xl font-black text-slate-900">
              {stats.flashcards}
            </h4>
          </div>
        </div>
      </div>

      {/* Main Action Bar: Search, Filters & Upload Button */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by title, chapter number, or filename..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-hidden focus:border-indigo-500 focus:bg-white text-slate-900"
          />
        </div>

        {/* Filters and Upload Action */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Class Filter */}
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-hidden focus:border-indigo-500"
          >
            <option value="all">All Classes</option>
            <option value="twelfth">Class 12th</option>
            <option value="eleventh">Class 11th</option>
          </select>

          {/* Section Filter */}
          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-hidden focus:border-indigo-500"
          >
            <option value="all">All Types</option>
            <option value="detailnotes">Detailed Notes</option>
            <option value="flashcards">Flashcards</option>
          </select>

          {/* Refresh button */}
          <button
            onClick={loadMaterials}
            disabled={loading}
            className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 transition-all"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          {/* Upload Button */}
          <button
            onClick={() => {
              setSelectedFile(null);
              setUploadTitle("");
              setUploadCustomId("");
              setShowUploadModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-indigo-100 transition-all"
          >
            <Upload className="w-4 h-4" />
            <span>Upload PDF</span>
          </button>
        </div>
      </div>

      {/* Materials Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
            <p className="text-sm font-bold text-slate-700">Loading catalog from Firestore...</p>
          </div>
        ) : filteredMaterials.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <FileText className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-slate-800">No study materials found</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {searchQuery
                ? `No results matching "${searchQuery}". Try a different search.`
                : "No PDFs uploaded yet. Click 'Upload PDF' above to add your first chapter."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-black uppercase tracking-wider text-slate-400">
                  <th className="py-4 px-6">Document Title & ID</th>
                  <th className="py-4 px-6">Class</th>
                  <th className="py-4 px-6">Section / Type</th>
                  <th className="py-4 px-6">Storage Path</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium">
                {filteredMaterials.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/60 transition-colors group"
                  >
                    {/* Title & Document ID */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                          {item.section === "flashcards" ? (
                            <Layers className="w-4 h-4 text-amber-600" />
                          ) : (
                            <FileText className="w-4 h-4 text-indigo-600" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-slate-900 text-sm truncate max-w-md">
                              {item.title}
                            </p>
                            <button
                              onClick={() => openEditModal(item)}
                              className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                              title="Rename Document"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <code className="text-[10px] text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                              {item.id}
                            </code>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Class */}
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
                        {item.class === "twelfth"
                          ? "Class 12th"
                          : item.class === "eleventh"
                          ? "Class 11th"
                          : item.class}
                      </span>
                    </td>

                    {/* Section */}
                    <td className="py-4 px-6">
                      {item.section === "flashcards" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <Layers className="w-3 h-3 text-amber-600" />
                          <span>Flashcards</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          <FileText className="w-3 h-3 text-indigo-600" />
                          <span>Detailed Notes</span>
                        </span>
                      )}
                    </td>

                    {/* Storage Path */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2 max-w-xs">
                        <span className="truncate text-slate-500 text-[11px] font-mono" title={item.storagePath}>
                          {item.storagePath}
                        </span>
                        <button
                          onClick={() => copyPath(item.storagePath, item.id)}
                          className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-all shrink-0"
                          title="Copy Storage Path"
                        >
                          {copiedId === item.id ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Action Buttons */}
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5 sm:gap-2">
                        {/* Rename / Edit button */}
                        <button
                          onClick={() => openEditModal(item)}
                          className="p-2 rounded-xl text-slate-600 hover:text-amber-600 hover:bg-amber-50 transition-all flex items-center gap-1.5 text-xs font-bold"
                          title="Rename Document Title"
                        >
                          <Pencil className="w-4 h-4" />
                          <span className="hidden sm:inline">Rename</span>
                        </button>

                        {/* Preview button */}
                        <button
                          onClick={() => setPreviewItem(item)}
                          className="p-2 rounded-xl text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex items-center gap-1.5 text-xs font-bold"
                          title="Preview in Protected Viewer"
                        >
                          <Eye className="w-4 h-4" />
                          <span className="hidden sm:inline">Preview</span>
                        </button>

                        {/* Delete button */}
                        <button
                          onClick={() => setItemToDelete(item)}
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all flex items-center gap-1.5 text-xs font-bold"
                          title="Delete from Storage & Firestore"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="hidden sm:inline">Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ================= MODAL: UPLOAD NEW PDF ================= */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Upload Study Material
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    Uploads file to Storage and publishes to Firestore automatically
                  </p>
                </div>
              </div>
              <button
                onClick={() => !isUploading && setShowUploadModal(false)}
                disabled={isUploading}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleUploadSubmit} className="p-6 space-y-4">
              {/* File Drop Area */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  PDF Document File (.pdf) *
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                    selectedFile
                      ? "border-emerald-400 bg-emerald-50/30"
                      : "border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/20"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-3 text-emerald-800">
                      <FileCheck className="w-7 h-7 text-emerald-600 shrink-0" />
                      <div className="text-left min-w-0">
                        <p className="font-bold text-xs truncate max-w-xs">
                          {selectedFile.name}
                        </p>
                        <p className="text-[10px] text-emerald-600">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • Ready to upload
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Upload className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-700">
                        Click to browse or drop your PDF here
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Only PDF documents are accepted
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Title input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Document Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Chapter 8: Psychology and Life"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-hidden focus:border-indigo-500 text-slate-900"
                  required
                />
              </div>

              {/* Class & Section in 2 columns */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Class *
                  </label>
                  <select
                    value={uploadClass}
                    onChange={(e) =>
                      setUploadClass(e.target.value as "twelfth" | "eleventh")
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-hidden focus:border-indigo-500"
                  >
                    <option value="twelfth">Class 12th (twelfth)</option>
                    <option value="eleventh">Class 11th (eleventh)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Section / Type *
                  </label>
                  <select
                    value={uploadSection}
                    onChange={(e) =>
                      setUploadSection(
                        e.target.value as "detailnotes" | "flashcards"
                      )
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-hidden focus:border-indigo-500"
                  >
                    <option value="detailnotes">Detailed Notes</option>
                    <option value="flashcards">Flashcards Deck</option>
                  </select>
                </div>
              </div>

              {/* Custom Document ID */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Document ID (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. psy_ch8 or psy_fc_ch8 (leave blank to auto-generate)"
                  value={uploadCustomId}
                  onChange={(e) => setUploadCustomId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-hidden focus:border-indigo-500 text-slate-900"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Will be uploaded to Storage path:{" "}
                  <code className="text-indigo-600 font-mono">
                    {uploadClass}/{uploadSection}/{selectedFile ? sanitizePdfFileName(selectedFile.name) : "your-file.pdf"}
                  </code>
                </p>
              </div>

              {/* Upload Progress Bar */}
              {isUploading && uploadProgress !== null && (
                <div className="space-y-1.5 pt-2">
                  <div className="flex justify-between text-xs font-bold text-slate-600">
                    <span>Uploading to Storage & Firestore...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-indigo-600 h-2.5 rounded-full transition-all duration-200"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="pt-3 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  disabled={isUploading}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading || !selectedFile}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-100 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isUploading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Upload & Publish</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT / RENAME STUDY MATERIAL ================= */}
      {itemToEdit && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => !isSavingEdit && setItemToEdit(null)}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Edit Document Name
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    Update the title displayed to students across dashboard &amp; reader
                  </p>
                </div>
              </div>
              <button
                onClick={() => !isSavingEdit && setItemToEdit(null)}
                disabled={isSavingEdit}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveTitle} className="p-6 space-y-4">
              {/* Document Info */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-semibold">Document ID:</span>
                  <code className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-800 font-bold">
                    {itemToEdit.id}
                  </code>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-semibold">Section &amp; Class:</span>
                  <span className="font-bold text-slate-700 capitalize">
                    {itemToEdit.section === "flashcards" ? "Flashcards Deck" : "Detailed Notes"} • Class {itemToEdit.class === "twelfth" ? "12" : "11"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500 font-semibold shrink-0">Storage File:</span>
                  <span className="font-mono text-slate-600 truncate text-[11px]" title={itemToEdit.storagePath}>
                    {itemToEdit.file || itemToEdit.storagePath}
                  </span>
                </div>
              </div>

              {/* Title Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Display Title (Name) *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  placeholder="e.g. Chapter 1: Variations in Psychological Attributes"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-900"
                />
                <p className="text-[11px] text-slate-400 mt-1.5">
                  This title is immediately shown to students on their dashboard, PDF viewer, and assignment lists.
                </p>
              </div>

              {/* Actions */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setItemToEdit(null)}
                  disabled={isSavingEdit}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-xs transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit || !editedTitle.trim()}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-100 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isSavingEdit ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: DELETE CONFIRMATION ================= */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200 p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-7 h-7" />
            </div>

            <h3 className="text-base font-black text-slate-900">
              Delete Study Material?
            </h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Are you sure you want to delete{" "}
              <strong className="text-slate-800">&ldquo;{itemToDelete.title}&rdquo;</strong>?
            </p>

            <div className="mt-4 p-3 bg-rose-50/60 rounded-xl border border-rose-100 text-left text-[11px] text-rose-700 space-y-1">
              <p>• Removes file from Storage: <code className="font-mono">{itemToDelete.storagePath}</code></p>
              <p>• Removes catalog document from Firestore: <code className="font-mono">{itemToDelete.id}</code></p>
            </div>

            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-100 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Material</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: IN-APP PREVIEW ================= */}
      {previewItem && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-6 backdrop-blur-xs"
          onClick={() => setPreviewItem(null)}
        >
          <div
            className="bg-slate-900 w-full max-w-5xl h-[90vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col border border-slate-700"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top header */}
            <div className="h-12 bg-slate-800 border-b border-slate-700 px-4 flex items-center justify-between text-xs text-slate-300">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                <span className="font-bold text-white truncate">
                  Preview: {previewItem.title}
                </span>
                <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                  ({previewItem.storagePath})
                </span>
              </div>
              <button
                onClick={() => setPreviewItem(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Viewer Body */}
            <div className="flex-1 w-full h-[calc(100%-3rem)]">
              {/* Load through MobilePdfReader using storage path / token */}
              <PreviewDocumentWrapper item={previewItem} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Helper to fetch download URL and embed in protected viewer
 */
function PreviewDocumentWrapper({ item }: { item: AcademicPdfItem }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchUrl = async () => {
      try {
        const { storage } = await import("@/lib/firebase/firebase");
        const { ref, getDownloadURL } = await import("firebase/storage");
        const downloadUrl = await getDownloadURL(ref(storage, item.storagePath));
        if (!cancelled) setUrl(downloadUrl);
      } catch {
        if (!cancelled) setError("Could not generate preview URL. Verify the file exists.");
      }
    };
    fetchUrl();
    return () => {
      cancelled = true;
    };
  }, [item]);

  if (error) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-rose-300 bg-slate-900">
        <AlertCircle className="w-8 h-8 text-rose-400 mb-2" />
        <p className="text-xs font-bold">{error}</p>
      </div>
    );
  }

  if (!url) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-slate-400 bg-slate-900">
        <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mb-2" />
        <p className="text-xs">Preparing preview...</p>
      </div>
    );
  }

  return <MobilePdfReader pdfUrl={url} docTitle={item.title} />;
}
