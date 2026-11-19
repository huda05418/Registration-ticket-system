import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email dan password wajib diisi." },
        { status: 400 }
      );
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
        { error: "Email tidak terdaftar sebagai admin." },
        { status: 401 }
      );
    }

    if (!admin.password_hash) {
      return NextResponse.json(
        {
          error:
            "Akun admin ini belum memiliki password. Silakan klik 'Lupa / Set Password' di bawah untuk menerima link aktivasi di email Anda.",
        },
        { status: 400 }
      );
    }

    const isValid = await bcrypt.compare(password, admin.password_hash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Password yang Anda masukkan salah." },
        { status: 401 }
      );
    }

    const cookieStore = cookies();
    cookieStore.set("admin_session", admin.email, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return NextResponse.json({ success: true, email: admin.email });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
