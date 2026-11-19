"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileText, ArrowRight, Mail } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal login admin.");
      }

      router.push("/admin/dashboard");
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Login gagal.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0ebf8] px-4">
      <div className="w-full max-w-md bg-white rounded-lg border border-gray-200 shadow-sm p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded bg-[#673ab7] flex items-center justify-center text-white">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-medium text-gray-800">Admin Formulir</h1>
            <p className="text-xs text-gray-500">Panel Pengelola Formulir Internal</p>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-xs text-red-700 leading-relaxed">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Email Terdaftar
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@emailanda.com"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-[#673ab7]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-gray-700">
                Password
              </label>
              <Link
                href="/admin/forgot-password"
                className="text-[11px] text-[#673ab7] hover:underline"
              >
                Lupa / Set Password?
              </Link>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-[#673ab7]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 px-4 bg-[#673ab7] hover:bg-[#512da8] text-white text-sm font-medium rounded transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span>{loading ? "Memverifikasi..." : "Masuk ke Panel"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-gray-100 text-center">
          <Link
            href="/admin/forgot-password"
            className="text-xs text-[#673ab7] hover:underline font-medium flex items-center justify-center gap-1.5"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Aktivasi atau buat password baru lewat email</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
