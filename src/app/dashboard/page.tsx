"use client";

import { useEffect, useState, useRef } from "react";
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
  Inbox
} from "lucide-react";

interface SubmissionItem {
  id: string;
  form_id: string;
  payment_status: string;
  midtrans_order_id: string | null;
  amount: number;
  created_at: string;
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
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    async function checkAuthAndLoadData() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser?.email) {
          const { data, error } = await supabase
            .from("submissions")
            .select(`
              id,
              form_id,
              payment_status,
              midtrans_order_id,
              amount,
              created_at,
              forms (
                id,
                title,
                slug,
                is_paid,
                price
              )
            `)
            .eq("user_email", currentUser.email)
            .order("created_at", { ascending: false });

          if (!error && data) {
            setSubmissions(data as any);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    checkAuthAndLoadData();
  }, [supabase]);

  useEffect(() => {
    if (!selectedFormId) {
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
  }, [selectedFormId, chatChannel, supabase]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !user || !selectedFormId || sendingChat) return;

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
      const res = await fetch(`/api/midtrans/status?orderId=${encodeURIComponent(orderId)}`);
      const data = await res.json();
      if (data.status === "SUCCESS") {
        alert("Pembayaran terverifikasi! Status diperbarui ke Sukses.");
        window.location.reload();
      } else {
        alert("Status transaksi saat ini: " + (data.transaction_status || "PENDING"));
      }
    } catch (err: any) {
      alert("Gagal cek pembayaran: " + err.message);
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

  const selectedSub = submissions.find((s) => {
    const f = Array.isArray(s.forms) ? s.forms[0] : s.forms;
    return f?.id === selectedFormId;
  });
  const selectedFormInfo = Array.isArray(selectedSub?.forms) ? selectedSub?.forms[0] : selectedSub?.forms;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f0ebf8] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#673ab7] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f0ebf8] flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-lg border border-gray-200 p-8 text-center shadow-sm">
          <FileText className="w-12 h-12 text-[#673ab7] mx-auto mb-3" />
          <h1 className="text-xl font-medium text-gray-800 mb-2">Halaman Utama Pengguna</h1>
          <p className="text-xs text-gray-500 mb-6">
            Masuk dengan akun Google Anda untuk melihat formulir yang telah Anda isi dan ruang diskusi komunitas.
          </p>
          <button
            onClick={handleLoginGoogle}
            className="w-full py-2.5 px-4 bg-[#202124] hover:bg-black text-white text-xs font-medium rounded flex items-center justify-center gap-2 transition"
          >
            <LogIn className="w-4 h-4" />
            <span>Masuk dengan Google</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      {/* Top Navbar */}
      <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between flex-shrink-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-[#673ab7] flex items-center justify-center text-white">
            <FileText className="w-5 h-5" />
          </div>
          <span className="text-base font-medium text-gray-800">Ruang Peserta</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {user.user_metadata?.avatar_url ? (
              <img
                src={user.user_metadata.avatar_url}
                alt="Avatar"
                className="w-7 h-7 rounded-full border border-gray-200"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-[#673ab7] text-white text-xs font-bold flex items-center justify-center">
                {(user.email?.[0] || "U").toUpperCase()}
              </div>
            )}
            <span className="text-xs font-medium text-gray-700 hidden sm:inline">
              {user.user_metadata?.full_name || user.email}
            </span>
          </div>

          <button
            onClick={handleLogout}
            title="Keluar"
            className="p-1.5 text-gray-500 hover:text-red-600 rounded hover:bg-gray-100"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Two-Pane Layout (WhatsApp Web Style) */}
      <div className="flex-1 flex overflow-hidden">
        {/* SIDEBAR KIRI: Daftar Formulir Saya */}
        <aside className="w-full md:w-80 lg:w-96 border-r border-gray-200 flex flex-col bg-white flex-shrink-0">
          {/* Header Sidebar & Filter Tab */}
          <div className="p-4 border-b border-gray-200 bg-white">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-800">Formulir Saya</h2>
              <span className="text-xs text-gray-400 font-mono">({submissions.length})</span>
            </div>

            <div className="flex gap-1 text-[11px]">
              <button
                onClick={() => setStatusFilter("all")}
                className={`flex-1 py-1 rounded text-center font-medium transition ${
                  statusFilter === "all"
                    ? "bg-[#673ab7] text-white"
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
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                Pending
              </button>
            </div>
          </div>

          {/* List Formulir */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
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
                        ? "bg-purple-50/70 border-l-4 border-l-[#673ab7]"
                        : "hover:bg-gray-50 border-l-4 border-l-transparent"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            isSuccess
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {isSuccess ? "Sukses" : "Pending Bayar"}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono">
                          {new Date(sub.created_at).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                      </div>

                      <h3 className="text-xs font-semibold text-gray-900 line-clamp-2">
                        {formItem?.title || "Formulir Acara"}
                      </h3>
                      {formItem?.is_paid && (
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          {formatRupiah(Number(formItem.price))}
                        </p>
                      )}
                    </div>

                    {!isSuccess && sub.midtrans_order_id && (
                      <div className="mt-3 pt-2 border-t border-gray-100 flex justify-end">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCheckPayment(sub.midtrans_order_id);
                          }}
                          className="flex items-center gap-1 text-[10px] bg-amber-600 hover:bg-amber-700 text-white font-medium px-2.5 py-1 rounded transition"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Cek Pembayaran</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* AREA KANAN: Ruang Chat Komunitas Realtime (WhatsApp Web Style) */}
        <main className="flex-1 flex flex-col bg-[#faf9fc]">
          {!selectedFormId ? (
            /* Empty State WhatsApp Web saat belum ada obrolan yang dipilih */
            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-gray-400 bg-[#f8fafc]">
              <div className="w-16 h-16 rounded-full bg-purple-100 text-[#673ab7] flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h2 className="text-base font-medium text-gray-700 mb-1">
                Ruang Diskusi & Pengumuman Komunitas
              </h2>
              <p className="text-xs text-gray-500 max-w-sm leading-relaxed">
                Pilih salah satu formulir di panel sebelah kiri untuk membaca pengumuman resmi dan berdiskusi dengan peserta lainnya.
              </p>
            </div>
          ) : (
            /* Chat Aktif Ketika Formulir Telah Dipilih */
            <div className="h-full flex flex-col">
              {/* Header Chat */}
              <div className="h-16 px-6 border-b border-gray-200 bg-white flex items-center justify-between flex-shrink-0">
                <div className="flex-1 mr-4">
                  <h2 className="text-sm font-semibold text-gray-800 truncate">
                    {selectedFormInfo?.title || "Formulir Acara"}
                  </h2>
                  <p className="text-[11px] text-gray-400">Komunitas & Forum Diskusi</p>
                </div>

                {/* 2 Channel Tabs */}
                <div className="flex gap-1.5 bg-gray-100 p-1 rounded">
                  <button
                    onClick={() => setChatChannel("public")}
                    className={`px-3 py-1.5 text-xs font-medium rounded flex items-center gap-1.5 transition ${
                      chatChannel === "public"
                        ? "bg-[#673ab7] text-white shadow-xs"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Public Chat</span>
                  </button>

                  <button
                    onClick={() => setChatChannel("announcement")}
                    className={`px-3 py-1.5 text-xs font-medium rounded flex items-center gap-1.5 transition ${
                      chatChannel === "announcement"
                        ? "bg-[#673ab7] text-white shadow-xs"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Announcement</span>
                  </button>
                </div>
              </div>

              {/* Chat Message List */}
              <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-[#faf9fc]">
                {messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center text-xs text-gray-400">
                    {chatChannel === "announcement"
                      ? "Belum ada pengumuman resmi dari panitia."
                      : "Belum ada percakapan. Sapa peserta lainnya!"}
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMine = msg.user_email === user.email;
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col text-xs ${isMine ? "items-end" : "items-start"}`}
                      >
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="font-semibold text-gray-700 text-[11px]">
                            {msg.is_admin ? "📢 Admin" : msg.user_name}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {new Date(msg.created_at).toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <div
                          className={`px-3.5 py-2 rounded-lg max-w-[80%] break-words leading-relaxed ${
                            msg.is_admin
                              ? "bg-amber-100 text-amber-900 border border-amber-200"
                              : isMine
                              ? "bg-[#673ab7] text-white"
                              : "bg-white text-gray-800 border border-gray-200 shadow-xs"
                          }`}
                        >
                          {msg.message}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input Area */}
              <div className="p-3 border-t border-gray-200 bg-white flex-shrink-0">
                {chatChannel === "announcement" ? (
                  <div className="text-center text-[11px] text-gray-400 py-2 bg-gray-50 rounded">
                    Hanya admin yang dapat memposting pengumuman resmi.
                  </div>
                ) : (
                  <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="Tulis pesan ke sesama peserta..."
                      disabled={!selectedFormId || sendingChat}
                      className="flex-1 text-xs border border-gray-300 rounded px-3 py-2 focus:outline-none focus:border-[#673ab7]"
                    />
                    <button
                      type="submit"
                      disabled={!inputText.trim() || sendingChat}
                      className="p-2 bg-[#673ab7] hover:bg-[#512da8] text-white rounded transition disabled:opacity-40"
                    >
                      <Send className="w-3.5 h-3.5" />
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
