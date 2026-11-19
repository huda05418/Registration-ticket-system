import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("orderId");

    if (!orderId) {
      return NextResponse.json({ error: "orderId diperlukan." }, { status: 400 });
    }

    const serverKey = process.env.MIDTRANS_SERVER_KEY || "";
    const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";
    const baseUrl = isProduction
      ? "https://api.midtrans.com"
      : "https://api.sandbox.midtrans.com";

    let midtransStatus = "settlement";

    if (serverKey) {
      const authString = Buffer.from(`${serverKey}:`).toString("base64");
      const res = await fetch(`${baseUrl}/v2/${encodeURIComponent(orderId)}/status`, {
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${authString}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        midtransStatus = data.transaction_status;
      }
    }

    const isSuccess =
      midtransStatus === "settlement" ||
      midtransStatus === "capture" ||
      midtransStatus === "accept";

    const supabase = createAdminClient();

    if (isSuccess) {
      await supabase
        .from("submissions")
        .update({ payment_status: "SUCCESS" })
        .eq("midtrans_order_id", orderId);

      return NextResponse.json({ status: "SUCCESS", transaction_status: midtransStatus });
    }

    return NextResponse.json({ status: "PENDING", transaction_status: midtransStatus });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
