<div align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-blue.svg" alt="Version">
  <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License">
  <img src="https://img.shields.io/badge/powered%20by-Gemini%20%7C%20OpenAI%20%7C%20DeepSeek-orange" alt="AI Engine">
</div>

# 🧠 AI CV Screening Assistant

**Hệ thống hỗ trợ sàng lọc hồ sơ ứng viên bằng AI — tự động, thông minh, tiết kiệm 80-90% thời gian tuyển dụng.**

---

## 📋 Tổng quan

Công cụ giúp doanh nghiệp SME tập trung toàn bộ CV từ nhiều kênh (Tally Form, upload trực tiếp, Facebook, Zalo, Email...) về một đầu mối, tự động đọc và phân tích bằng AI, đưa ra khuyến nghị tuyển dụng.

### Vấn đề giải quyết

| Trước khi áp dụng | Sau khi áp dụng |
|---|---|
| 200 CV/tháng × 5 phút = 16,7 giờ | 200 CV/tháng × 30 giây = 1,7 giờ |
| Hồ sơ phân tán nhiều kênh | Tập trung một đầu mối |
| Thiếu tiêu chuẩn đánh giá | AI đánh giá nhất quán |
| Dễ bỏ sót ứng viên | Theo dõi lịch sử đầy đủ |

### ✨ Tính năng chính

- **📥 Tiếp nhận hồ sơ** — Tally Form webhook + Upload CV trực tiếp (PDF/DOCX)
- **🤖 AI Screening** — Phân tích CV, so sánh với JD, đưa ra khuyến nghị (Gemini / OpenAI / DeepSeek)
- **📊 Dashboard** — Thống kê trực quan, danh sách ứng viên, Kanban board
- **📨 Thông báo** — Telegram + Email (SMTP)
- **⚡ Xử lý bất đồng bộ** — Queue pipeline với BullMQ + Redis

---

## 🏗️ Kiến trúc hệ thống

```
Ứng viên → Tally Form / Upload
                ↓
         Fastify API Server
                ↓
         BullMQ Queue (Redis)
        ┌───────┼───────┐
        ↓       ↓       ↓
   CV Parser  AI Engine  Notifications
   (PDF/DOCX) (Gemini)   (Telegram/Email)
        ↓       ↓       ↓
         PostgreSQL (Supabase)
                ↓
          Dashboard SPA
```

---

## 🚀 Bắt đầu nhanh

### Yêu cầu

