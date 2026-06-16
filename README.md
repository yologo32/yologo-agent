# 🤖 Zalo AI Bot

Bot Zalo cá nhân tích hợp AI của VNG Cloud. Khi bị tag trong group, bot sẽ trả lời theo phong cách bạn chọn — Gen Z, châm biếm, khịa, cà khịa hoặc nghiêm túc — hoàn toàn bằng **tiếng Việt**.

---

## ✨ Tính năng

- Lắng nghe tin nhắn trong **Zalo Group**
- Phát hiện khi bị **tag/mention**
- Hỗ trợ **5 phong cách trả lời** khác nhau
- Tích hợp **VNG Cloud AI** (model `google/gemma-4-31b-it`)
- **Điền hợp đồng tự động** từ file GPKD, CCCD và dữ liệu Excel
- Rate limiting để tránh spam
- Lưu session đăng nhập (không cần scan QR lại sau lần đầu)

---

## 📝 Tính Năng Hợp Đồng (`/hd`)

Tính năng nổi bật: tự động điền thông tin doanh nghiệp vào template hợp đồng Word chỉ với một lệnh.

### Cách dùng

Gõ `/hd` trong group, sau đó gửi 3 file bắt buộc (trong vòng 90 giây):

| File | Định dạng | Nội dung |
|------|-----------|----------|
| Template hợp đồng | `.docx` | File Word có `{placeholder}` |
| Thông tin doanh nghiệp | `.xlsx` | STK, email, người liên hệ... |
| Giấy phép kinh doanh | `.pdf` | GPKD (bot đọc bằng AI Vision) |

File CCCD và Giấy ủy quyền là **tuỳ chọn** — gửi kèm nếu có.

### Bot tự động trích xuất

- 🏢 Tên công ty, địa chỉ, mã số thuế
- 👤 Người đại diện pháp luật, chức vụ
- 🏦 Số tài khoản, ngân hàng, tên chủ TK
- 📞 Hotline, email
- 👥 Bảng liên hệ 4 đầu mối: phụ trách hợp đồng, kỹ thuật, quan hệ khách hàng, thanh toán
- 🏪 Danh sách cửa hàng (nếu có)

### Placeholder template

Template `.docx` sử dụng cú pháp `{ten_truong}`:

```
{ten_ben_a}        → Tên công ty
{dia_chi_ben_a}    → Địa chỉ
{ma_so_thue}       → Mã số thuế
{dai_dien}         → Người đại diện
{chuc_vu}          → Chức vụ
{giay_uy_quyen}    → Số giấy ủy quyền (nếu có)
{so_tai_khoan}     → Số tài khoản ngân hàng
{ngan_hang}        → Tên ngân hàng
{ten_chu_tk}       → Tên chủ tài khoản
{hotline}          → Hotline
{email}            → Email

{ct_hd_ten/cv/email/sdt}   → Phụ trách hợp đồng
{ct_kt_ten/cv/email/sdt}   → Phụ trách kỹ thuật
{ct_kh_ten/cv/email/sdt}   → Phụ trách quan hệ KH
{ct_tt_ten/cv/email/sdt}   → Phụ trách thanh toán
```

---

## 🎭 Các Tone Hỗ Trợ

| Keyword    | Phong cách                              | Emoji |
|------------|-----------------------------------------|-------|
| `[genz]`   | Gen Z Việt Nam, từ lóng hiện hành       | ✨    |
| `[cb]`     | Châm biếm, mỉa mai tinh tế             | 🎭    |
| `[kkk]`    | Khịa thẳng, đá đểu nhưng không tục tĩu | 🗿    |
| `[mama]`   | Cà khịa dí dỏm, hài hước               | 😅    |
| `[serious]`| Nghiêm túc, chuyên nghiệp              | 💼    |

> **Mặc định**: Nếu không ghi tone, bot dùng `[genz]`

---

## 📋 Yêu cầu

- **Node.js** >= 18.0.0
- **Tài khoản Zalo phụ** (⚠️ không dùng tài khoản chính!)
- **VNG Cloud AI API Key**

---

## 🚀 Cài Đặt

### 1. Clone / Download project

```bash
cd zalo-ai-bot
```

### 2. Cài dependencies

```bash
npm install
```

### 3. Cấu hình `.env`

```bash
# Copy file mẫu
copy .env.example .env
```

Mở file `.env` và điền thông tin:

