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
npm start                       # chạy nền, scheduler bật cron 07:15 VN hàng ngày
npm run dry-run                 # chạy ngay 1 lần với telegram in ra console
npm run replay                  # replay break của hôm nay (in ra console)
npm run replay -- 2026-05-12    # replay break của ngày bất kỳ (YYYY-MM-DD)
npm test                        # unit test
```

## Production với PM2

Cài pm2 toàn cục cho Node 20:

```bash
nvm use 20
npm install -g pm2
```

Chạy:

```bash
npm run pm2:start      # khởi động background process
npm run pm2:logs       # xem log realtime
npm run pm2:status     # xem trạng thái
npm run pm2:restart    # restart sau khi đổi code/.env
npm run pm2:stop       # dừng
```

Auto-start khi reboot máy (chỉ chạy 1 lần):

```bash
pm2 startup            # in ra 1 lệnh sudo, copy chạy theo hướng dẫn
npm run pm2:start
pm2 save               # lưu danh sách process để restart sau reboot
```

Log nằm trong `./logs/{out,err}.log`.

## Thiết kế

Xem [docs/superpowers/specs/2026-05-13-15m-key-design.md](docs/superpowers/specs/2026-05-13-15m-key-design.md).
