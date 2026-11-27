"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { formatRupiah } from "@/lib/utils";
import { User } from "@supabase/supabase-js";
import {
  FileText,
  Lock,
  LogIn,
  CheckCircle2,
  CreditCard,
  RefreshCw,
  AlertCircle
} from "lucide-react";

declare global {
  interface Window {
    snap: any;
  }
}

export default function PublicFormPage() {
  const params = useParams();
  const slug = params.slug as string;
  const router = useRouter();
  const supabase = createClient();

  const [form, setForm] = useState<any>(null);
  const [fields, setFields] = useState<any[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [responses, setResponses] = useState<{ [key: string]: any }>({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [draftRestored, setDraftRestored] = useState(false);

  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [activeSnapToken, setActiveSnapToken] = useState<string | null>(null);
  const [existingSubmission, setExistingSubmission] = useState<any>(null);
  const [checkingPayment, setCheckingPayment] = useState(false);

  // Otomatis pulihkan jawaban formulir dari draft localStorage jika ada
  useEffect(() => {
    if (!slug || typeof window === "undefined") return;
    try {
      const savedDraft = localStorage.getItem(`form_draft_${slug}`);
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
          setResponses(parsed);
          setDraftRestored(true);
        }
      }
    } catch (err) {
      console.error("Gagal membaca draft:", err);
    }
  }, [slug]);

  const handleClearDraft = () => {
    if (typeof window !== "undefined" && slug) {
      localStorage.removeItem(`form_draft_${slug}`);
    }
    setResponses({});
    setDraftRestored(false);
  };

  useEffect(() => {
    async function loadFormAndFields() {
      try {
        const { data: formData, error: formErr } = await supabase
          .from("forms")
          .select("*")
          .eq("slug", slug)
          .single();

        if (formErr || !formData) {
          setErrorMsg("Formulir tidak ditemukan.");
          setLoading(false);
          return;
        }

        setForm(formData);

        const { data: fieldList } = await supabase
          .from("form_fields")
          .select("*")
          .eq("form_id", formData.id)
          .order("order_index", { ascending: true });

        setFields(fieldList || []);
      } catch (err: any) {
        setErrorMsg(err.message || "Gagal memuat formulir.");
      } finally {
        setLoading(false);
      }
    }

    if (slug) loadFormAndFields();
  }, [slug, supabase]);

  useEffect(() => {
    async function checkUser() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
    }
    checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  // Cek apakah user sudah pernah submit form ini sebelumnya
  useEffect(() => {
    async function checkExistingSubmission() {
      if (!user || !form?.id) return;
      try {
        const { data: sub } = await supabase
          .from("submissions")
          .select("*")
          .eq("form_id", form.id)
          .eq("user_email", user.email!)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (sub) {
          setExistingSubmission(sub);
          if (sub.payment_status === "PENDING" && sub.midtrans_order_id) {
            setActiveOrderId(sub.midtrans_order_id);
          }
        }
      } catch (err) {
        console.error("Gagal cek existing submission:", err);
      }
    }
    checkExistingSubmission();
  }, [user, form?.id, supabase]);

  const handleLoginGoogle = async () => {
    // Simpan draft sebelum redirect login Google agar tidak hilang
    if (typeof window !== "undefined" && slug) {
      try {
        localStorage.setItem(`form_draft_${slug}`, JSON.stringify(responses));
      } catch (e) {
        console.error("Gagal simpan draft sebelum login:", e);
      }
    }
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.href,
      },
    });
  };

  const handleInputChange = (fieldId: string, val: any) => {
    setResponses((prev) => {
      const next = { ...prev, [fieldId]: val };
      if (typeof window !== "undefined" && slug) {
        try {
          localStorage.setItem(`form_draft_${slug}`, JSON.stringify(next));
        } catch (e) {
          console.error("Gagal simpan draft:", e);
        }
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert("Harap login dengan Google terlebih dahulu.");
      return;
    }

    if (form.is_active === false) {
      alert("Formulir ini sudah ditutup dan tidak lagi menerima tanggapan.");
      return;
    }

    if (existingSubmission?.payment_status === "SUCCESS") {
      alert("Anda sudah pernah mengisi formulir ini.");
      router.push("/dashboard");
      return;
    }

    // Jika sudah memiliki pesanan pending, gunakan pembayaran yang ada (cegah duplikasi)
    if (activeOrderId && form.is_paid) {
      handleResumePayment(activeOrderId);
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg("");

      const isPaid = form.is_paid && Number(form.price) > 0;
      const orderId = isPaid ? `ORDER-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}` : null;

      const { data: sub, error: subError } = await supabase
        .from("submissions")
        .insert({
          form_id: form.id,
          user_email: user.email!,
          user_name: user.user_metadata?.full_name || user.email!.split("@")[0],
          user_avatar: user.user_metadata?.avatar_url || "",
          responses: responses,
          payment_status: isPaid ? "PENDING" : "SUCCESS",
          midtrans_order_id: orderId,
          amount: isPaid ? Number(form.price) : 0,
        })
        .select()
        .single();

      if (subError) throw new Error(subError.message);

      // Hapus draft tersimpan setelah berhasil submit
      if (typeof window !== "undefined" && slug) {
        localStorage.removeItem(`form_draft_${slug}`);
      }

      setExistingSubmission(sub);

      if (!isPaid) {
        router.push("/dashboard");
        return;
      }

      setActiveOrderId(orderId);

      const tokenRes = await fetch("/api/midtrans/snap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          amount: Number(form.price),
          customerName: user.user_metadata?.full_name || "Peserta",
          customerEmail: user.email,
          itemTitle: form.title,
        }),
      });

      const tokenData = await tokenRes.json();
      if (!tokenRes.ok || !tokenData.token) {
        throw new Error(tokenData.error || "Gagal membuat transaksi Midtrans.");
      }

      setActiveSnapToken(tokenData.token);

      // Simpan snap token ke submission agar bisa dibuka lagi di dashboard tanpa buat order baru
      if (orderId && sub) {
        await supabase
          .from("submissions")
          .update({
            responses: { ...responses, _snap_token: tokenData.token },
          })
          .eq("id", sub.id);
      }

      if (window.snap) {
        window.snap.pay(tokenData.token, {
          onSuccess: async () => {
            await handleCheckPaymentManual(orderId);
          },
          onPending: () => {
            alert("Menunggu pembayaran. Setelah transfer selesai, klik tombol 'Cek Pembayaran'.");
          },
          onError: () => {
            setErrorMsg("Pembayaran gagal atau dibatalkan.");
          },
          onClose: () => {
            console.log("Customer closed snap modal without finishing payment");
          },
        });
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal mengirimkan formulir.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResumePayment = async (customOrderId?: string) => {
    const targetOrderId = customOrderId || activeOrderId;
    if (!targetOrderId) return;

    try {
      setSubmitting(true);
      setErrorMsg("");

      // Jika snap token sudah tersimpan di state browser
      if (activeSnapToken && window.snap) {
        window.snap.pay(activeSnapToken, {
          onSuccess: async () => {
            await handleCheckPaymentManual(targetOrderId);
          },
          onPending: () => {
            alert("Menunggu pembayaran. Setelah transfer selesai, klik tombol 'Cek Pembayaran'.");
          },
          onError: () => {
            setErrorMsg("Pembayaran gagal atau dibatalkan.");
          },
          onClose: () => {
            console.log("Customer closed snap modal without finishing payment");
          },
        });
        return;
      }

      // Ambil token untuk orderId yang sudah ada
      const tokenRes = await fetch("/api/midtrans/snap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: targetOrderId,
          amount: Number(form.price),
          customerName: user?.user_metadata?.full_name || "Peserta",
          customerEmail: user?.email,
          itemTitle: form.title,
        }),
      });

      const tokenData = await tokenRes.json();
      if (!tokenRes.ok || !tokenData.token) {
        throw new Error(tokenData.error || "Gagal memproses pembayaran Midtrans.");
      }

      setActiveSnapToken(tokenData.token);

      // Simpan snap token ke submission agar bisa dibuka lagi di dashboard tanpa buat order baru
      if (targetOrderId) {
        await supabase
          .from("submissions")
          .update({
            responses: { ...(existingSubmission?.responses || {}), _snap_token: tokenData.token },
          })
          .eq("midtrans_order_id", targetOrderId);
      }

      if (window.snap) {
        window.snap.pay(tokenData.token, {
          onSuccess: async () => {
            await handleCheckPaymentManual(targetOrderId);
          },
          onPending: () => {
            alert("Menunggu pembayaran. Setelah transfer selesai, klik tombol 'Cek Pembayaran'.");
          },
          onError: () => {
            setErrorMsg("Pembayaran gagal atau dibatalkan.");
          },
          onClose: () => {
            console.log("Customer closed snap modal without finishing payment");
          },
        });
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal melanjutkan pembayaran.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckPaymentManual = async (targetOrderId?: string | null) => {
    const checkId = targetOrderId || activeOrderId;
    if (!checkId) return;

    try {
      setCheckingPayment(true);
      const res = await fetch(`/api/midtrans/status?orderId=${encodeURIComponent(checkId)}`);
      const data = await res.json();

      if (data.status === "SUCCESS") {
        router.push("/dashboard");
      } else {
        alert("Status pembayaran Anda saat ini: " + (data.transaction_status || "PENDING") + ". Selesaikan pembayaran terlebih dahulu.");
      }
    } catch (err: any) {
      alert("Gagal memeriksa status: " + err.message);
    } finally {
      setCheckingPayment(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f0ebf8] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#673ab7] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!form) {
    return (
      <div className="max-w-md mx-auto mt-20 p-6 bg-white rounded-lg border border-gray-200 text-center">
        <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-2" />
        <p className="text-sm text-gray-700">{errorMsg || "Formulir tidak ditemukan."}</p>
      </div>
    );
  }

  // Tampilan jika Formulir Ditutup (is_active === false)
  if (form.is_active === false) {
    return (
      <div className="min-h-screen bg-[#f0ebf8] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Formulir Telah Ditutup</h2>
          <p className="text-xs text-gray-600 mb-6 leading-relaxed">
            Penyelenggara telah menutup pendaftaran atau penerimaan tanggapan untuk formulir <strong>{form.title}</strong>.
          </p>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-5 py-2.5 bg-[#673ab7] hover:bg-[#5e35b1] text-white text-xs font-medium rounded-lg transition"
          >
            Kembali ke Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Tampilan jika user sudah pernah mengisi dan pembayaran selesai
  if (existingSubmission?.payment_status === "SUCCESS") {
    return (
      <div className="min-h-screen bg-[#f0ebf8] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Anda Sudah Terdaftar</h2>
          <p className="text-xs text-gray-600 mb-6 leading-relaxed">
            Anda telah berhasil mengisi formulir <strong>{form.title}</strong> dan pembayaran Anda telah terkonfirmasi.
          </p>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-5 py-2.5 bg-[#673ab7] hover:bg-[#5e35b1] text-white text-xs font-medium rounded-lg transition"
          >
            Buka Dashboard & Forum Diskusi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0ebf8] py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header Formulir */}
        <div className="bg-white rounded-lg border border-gray-200 border-t-8 border-t-[#673ab7] p-6 shadow-sm">
          <h1 className="text-2xl font-normal text-gray-900 mb-2">{form.title}</h1>
          {form.description && (
            <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line mb-4">
              {form.description}
            </p>
          )}

          {form.is_paid && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-50 text-[#673ab7] text-xs font-semibold rounded">
              <CreditCard className="w-3.5 h-3.5" />
              <span>Biaya Registrasi: {formatRupiah(Number(form.price))}</span>
            </div>
          )}
        </div>

        {/* Card Identitas Pengguna Google */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm text-xs">
          {!user ? (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
              <div>
                <p className="font-medium text-gray-800">Wajib masuk menggunakan Google</p>
                <p className="text-gray-500 text-[11px]">Identitas email Anda akan otomatis direkam untuk formulir ini.</p>
              </div>
              <button
                type="button"
                onClick={handleLoginGoogle}
                className="flex items-center gap-2 bg-[#202124] text-white hover:bg-black px-4 py-2 rounded text-xs font-medium transition"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Login with Google</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {user.user_metadata?.avatar_url ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt="User"
                    className="w-8 h-8 rounded-full border border-gray-200"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#673ab7] text-white text-xs font-bold flex items-center justify-center">
                    {(user.email?.[0] || "U").toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="font-medium text-gray-800">
                    {user.user_metadata?.full_name || user.email}
                  </p>
                  <p className="text-gray-500 text-[11px]">
                    Merekam <span className="font-mono text-gray-700">{user.email}</span> sebagai pengisi formulir
                  </p>
                </div>
              </div>
              <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-medium border border-emerald-200">
                Terhubung
              </span>
            </div>
          )}
        </div>

        {/* Notifikasi Tagihan Pending Jika Ada */}
        {activeOrderId && form.is_paid && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-amber-900 shadow-xs">
            <div className="flex items-start gap-3">
              <CreditCard className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <h4 className="font-semibold text-sm">Menunggu Pembayaran</h4>
                <p className="text-xs text-amber-700 mt-1">
                  Tagihan pendaftaran Anda telah dibuat dengan nomor pesanan: <span className="font-mono font-bold">{activeOrderId}</span>
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleResumePayment()}
                    disabled={submitting}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 transition disabled:opacity-50"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Lanjutkan Pembayaran</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCheckPaymentManual()}
                    disabled={checkingPayment}
                    className="px-4 py-2 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${checkingPayment ? "animate-spin" : ""}`} />
                    <span>{checkingPayment ? "Mengecek..." : "Cek Status Pembayaran"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded">
            {errorMsg}
          </div>
        )}

        {/* Notifikasi Pemulihan Draft Otomatis */}
        {draftRestored && Object.keys(responses).length > 0 && (
          <div className="flex items-center justify-between bg-purple-50 border border-purple-200 text-purple-900 px-4 py-2.5 rounded-lg text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#673ab7] shrink-0" />
              <span>Draft jawaban Anda yang belum dikirim berhasil dipulihkan otomatis.</span>
            </div>
            <button
              type="button"
              onClick={handleClearDraft}
              className="text-gray-500 hover:text-red-600 underline text-[11px] font-medium shrink-0 ml-3"
            >
              Hapus draft
            </button>
          </div>
        )}

        {/* Formulir Pertanyaan */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {fields.map((field) => (
            <div
              key={field.id}
              className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm space-y-3"
            >
              <label className="block text-sm font-medium text-gray-900">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </label>

              {field.type === "text" && (
                <input
                  type="text"
                  required={field.required}
                  value={responses[field.id] || ""}
                  onChange={(e) => handleInputChange(field.id, e.target.value)}
                  placeholder="Jawaban Anda"
                  className="w-full text-xs text-gray-800 border-b border-gray-300 focus:border-[#673ab7] focus:outline-none pb-1"
                />
              )}

              {field.type === "textarea" && (
                <textarea
                  rows={3}
                  required={field.required}
                  value={responses[field.id] || ""}
                  onChange={(e) => handleInputChange(field.id, e.target.value)}
                  placeholder="Jawaban Anda"
                  className="w-full text-xs text-gray-800 border-b border-gray-300 focus:border-[#673ab7] focus:outline-none resize-none"
                />
              )}

              {field.type === "number" && (
                <input
                  type="number"
                  required={field.required}
                  value={responses[field.id] || ""}
                  onChange={(e) => handleInputChange(field.id, e.target.value)}
                  placeholder="08xxxxxxxx"
                  className="w-full text-xs text-gray-800 border-b border-gray-300 focus:border-[#673ab7] focus:outline-none pb-1"
                />
              )}

              {field.type === "dropdown" && (
                <select
                  required={field.required}
                  value={responses[field.id] || ""}
                  onChange={(e) => handleInputChange(field.id, e.target.value)}
                  className="w-full text-xs text-gray-700 bg-white border border-gray-300 rounded px-3 py-2 focus:outline-none focus:border-[#673ab7]"
                >
                  <option value="">-- Pilih opsi --</option>
                  {(field.options || []).map((opt: string, i: number) => (
                    <option key={i} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              )}

              {field.type === "radio" && (
                <div className="space-y-2">
                  {(field.options || []).map((opt: string, i: number) => (
                    <label key={i} className="flex items-center gap-2.5 text-xs text-gray-800 cursor-pointer">
                      <input
                        type="radio"
                        name={`q-${field.id}`}
                        required={field.required}
                        value={opt}
                        checked={responses[field.id] === opt}
                        onChange={(e) => handleInputChange(field.id, e.target.value)}
                        className="w-4 h-4 accent-[#673ab7]"
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              )}

              {field.type === "checkbox" && (
                <div className="space-y-2">
                  {(field.options || []).map((opt: string, i: number) => {
                    const current = responses[field.id] || [];
                    const checked = current.includes(opt);
                    return (
                      <label key={i} className="flex items-center gap-2.5 text-xs text-gray-800 cursor-pointer">
                        <input
                          type="checkbox"
                          value={opt}
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              handleInputChange(field.id, [...current, opt]);
                            } else {
                              handleInputChange(
                                field.id,
                                current.filter((v: string) => v !== opt)
                              );
                            }
                          }}
                          className="w-4 h-4 accent-[#673ab7]"
                        />
                        <span>{opt}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          ))}

          {/* Action Button & Payment Trigger */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <button
              type="submit"
              disabled={!user || submitting || (!!activeOrderId && form.is_paid)}
              className="w-full sm:w-auto px-6 py-2.5 bg-[#673ab7] hover:bg-[#512da8] text-white text-xs font-medium rounded transition disabled:opacity-50"
            >
              {submitting
                ? "Memproses..."
                : activeOrderId && form.is_paid
                  ? "Tagihan Sudah Ada (Lihat di Atas)"
                  : form.is_paid && Number(form.price) > 0
                    ? `Kirim & Bayar (${formatRupiah(Number(form.price))})`
                    : "Kirim Formulir"}
            </button>

            {activeOrderId && form.is_paid && (
              <button
                type="button"
                onClick={() => handleCheckPaymentManual()}
                disabled={checkingPayment}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${checkingPayment ? "animate-spin" : ""}`} />
                <span>Cek Pembayaran</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
