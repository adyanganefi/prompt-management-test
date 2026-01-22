# 🤖 Prompt Management System

Sistem manajemen prompt AI yang lengkap dengan fitur versioning, multi-agent, dan API integration. Dibangun dengan React + Tailwind CSS untuk frontend dan Python FastAPI + LangChain untuk backend.

## 📋 Daftar Isi

1. [Fitur Utama](#-fitur-utama)
2. [Arsitektur Sistem](#-arsitektur-sistem)
3. [Prasyarat](#-prasyarat)
4. [Instalasi & Setup](#-instalasi--setup)
5. [Menjalankan Aplikasi](#-menjalankan-aplikasi)
6. [Penggunaan](#-penggunaan)
7. [API Documentation](#-api-documentation)
8. [Struktur Folder](#-struktur-folder)

---

## ✨ Fitur Utama

### 🔐 Manajemen Project dengan Autentikasi
- Setiap project memiliki kredensial sendiri (username & password)
- Isolasi data antar project/tim - project A tidak bisa melihat project B
- Autentikasi JWT untuk keamanan

### 🤖 Multi-Agent dengan Versioning
- Buat multiple agents dalam satu project
- Setiap agent memiliki versioning (v1, v2, v3, dst.)
- Versi bersifat **immutable** - tidak bisa diubah setelah dibuat
- Preview perubahan sebelum membuat versi baru
- Bandingkan dua versi untuk melihat perbedaan
- Set versi mana yang "aktif" untuk production

### 🔑 API Key Management
- Generate multiple API keys per project
- View/hide dengan masking untuk keamanan
- Toggle aktif/nonaktif
- Tracking penggunaan terakhir

### 💬 Chat Interface
- Chat langsung dengan agent dari dashboard
- Pilih agent dan versi spesifik
- Session management
- History percakapan

### 🎨 UI Modern & Responsive
- Desain elegan dengan Tailwind CSS
- Fully responsive (mobile, tablet, desktop)
- Dark/light theme ready
- Animasi smooth

---

## 🏗 Arsitektur Sistem

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  React Frontend │◄───►│  FastAPI Backend│◄───►│   PostgreSQL    │
│  (Port 5173)    │     │  (Port 8001)    │     │   (Port 5433)   │
│                 │     │                 │     │                 │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │                 │
                        │   LangChain +   │
                        │   OpenAI API    │
                        │                 │
                        └─────────────────┘
```

---

## 📦 Prasyarat

Pastikan Anda sudah menginstal:

1. **Python 3.10+** - [Download Python](https://www.python.org/downloads/)
2. **Node.js 18+** - [Download Node.js](https://nodejs.org/)
3. **PostgreSQL** - Sudah berjalan di `localhost:5433`
   - Username: `postgres`
   - Password: `postgres`
4. **Git** (opsional) - Untuk clone repository

---

## 🚀 Instalasi & Setup

### Langkah 1: Setup Database PostgreSQL

1. Buka terminal PostgreSQL atau gunakan pgAdmin

2. Buat database baru:
```sql
CREATE DATABASE prompt_management;
```

3. Hubungkan ke database dan jalankan script inisialisasi:

**Menggunakan psql:**
```bash
# Connect ke PostgreSQL
psql -h localhost -p 5433 -U postgres

# Setelah terhubung, buat database
CREATE DATABASE prompt_management;

# Connect ke database baru
\c prompt_management

# Jalankan script init.sql
\i database/init.sql
```

**Menggunakan pgAdmin:**
1. Klik kanan pada "Databases" → "Create" → "Database"
2. Isi nama: `prompt_management`
3. Klik "Save"
4. Klik kanan pada database `prompt_management` → "Query Tool"
5. Buka file `database/init.sql`, copy semua isinya
6. Paste di Query Tool dan klik "Execute" (F5)

### Langkah 2: Setup Backend Python

1. Buka terminal dan masuk ke folder backend:
```bash
cd prompt-management-test/backend
```

2. Buat virtual environment:
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Linux/Mac
python3 -m venv venv
source venv/bin/activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

### Langkah 3: Setup Frontend React

1. Buka terminal baru dan masuk ke folder frontend:
```bash
cd prompt-management-test/frontend
```

2. Install dependencies:
```bash
npm install
```

---

## ▶️ Menjalankan Aplikasi

### Terminal 1: Jalankan Backend

```bash
cd prompt-management-test/backend

# Aktifkan virtual environment
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Jalankan server
uvicorn main:app --reload --host 127.0.0.1 --port 8001
```

Backend akan berjalan di: `http://localhost:8001`

### Terminal 2: Jalankan Frontend

```bash
cd prompt-management-test/frontend

# Jalankan development server
npm run dev
```

Frontend akan berjalan di: `http://localhost:5173`

---

## ⚙️ Kustomisasi Port, Database, dan API Path

- **Port backend (default 8001)**: ubah di [backend/app/config.py](backend/app/config.py#L14-L24) pada properti `port`, lalu sesuaikan perintah `uvicorn` jika Anda menjalankan manual. Bisa juga override via `.env` (`PORT=8001`).
- **Port frontend (default 5173)**: ubah di [frontend/vite.config.js](frontend/vite.config.js#L1-L12) pada `server.port`.
- **PostgreSQL host/port/username/password**: ubah connection string di [backend/app/config.py](backend/app/config.py#L4-L13) (`database_url` dan `database_url_sync`). Nilai dapat dioverride dengan `.env`, contoh `DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/db_name`.
- **API root path (default `/api`)**: ditentukan saat router di-include di [backend/main.py](backend/main.py#L18-L23). Jika mengubah prefix, selaraskan:
  - Proxy dev frontend di [frontend/vite.config.js](frontend/vite.config.js#L4-L12) (`'/api'` key dan `target`).
  - Base URL client di [frontend/src/api/index.js](frontend/src/api/index.js#L3-L15) (`API_BASE_URL`, default `'/api'` atau `VITE_API_BASE_URL`).

Setelah mengubah nilai di atas, restart backend dan frontend agar konfigurasi baru diterapkan.

---

## 📖 Penggunaan

### 1. Buat Project Baru

1. Buka browser dan akses `http://localhost:5173`
2. Klik "Buat Project Baru"
3. Isi form:
   - **Nama Project**: Nama untuk project Anda
   - **Deskripsi**: Penjelasan tentang project (opsional)
   - **Username**: Username untuk login tim
   - **Password**: Password untuk login (min. 6 karakter)
4. Klik "Buat Project"

### 2. Login ke Project

1. Akses `http://localhost:5173/login`
2. Masukkan username dan password project
3. Klik "Masuk"

### 3. Membuat Agent

1. Di halaman dashboard, klik "Buat Agent"
2. Isi nama dan deskripsi agent
3. Klik "Buat Agent"

### 4. Membuat Versi Agent

1. Expand agent dengan klik pada card agent
2. Klik "Versi Baru"
3. Isi konfigurasi:
   - **System Prompt**: Instruksi untuk AI
   - **Model**: Pilih model (GPT-4, GPT-3.5, dll)
   - **API Key**: API key dari OpenAI atau provider lain
   - **Base URL**: Kosongkan untuk OpenAI default
   - **Parameter lanjutan**: Temperature, Max Tokens, dll
4. Klik "Buat Versi"

### 5. Mengaktifkan Versi

1. Di list versi, klik tombol "Aktifkan" pada versi yang diinginkan
2. Versi yang aktif akan digunakan saat API call

### 6. Generate API Key

1. Buka tab "API Keys"
2. Klik "Generate API Key"
3. Beri nama untuk identifikasi
4. API key akan ditampilkan - **simpan baik-baik!**
5. Gunakan API key sebagai Bearer token untuk API calls

### 7. Chat dengan Agent

1. Buka tab "Chat"
2. Pilih agent dan versi
3. Ketik pesan dan kirim
4. Respons akan muncul dalam chat

---

## 📡 API Documentation

Setelah backend berjalan, akses dokumentasi API di:
- **Swagger UI**: `http://localhost:8001/docs`
- **ReDoc**: `http://localhost:8001/redoc`

### Catatan Autentikasi Chat API

- Gunakan **Project API Key** sebagai Bearer (`Authorization: Bearer pm_xxx`).
- JWT login **tidak diterima** untuk endpoint `/api/chat`.

### Contoh API Call untuk Chat

```bash
curl -X POST "http://localhost:8001/api/chat" \
  -H "Authorization: Bearer pm_project_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Halo, apa kabar?",
    "agent_name": "Nama Agent",            
    "version_number": 1,                   
    "session_id": "uuid-session-opsional" 
  }'
```

Keterangan payload:
- `agent_name`: nama agent (case-insensitive). Wajib diisi.
- `version_number`: nomor versi agent. Opsional; bila kosong akan memakai versi aktif.
- `session_id`: gunakan untuk melanjutkan sesi yang sudah ada. Opsional; jika dikosongkan server membuat sesi baru dan mengembalikan `session_id` baru.

### Response:
```json
{
  "response": "Halo! Saya baik-baik saja. Ada yang bisa saya bantu?",
  "session_id": "uuid-session",
  "agent_name": "Nama Agent",
  "version_number": 1,
  "prompt_tokens": 80,
  "completion_tokens": 65,
  "total_tokens": 145,
  "model_name": "gpt-4o"
}
```

---

## 📁 Struktur Folder

```
prompt-management-test/
├── backend/
│   ├── app/
│   │   ├── routers/           # API endpoints
│   │   │   ├── projects.py    # Project CRUD & auth
│   │   │   ├── agents.py      # Agents & versions
│   │   │   ├── api_keys.py    # API key management
│   │   │   └── chat.py        # Chat endpoints
│   │   ├── services/
│   │   │   └── langchain_service.py  # LangChain integration
│   │   ├── utils/
│   │   │   ├── auth.py        # JWT authentication
│   │   │   └── encryption.py  # API key encryption
│   │   ├── config.py          # App configuration
│   │   ├── database.py        # Database connection
│   │   ├── models.py          # SQLAlchemy models
│   │   └── schemas.py         # Pydantic schemas
│   ├── main.py                # FastAPI app entry
│   ├── requirements.txt       # Python dependencies
│   └── .env                   # Environment variables
│
├── frontend/
│   ├── src/
│   │   ├── api/               # API client
│   │   ├── components/
│   │   │   ├── forms/         # Form components
│   │   │   ├── tabs/          # Dashboard tabs
│   │   │   ├── Modal.jsx
│   │   │   └── LoadingSpinner.jsx
│   │   ├── context/           # React context
│   │   ├── pages/             # Page components
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css          # Tailwind styles
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── index.html
│
├── database/
│   └── init.sql               # Database initialization
│
└── README.md                  # Dokumentasi ini
```

---

## 🔧 Troubleshooting

### Error: "Could not connect to database"
- Pastikan PostgreSQL berjalan di port 5433
- Cek username dan password (`postgres`/`postgres`)
- Pastikan database `prompt_management` sudah dibuat

### Error: "Module not found"
- Backend: Pastikan virtual environment aktif dan jalankan `pip install -r requirements.txt`
- Frontend: Jalankan `npm install`

### Error: "CORS error"
- Pastikan backend berjalan di port 8001
- Cek konfigurasi CORS di `.env`

### Chat tidak bekerja
- Pastikan API key OpenAI/provider valid
- Cek model name sesuai dengan provider
- Pastikan versi agent sudah diaktifkan

---

## 📞 Support

Jika mengalami masalah atau ada pertanyaan, silakan buat issue di repository ini.

---

**Happy Prompting! 🚀**
