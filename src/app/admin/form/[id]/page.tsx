"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import {
  FileText,
  Star,
  Folder,
  Send,
  Eye,
  Plus,
  Trash2,
  Copy,
  Check,
  CreditCard,
  ExternalLink,
  Users,
  MessageSquare,
  Megaphone,
  CheckCircle2,
  Lock,
  RefreshCw
} from "lucide-react";

interface FormField {
  id: string;
  label: string;
  type: string;
  options: string[];
  required: boolean;
  order_index: number;
}

export default function FormEditorPage() {
  const params = useParams();
  const formId = params.id as string;
  const router = useRouter();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<"questions" | "responses" | "chat" | "settings">("questions");
  const [title, setTitle] = useState("Formulir tanpa judul");
  const [description, setDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [isPaid, setIsPaid] = useState(false);
  const [price, setPrice] = useState<number | string>("");
  const [isActive, setIsActive] = useState(true);
  const [fields, setFields] = useState<FormField[]>([]);
  const [responses, setResponses] = useState<any[]>([]);

  // Chat & Announcement states
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [adminChatChannel, setAdminChatChannel] = useState<"announcement" | "public">("announcement");
  const [adminChatInput, setAdminChatInput] = useState("");
  const [sendingAdminChat, setSendingAdminChat] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get("tab");
      if (tabParam === "chat" || tabParam === "responses" || tabParam === "settings") {
        setActiveTab(tabParam as any);
      }
    }
  }, []);

  useEffect(() => {
    async function loadForm() {
      try {
        const { data: form, error } = await supabase
          .from("forms")
          .select("*")
          .eq("id", formId)
          .single();

        if (error || !form) {
          alert("Formulir tidak ditemukan.");
          router.push("/admin/dashboard");
          return;
        }

        setTitle(form.title);
        setDescription(form.description || "");
        setSlug(form.slug);
        setIsPaid(form.is_paid || false);
        setPrice(form.price && Number(form.price) > 0 ? Number(form.price) : "");
        setIsActive(form.is_active !== false);

        const { data: fieldList } = await supabase
          .from("form_fields")
          .select("*")
          .eq("form_id", formId)
          .order("order_index", { ascending: true });

        const mappedFields = (fieldList || []).map((f) => ({
          id: f.id,
          label: f.label,
          type: f.type,
          options: Array.isArray(f.options) ? f.options : ["Opsi 1"],
          required: f.required,
          order_index: f.order_index,
        }));

        setFields(mappedFields);
        if (mappedFields.length > 0) {
          setSelectedFieldId(mappedFields[0].id);
        }

        const { data: subList } = await supabase
          .from("submissions")
          .select("*")
          .eq("form_id", formId)
          .order("created_at", { ascending: false });

        setResponses(subList || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    if (formId) loadForm();
  }, [formId, supabase, router]);

  // Load chat messages when activeTab is chat
  useEffect(() => {
    if (activeTab !== "chat" || !formId) return;

    let isMounted = true;
    async function loadChat() {
      setLoadingChat(true);
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("form_id", formId)
        .order("created_at", { ascending: true })
        .limit(100);

      if (!error && data && isMounted) {
        setChatMessages(data);
        setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      }
      if (isMounted) setLoadingChat(false);
    }

    loadChat();

    const channel = supabase
      .channel(`admin-chat-${formId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `form_id=eq.${formId}`,
        },
        (payload: any) => {
          if (payload.new) {
            setChatMessages((prev) => [...prev, payload.new]);
            setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "chat_messages",
          filter: `form_id=eq.${formId}`,
        },
        (payload: any) => {
          if (payload.old) {
            setChatMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [activeTab, formId, supabase]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await supabase
        .from("forms")
        .update({
          title,
          description,
          is_paid: isPaid,
          price: isPaid ? Number(price) : 0,
          is_active: isActive,
          updated_at: new Date().toISOString(),
        })
        .eq("id", formId);

      await supabase.from("form_fields").delete().eq("form_id", formId);

      if (fields.length > 0) {
        const toInsert = fields.map((f, idx) => ({
          form_id: formId,
          label: f.label || "Pertanyaan tanpa judul",
          type: f.type,
          options: f.options,
          required: f.required,
          order_index: idx,
        }));
        await supabase.from("form_fields").insert(toInsert);
      }
    } catch (err: any) {
      alert("Gagal menyimpan: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSendAdminChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminChatInput.trim() || sendingAdminChat) return;

    try {
      setSendingAdminChat(true);
      const text = adminChatInput.trim();
      const { error } = await supabase.from("chat_messages").insert({
        form_id: formId,
        user_email: "admin@system.local",
        user_name: adminChatChannel === "announcement" ? "Panitia (Pengumuman)" : "Admin Panitia",
        channel_type: adminChatChannel,
        message: text,
        is_admin: true,
      });

      if (error) {
        alert("Gagal mengirim pesan: " + error.message);
        return;
      }
      setAdminChatInput("");
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setSendingAdminChat(false);
    }
  };

  const handleDeleteChatMessage = async (msgId: string) => {
    if (!confirm("Hapus pesan ini dari ruang chat?")) return;
    try {
      const { error } = await supabase.from("chat_messages").delete().eq("id", msgId);
      if (error) alert("Gagal menghapus pesan: " + error.message);
      else setChatMessages((prev) => prev.filter((m) => m.id !== msgId));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const addField = () => {
    const newField: FormField = {
      id: `new-${Date.now()}`,
      label: "Pertanyaan tanpa judul",
      type: "radio",
      options: ["Opsi 1"],
      required: false,
      order_index: fields.length,
    };
    setFields([...fields, newField]);
    setSelectedFieldId(newField.id);
  };

  const updateField = (id: string, updates: Partial<FormField>) => {
    setFields(fields.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const removeField = (id: string) => {
    if (fields.length <= 1) {
      alert("Minimal harus ada 1 pertanyaan.");
      return;
    }
    const filtered = fields.filter((f) => f.id !== id);
    setFields(filtered);
    if (selectedFieldId === id) {
      setSelectedFieldId(filtered[0]?.id || null);
    }
  };

  const addOption = (fieldId: string) => {
    setFields(
      fields.map((f) => {
        if (f.id === fieldId) {
          return {
            ...f,
            options: [...f.options, `Opsi ${f.options.length + 1}`],
          };
        }
        return f;
      })
    );
  };

  const updateOption = (fieldId: string, optIdx: number, val: string) => {
    setFields(
      fields.map((f) => {
        if (f.id === fieldId) {
          const next = [...f.options];
          next[optIdx] = val;
          return { ...f, options: next };
        }
        return f;
      })
    );
  };

  const removeOption = (fieldId: string, optIdx: number) => {
    setFields(
      fields.map((f) => {
        if (f.id === fieldId) {
          return { ...f, options: f.options.filter((_, i) => i !== optIdx) };
        }
        return f;
      })
    );
  };

  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/form/${slug}` : `/form/${slug}`;

  const copyShareLink = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f0ebf8] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#673ab7] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0ebf8] pb-16">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
        <div className="h-16 px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin/dashboard" title="Kembali ke formulir">
              <div className="w-8 h-8 rounded bg-[#673ab7] flex items-center justify-center text-white">
                <FileText className="w-5 h-5" />
              </div>
            </Link>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-base font-medium text-gray-800 bg-transparent hover:bg-gray-100 px-2 py-1 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#673ab7]"
              />
              <button className="p-1 text-gray-400 hover:text-gray-600">
                <Star className="w-4 h-4" />
              </button>
              <button className="p-1 text-gray-400 hover:text-gray-600">
                <Folder className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={`/form/${slug}`}
              target="_blank"
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-full"
              title="Pratinjau"
            >
              <Eye className="w-5 h-5" />
            </Link>

            <button
              onClick={copyShareLink}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              <span>{copiedLink ? "Disalin!" : "Salin Link"}</span>
            </button>

            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 text-xs font-medium bg-[#673ab7] hover:bg-[#512da8] text-white px-4 py-2 rounded transition disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{saving ? "Menyimpan..." : "Simpan Form"}</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex justify-center border-t border-gray-100">
          <button
            onClick={() => setActiveTab("questions")}
            className={`px-6 py-2.5 text-xs font-medium border-b-2 transition ${
              activeTab === "questions"
                ? "border-[#673ab7] text-[#673ab7]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Pertanyaan
          </button>
          <button
            onClick={() => setActiveTab("responses")}
            className={`px-6 py-2.5 text-xs font-medium border-b-2 transition ${
              activeTab === "responses"
                ? "border-[#673ab7] text-[#673ab7]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Tanggapan ({responses.length})
          </button>
          <button
            onClick={() => setActiveTab("chat")}
            className={`px-6 py-2.5 text-xs font-medium border-b-2 transition ${
              activeTab === "chat"
                ? "border-[#673ab7] text-[#673ab7]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Chat & Pengumuman
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`px-6 py-2.5 text-xs font-medium border-b-2 transition ${
              activeTab === "settings"
                ? "border-[#673ab7] text-[#673ab7]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Setelan
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-3xl mx-auto mt-6 px-4">
        {/* TAB 1: PERTANYAAN */}
        {activeTab === "questions" && (
          <div className="space-y-4">
            {/* Header Form Title Card */}
            <div className="bg-white rounded-lg border border-gray-200 border-t-8 border-t-[#673ab7] p-6 shadow-sm">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Judul formulir"
                className="w-full text-2xl font-normal text-gray-900 border-b border-transparent hover:border-gray-200 focus:border-[#673ab7] focus:outline-none pb-1 mb-3 transition"
              />
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Deskripsi formulir"
                className="w-full text-xs text-gray-600 border-b border-transparent hover:border-gray-200 focus:border-[#673ab7] focus:outline-none resize-none transition"
              />
            </div>

            {/* List Pertanyaan */}
            {fields.map((field) => {
              const isSelected = selectedFieldId === field.id;
              return (
                <div
                  key={field.id}
                  onClick={() => setSelectedFieldId(field.id)}
                  className={`bg-white rounded-lg border transition shadow-sm p-6 relative ${
                    isSelected ? "border-l-4 border-l-[#4285f4] border-gray-300" : "border-gray-200"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                    <input
                      type="text"
                      value={field.label}
                      onChange={(e) => updateField(field.id, { label: e.target.value })}
                      placeholder="Pertanyaan"
                      className="w-full sm:flex-1 text-sm text-gray-900 bg-gray-50 px-3 py-2 border-b-2 border-gray-300 focus:border-[#673ab7] focus:bg-purple-50/20 focus:outline-none"
                    />

                    {/* Selector Type */}
                    <select
                      value={field.type}
                      onChange={(e) => updateField(field.id, { type: e.target.value })}
                      className="text-xs bg-white border border-gray-300 rounded px-3 py-2 text-gray-700 focus:outline-none focus:border-[#673ab7]"
                    >
                      <option value="text">Jawaban singkat</option>
                      <option value="textarea">Paragraf</option>
                      <option value="radio">Pilihan ganda</option>
                      <option value="checkbox">Kotak centang</option>
                      <option value="dropdown">Dropdown</option>
                      <option value="number">Angka / WA</option>
                    </select>
                  </div>

                  {/* Preview / Edit Options untuk Radio/Checkbox/Dropdown */}
                  {(field.type === "radio" || field.type === "checkbox" || field.type === "dropdown") && (
                    <div className="space-y-2 mb-4">
                      {field.options.map((opt, optIdx) => (
                        <div key={optIdx} className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full border border-gray-400 flex items-center justify-center text-[10px] text-gray-400">
                            {field.type === "checkbox" ? "■" : "●"}
                          </div>
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => updateOption(field.id, optIdx, e.target.value)}
                            className="flex-1 text-xs text-gray-800 border-b border-gray-200 hover:border-gray-400 focus:border-[#673ab7] focus:outline-none py-1"
                          />
                          {field.options.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeOption(field.id, optIdx)}
                              className="text-gray-400 hover:text-red-500 p-1 text-xs"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => addOption(field.id)}
                        className="text-xs text-[#673ab7] hover:underline font-medium pt-1"
                      >
                        + Tambahkan opsi
                      </button>
                    </div>
                  )}

                  {/* Single Line / Paragraph Placeholder Preview */}
                  {field.type === "text" && (
                    <div className="text-xs text-gray-400 border-b border-dotted border-gray-300 pb-1 mb-4 w-1/2">
                      Teks jawaban singkat
                    </div>
                  )}

                  {field.type === "textarea" && (
                    <div className="text-xs text-gray-400 border-b border-dotted border-gray-300 pb-4 mb-4 w-3/4">
                      Teks jawaban panjang
                    </div>
                  )}

                  {field.type === "number" && (
                    <div className="text-xs text-gray-400 border-b border-dotted border-gray-300 pb-1 mb-4 w-1/3">
                      Input angka
                    </div>
                  )}

                  {/* Footer Card: Wajib Diisi & Hapus */}
                  <div className="flex items-center justify-end gap-4 pt-3 border-t border-gray-100 text-xs">
                    <button
                      type="button"
                      onClick={() => removeField(field.id)}
                      className="p-1.5 text-gray-500 hover:text-red-600 rounded"
                      title="Hapus pertanyaan"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <div className="h-4 w-px bg-gray-200" />

                    <label className="flex items-center gap-2 cursor-pointer select-none text-gray-700">
                      <span>Wajib diisi</span>
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(e) => updateField(field.id, { required: e.target.checked })}
                        className="w-4 h-4 accent-[#673ab7]"
                      />
                    </label>
                  </div>
                </div>
              );
            })}

            {/* Tombol Tambah Pertanyaan Floating / Bottom */}
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={addField}
                className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 px-4 py-2.5 rounded-full shadow-xs text-xs font-medium transition"
              >
                <Plus className="w-4 h-4 text-[#673ab7]" />
                <span>Tambah Pertanyaan</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: TANGGAPAN */}
        {activeTab === "responses" && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                <div>
                  <h2 className="text-xl font-normal text-gray-800">
                    {responses.length} Tanggapan
                  </h2>
                  <p className="text-xs text-gray-500">
                    Daftar pengguna yang telah mengisi formulir ini.
                  </p>
                </div>
              </div>

              {responses.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-xs">
                  Belum ada tanggapan masuk.
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {responses.map((sub) => (
                    <div key={sub.id} className="py-3 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-medium text-gray-900">{sub.user_name}</p>
                        <p className="text-gray-500 font-mono text-[11px]">{sub.user_email}</p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            sub.payment_status === "SUCCESS"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {sub.payment_status}
                        </span>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {new Date(sub.created_at).toLocaleTimeString("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: CHAT & PENGUMUMAN */}
        {activeTab === "chat" && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col h-[650px] overflow-hidden">
            {/* Header Chat Tab */}
            <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50">
              <div>
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-[#673ab7]" />
                  Kelola Chat & Pengumuman Panitia
                </h3>
                <p className="text-xs text-gray-500">
                  Kirim pengumuman resmi ke seluruh peserta atau pantau diskusi publik untuk formulir ini.
                </p>
              </div>

              {/* Sub-channel Switcher */}
              <div className="flex gap-1.5 bg-gray-200 p-1 rounded-lg self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setAdminChatChannel("announcement")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded flex items-center gap-1.5 transition ${
                    adminChatChannel === "announcement"
                      ? "bg-[#673ab7] text-white shadow-xs"
                      : "text-gray-700 hover:text-black"
                  }`}
                >
                  <Megaphone className="w-3.5 h-3.5" />
                  Pengumuman Resmi
                </button>
                <button
                  type="button"
                  onClick={() => setAdminChatChannel("public")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded flex items-center gap-1.5 transition ${
                    adminChatChannel === "public"
                      ? "bg-[#673ab7] text-white shadow-xs"
                      : "text-gray-700 hover:text-black"
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Diskusi Publik
                </button>
              </div>
            </div>

            {/* Banner info */}
            {adminChatChannel === "announcement" ? (
              <div className="bg-purple-50 px-4 py-2 border-b border-purple-100 text-[11px] text-purple-900 flex items-center gap-2">
                <span className="font-bold">Info:</span> Pesan di channel ini ditandai sebagai Pengumuman Resmi dan tampil di dashboard peserta. Peserta biasa tidak bisa membalas di channel ini.
              </div>
            ) : (
              <div className="bg-blue-50 px-4 py-2 border-b border-blue-100 text-[11px] text-blue-900 flex items-center gap-2">
                <span className="font-bold">Info:</span> Forum diskusi publik yang diisi oleh peserta yang telah mendaftar. Anda bisa ikut menjawab atau menghapus pesan yang tidak sesuai.
              </div>
            )}

            {/* Message List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#faf9fc]">
              {loadingChat ? (
                <div className="h-full flex items-center justify-center text-xs text-gray-400">
                  <div className="w-6 h-6 border-2 border-[#673ab7] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : chatMessages.filter((m) => m.channel_type === adminChatChannel).length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-xs text-gray-400">
                  <MessageSquare className="w-8 h-8 opacity-40 mb-2" />
                  <p>
                    {adminChatChannel === "announcement"
                      ? "Belum ada pengumuman resmi. Tulis pengumuman pertama Anda di bawah!"
                      : "Belum ada percakapan di forum diskusi."}
                  </p>
                </div>
              ) : (
                chatMessages
                  .filter((m) => m.channel_type === adminChatChannel)
                  .map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-3 rounded-lg border text-xs max-w-xl group relative ${
                        msg.is_admin
                          ? "bg-purple-50/80 border-purple-200 ml-auto"
                          : "bg-white border-gray-200 mr-auto"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4 mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-gray-900">{msg.user_name}</span>
                          {msg.is_admin && (
                            <span className="bg-[#673ab7] text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                              PANITIA
                            </span>
                          )}
                          <span className="text-[10px] text-gray-400">
                            {new Date(msg.created_at).toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <button
                          onClick={() => handleDeleteChatMessage(msg.id)}
                          title="Hapus pesan ini"
                          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 transition p-0.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                    </div>
                  ))
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Input Chat Admin */}
            <form onSubmit={handleSendAdminChat} className="p-3 bg-white border-t border-gray-200 flex gap-2">
              <input
                type="text"
                value={adminChatInput}
                onChange={(e) => setAdminChatInput(e.target.value)}
                placeholder={
                  adminChatChannel === "announcement"
                    ? "Ketik pengumuman resmi (contoh: Link grup WhatsApp / pengumuman jadwal)..."
                    : "Ketik pesan balasan ke diskusi peserta..."
                }
                className="flex-1 text-xs border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#673ab7]"
              />
              <button
                type="submit"
                disabled={!adminChatInput.trim() || sendingAdminChat}
                className="px-4 py-2.5 bg-[#673ab7] hover:bg-[#512da8] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{adminChatChannel === "announcement" ? "Kirim Pengumuman" : "Kirim"}</span>
              </button>
            </form>
          </div>
        )}

        {/* TAB 4: SETELAN (SETTINGS) */}
        {activeTab === "settings" && (
          <div className="space-y-4">
            {/* Status Formulir (Buka / Tutup Tanggapan) */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-800 mb-1">
                    {isActive ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Lock className="w-4 h-4 text-red-600" />
                    )}
                    <span>Status Formulir: {isActive ? "Menerima Tanggapan (Buka)" : "Tanggapan Ditutup"}</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {isActive
                      ? "Formulir ini sedang dibuka dan dapat diisi oleh siapa saja yang memiliki link."
                      : "Formulir ini dikunci. Pengunjung tidak bisa mengisi tanggapan baru (mencegah spam)."}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#673ab7]"></div>
                </label>
              </div>
            </div>

            {/* Pengaturan Pembayaran */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-800 mb-1">
                <CreditCard className="w-4 h-4 text-[#673ab7]" />
                <span>Pengaturan Pembayaran</span>
              </div>
              <p className="text-xs text-gray-500 mb-5">
                Tentukan apakah formulir ini memerlukan biaya pendaftaran atau gratis.
              </p>

              <div className="space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                  <div>
                    <span className="text-xs font-medium text-gray-800 block">
                      Aktifkan Pembayaran
                    </span>
                    <span className="text-[11px] text-gray-500">
                      Peserta wajib membayar via Midtrans sebelum tanggapan dianggap selesai.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={isPaid}
                    onChange={(e) => setIsPaid(e.target.checked)}
                    className="w-4 h-4 accent-[#673ab7]"
                  />
                </div>

                {isPaid && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Nominal Pembayaran (Rp)
                    </label>
                    <input
                      type="number"
                      min="1000"
                      step="1000"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="10000"
                      className="w-full sm:w-64 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-[#673ab7] font-semibold text-gray-900"
                    />
                    <span className="text-[11px] text-gray-400 block mt-1">
                      Ketik misal: 10000 untuk tagihan Rp 10.000.
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Link Publik */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <span className="text-xs font-medium text-gray-800 block mb-1">
                Tautan Publik Formulir
              </span>
              <p className="text-[11px] text-gray-500 mb-3">
                Bagikan tautan ini kepada calon peserta untuk mengisi formulir.
              </p>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={publicUrl}
                  className="flex-1 bg-gray-50 border border-gray-200 rounded px-3 py-2 text-xs font-mono text-gray-700"
                />
                <button
                  onClick={copyShareLink}
                  className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-medium rounded"
                >
                  {copiedLink ? "Disalin!" : "Salin"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
