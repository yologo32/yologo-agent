# Zalo AI Bot — Context for New Conversation

## Project location
`C:\Users\VNG\.gemini\antigravity\scratch\zalo-ai-bot`

## Current version
`1.3.7`

## Docker image
Registry: `vcr.vngcloud.vn/111480-abp111819/zalo-ai-bot`

---

## Standing rules (NEVER break these)

1. **Always split `docker build` and `docker push` into 2 separate lines** — never chain with `&&`
2. **Always bump VERSION** when making any code change
3. **Test command format** (separate lines, NO `&&`, Windows terminal):
```
docker run -d --rm --env-file .env --name zalo-bot-test {image}
timeout /t 10 /nobreak
docker logs zalo-bot-test
docker stop zalo-bot-test
```

---

## Tech stack
- Node.js 18, ES Modules (`"type": "module"`)
- `zca-js` — Zalo unofficial API
- VNG Cloud AI Platform (OpenAI-compatible endpoint)
- Model: `google/gemma-4-31b-it` (vision + text)
- Docker, VNG Cloud Container Registry
- No persistent storage — all in-memory

---

## Bot features

### 1. `/hd` — Contract auto-fill
- User sends `/hd` in group → bot waits 90s for files
- Required: `.docx` template + `.xlsx` info + `.pdf` GPKD
- Optional: CCCD image + Giấy ủy quyền PDF
- Bot OCRs GPKD (AI Vision), reads XLSX, fills 26 placeholders in Word template
- Sends filled `.docx` back in group
- Authorization: `CONTRACT_ALLOW_ALL=true` in `.env` → all group members can use; otherwise only `BOT_OWNER_IDS` and `CONTRACT_IDS`

### 2. Summary — Tóm tắt hội thoại
- Bot listens to all group messages, stores in RAM (max 100 msgs, 24h window)
- Triggered by: @mention OR keywords (`tóm tắt`, `hóng`, `chuyện gì vậy`, etc.)
- AI generates 1-2 sentence summary in Vietnamese slang
- If history < 2 messages: replies "Group có ai chat gì đâu mà tóm tắt má!"
- Rate limited per user

---

## File structure
```
zalo-ai-bot/
├── index.js              # Entry point, HTTP server port 8080 (dashboard + health)
├── VERSION               # Current: 1.3.7
├── .env                  # (gitignored) AI_PLATFORM_API_KEY, BOT_NAME, BOT_OWNER_IDS, CONTRACT_ALLOW_ALL, etc.
├── .env.example
├── .gitignore
├── Dockerfile
├── docker-compose.yml    # Exposes port 8080
└── src/
    ├── bot.js                         # Main listener, routes messages
    ├── ai.js                          # generateSummary(), generateReply()
    ├── contractHandler.js             # handleContractFiles() — full /hd flow
    ├── contractSession.js             # 90s file collection session
    ├── contractAuth.js                # isContractAuthorized() — checks CONTRACT_ALLOW_ALL
    ├── docxFiller.js                  # fillDocxTemplate() — fills {placeholder} in Word XML
    ├── messageParser.js               # parseGroupMessage(), isSummaryTrigger()
    ├── memory.js                      # In-memory chat history per group
    ├── metrics.js                     # In-memory metrics store
    ├── dashboard.js                   # HTML dashboard renderer
    ├── rateLimiter.js
    ├── sessionManager.js              # smartLogin(), Zalo session persistence
    ├── config.js
    ├── logger.js
    └── extractors/
        ├── extractFromXLSX.js         # Reads Excel, parses multiline STK cell
        ├── extractFromGPKD.js         # AI Vision OCR for GPKD PDF
        ├── extractFromCCCD.js         # AI Vision OCR for CCCD image
        └── extractFromGiayUyQuyen.js  # AI Vision OCR for authorization letter
```

---

## Metrics dashboard
- URL: `http://<server>:8080` — HTML dashboard (auto-refresh 15s)
- `http://<server>:8080/metrics` — JSON raw data
- `http://<server>:8080/health` — health check
- Tracks: AI latency (avg/p50/p95/p99), contract fills, summary requests, rate limit hits, per-group activity, recent event feed

---

## Known issues / gotchas

### Windows NTFS mount truncation
Writing files through Linux sandbox → Windows mount truncates Vietnamese UTF-8 content mid-file.
**Workaround**: `git show HEAD:src/bot.js > /tmp/bot_restored.js && cp /tmp/bot_restored.js src/bot.js`

### `.git/index.lock`
Linux sandbox cannot delete Windows-side lock file. User must run manually: `del .git\index.lock`
Or use `cleanup_and_push.bat` in project root.

### Bot UID detection
`parseGroupMessage()` detects mentions by UID (`api.getOwnId()`), not by display name.
Changing the bot's Zalo display name has zero effect on functionality.

---

## .env variables
```env
AI_PLATFORM_API_KEY=...          # VNG Cloud AI key (required)
BOT_NAME=Thư Kí Kim              # Display name in logs
BOT_OWNER_IDS=...                # Comma-separated Zalo UIDs
RATE_LIMIT_PER_MINUTE=10
CONTRACT_ALLOW_ALL=true          # true = all group members can use /hd
CONTRACT_IDS=                    # Comma-separated UIDs (if CONTRACT_ALLOW_ALL=false)
```

---

## XLSX STK parsing (v1.3.5 fix)
Cell "STK thanh toán" is multiline (Alt+Enter):
```
Tên:NGUYEN VAN A
Số tài khoản: 20262027+A17
Ngân hàng thu hưởng:AGRIBANK
```
`extractFromXLSX.js` now parses each line → fills `{ten_chu_tk}`, `{so_tai_khoan}`, `{ngan_hang}` separately.

---

## docxFiller FIELD_MAP
| Placeholder | Source field |
|---|---|
| `{ten_ben_a}` | `fields.ten` (from GPKD) |
| `{dia_chi_ben_a}` | `fields.dia_chi` |
| `{ma_so_thue}` | `fields.ma_so_thue` |
| `{dai_dien}` | `fields.dai_dien` |
| `{chuc_vu}` | `fields.chuc_vu` |
| `{so_tai_khoan}` | `fields.so_tai_khoan` (from XLSX) |
| `{ngan_hang}` | `fields.ngan_hang` |
| `{ten_chu_tk}` | `fields.ten_chu_tai_khoan` |
| `{hotline}` | `fields.dien_thoai` |
| `{email}` | `fields.email` |
| `{ct_hd_ten/cv/email/sdt}` | contact role 1 |
| `{ct_kt_ten/cv/email/sdt}` | contact role 2 |
| `{ct_kh_ten/cv/email/sdt}` | contact role 3 |
| `{ct_tt_ten/cv/email/sdt}` | contact role 4 |
