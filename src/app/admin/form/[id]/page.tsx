"use client";

import { useEffect, useState } from "react";
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
  Users
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

  const [activeTab, setActiveTab] = useState<"questions" | "responses" | "settings">("questions");
  const [title, setTitle] = useState("Formulir tanpa judul");
  const [description, setDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [isPaid, setIsPaid] = useState(false);
  const [price, setPrice] = useState<number | string>("");
  const [fields, setFields] = useState<FormField[]>([]);
  const [responses, setResponses] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);

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

  const removeField = (id: string) => {
    setFields(fields.filter((f) => f.id !== id));
  };

  const duplicateField = (field: FormField) => {
    const copy: FormField = {
      ...field,
      id: `copy-${Date.now()}`,
      order_index: fields.length,
    };
    setFields([...fields, copy]);
    setSelectedFieldId(copy.id);
  };

  const updateFieldProp = (id: string, updates: Partial<FormField>) => {
    setFields(fields.map((f) => (f.id === id ? { ...f, ...updates } : f)));
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
          const opts = [...f.options];
          opts[optIdx] = val;
          return { ...f, options: opts };
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
            className={`px-6 py-2.5 text-xs font-medium border-b-2 transition ${activeTab === "questions"
                ? "border-[#673ab7] text-[#673ab7]"
                : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
          >
            Pertanyaan
          </button>
          <button
            onClick={() => setActiveTab("responses")}
            className={`px-6 py-2.5 text-xs font-medium border-b-2 transition flex items-center gap-1 ${activeTab === "responses"
                ? "border-[#673ab7] text-[#673ab7]"
                : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
          >
            <span>Tanggapan</span>
            <span className="text-[10px] bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded-full">
              {responses.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`px-6 py-2.5 text-xs font-medium border-b-2 transition ${activeTab === "settings"
                ? "border-[#673ab7] text-[#673ab7]"
                : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
          >
            Setelan
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-2xl mx-auto px-4 mt-6">
        {/* TAB 1: PERTANYAAN */}
        {activeTab === "questions" && (
          <div className="space-y-4">
            {/* Header Card Formulir */}
            <div className="bg-white rounded-lg border border-gray-200 border-t-8 border-t-[#673ab7] p-6 shadow-sm">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Judul formulir"
                className="w-full text-2xl font-normal text-gray-900 border-b border-transparent hover:border-gray-300 focus:border-[#673ab7] focus:outline-none pb-1 mb-3"
              />
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Deskripsi formulir"
                className="w-full text-xs text-gray-600 border-b border-transparent hover:border-gray-300 focus:border-[#673ab7] focus:outline-none resize-none"
              />
            </div>

            {/* List Kartu Pertanyaan */}
            {fields.map((field) => {
              const isSelected = selectedFieldId === field.id;
              return (
                <div
                  key={field.id}
                  onClick={() => setSelectedFieldId(field.id)}
                  className={`bg-white rounded-lg border p-6 transition shadow-sm ${isSelected
                      ? "border-l-4 border-l-[#673ab7] border-gray-200"
                      : "border-gray-200 hover:border-gray-300"
                    }`}
                >
                  <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between mb-4">
                    <input
                      type="text"
                      value={field.label}
                      onChange={(e) => updateFieldProp(field.id, { label: e.target.value })}
                      placeholder="Pertanyaan"
                      className="flex-1 text-sm text-gray-900 bg-gray-50 px-3 py-2 border-b-2 border-gray-300 focus:border-[#673ab7] focus:outline-none"
                    />

                    <select
                      value={field.type}
                      onChange={(e) => updateFieldProp(field.id, { type: e.target.value })}
                      className="text-xs text-gray-700 bg-white border border-gray-300 rounded px-3 py-2 focus:outline-none focus:border-[#673ab7]"
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

                  {/* Card Footer Tools */}
                  <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-3 text-gray-500">
                    <button
                      type="button"
                      onClick={() => duplicateField(field)}
                      title="Duplikasi"
                      className="p-1.5 hover:text-gray-700"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeField(field.id)}
                      title="Hapus"
                      className="p-1.5 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <div className="h-4 w-[1px] bg-gray-300 mx-1" />

                    <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-700">
                      <span>Wajib diisi</span>
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(e) => updateFieldProp(field.id, { required: e.target.checked })}
                        className="w-4 h-4 accent-[#673ab7]"
                      />
                    </label>
                  </div>
                </div>
              );
            })}

            {/* Tombol Tambah Pertanyaan */}
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={addField}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 hover:border-[#673ab7] text-gray-700 hover:text-[#673ab7] rounded-full shadow-sm text-xs font-medium transition"
              >
                <Plus className="w-4 h-4" />
                <span>Tambahkan pertanyaan</span>
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
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${sub.payment_status === "SUCCESS"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                            }`}
                        >
                          {sub.payment_status}
                        </span>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {new Date(sub.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: SETELAN (SETTINGS) */}
        {activeTab === "settings" && (
          <div className="space-y-4">
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
