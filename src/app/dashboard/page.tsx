"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { formatRupiah } from "@/lib/utils";
import { User } from "@supabase/supabase-js";
import {
  FileText,
  MessageSquare,
  Volume2,
  Send,
  CheckCircle,
  Clock,
  LogIn,
  LogOut,
  RefreshCw,
  AlertCircle,
  Inbox,
  Lock,
  CreditCard,
  QrCode,
  Sun,
  Moon,
  CheckCheck,
  ShieldCheck,
  Megaphone
} from "lucide-react";

declare global {
  interface Window {
    snap: any;
  }
}

interface SubmissionItem {
  id: string;
  form_id: string;
  payment_status: string;
  midtrans_order_id: string | null;
  amount: number;
  created_at: string;
  responses?: any;
  forms: any;
}

interface ChatMessage {
  id: string;
  form_id: string;
  user_email: string;
  user_name: string;
  channel_type: "public" | "announcement";
  message: string;
  is_admin: boolean;
  created_at: string;
}

export default function UserDashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "SUCCESS" | "PENDING">("all");

  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [chatChannel, setChatChannel] = useState<"public" | "announcement">("public");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const [payingSubId, setPayingSubId] = useState<string | null>(null);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [isDark, setIsDark] = useState<boolean>(false);
  const [userAvatars, setUserAvatars] = useState<Record<string, { avatar: string; name: string }>>({});
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Load Dark Mode Preference
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("app_dark_mode");
      if (savedTheme === "true") {
        setIsDark(true);
      }
    }
  }, []);

  const toggleDarkMode = () => {
    setIsDark((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("app_dark_mode", String(next));
      }
      return next;
    });
  };

  const loadSubmissions = useCallback(async (email: string) => {
    const { data, error } = await supabase
      .from("submissions")
      .select(`
        id,
        form_id,
        payment_status,
        midtrans_order_id,
        amount,
        created_at,
        responses,
        forms (
          id,
          title,
          slug,
          is_paid,
          price
        )
      `)
      .eq("user_email", email)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setSubmissions(data as any);
    }
  }, [supabase]);

  useEffect(() => {
    async function checkAuthAndLoadData() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser?.email) {
          await loadSubmissions(currentUser.email);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    checkAuthAndLoadData();
  }, [supabase, loadSubmissions]);

  // Load avatar seluruh peserta dalam formulir yang dipilih
  useEffect(() => {
    if (!selectedFormId) return;

    async function loadParticipants() {
      try {
        const { data } = await supabase
          .from("submissions")
          .select("user_email, user_name, user_avatar")
          .eq("form_id", selectedFormId);

        if (data) {
          const map: Record<string, { avatar: string; name: string }> = {};
          data.forEach((item) => {
            if (item.user_email) {
              map[item.user_email.toLowerCase()] = {
                avatar: item.user_avatar || "",
                name: item.user_name || item.user_email.split("@")[0],
              };
            }
          });
          setUserAvatars(map);
        }
      } catch (e) {
        console.error("Gagal load avatar peserta:", e);
      }
    }

    loadParticipants();
  }, [selectedFormId, supabase]);

  const selectedSub = submissions.find((s) => {
    const f = Array.isArray(s.forms) ? s.forms[0] : s.forms;
    return f?.id === selectedFormId;
  });
  const selectedFormInfo = Array.isArray(selectedSub?.forms) ? selectedSub?.forms[0] : selectedSub?.forms;
  const isPaidSuccess = selectedSub?.payment_status === "SUCCESS";

  useEffect(() => {
    // JIKA FORM BELUM DIPILIH ATAU STATUS BELUM SUKSES (MASIH PENDING), JANGAN LOAD CHAT!
    if (!selectedFormId || !isPaidSuccess) {
      setMessages([]);
      return;
    }

    async function loadChatMessages() {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("form_id", selectedFormId)
        .eq("channel_type", chatChannel)
        .order("created_at", { ascending: true })
        .limit(100);

      setMessages(data || []);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }

    loadChatMessages();

    const channel = supabase
      .channel(`chat-${selectedFormId}-${chatChannel}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `form_id=eq.${selectedFormId}`,
        },
        (payload: any) => {
          if (payload.new && payload.new.channel_type === chatChannel) {
            setMessages((prev) => [...prev, payload.new as ChatMessage]);
            setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedFormId, chatChannel, isPaidSuccess, supabase]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !user || !selectedFormId || sendingChat || !isPaidSuccess) return;

    if (chatChannel === "announcement") {
      alert("Hanya admin yang dapat mengirim pesan di channel Pengumuman.");
      return;
    }

    try {
      setSendingChat(true);
      const text = inputText.trim();
      setInputText("");

      const { error } = await supabase.from("chat_messages").insert({
        form_id: selectedFormId,
        user_email: user.email!,
        user_name: user.user_metadata?.full_name || user.email!.split("@")[0],
        channel_type: "public",
        message: text,
        is_admin: false,
      });

      if (error) {
        console.error("Gagal kirim chat:", error.message);
      }
    } finally {
      setSendingChat(false);
    }
  };

  const handleCheckPayment = async (orderId: string | null) => {
    if (!orderId) return;
    try {
      setCheckingPayment(true);
      const res = await fetch(`/api/midtrans/status?orderId=${encodeURIComponent(orderId)}`);
      const data = await res.json();
      if (data.status === "SUCCESS") {
        alert("Pembayaran terverifikasi! Status pendaftaran telah lunas.");
        if (user?.email) await loadSubmissions(user.email);
      } else {
        alert("Status transaksi saat ini: " + (data.transaction_status || "PENDING") + ". Selesaikan pembayaran di QRIS / VA terlebih dahulu.");
      }
    } catch (err: any) {
      alert("Gagal cek pembayaran: " + err.message);
    } finally {
      setCheckingPayment(false);
    }
  };

  const handlePaySnap = async (sub: SubmissionItem) => {
    if (payingSubId) return; // Mencegah spam klik

    try {
      setPayingSubId(sub.id);
      const formItem = Array.isArray(sub.forms) ? sub.forms[0] : sub.forms;
      const amount = Number(sub.amount) > 0 ? Number(sub.amount) : Number(formItem?.price || 0);

      if (amount <= 0) {
        alert("Formulir ini tidak memerlukan pembayaran.");
        return;
      }

      // KUNCI ORDER ID: Tetap gunakan order ID yang sudah ada, JANGAN ganti-ganti
      let orderId = sub.midtrans_order_id;
      if (!orderId) {
        orderId = `ORDER-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        await supabase
          .from("submissions")
          .update({ midtrans_order_id: orderId })
          .eq("id", sub.id);
      }

      // Gunakan token yang sudah tersimpan
      const sessionKey = `snap_token_${orderId}`;
      let token = typeof window !== "undefined" ? sessionStorage.getItem(sessionKey) : null;
      if (!token && sub.responses?._snap_token) {
        token = sub.responses._snap_token;
      }

      if (!token) {
        const tokenRes = await fetch("/api/midtrans/snap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: orderId,
            amount: amount,
            customerName: user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Peserta",
            customerEmail: user?.email,
            itemTitle: formItem?.title || "Pendaftaran Formulir",
          }),
        });

        const tokenData = await tokenRes.json();

        if (!tokenRes.ok) {
          if (tokenData.error && tokenData.error.includes("already exists")) {
            const statusRes = await fetch(`/api/midtrans/status?orderId=${encodeURIComponent(orderId)}`);
            const statusData = await statusRes.json();
            if (statusData.status === "SUCCESS") {
              alert("Pembayaran untuk pesanan ini sudah diverifikasi lunas!");
              if (user?.email) await loadSubmissions(user.email);
              return;
            }

            const retryOrderId = `${orderId.replace(/-R\d*$/, "")}-R${Date.now().toString().slice(-4)}`;
            const retryRes = await fetch("/api/midtrans/snap", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderId: retryOrderId,
                amount: amount,
                customerName: user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Peserta",
                customerEmail: user?.email,
                itemTitle: formItem?.title || "Pendaftaran Formulir",
              }),
            });
            const retryData = await retryRes.json();
            if (!retryRes.ok || !retryData.token) {
              throw new Error(retryData.error || "Gagal mendapatkan sesi pembayaran Midtrans.");
            }
            token = retryData.token;
            orderId = retryOrderId;
            await supabase
              .from("submissions")
              .update({
                midtrans_order_id: retryOrderId,
                responses: { ...(sub.responses || {}), _snap_token: token }
              })
              .eq("id", sub.id);
          } else {
            throw new Error(tokenData.error || "Gagal mendapatkan sesi pembayaran Midtrans.");
          }
        } else {
          token = tokenData.token;
          await supabase
            .from("submissions")
            .update({
              responses: { ...(sub.responses || {}), _snap_token: token }
            })
            .eq("id", sub.id);
        }

        if (token && typeof window !== "undefined") {
          sessionStorage.setItem(sessionKey, token);
        }
      }

      if (token && typeof window !== "undefined" && window.snap) {
        window.snap.pay(token, {
          onSuccess: async () => {
            alert("Pembayaran berhasil! Mengaktifkan akses forum chat...");
            await handleCheckPayment(orderId);
          },
          onPending: () => {
            alert("Menunggu pembayaran QRIS / Virtual Account. Setelah transfer selesai, klik tombol 'Cek Pembayaran'.");
            if (user?.email) loadSubmissions(user.email);
          },
          onError: () => {
            alert("Pembayaran dibatalkan atau gagal.");
            if (user?.email) loadSubmissions(user.email);
          },
          onClose: () => {
            if (user?.email) loadSubmissions(user.email);
          },
        });
      } else {
        alert("Midtrans Snap belum siap. Silakan muat ulang halaman.");
      }
    } catch (err: any) {
      alert("Kendala pembayaran: " + err.message);
    } finally {
      setPayingSubId(null);
    }
  };

  const handleLoginGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.href,
      },
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSubmissions([]);
    setSelectedFormId(null);
  };

  const filteredSubs = submissions.filter((s) => {
    if (statusFilter === "all") return true;
    return s.payment_status === statusFilter;
  });

  // Helper mendapatkan avatar peserta
  const getUserAvatarUrl = (email: string) => {
    const normalized = email?.toLowerCase();
    if (user?.email?.toLowerCase() === normalized && user.user_metadata?.avatar_url) {
      return user.user_metadata.avatar_url;
    }
    return userAvatars[normalized]?.avatar || null;
  };

  // Helper warna avatar inisial
  const getAvatarBgColor = (name: string) => {
    const colors = [
      "bg-emerald-600",
      "bg-blue-600",
      "bg-indigo-600",
      "bg-purple-600",
      "bg-pink-600",
      "bg-amber-600",
      "bg-teal-600",
      "bg-cyan-600",
    ];
    let hash = 0;
    for (let i = 0; i < (name || "").length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? "bg-[#111b21]" : "bg-[#f0ebf8]"}`}>
        <div className="w-8 h-8 border-4 border-[#673ab7] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className={`min-h-screen flex items-center justify-center px-4 ${isDark ? "bg-[#111b21]" : "bg-[#f0ebf8]"}`}>
        <div className={`w-full max-w-md rounded-xl border p-8 text-center shadow-sm ${isDark ? "bg-[#202c33] border-gray-700 text-white" : "bg-white border-gray-200"}`}>
          <FileText className="w-12 h-12 text-[#673ab7] mx-auto mb-3" />
          <h1 className="text-xl font-medium mb-2">Halaman Utama Pengguna</h1>
          <p className={`text-xs mb-6 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            Masuk dengan akun Google Anda untuk melihat formulir yang telah Anda ikuti dan bergabung di forum diskusi komunitas.
          </p>
          <button
            onClick={handleLoginGoogle}
            className="w-full py-2.5 px-4 bg-[#202124] hover:bg-black text-white text-xs font-medium rounded-lg flex items-center justify-center gap-2 transition"
          >
            <LogIn className="w-4 h-4" />
            <span>Masuk dengan Google</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen flex flex-col overflow-hidden transition-colors duration-200 ${isDark ? "bg-[#111b21] text-[#e9edef]" : "bg-white text-gray-900"}`}>
      {/* Top Navbar */}
      <header className={`h-16 border-b px-6 flex items-center justify-between flex-shrink-0 z-10 transition-colors ${
        isDark ? "bg-[#202c33] border-[#2a3942]" : "bg-white border-gray-200"
      }`}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-[#673ab7] flex items-center justify-center text-white">
            <FileText className="w-5 h-5" />
          </div>
          <span className="text-base font-semibold">Ruang Peserta</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Tombol Dark Mode Toggle */}
          <button
            onClick={toggleDarkMode}
            title={isDark ? "Beralih ke Mode Terang" : "Beralih ke Mode Gelap"}
            className={`p-2 rounded-full transition ${
              isDark
                ? "bg-[#2a3942] text-amber-400 hover:bg-[#32434d]"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <div className="flex items-center gap-2">
            {user.user_metadata?.avatar_url ? (
              <img
                src={user.user_metadata.avatar_url}
                alt="Avatar"
                className="w-7 h-7 rounded-full border border-gray-200 dark:border-gray-600 object-cover"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-[#673ab7] text-white text-xs font-bold flex items-center justify-center">
                {(user.email?.[0] || "U").toUpperCase()}
              </div>
            )}
            <span className={`text-xs font-medium hidden sm:inline ${isDark ? "text-gray-300" : "text-gray-700"}`}>
              {user.user_metadata?.full_name || user.email}
            </span>
          </div>

          <button
            onClick={handleLogout}
            title="Keluar"
            className={`p-1.5 rounded transition ${
              isDark ? "text-gray-400 hover:text-red-400 hover:bg-[#2a3942]" : "text-gray-500 hover:text-red-600 hover:bg-gray-100"
            }`}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Two-Pane Layout (WhatsApp Web Style) */}
      <div className="flex-1 flex overflow-hidden">
        {/* SIDEBAR KIRI: Daftar Formulir Saya */}
        <aside className={`w-full md:w-80 lg:w-96 border-r flex flex-col flex-shrink-0 transition-colors ${
          isDark ? "bg-[#111b21] border-[#2a3942]" : "bg-white border-gray-200"
        }`}>
          {/* Header Sidebar & Filter Tab */}
          <div className={`p-4 border-b transition-colors ${
            isDark ? "bg-[#111b21] border-[#2a3942]" : "bg-white border-gray-200"
          }`}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Formulir Saya</h2>
              <span className={`text-xs font-mono ${isDark ? "text-gray-500" : "text-gray-400"}`}>({submissions.length})</span>
            </div>

            <div className="flex gap-1 text-[11px]">
              <button
                onClick={() => setStatusFilter("all")}
                className={`flex-1 py-1 rounded text-center font-medium transition ${
                  statusFilter === "all"
                    ? "bg-[#673ab7] text-white"
                    : isDark
                    ? "bg-[#202c33] text-gray-300 hover:bg-[#2a3942]"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                Semua
              </button>
              <button
                onClick={() => setStatusFilter("SUCCESS")}
                className={`flex-1 py-1 rounded text-center font-medium transition ${
                  statusFilter === "SUCCESS"
                    ? "bg-[#673ab7] text-white"
                    : isDark
                    ? "bg-[#202c33] text-gray-300 hover:bg-[#2a3942]"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                Sukses
              </button>
              <button
                onClick={() => setStatusFilter("PENDING")}
                className={`flex-1 py-1 rounded text-center font-medium transition ${
                  statusFilter === "PENDING"
                    ? "bg-[#673ab7] text-white"
                    : isDark
                    ? "bg-[#202c33] text-gray-300 hover:bg-[#2a3942]"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                Pending
              </button>
            </div>
          </div>

          {/* List Formulir */}
          <div className={`flex-1 overflow-y-auto divide-y ${isDark ? "divide-[#2a3942]" : "divide-gray-100"}`}>
            {filteredSubs.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-xs">
                <Inbox className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>Belum ada formulir dalam status ini.</p>
              </div>
            ) : (
              filteredSubs.map((sub) => {
                const formItem = Array.isArray(sub.forms) ? sub.forms[0] : sub.forms;
                const isSelected = selectedFormId === formItem?.id;
                const isSuccess = sub.payment_status === "SUCCESS";

                return (
                  <div
                    key={sub.id}
                    onClick={() => formItem && setSelectedFormId(formItem.id)}
                    className={`p-4 text-left transition cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? isDark
                          ? "bg-[#2a3942] border-l-4 border-l-[#a855f7]"
                          : "bg-purple-50/70 border-l-4 border-l-[#673ab7]"
                        : isDark
                        ? "hover:bg-[#202c33] border-l-4 border-l-transparent"
                        : "hover:bg-gray-50 border-l-4 border-l-transparent"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            isSuccess
                              ? isDark ? "bg-emerald-950 text-emerald-300 border border-emerald-800" : "bg-emerald-100 text-emerald-800"
                              : isDark ? "bg-amber-950 text-amber-300 border border-amber-800" : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {isSuccess ? "Sukses" : "Pending Bayar"}
                        </span>
                        <span className={`text-[10px] font-mono ${isDark ? "text-gray-400" : "text-gray-400"}`}>
                          {new Date(sub.created_at).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                      </div>

                      <h3 className={`text-xs font-semibold line-clamp-2 ${isDark ? "text-gray-100" : "text-gray-900"}`}>
                        {formItem?.title || "Formulir Acara"}
                      </h3>
                      {formItem?.is_paid && (
                        <p className={`text-[11px] mt-0.5 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                          {formatRupiah(Number(formItem.price))}
                        </p>
                      )}
                    </div>

                    {!isSuccess && (
                      <div className={`mt-3 pt-2 border-t flex items-center justify-end gap-1.5 ${isDark ? "border-[#2a3942]" : "border-gray-100"}`}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePaySnap(sub);
                          }}
                          disabled={payingSubId === sub.id}
                          className="flex items-center gap-1 text-[10px] bg-[#673ab7] hover:bg-[#512da8] text-white font-medium px-2.5 py-1 rounded transition disabled:opacity-50"
                        >
                          <CreditCard className="w-3 h-3" />
                          <span>{payingSubId === sub.id ? "Membuka..." : "Bayar"}</span>
                        </button>

                        {sub.midtrans_order_id && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCheckPayment(sub.midtrans_order_id);
                            }}
                            className="flex items-center gap-1 text-[10px] bg-amber-600 hover:bg-amber-700 text-white font-medium px-2 py-1 rounded transition"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Cek</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* AREA KANAN: Ruang Chat Komunitas Realtime (WhatsApp Web Style) */}
        <main className={`flex-1 flex flex-col transition-colors ${isDark ? "bg-[#0b141a]" : "bg-[#efeae2]"}`}>
          {!selectedFormId ? (
            /* Empty State WhatsApp Web saat belum ada formulir yang dipilih */
            <div className={`h-full flex flex-col items-center justify-center p-8 text-center ${
              isDark ? "bg-[#111b21] text-gray-400" : "bg-[#f8fafc] text-gray-400"
            }`}>
              <div className="w-16 h-16 rounded-full bg-purple-100 text-[#673ab7] flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h2 className={`text-base font-medium mb-1 ${isDark ? "text-gray-200" : "text-gray-700"}`}>
                Ruang Diskusi & Pengumuman Komunitas
              </h2>
              <p className={`text-xs max-w-sm leading-relaxed ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                Pilih salah satu formulir di panel sebelah kiri untuk membaca pengumuman resmi dan berdiskusi dengan peserta lainnya.
              </p>
            </div>
          ) : !isPaidSuccess ? (
            /* PAYWALL TERKUNCI KARENA STATUS PEMBAYARAN MASIH PENDING */
            <div className={`h-full flex flex-col ${isDark ? "bg-[#111b21]" : "bg-[#faf9fc]"}`}>
              {/* Header Terkunci */}
              <div className={`h-16 px-6 border-b flex items-center justify-between flex-shrink-0 transition-colors ${
                isDark ? "bg-[#202c33] border-[#2a3942]" : "bg-white border-gray-200"
              }`}>
                <div className="flex-1 mr-4">
                  <h2 className="text-sm font-semibold truncate">
                    {selectedFormInfo?.title || "Formulir Acara"}
                  </h2>
                  <p className="text-[11px] text-amber-500 font-medium flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>Status: Menunggu Pembayaran Registrasi</span>
                  </p>
                </div>

                <div className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded ${
                  isDark
                    ? "bg-amber-950 text-amber-300 border border-amber-800"
                    : "bg-amber-50 border border-amber-200 text-amber-800"
                }`}>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Forum Terkunci</span>
                </div>
              </div>

              {/* Paywall Container */}
              <div className="flex-1 overflow-y-auto flex items-center justify-center p-6">
                <div className={`w-full max-w-md rounded-xl border p-6 shadow-sm text-center ${
                  isDark ? "bg-[#202c33] border-[#2a3942]" : "bg-white border-gray-200"
                }`}>
                  <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto mb-4">
                    <Lock className="w-7 h-7" />
                  </div>

                  <h3 className="text-base font-semibold mb-1.5">
                    Akses Forum & Chat Belum Dibuka
                  </h3>
                  <p className={`text-xs leading-relaxed mb-6 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                    Pendaftaran Anda telah tercatat. Namun ruang <strong>Public Chat</strong> dan <strong>Pengumuman Resmi</strong> panitia hanya terbuka untuk peserta yang telah menyelesaikan pembayaran.
                  </p>

                  {/* Summary Invoice Card */}
                  <div className={`border rounded-lg p-4 mb-6 text-left text-xs space-y-2.5 ${
                    isDark ? "bg-[#111b21] border-[#2a3942]" : "bg-gray-50 border-gray-200"
                  }`}>
                    <div className="flex justify-between items-center">
                      <span className={isDark ? "text-gray-400" : "text-gray-500"}>Nama Acara</span>
                      <span className="font-semibold truncate max-w-[200px]">
                        {selectedFormInfo?.title || "Acara"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className={isDark ? "text-gray-400" : "text-gray-500"}>Total Biaya Pendaftaran</span>
                      <span className="font-bold text-[#a855f7] text-sm">
                        {formatRupiah(Number(selectedSub?.amount || selectedFormInfo?.price || 0))}
                      </span>
                    </div>
                    <div className={`flex justify-between items-center pt-2 border-t ${isDark ? "border-[#2a3942]" : "border-gray-200"}`}>
                      <span className={isDark ? "text-gray-400" : "text-gray-500"}>Status Pembayaran</span>
                      <span className="font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded text-[10px]">
                        Pending (Belum Lunas)
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2.5">
                    <button
                      type="button"
                      onClick={() => selectedSub && handlePaySnap(selectedSub)}
                      disabled={payingSubId === selectedSub?.id}
                      className="w-full py-2.5 px-4 bg-[#673ab7] hover:bg-[#512da8] text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition disabled:opacity-50 shadow-sm"
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>
                        {payingSubId === selectedSub?.id
                          ? "Membuka Midtrans..."
                          : "Bayar Sekarang (Buka QRIS / VA / E-Wallet)"}
                      </span>
                    </button>

                    {selectedSub?.midtrans_order_id && (
                      <button
                        type="button"
                        onClick={() => handleCheckPayment(selectedSub?.midtrans_order_id)}
                        disabled={checkingPayment}
                        className={`w-full py-2 px-4 border rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition ${
                          isDark
                            ? "bg-[#111b21] border-[#2a3942] hover:bg-[#2a3942] text-gray-200"
                            : "bg-white border-gray-300 hover:bg-gray-50 text-gray-700"
                        }`}
                      >
                        <RefreshCw className={`w-3.5 h-3.5 text-gray-400 ${checkingPayment ? "animate-spin" : ""}`} />
                        <span>Cek Status Pembayaran</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Chat Aktif Ketika Formulir Telah Lunas (SUCCESS) */
            <div className="h-full flex flex-col">
              {/* Header Chat */}
              <div className={`h-16 px-6 border-b flex items-center justify-between flex-shrink-0 transition-colors ${
                isDark ? "bg-[#202c33] border-[#2a3942]" : "bg-white border-gray-200"
              }`}>
                <div className="flex-1 mr-4">
                  <h2 className="text-sm font-semibold truncate">
                    {selectedFormInfo?.title || "Formulir Acara"}
                  </h2>
                  <p className={`text-[11px] ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                    Komunitas & Forum Diskusi Peserta
                  </p>
                </div>

                {/* 2 Channel Tabs */}
                <div className={`flex gap-1.5 p-1 rounded-lg ${isDark ? "bg-[#111b21]" : "bg-gray-100"}`}>
                  <button
                    onClick={() => setChatChannel("public")}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition ${
                      chatChannel === "public"
                        ? "bg-[#673ab7] text-white shadow-xs"
                        : isDark
                        ? "text-gray-400 hover:text-gray-200"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Public Chat</span>
                  </button>

                  <button
                    onClick={() => setChatChannel("announcement")}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition ${
                      chatChannel === "announcement"
                        ? "bg-[#673ab7] text-white shadow-xs"
                        : isDark
                        ? "text-gray-400 hover:text-gray-200"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Announcement</span>
                  </button>
                </div>
              </div>

              {/* Chat Message List - WhatsApp Style Layout */}
              <div
                style={{
                  backgroundImage: isDark
                    ? "radial-gradient(#1f2c34 1.5px, transparent 1.5px)"
                    : "linear-gradient(#d5dce0 1px, transparent 1px), linear-gradient(90deg, #d5dce0 1px, transparent 1px)",
                  backgroundSize: "24px 24px",
                }}
                className={`flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5 transition-colors ${
                  isDark ? "bg-[#0b141a]" : "bg-[#dfe5e8]"
                }`}
              >
                {messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center text-xs text-gray-400">
                    {chatChannel === "announcement"
                      ? "Belum ada pengumuman resmi dari panitia."
                      : "Belum ada percakapan. Sapa peserta lainnya!"}
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMine = msg.user_email?.toLowerCase() === user.email?.toLowerCase();
                    const avatarUrl = getUserAvatarUrl(msg.user_email);

                    // Announcement Spesial (Admin Banner Style)
                    if (msg.channel_type === "announcement" || msg.is_admin) {
                      return (
                        <div key={msg.id} className="flex flex-col items-center my-3">
                          <div className={`max-w-lg w-full p-4 rounded-xl border-2 text-xs shadow-sm ${
                            isDark
                              ? "bg-[#202c33] border-amber-500/50 text-amber-200"
                              : "bg-amber-50 border-amber-300 text-amber-950"
                          }`}>
                            <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-amber-300/40">
                              <Megaphone className="w-4 h-4 text-amber-600 shrink-0" />
                              <span className="font-bold text-[11px] uppercase tracking-wide">
                                Pengumuman Resmi Panitia
                              </span>
                              <span className="text-[10px] text-black font-medium dark:text-gray-300 ml-auto">
                                {new Date(msg.created_at).toLocaleTimeString("id-ID", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                            <p className="leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                          </div>
                        </div>
                      );
                    }

                    // MY MESSAGE (Pesan Saya - WhatsApp style on Right)
                    if (isMine) {
                      return (
                        <div key={msg.id} className="flex items-end justify-end gap-2 text-xs max-w-[85%] sm:max-w-[75%] ml-auto">
                          {/* Bubble Pesan Saya dengan border jelas & jam hitam tanpa icon centang */}
                          <div className={`p-3 rounded-2xl rounded-br-xs shadow-sm relative border transition-colors ${
                            isDark
                              ? "bg-[#005c4b] text-[#e9edef] border-[#007a63]"
                              : "bg-[#d9fdd3] text-gray-900 border-gray-400"
                          }`}>
                            <p className="text-xs leading-relaxed whitespace-pre-wrap break-words">{msg.message}</p>
                            <div className="text-[10px] text-black font-medium dark:text-gray-300 text-right mt-1">
                              {new Date(msg.created_at).toLocaleTimeString("id-ID", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          </div>

                          {/* Avatar Saya di Kanan */}
                          <div className="shrink-0 mb-1">
                            {user.user_metadata?.avatar_url ? (
                              <img
                                src={user.user_metadata.avatar_url}
                                alt="Me"
                                className="w-8 h-8 rounded-full border border-gray-400 dark:border-gray-600 object-cover shadow-xs"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-[#673ab7] text-white font-bold text-xs flex items-center justify-center shadow-xs">
                                {(user.email?.[0] || "U").toUpperCase()}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }

                    // OTHERS MESSAGE (Pesan Peserta Lain - WhatsApp style on Left)
                    return (
                      <div key={msg.id} className="flex items-end gap-2 text-xs max-w-[85%] sm:max-w-[75%] mr-auto">
                        {/* Avatar Peserta Lain di Kiri */}
                        <div className="shrink-0 mb-1">
                          {avatarUrl ? (
                            <img
                              src={avatarUrl}
                              alt={msg.user_name}
                              className="w-8 h-8 rounded-full border border-gray-400 dark:border-gray-600 object-cover shadow-xs"
                            />
                          ) : (
                            <div className={`w-8 h-8 rounded-full text-white font-bold text-xs flex items-center justify-center shadow-xs ${getAvatarBgColor(msg.user_name)}`}>
                              {(msg.user_name?.[0] || msg.user_email?.[0] || "U").toUpperCase()}
                            </div>
                          )}
                        </div>

                        {/* Bubble Pesan Teman dengan border jelas & jam hitam */}
                        <div className={`p-3 rounded-2xl rounded-bl-xs shadow-sm relative border transition-colors ${
                          isDark
                            ? "bg-[#202c33] text-[#e9edef] border-[#374248]"
                            : "bg-white text-gray-900 border-gray-400"
                        }`}>
                          <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 mb-0.5">
                            {msg.user_name}
                          </div>
                          <p className="text-xs leading-relaxed whitespace-pre-wrap break-words">{msg.message}</p>
                          <div className="text-[10px] text-black font-medium dark:text-gray-300 text-right mt-1">
                            {new Date(msg.created_at).toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input Area */}
              <div className={`p-3 border-t flex-shrink-0 transition-colors ${
                isDark ? "bg-[#202c33] border-[#2a3942]" : "bg-white border-gray-200"
              }`}>
                {chatChannel === "announcement" ? (
                  <div className={`text-center text-[11px] py-2 rounded-lg ${
                    isDark ? "bg-[#111b21] text-gray-400" : "bg-gray-50 text-gray-400"
                  }`}>
                    Hanya admin panitia yang dapat memposting di channel Pengumuman.
                  </div>
                ) : (
                  <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="Tulis pesan ke sesama peserta..."
                      disabled={!selectedFormId || sendingChat}
                      className={`flex-1 text-xs border rounded-lg px-3.5 py-2.5 focus:outline-none transition ${
                        isDark
                          ? "bg-[#2a3942] border-[#374248] text-white placeholder-gray-400 focus:border-[#a855f7]"
                          : "bg-white border-gray-300 text-gray-900 focus:border-[#673ab7]"
                      }`}
                    />
                    <button
                      type="submit"
                      disabled={!inputText.trim() || sendingChat}
                      className="p-2.5 bg-[#673ab7] hover:bg-[#512da8] text-white rounded-lg transition disabled:opacity-40 shadow-xs"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
