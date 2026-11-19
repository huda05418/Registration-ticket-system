import nodemailer from "nodemailer";

export function getTransporter() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    throw new Error("SMTP_USER atau SMTP_PASS belum dikonfigurasi di environment!");
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "465", 10),
    secure: true,
    auth: {
      user: user,
      pass: pass.replace(/\s+/g, ""),
    },
  });
}

export async function sendPasswordResetEmail(to: string, resetLink: string) {
  const transporter = getTransporter();

  const mailOptions = {
    from: `"Admin Portal" <${process.env.SMTP_USER}>`,
    to: to,
    subject: "Tautan Pengaturan / Reset Password Admin",
    html: `
      <div style="font-family: Arial, sans-serif; background-color: #f0ebf8; padding: 24px; color: #202124;">
        <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; border: 1px solid #e0e0e0; padding: 24px;">
          <h2 style="color: #673ab7; margin-top: 0; font-size: 20px;">Pengaturan Akun Admin</h2>
          <p style="font-size: 14px; line-height: 1.5; color: #3c4043;">
            Email Anda telah terdaftar sebagai pengelola (Admin) pada Sistem Formulir. Klik tombol di bawah ini untuk membuat atau mereset password akun Anda:
          </p>
          <div style="text-align: center; margin: 28px 0;">
            <a href="${resetLink}" style="background-color: #673ab7; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 4px; font-weight: bold; font-size: 14px; display: inline-block;">
              Atur Password Admin
            </a>
          </div>
          <p style="font-size: 12px; color: #70757a; line-height: 1.4;">
            Tautan ini berlaku selama 1 jam. Jika Anda tidak merasa meminta tautan ini, silakan abaikan email ini.
          </p>
          <hr style="border: none; border-top: 1px solid #eeeeee; margin: 20px 0;" />
          <p style="font-size: 11px; color: #9aa0a6;">
            Jika tombol di atas tidak dapat diklik, salin dan tempel URL berikut di browser Anda:<br />
            <a href="${resetLink}" style="color: #673ab7;">${resetLink}</a>
          </p>
        </div>
      </div>
    `,
  };

  return transporter.sendMail(mailOptions);
}
