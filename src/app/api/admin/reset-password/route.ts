import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const { token, newPassword } = await req.json();

    if (!token || !newPassword) {
      return NextResponse.json(
        { error: "Token dan password baru wajib diisi." },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "Password minimal terdiri dari 6 karakter." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data: admin, error } = await supabase
      .from("admins")
      .select("*")
      .eq("reset_token", token)
      .single();

    if (error || !admin) {
      return NextResponse.json(
        { error: "Token tidak valid atau sudah digunakan." },
        { status: 400 }
      );
    }

    if (
      admin.reset_token_expires_at &&
      new Date(admin.reset_token_expires_at) < new Date()
    ) {
      return NextResponse.json(
        { error: "Token sudah kadaluarsa. Silakan minta tautan baru." },
        { status: 400 }
      );
    }

    const hash = await bcrypt.hash(newPassword, 10);

    const { error: updateError } = await supabase
      .from("admins")
      .update({
        password_hash: hash,
        reset_token: null,
        reset_token_expires_at: null,
      })
      .eq("id", admin.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return NextResponse.json({
      success: true,
      message: "Password berhasil disimpan! Silakan login.",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
