# Nộp Bài — Yô lô gơ Agent Bot

---

## Bài Mô Tả Ngắn (300 từ)

**Yô lô gơ Agent Bot** là AI agent chạy trong Zalo group chat, tích hợp VNG Cloud AI Platform, giải quyết hai bài toán thực tế trong môi trường doanh nghiệp: tự động hoá điền hợp đồng và tóm tắt hội thoại nhóm.

**Tính năng 1: Điền hợp đồng tự động (`/hd`)**

Nhân viên gõ `/hd` trong group, sau đó gửi 3 file: template hợp đồng Word (`.docx` có placeholder), bảng thông tin doanh nghiệp Excel (`.xlsx`), và ảnh scan Giấy phép kinh doanh (`.pdf`). Bot xử lý song song:

- Đọc dữ liệu có cấu trúc từ Excel (tên công ty, MST, STK, email, 4 đầu mối liên hệ...)
- Dùng AI Vision (Gemma 4 31B) OCR Giấy phép kinh doanh để trích xuất thông tin pháp lý
- Điền tự động 26 placeholder vào template Word
- Trả file hợp đồng đã hoàn chỉnh ngay trong group

Toàn bộ luồng hoàn thành trong vài chục giây, thay thế công việc copy-paste thủ công mất 15-30 phút mỗi hợp đồng.

**Tính năng 2: Tóm tắt hội thoại**

Bot lắng nghe và lưu lịch sử chat nhóm trong RAM (tối đa 100 tin, cửa sổ 24h). Khi thành viên tag bot hoặc nhắn các từ khoá như "tóm tắt", "recap", "mn đang nói gì", "chuyện gì vậy" — bot tổng hợp toàn bộ cuộc hội thoại bằng AI và trả về bản tóm tắt ngắn gọn: ai nói gì, quyết định gì, việc cần làm.

**Kiến trúc**

- Runtime: Node.js 18, ES Modules, zca-js (Zalo unofficial API)
- AI: VNG Cloud AI Platform, model `google/gemma-4-31b-it` (vision + text)
- Deploy: Docker, VNG Cloud Container Registry
- Không lưu dữ liệu bền vững — hội thoại chỉ giữ trong RAM, không log ra ngoài

**Giá trị thực tế**: Giảm thời gian soạn hợp đồng từ 30 phút xuống dưới 1 phút; giúp thành viên bắt kịp nội dung cuộc họp mà không cần đọc lại toàn bộ chat.

---

## Gợi ý nội dung Video Demo

Quay màn hình (~2-3 phút), bao gồm:

1. **[0:00-0:20]** Giới thiệu bot đang chạy trong group Zalo
2. **[0:20-1:20]** Demo `/hd`:
   - Gõ `/hd` → bot xác nhận, yêu cầu gửi file
   - Gửi 3 file (docx + xlsx + pdf GPKD)
   - Bot báo tiến trình → trả file hợp đồng đã điền xong
   - Mở file Word, zoom vào các placeholder đã được điền
3. **[1:20-2:00]** Demo tóm tắt:
   - Chat một vài tin trong group
   - Tag bot: `@Bot tóm tắt những gì đã bàn`
   - Bot trả về bản tóm tắt
4. **[2:00-2:30]** Kết: show Docker logs, highlight VNG Cloud AI Platform

> Tip: Chuẩn bị sẵn 3 file mẫu trước khi quay để demo trơn tru.
