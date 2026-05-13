export interface TelegramClient {
  send(text: string): Promise<void>;
}

export function createTelegramClient(token: string, chatId: string, dryRun = false): TelegramClient {
  if (dryRun) {
    return {
      async send(text) {
        console.log('[telegram dry-run]\n' + text + '\n---');
      },
    };
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  return {
    async send(text) {
      const body = JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true });
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body,
          });
          if (!res.ok) throw new Error(`telegram ${res.status}: ${await res.text()}`);
          return;
        } catch (err) {
          if (attempt === 1) {
            console.error('[telegram] giving up:', err);
            return;
          }
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    },
  };
}
