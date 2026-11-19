import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { orderId, amount, customerName, customerEmail, itemTitle } = await req.json();

    if (!orderId || !amount) {
      return NextResponse.json({ error: "orderId dan amount wajib diisi." }, { status: 400 });
    }

    const serverKey = process.env.MIDTRANS_SERVER_KEY || "";
    if (!serverKey) {
      return NextResponse.json({ error: "MIDTRANS_SERVER_KEY belum dikonfigurasi." }, { status: 500 });
    }

    const authString = Buffer.from(`${serverKey}:`).toString("base64");
    const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";
    const endpoint = isProduction
      ? "https://app.midtrans.com/snap/v1/transactions"
      : "https://app.sandbox.midtrans.com/snap/v1/transactions";

    const payload = {
      transaction_details: {
        order_id: orderId,
        gross_amount: Math.round(Number(amount)),
      },
      item_details: [
        {
          id: orderId,
          price: Math.round(Number(amount)),
          quantity: 1,
          name: (itemTitle || "Pendaftaran Formulir").substring(0, 50),
        },
      ],
      customer_details: {
        first_name: (customerName || "Peserta").substring(0, 50),
        email: customerEmail || "peserta@example.com",
      },
    };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Basic ${authString}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: data.error_messages ? data.error_messages.join(", ") : "Gagal memproses Midtrans." },
        { status: res.status }
      );
    }

    return NextResponse.json({ token: data.token, redirect_url: data.redirect_url });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
