"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import {
  Menu,
  Search,
  Plus,
  MoreVertical,
  Folder,
  ArrowUpDown,
  LayoutGrid,
  FileText,
  LogOut,
  ExternalLink,
  ChevronDown,
  Trash2
} from "lucide-react";

interface FormItem {
  id: string;
  title: string;
  slug: string;
  is_paid: boolean;
  price: number;
  created_at: string;
  updated_at: string;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const [forms, setForms] = useState<FormItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  useEffect(() => {
    async function loadForms() {
      try {
        const { data, error } = await supabase
          .from("forms")
          .select("*")
          .order("updated_at", { ascending: false });

        if (!error && data) {
          setForms(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadForms();
  }, [supabase]);

  const handleCreateNewForm = async (templateTitle?: string, templateType?: string) => {
    try {
      const title = templateTitle || "Formulir tanpa judul";
      const slug = `form-${Date.now().toString(36)}`;

      const { data: form, error } = await supabase
        .from("forms")
        .insert({
          title,
          slug,
          is_paid: false,
          price: 0,
        })
        .select()
        .single();

      if (error || !form) {
        alert("Gagal membuat formulir baru.");
        return;
      }

      // Buat default fields jika template
      let defaultFields: any[] = [];
      if (templateType === "contact") {
        defaultFields = [
          { form_id: form.id, label: "Nama Lengkap", type: "text", required: true, order_index: 0 },
          { form_id: form.id, label: "Email", type: "text", required: true, order_index: 1 },
          { form_id: form.id, label: "Alamat", type: "textarea", required: false, order_index: 2 },
          { form_id: form.id, label: "Nomor Telepon", type: "number", required: true, order_index: 3 },
        ];
      } else if (templateType === "event") {
        defaultFields = [
          { form_id: form.id, label: "Nama Peserta", type: "text", required: true, order_index: 0 },
          { form_id: form.id, label: "Institusi / Organisasi", type: "text", required: true, order_index: 1 },
          { form_id: form.id, label: "Nomor WhatsApp", type: "number", required: true, order_index: 2 },
          {
            form_id: form.id,
            label: "Pilihan Sesi / Kelas",
            type: "radio",
            options: ["Sesi Pagi (09:00 - 12:00)", "Sesi Siang (13:00 - 16:00)"],
            required: true,
            order_index: 3,
          },
        ];
      } else {
        defaultFields = [
          {
            form_id: form.id,
            label: "Pertanyaan tanpa judul",
            type: "radio",
            options: ["Opsi 1"],
            required: false,
            order_index: 0,
          },
        ];
      }

      await supabase.from("form_fields").insert(defaultFields);
      router.push(`/admin/form/${form.id}`);
    } catch (err: any) {
      alert(err.message || "Gagal membuat form.");
    }
  };

  const handleDeleteForm = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Hapus formulir ini secara permanen?")) return;

    await supabase.from("forms").delete().eq("id", id);
    setForms(forms.filter((f) => f.id !== id));
    setActiveMenuId(null);
  };

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  };

  const filteredForms = forms.filter((f) =>
    f.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-white">
      {/* Top Navbar Header */}
      <header className="h-16 px-4 flex items-center justify-between border-b border-gray-200">
        <div className="flex items-center gap-3">
          <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-full">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-[#673ab7] flex items-center justify-center text-white">
              <FileText className="w-5 h-5" />
            </div>
            <span className="text-xl font-normal text-gray-700">Formulir</span>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex-1 max-w-2xl mx-6">
          <div className="flex items-center bg-[#f1f3f4] rounded-lg px-4 py-2 text-gray-600 focus-within:bg-white focus-within:shadow-md focus-within:border focus-within:border-transparent transition">
            <Search className="w-5 h-5 text-gray-500 mr-3" />
            <input
              type="text"
              placeholder="Telusuri"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-sm focus:outline-none text-gray-800"
            />
          </div>
        </div>

        {/* User / Logout */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleLogout}
            title="Keluar dari Admin"
            className="flex items-center gap-1 text-xs text-gray-600 hover:text-red-600 px-3 py-1.5 rounded hover:bg-gray-100"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
          <div className="w-8 h-8 rounded-full bg-[#673ab7] text-white text-xs font-bold flex items-center justify-center">
            A
          </div>
        </div>
      </header>

      {/* Section 1: Mulai Formulir Baru */}
      <section className="bg-[#f1f3f4] py-5 px-6 border-b border-gray-200">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-gray-700">Mulai formulir baru</span>
            <div className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer hover:bg-gray-200 px-2 py-1 rounded">
              <span>Galeri template</span>
              <ArrowUpDown className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
            {/* Template Kosong (+) */}
            <div
              onClick={() => handleCreateNewForm()}
              className="cursor-pointer group"
            >
              <div className="h-32 bg-white rounded border border-gray-300 hover:border-[#673ab7] flex items-center justify-center transition">
                <Plus className="w-12 h-12 text-[#673ab7] group-hover:scale-110 transition" />
              </div>
              <p className="text-xs font-medium text-gray-800 mt-2 truncate">Formulir kosong</p>
            </div>

            {/* Template 1: Informasi Kontak */}
            <div
              onClick={() => handleCreateNewForm("Informasi Kontak", "contact")}
              className="cursor-pointer group"
            >
              <div className="h-32 bg-emerald-50 rounded border border-gray-300 hover:border-[#673ab7] p-2 flex flex-col justify-between">
                <div className="h-2 w-12 bg-emerald-600 rounded"></div>
                <div className="space-y-1">
                  <div className="h-1.5 w-full bg-emerald-200 rounded"></div>
                  <div className="h-1.5 w-3/4 bg-emerald-200 rounded"></div>
                </div>
              </div>
              <p className="text-xs font-medium text-gray-800 mt-2 truncate">Informasi Kontak</p>
            </div>

            {/* Template 2: Pendaftaran Acara */}
            <div
              onClick={() => handleCreateNewForm("Pendaftaran Acara", "event")}
              className="cursor-pointer group"
            >
              <div className="h-32 bg-amber-50 rounded border border-gray-300 hover:border-[#673ab7] p-2 flex flex-col justify-between">
                <div className="h-2 w-12 bg-amber-600 rounded"></div>
                <div className="space-y-1">
                  <div className="h-1.5 w-full bg-amber-200 rounded"></div>
                  <div className="h-1.5 w-2/3 bg-amber-200 rounded"></div>
                </div>
              </div>
              <p className="text-xs font-medium text-gray-800 mt-2 truncate">Pendaftaran Acara</p>
            </div>

            {/* Template 3: RSVP */}
            <div
              onClick={() => handleCreateNewForm("RSVP Kegiatan")}
              className="cursor-pointer group"
            >
              <div className="h-32 bg-blue-50 rounded border border-gray-300 hover:border-[#673ab7] p-2 flex flex-col justify-between">
                <div className="h-2 w-10 bg-blue-600 rounded"></div>
                <div className="space-y-1">
                  <div className="h-1.5 w-full bg-blue-200 rounded"></div>
                  <div className="h-1.5 w-1/2 bg-blue-200 rounded"></div>
                </div>
              </div>
              <p className="text-xs font-medium text-gray-800 mt-2 truncate">RSVP</p>
            </div>

            {/* Template 4: Undangan Pesta */}
            <div
              onClick={() => handleCreateNewForm("Undangan Pesta & Reuni")}
              className="cursor-pointer group"
            >
              <div className="h-32 bg-rose-50 rounded border border-gray-300 hover:border-[#673ab7] p-2 flex flex-col justify-between">
                <div className="h-2 w-12 bg-rose-600 rounded"></div>
                <div className="space-y-1">
                  <div className="h-1.5 w-full bg-rose-200 rounded"></div>
                  <div className="h-1.5 w-3/4 bg-rose-200 rounded"></div>
                </div>
              </div>
              <p className="text-xs font-medium text-gray-800 mt-2 truncate">Undangan Pesta</p>
            </div>

            {/* Template 5: Pendaftaran Seminar Berbayar */}
            <div
              onClick={() => handleCreateNewForm("Pendaftaran Seminar Berbayar", "event")}
              className="cursor-pointer group"
            >
              <div className="h-32 bg-purple-50 rounded border border-gray-300 hover:border-[#673ab7] p-2 flex flex-col justify-between">
                <div className="h-2 w-14 bg-[#673ab7] rounded"></div>
                <div className="space-y-1">
                  <div className="h-1.5 w-full bg-purple-200 rounded"></div>
                  <div className="h-1.5 w-2/3 bg-purple-200 rounded"></div>
                </div>
              </div>
              <p className="text-xs font-medium text-gray-800 mt-2 truncate">Pendaftaran Seminar</p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Formulir Terbaru */}
      <main className="max-w-5xl mx-auto py-6 px-6">
        <div className="flex items-center justify-between mb-5">
          <span className="text-sm font-medium text-gray-800">Formulir terbaru</span>

          <div className="flex items-center gap-4 text-xs text-gray-600">
            <div className="flex items-center gap-1 cursor-pointer">
              <span>Milik siapa saja</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </div>
            <button className="p-1 hover:bg-gray-100 rounded">
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button className="p-1 hover:bg-gray-100 rounded">
              <ArrowUpDown className="w-4 h-4" />
            </button>
            <button className="p-1 hover:bg-gray-100 rounded">
              <Folder className="w-4 h-4" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-56 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : filteredForms.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Belum ada formulir. Klik tanda &ldquo;+&rdquo; di atas untuk membuat.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
            {filteredForms.map((item) => (
              <div
                key={item.id}
                onClick={() => router.push(`/admin/form/${item.id}`)}
                className="bg-white rounded border border-gray-300 hover:border-[#673ab7] cursor-pointer overflow-hidden transition relative flex flex-col justify-between"
              >
                {/* Thumbnail Preview Area */}
                <div className="h-32 bg-[#f0ebf8] p-3 flex flex-col justify-between border-b border-gray-200">
                  <div className="h-2 w-16 bg-[#673ab7] rounded"></div>
                  <div className="space-y-1">
                    <div className="h-1.5 w-full bg-purple-200 rounded"></div>
                    <div className="h-1.5 w-4/5 bg-purple-200 rounded"></div>
                  </div>
                  {item.is_paid && (
                    <span className="self-end text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                      Berbayar
                    </span>
                  )}
                </div>

                {/* Footer Area */}
                <div className="p-3 bg-white">
                  <p className="text-xs font-medium text-gray-900 truncate mb-1">
                    {item.title}
                  </p>
                  <div className="flex items-center justify-between text-[11px] text-gray-500">
                    <div className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-[#673ab7]" />
                      <span>
                        Dibuka {new Date(item.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </div>

                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(activeMenuId === item.id ? null : item.id);
                        }}
                        className="p-1 hover:bg-gray-100 rounded-full"
                      >
                        <MoreVertical className="w-4 h-4 text-gray-500" />
                      </button>

                      {activeMenuId === item.id && (
                        <div className="absolute right-0 bottom-6 w-36 bg-white border border-gray-200 rounded shadow-lg py-1 z-20">
                          <Link
                            href={`/form/${item.slug}`}
                            target="_blank"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Buka Publik</span>
                          </Link>
                          <button
                            onClick={(e) => handleDeleteForm(item.id, e)}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 text-left"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Hapus</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
