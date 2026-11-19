"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal mengirimkan tautan.");
      }

      setSuccessMsg(data.message || "Tautan telah dikirim ke email Anda.");
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0ebf8] px-4">
      <div className="w-full max-w-md bg-white rounded-lg border border-gray-200 shadow-sm p-8">
        <Link
          href="/admin/login"
          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Kembali ke Login</span>
        </Link>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded bg-[#673ab7] flex items-center justify-center text-white">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-medium text-gray-800">Atur / Reset Password</h1>
            <p className="text-xs text-gray-500">Kirim tautan aktivasi ke email admin</p>
          </div>
        </div>

        {successMsg && (
          <div className="mb-4 p-4 rounded bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 leading-relaxed flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold">Email Berhasil Dikirim!</p>
              <p className="mt-1">{successMsg}</p>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {!successMsg ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-xs text-gray-600 leading-relaxed">
              Masukkan alamat email admin yang telah set
            </p>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Email Admin
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="namaadmin@gmail.com"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-[#673ab7]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-[#673ab7] hover:bg-[#512da8] text-white text-xs font-medium rounded transition disabled:opacity-50"
            >
              {loading ? "Mengirim Email via SMTP..." : "Kirim Tautan ke Email"}
            </button>
          </form>
        ) : (
          <div className="text-center pt-2">
            <Link
              href="/admin/login"
              className="inline-block text-xs font-medium text-[#673ab7] hover:underline"
            >
              Kembali ke Halaman Login
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
