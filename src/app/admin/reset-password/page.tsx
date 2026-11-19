"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { KeyRound, CheckCircle2, AlertCircle } from "lucide-react";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setErrorMsg("Tautan tidak valid. Tidak ada token pengaturan password.");
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (newPassword !== confirmPassword) {
      setErrorMsg("Konfirmasi password tidak cocok.");
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg("Password minimal 6 karakter.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menyimpan password.");
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/admin/login");
      }, 2500);
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white rounded-lg border border-gray-200 shadow-sm p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded bg-[#673ab7] flex items-center justify-center text-white">
          <KeyRound className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-lg font-medium text-gray-800">Atur Password Baru</h1>
          <p className="text-xs text-gray-500">Buat password untuk akun admin Anda</p>
        </div>
      </div>

      {success ? (
        <div className="p-4 rounded bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 text-center space-y-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
          <p className="font-semibold text-sm">Password Berhasil Disimpan!</p>
          <p className="text-gray-500">Mengalihkan Anda ke halaman login...</p>
        </div>
      ) : (
        <>
          {errorMsg && (
            <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Password Baru (Minimal 6 Karakter)
              </label>
              <input
                type="password"
                required
                disabled={!token || loading}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-[#673ab7]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Ulangi Password Baru
              </label>
              <input
                type="password"
                required
                disabled={!token || loading}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-[#673ab7]"
              />
            </div>

            <button
              type="submit"
              disabled={!token || loading}
              className="w-full py-2.5 px-4 bg-[#673ab7] hover:bg-[#512da8] text-white text-xs font-medium rounded transition disabled:opacity-50"
            >
              {loading ? "Menyimpan Password..." : "Simpan Password & Aktifkan Akun"}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-gray-100 text-center">
            <Link
              href="/admin/login"
              className="text-xs text-gray-500 hover:text-[#673ab7]"
            >
              Kembali ke Login
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0ebf8] px-4">
      <Suspense fallback={<div className="text-xs text-gray-500">Memuat formulir...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
