-- ============================================================================
-- SKEMA LENGKAP DARI AWAL (BERSIH TOTAL)
-- SISTEM FORMULIR, REGISTRASI & CHAT REALTIME
-- ============================================================================

-- 1. HAPUS TABEL LAMA DULU AGAR TIDAK ADA KONFLIK
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS submissions CASCADE;
DROP TABLE IF EXISTS form_fields CASCADE;
DROP TABLE IF EXISTS forms CASCADE;
DROP TABLE IF EXISTS admins CASCADE;

-- 2. AKTIFKAN EXTENSION UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 3. TABEL ADMINS (Sistem Whitelist Email Admin & Reset Password via SMTP)
CREATE TABLE admins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    reset_token VARCHAR(255),
    reset_token_expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. TABEL FORMS (Data Formulir yang dibuat Admin)
CREATE TABLE forms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL DEFAULT 'Formulir tanpa judul',
    description TEXT DEFAULT '',
    slug VARCHAR(255) UNIQUE NOT NULL,
    is_paid BOOLEAN DEFAULT false,
    price NUMERIC(12, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. TABEL FORM_FIELDS (Pertanyaan Dinamis ala Google Form)
CREATE TABLE form_fields (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID REFERENCES forms(id) ON DELETE CASCADE NOT NULL,
    label VARCHAR(255) NOT NULL DEFAULT 'Pertanyaan tanpa judul',
    type VARCHAR(50) NOT NULL DEFAULT 'text',
    options JSONB DEFAULT '[]'::jsonb,
    required BOOLEAN DEFAULT false,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. TABEL SUBMISSIONS (Data Rekam Tanggapan Peserta & Status Pembayaran)
CREATE TABLE submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID REFERENCES forms(id) ON DELETE CASCADE NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    user_avatar TEXT DEFAULT '',
    responses JSONB NOT NULL DEFAULT '{}'::jsonb,
    payment_status VARCHAR(50) DEFAULT 'SUCCESS' NOT NULL,
    midtrans_order_id VARCHAR(255) UNIQUE,
    amount NUMERIC(12, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. TABEL CHAT_MESSAGES (Ruang Chat Komunitas Realtime 2 Channel)
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID REFERENCES forms(id) ON DELETE CASCADE NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    channel_type VARCHAR(50) NOT NULL DEFAULT 'public',
    message TEXT NOT NULL,
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. INDEX QUERY PERFORMA
CREATE INDEX idx_forms_slug ON forms(slug);
CREATE INDEX idx_form_fields_form_id ON form_fields(form_id);
CREATE INDEX idx_submissions_form_user ON submissions(form_id, user_email);
CREATE INDEX idx_chat_messages_form_channel ON chat_messages(form_id, channel_type, created_at);

-- 9. PUBLIKASI REALTIME (SUPABASE REALTIME CHANNELS)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'chat_messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'submissions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE submissions;
    END IF;
END $$;

-- 10. CONTOH DAFTARKAN EMAIL ADMIN PERTAMA (Ganti dengan email asli Anda):
-- INSERT INTO admins (email) VALUES ('emailanda@gmail.com');