```env
AI_PLATFORM_API_KEY=your_vng_cloud_api_key_here
BOT_NAME=TenBot
RATE_LIMIT_PER_MINUTE=10
```

> **Lấy API Key**: Đăng nhập [VNG Cloud AI Platform](https://aiplatform.console.vngcloud.vn/) → API Keys

### 4. Chạy bot

```bash
npm start
```

Bot sẽ hiển thị **QR code trong terminal**. Mở Zalo trên điện thoại:
- **Android**: Trang chủ → Biểu tượng QR góc trên phải
- **iOS**: Cài đặt → QR Code

Scan xong, bot sẽ tự động login và bắt đầu lắng nghe.

> **Lần sau**: Session được lưu vào `zalo_session.json`, không cần scan lại trừ khi session hết hạn.

---

## 💬 Cách Sử Dụng

Trong **Zalo group** có bot, tag bot kèm câu hỏi:

```
@Bot [genz] Deadline là gì vậy?
@Bot [cb] Tại sao sếp hay cancel meeting?
@Bot [kkk] Sao phải làm overtime?
@Bot [mama] Explain KPI cho tôi với
@Bot [serious] Phân tích điểm mạnh yếu của mô hình OKR
@Bot Cà phê uống nhiều có tốt không?   ← mặc định dùng genz
```

---

## ⚙️ Cấu Hình Nâng Cao

| Biến môi trường          | Mặc định | Mô tả                           |
|--------------------------|----------|---------------------------------|
| `AI_PLATFORM_API_KEY`    | (bắt buộc) | VNG Cloud API Key             |
| `BOT_NAME`               | `Bot`    | Tên hiển thị của bot            |
| `RATE_LIMIT_PER_MINUTE`  | `10`     | Số lần reply tối đa/user/phút   |

---

## ⚠️ Lưu Ý Quan Trọng

> **Rủi ro tài khoản**: `zca-js` là thư viện **không chính thức**. Zalo không cho phép automation trên tài khoản cá nhân. Có nguy cơ tài khoản bị khóa. **Luôn dùng tài khoản phụ**, không dùng tài khoản chính.

- Bot chỉ reply trong **group**, không reply DM cá nhân
- Bot chỉ reply khi được **@mention** trực tiếp
- Giữ `zalo_session.json` bảo mật (đã có trong `.gitignore`)

---

## 📁 Cấu Trúc Project

```
zalo-ai-bot/
├── index.js              # Entry point
├── package.json
├── .env.example          # Template cấu hình
├── .env                  # Cấu hình thực (không commit)
├── .gitignore
└── src/
    ├── bot.js                      # Logic chính: login + lắng nghe
    ├── ai.js                       # Gọi VNG Cloud AI API
    ├── contractHandler.js          # Xử lý lệnh /hd: điền hợp đồng
    ├── contractSession.js          # Thu thập file trong 90 giây
    ├── docxFiller.js               # Điền {placeholder} vào Word template
    ├── tones.js                    # Định nghĩa phong cách trả lời
    ├── messageParser.js            # Phân tích tin nhắn, detect mention
    ├── rateLimiter.js              # Giới hạn số request mỗi phút
    ├── config.js                   # Cấu hình tập trung
    ├── logger.js                   # Logger màu sắc
    └── extractors/
        ├── extractFromXLSX.js      # Đọc dữ liệu từ file Excel
        ├── extractFromGPKD.js      # OCR giấy phép kinh doanh (AI Vision)
        ├── extractFromCCCD.js      # OCR CCCD (AI Vision)
        └── extractFromGiayUyQuyen.js  # OCR giấy ủy quyền (AI Vision)
```

---

## 🛠️ Troubleshooting

**Bot không nhận được tin nhắn?**
- Đảm bảo bot đã được thêm vào group
- Kiểm tra `zalo_session.json` có tồn tại không
- Thử xóa session và scan QR lại

**Lỗi API Key?**
- Kiểm tra `AI_PLATFORM_API_KEY` trong `.env`
- Đảm bảo key còn quota trên VNG Cloud Console

**`/hd` không điền được thông tin?**
- Đảm bảo template `.docx` dùng đúng cú pháp `{placeholder}` (không có dấu cách bên trong)
- File GPKD phải là PDF scan rõ nét để AI đọc được
- Kiểm tra file Excel có đúng cột theo format mẫu không
