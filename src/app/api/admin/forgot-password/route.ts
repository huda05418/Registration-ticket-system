import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { sendPasswordResetEmail } from "@/lib/mailer";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email wajib diisi." }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const supabase = createAdminClient();

    const { data: admin, error } = await supabase
      .from("admins")
      .select("*")
      .eq("email", cleanEmail)
      .single();

    if (error || !admin) {
      return NextResponse.json(
        { error: "Email ini tidak terdaftar sebagai admin di sistem." },
        { status: 404 }
      );
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const { error: updateError } = await supabase
      .from("admins")
      .update({
        reset_token: token,
        reset_token_expires_at: expiresAt,
      })
      .eq("id", admin.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    const origin = req.headers.get("origin") || "http://localhost:3000";
    const resetLink = `${origin}/admin/reset-password?token=${token}`;

    await sendPasswordResetEmail(cleanEmail, resetLink);

    return NextResponse.json({
      success: true,
      message: `Tautan pengaturan password telah dikirim ke ${cleanEmail}. Periksa kotak masuk atau spam email Anda.`,
    });
  } catch (err: any) {
    console.error("[Forgot Password Error]:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
