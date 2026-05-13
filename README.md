# 15m-key

Theo dõi nến 15m BTCUSDT Futures lúc 07:00 VN mỗi ngày. Sau khi nến đóng, gửi OHLC qua Telegram. Tiếp tục giám sát các nến 3m và 5m liền sau — mỗi khi close vượt HIGH hoặc thủng LOW của nến khóa, gửi tin nhắn. Đếm 3 break mỗi khung là dừng.

## Setup

```bash
cp .env.example .env
# Điền TELEGRAM_BOT_TOKEN và TELEGRAM_CHAT_ID
npm install
```

## Chạy

```bash
npm start          # chạy nền, scheduler bật cron 07:15 VN hàng ngày
npm run dry-run    # chạy ngay 1 lần với telegram in ra console
npm test           # unit test
```

## Thiết kế

Xem [docs/superpowers/specs/2026-05-13-15m-key-design.md](docs/superpowers/specs/2026-05-13-15m-key-design.md).
