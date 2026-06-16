# 🤖 Yô lô gơ Agent Bot

Bot Zalo tích hợp AI của VNG Cloud, chạy trong group chat. Hai tính năng chính:

> 📝 **Điền hợp đồng tự động** — gửi 3 file (template Word + Excel thông tin doanh nghiệp + GPKD), bot trả về hợp đồng đã điền đầy đủ thông tin trong vài giây.

> 📋 **Tóm tắt hội thoại** — cả group họp hành, bàn tới bàn lui mà vẫn không biết kết luận là gì? Tag bot, nó đọc hết lịch sử chat rồi tóm gọn lại cho — ai nói gì, quyết định gì, việc ai cần làm. Nghiêm túc đấy, không phải bot lười đâu.

---

## 📝 Tính Năng Hợp Đồng (`/hd`)

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

## 📋 Tính Năng Tóm Tắt Hội Thoại

Tag bot trong group và yêu cầu tóm tắt — bot sẽ đọc lịch sử chat và trả về bản tóm tắt các điểm chính, quyết định, và việc cần làm.

```
@Bot tóm tắt hội thoại hôm nay
@Bot tóm tắt những gì đã bàn về dự án X
@Bot recap cuộc họp vừa rồi
```

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

Bot sẽ hiển thị **QR code trong terminal**. Mở Zalo trên điện thoại → scan QR.

> **Lần sau**: Session được lưu lại, không cần scan lại trừ khi hết hạn.

---

## ⚙️ Cấu Hình

| Biến môi trường          | Mặc định   | Mô tả                           |
|--------------------------|------------|---------------------------------|
| `AI_PLATFORM_API_KEY`    | (bắt buộc) | VNG Cloud API Key               |
| `BOT_NAME`               | `Bot`      | Tên hiển thị của bot            |
| `RATE_LIMIT_PER_MINUTE`  | `10`       | Số lần reply tối đa/user/phút   |

---

## ⚠️ Lưu Ý

> **Rủi ro tài khoản**: `zca-js` là thư viện **không chính thức**. Zalo không cho phép automation trên tài khoản cá nhân. Có nguy cơ tài khoản bị khóa. **Luôn dùng tài khoản phụ.**

---

## 📁 Cấu Trúc Project

```
zalo-ai-bot/
├── index.js              # Entry point
├── package.json
├── .env.example
└── src/
    ├── bot.js                         # Login + lắng nghe group
    ├── ai.js                          # Gọi VNG Cloud AI API
    ├── contractHandler.js             # Xử lý /hd: điền hợp đồng
    ├── contractSession.js             # Thu thập file trong 90 giây
    ├── docxFiller.js                  # Điền {placeholder} vào Word
    ├── config.js
    ├── logger.js
    └── extractors/
        ├── extractFromXLSX.js         # Đọc dữ liệu từ Excel
        ├── extractFromGPKD.js         # OCR GPKD (AI Vision)
        ├── extractFromCCCD.js         # OCR CCCD (AI Vision)
        └── extractFromGiayUyQuyen.js  # OCR giấy ủy quyền (AI Vision)
```

---

## 🛠️ Troubleshooting

**Bot không nhận tin nhắn?** — Kiểm tra session còn hiệu lực, bot đã có trong group, và đang được @mention đúng.

**Lỗi API Key?** — Kiểm tra `AI_PLATFORM_API_KEY` trong `.env` và quota còn trên VNG Cloud Console.

**`/hd` không điền được?** — Template `.docx` phải dùng đúng cú pháp `{placeholder}`, GPKD phải scan rõ nét, Excel đúng format.
