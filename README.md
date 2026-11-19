# Sistem Formulir, Registrasi & Komunitas Realtime

Aplikasi formulir interaktif mandiri yang memadukan pengalaman pembuatan formulir ala Google Forms dengan sistem pembayaran digital Midtrans, autentikasi akun Google terverifikasi, dan ruang diskusi komunitas realtime dua arah.

---

## 👥 Tim Pengembang (Kelompok)
* **25103041072** - Hisam Zacky Aqmar
* **25103041073** - Abil Khoiri Hmmad
* **25103041079** - Muhammad Nurul Huda

---

## 🚀 Fitur Utama

1. **Dashboard & Form Builder Mandiri (Ala Google Forms)**:
   * Pembuatan formulir kustom: .
   * Pengaturan harga pendaftaran 
   * Link publik unik per formulir yang siap dibagikan.

2. **Autentikasi Akun Google untuk Peserta**:
   * Merekam identitas nama dan email Google peserta secara otomatis untuk mencegah manipulasi data.

3. **Integrasi Pembayaran Midtrans Snap**:
   * Multi-metode pembayaran 
 

4. **Ruang Peserta & Komunitas Realtime (Supabase Realtime)**:
   * **2 Channel Diskusi**:
     * 📢 **Announcement**: Siaran informasi resmi satu arah khusus Admin.
     * 💬 **Public Chat**: Forum diskusi teks realtime antar peserta acara.

5. **Sistem Keamanan Admin via Email Whitelist & SMTP**:
   * Admin hanya didaftarkan melalui whitelist email di database.
   * Aktivasi dan reset password dikirimkan melalui tautan aman via SMTP Gmail.
   * Akses URL admin tersembunyi dari publik (`/admin/login`).

