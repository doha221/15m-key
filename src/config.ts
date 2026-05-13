import 'dotenv/config';

export interface Config {
  telegramBotToken: string;
  telegramChatId: string;
  symbol: string;
  dryRun: boolean;
}

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === '') {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v.trim();
}

export function loadConfig(argv: string[] = process.argv): Config {
  return {
    telegramBotToken: required('TELEGRAM_BOT_TOKEN'),
    telegramChatId: required('TELEGRAM_CHAT_ID'),
    symbol: (process.env.SYMBOL ?? 'BTCUSDT').trim().toUpperCase(),
    dryRun: argv.includes('--dry-run'),
  };
}
