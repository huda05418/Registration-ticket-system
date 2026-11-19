import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  const cookieStore = cookies();
  cookieStore.delete("admin_session");
  return NextResponse.json({ success: true });
}

export async function GET() {
  const cookieStore = cookies();
  const session = cookieStore.get("admin_session");
  if (!session?.value) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true, username: session.value });
}