- [Node.js](https://nodejs.org/) ≥ 18
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (cho Redis)
- Tài khoản [Supabase](https://supabase.com/) (free tier đủ dùng)
- API Key AI (Gemini / OpenAI / DeepSeek)

### 1. Clone & cài đặt

```bash
git clone https://github.com/Dennisnguyenexport/AI_CV-Screening-Assistant.git
cd AI_CV-Screening-Assistant
npm install
```

### 2. Cấu hình môi trường

Copy file `.env.example` thành `.env` và điền các thông tin:

```bash
cp .env.example .env
```

Nội dung `.env`:

```env
# ===== Supabase =====
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here

# ===== Redis (Docker) =====
REDIS_HOST=localhost
REDIS_PORT=6379

# ===== AI Engine =====
AI_PROVIDER=gemini          # gemini | openai | deepseek
GEMINI_API_KEY=your-key     # or OPENAI_API_KEY / DEEPSEEK_API_KEY

# ===== Telegram (optional) =====
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHAT_ID=your-chat-id

# ===== Email (optional) =====
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASS=your-password
EMAIL_FROM=noreply@cvscreening.ai

# ===== Server =====
PORT=3000
HOST=0.0.0.0
NODE_ENV=development
```

### 3. Chạy Redis

```bash
docker compose up -d redis
```

### 4. Khởi tạo Database

Mở **Supabase Dashboard** → **SQL Editor** ([link](https://supabase.com/dashboard/project/your-project/sql/new)) và chạy nội dung file `src/database/migrate.sql`.

### 5. Khởi động server

```bash
npm run dev
```

Server sẽ chạy tại `http://localhost:3000`.

### 6. Expose ra internet (Tùy chọn)

Dùng Cloudflare Tunnel để nhận webhook từ Tally Form:

```bash
# Cài cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
cloudflared tunnel --url http://localhost:3000
```

Output sẽ hiện URL dạng `https://random-words.trycloudflare.com`.

---

## 🖥️ API Endpoints

### Health Check

```http
GET /api/health
```

Response:
```json
{ "status": "ok", "timestamp": "2024-01-01T00:00:00Z", "version": "1.0.0" }
```

### Danh sách công việc

```http
GET /api/jobs
```

Trả về danh sách vị trí tuyển dụng đang active.

### Thống kê Dashboard

```http
GET /api/stats
```

Response:
```json
{
  "total_candidates": 10,
  "new": 3,
  "screening": 1,
  "screened": 4,
  "shortlisted": 1,
  "interview": 1,
  "rejected": 0,
  "hired": 0
}
```

### Danh sách ứng viên

```http
GET /api/applications
GET /api/applications?status=new
GET /api/applications?limit=20&offset=0
```

### Chi tiết ứng viên

```http
GET /api/applications/:id
```

### Cập nhật trạng thái

```http
PATCH /api/applications/:id/status
Content-Type: application/json

{ "status": "interview", "notes": "Đã liên hệ lịch PV" }
```

### Upload CV trực tiếp

```http
POST /api/cv/upload
Content-Type: multipart/form-data

file: [PDF/DOCX file]
full_name: "Nguyễn Văn A"
email: "a@example.com"
phone: "0901234567"
job_id: "optional-job-uuid"
```

### Webhook từ Tally Form

```http
POST /webhook/tally
Content-Type: application/json

{
  "formId": "...",
  "formName": "Ứng tuyển",
  "submissionId": "...",
  "fields": [
    { "key": "full_name", "label": "Họ tên", "type": "INPUT_TEXT", "value": "Nguyễn Văn A" },
    { "key": "email", "label": "Email", "type": "INPUT_EMAIL", "value": "a@example.com" },
    { "key": "cv", "label": "CV", "type": "FILE_UPLOAD", "value": "https://..." }
  ]
}
```

---

## 📊 Dashboard

Truy cập `http://localhost:3000/dashboard` để xem giao diện quản lý:

- **Thống kê** — Tổng CV, mới, đã sàng lọc, phỏng vấn
- **Danh sách ứng viên** — Filter theo trạng thái
- **Tự động refresh** — 30 giây/lần

---

## 🗄️ Database Schema

### `candidates`
| Column | Type | Description |
|---|---|---|
| id | UUID | PK |
| full_name | TEXT | Họ tên |
| email | TEXT | Email |
| phone | TEXT | Số điện thoại |
| cv_file_url | TEXT | Link file CV |
| cv_raw_text | TEXT | Nội dung CV đã parse |
| source | TEXT | tally, upload, email, zalo... |
| source_meta | JSONB | Metadata bổ sung |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### `jobs`
| Column | Type | Description |
|---|---|---|
| id | UUID | PK |
| title | TEXT | Tên vị trí |
| department | TEXT | Phòng ban |
| description | TEXT | Mô tả công việc |
| requirements | TEXT | Yêu cầu |
| is_active | BOOLEAN | Đang tuyển? |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### `applications`
| Column | Type | Description |
|---|---|---|
| id | UUID | PK |
| candidate_id | UUID | FK → candidates |
| job_id | UUID | FK → jobs |
| status | ENUM | new → screening → screened → shortlisted → interview → offered → hired / rejected / withdrawn |
| notes | TEXT | Ghi chú |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### `screenings`
| Column | Type | Description |
|---|---|---|
| id | UUID | PK |
| application_id | UUID | FK → applications |
| ai_provider | TEXT | gemini / openai / deepseek |
| recommendation | TEXT | interview / shortlist / review / reject |
| score | INTEGER | 0-100 |
| summary | TEXT | Tóm tắt |
| strengths | TEXT[] | Điểm mạnh |
| weaknesses | TEXT[] | Điểm yếu |
| risks | TEXT[] | Rủi ro |
| skills_match | JSONB | Kỹ năng phù hợp |
| raw_output | TEXT | Output gốc từ AI |
| processing_time_ms | INTEGER | Thời gian xử lý |

### `notifications`
| Column | Type | Description |
|---|---|---|
| id | UUID | PK |
| application_id | UUID | FK → applications |
| channel | TEXT | telegram / email |
| to_address | TEXT | Địa chỉ gửi |
| subject | TEXT | Tiêu đề |
| body | TEXT | Nội dung |
| status | TEXT | pending / sent / failed |
| error | TEXT | Lỗi nếu failed |

---

## 🤖 AI Engines

Hỗ trợ 3 provider, cấu hình qua biến môi trường `AI_PROVIDER`:

| Provider | Mô hình | API Key |
|---|---|---|
| **Gemini** (mặc định) | `gemini-2.0-flash` | [Google AI Studio](https://aistudio.google.com/apikey) |
| **OpenAI** | `gpt-4o-mini` | [OpenAI Platform](https://platform.openai.com/api-keys) |
| **DeepSeek** | `deepseek-chat` | [DeepSeek Platform](https://platform.deepseek.com/) |

### Gemini Free Tier

- 60 requests/phút
- Không cần thẻ tín dụng
- Đủ dùng cho MVP

---

## 🐳 Docker

### Development

```bash
docker compose up -d redis   # Chỉ Redis
docker compose up            # Cả App + Redis
```

### Production

```yaml
# docker-compose.yml
services:
  redis:
    image: redis:7-alpine
    restart: unless-stopped

  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
      - REDIS_HOST=redis
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
    depends_on:
      - redis
```

---

## 📈 Pipeline xử lý

Khi có CV mới, hệ thống tự động chạy pipeline:

```
1. Tiếp nhận (Webhook / Upload)
         ↓
2. Parse CV (PDF/DOCX → text)
         ↓
3. AI Screening (Phân tích + Khuyến nghị)
         ↓
4. Lưu kết quả (Supabase)
         ↓
5. Thông báo (Telegram / Email)
         ↓
6. Dashboard cập nhật (realtime)
```

Mỗi bước chạy bất đồng bộ qua **BullMQ Queue**, tự động retry khi thất bại.

---

## 🔧 Cấu trúc thư mục

```
cv-screening-assistant/
├── src/
│   ├── index.ts              # Entry point
│   ├── config/               # Config (.env)
│   ├── types/                # TypeScript types
│   ├── database/             # Supabase client + migration
│   ├── routes/               # API endpoints
│   ├── parser/               # CV parser (PDF/DOCX)
│   ├── ai/                   # AI Engine
│   ├── queue/                # BullMQ pipeline
│   └── notifications/        # Telegram + Email
├── public/
│   └── dashboard.html        # SPA Dashboard
├── scripts/
│   └── run-migration.ts      # DB migration script
├── docker-compose.yml        # Docker services
├── Dockerfile                # App container
├── package.json
└── tsconfig.json
```

---

## 📝 Kế hoạch phát triển

| Phase | Tính năng | Trạng thái |
|---|---|---|
| **Sprint 1** | Tally webhook + CV Parser + Telegram | ✅ Hoàn thành |
| **Sprint 2** | AI Screening + Candidate DB | ✅ Hoàn thành |
| **Sprint 3** | Dashboard + Kanban | ✅ Hoàn thành |
| **Sprint 4** | Logging + Monitoring + Security | ⏳ Chuẩn bị |
| **Tương lai** | Zalo OA, Email, Multi-tenant, ATS | 📅 Lên kế hoạch |

---

## 💰 Chi phí vận hành (MVP)

| Hạng mục | Chi phí | Ghi chú |
|---|---|---|
| Supabase | Miễn phí | Free tier 500MB DB |
| Redis (Docker) | Miễn phí | Local |
| Gemini API | Miễn phí | 60 req/phút |
| Cloudflare Tunnel | Miễn phí | trycloudflare.com |
| Hosting (VPS) | ~$5-10/tháng | 2 CPU / 2GB RAM |
| **Tổng** | **~$5-10/tháng** | |

---

## 🤝 Đóng góp

Mọi đóng góp đều được hoan nghênh!

1. Fork project
2. Tạo branch mới: `git checkout -b feature/amazing-feature`
3. Commit: `git commit -m 'Add amazing feature'`
4. Push: `git push origin feature/amazing-feature`
5. Tạo Pull Request

---

## 📄 Giấy phép

MIT License — xem [LICENSE](LICENSE) để biết thêm chi tiết.

---

## 🙏 Cảm ơn

- [Supabase](https://supabase.com/) — Database + Auth
- [Fastify](https://fastify.dev/) — Web framework
- [BullMQ](https://bullmq.io/) — Queue system
- [Google Gemini](https://deepmind.google/technologies/gemini/) — AI Engine
- [Cloudflare](https://cloudflare.com/) — Tunnel

---

<div align="center">
  Made with ❤️ by <a href="https://github.com/teslanokolas">Dennis Nguyen</a>
</div>
