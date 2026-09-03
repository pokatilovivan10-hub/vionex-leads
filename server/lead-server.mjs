import http from 'node:http';
import { readFile } from 'node:fs/promises';

const PORT = Number(process.env.PORT || 8787);
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const ALLOWED_ORIGINS = new Set([
  'https://vionex-leads.ru',
  'https://www.vionex-leads.ru',
]);
const MAX_BODY_BYTES = 16 * 1024;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 8;
const recentRequests = new Map();

function clean(value, max = 300) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

function normalizePhone(value) {
  const digits = clean(value, 40).replace(/\D/g, '');
  const ten = digits.length === 11 && /^[78]/.test(digits) ? digits.slice(1) : digits;
  return ten.length === 10 ? `+7${ten}` : '';
}

export function validateLead(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const name = clean(input.name, 100);
  const phone = normalizePhone(input.phone);
  if (name.length < 2 || !phone) return null;
  return {
    name,
    phone,
    city: clean(input.city, 120),
    volume: clean(input.volume, 120),
    product: clean(input.product, 160),
    form: clean(input.form, 160),
    page: clean(input.page, 500),
    requestId: clean(input.requestId, 100),
    utm: input.utm && typeof input.utm === 'object' ? input.utm : {},
  };
}

function formatLead(lead) {
  const lines = [
    'Новая заявка с vionex-leads.ru',
    '',
    `Имя: ${lead.name}`,
    `Телефон: ${lead.phone}`,
  ];
  if (lead.city) lines.push(`Город: ${lead.city}`);
  if (lead.volume) lines.push(`Объём: ${lead.volume}`);
  if (lead.product) lines.push(`Продукт: ${lead.product}`);
  if (lead.form) lines.push(`Форма: ${lead.form}`);
  const utm = Object.entries(lead.utm)
    .filter(([, value]) => value)
    .slice(0, 8)
    .map(([key, value]) => `${clean(key, 40)}=${clean(value, 160)}`)
    .join(', ');
  if (utm) lines.push(`UTM: ${utm}`);
  if (lead.page) lines.push(`Страница: ${lead.page}`);
  if (lead.requestId) lines.push(`ID: ${lead.requestId}`);
  return lines.join('\n').slice(0, 4000);
}

async function getBotToken() {
  if (process.env.TELEGRAM_BOT_TOKEN) return process.env.TELEGRAM_BOT_TOKEN;
  const dir = process.env.CREDENTIALS_DIRECTORY;
  if (!dir) throw new Error('Telegram bot credential is unavailable');
  return (await readFile(`${dir}/telegram_bot_token`, 'utf8')).trim();
}

async function sendTelegram(lead) {
  if (!CHAT_ID) throw new Error('Telegram chat id is unavailable');
  const token = await getBotToken();
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text: formatLead(lead) }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Telegram API ${response.status}: ${body.slice(0, 300)}`);
  }
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function reply(res, status, body, origin = '') {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...(origin ? corsHeaders(origin) : {}),
  });
  res.end(JSON.stringify(body));
}

function clientIp(req) {
  return clean(req.headers['x-forwarded-for'] || req.socket.remoteAddress, 100).split(',')[0];
}

function rateLimited(ip) {
  const now = Date.now();
  const active = (recentRequests.get(ip) || []).filter((time) => now - time < RATE_WINDOW_MS);
  active.push(now);
  recentRequests.set(ip, active);
  return active.length > RATE_LIMIT;
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error('Payload too large'), { status: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('Invalid JSON'), { status: 400 });
  }
}

export function createServer() {
  return http.createServer(async (req, res) => {
    const origin = clean(req.headers.origin, 200);
    if (req.url === '/health' && req.method === 'GET') return reply(res, 200, { ok: true });
    if (req.url !== '/lead') return reply(res, 404, { ok: false });
    if (!ALLOWED_ORIGINS.has(origin)) return reply(res, 403, { ok: false, error: 'origin' });
    if (req.method === 'OPTIONS') {
      res.writeHead(204, corsHeaders(origin));
      return res.end();
    }
    if (req.method !== 'POST') return reply(res, 405, { ok: false }, origin);
    if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
      return reply(res, 415, { ok: false, error: 'content_type' }, origin);
    }
    if (rateLimited(clientIp(req))) return reply(res, 429, { ok: false, error: 'rate_limit' }, origin);

    try {
      const lead = validateLead(await readJson(req));
      if (!lead) return reply(res, 422, { ok: false, error: 'validation' }, origin);
      await sendTelegram(lead);
      return reply(res, 200, { ok: true, requestId: lead.requestId }, origin);
    } catch (error) {
      console.error(new Date().toISOString(), error.message);
      return reply(res, error.status || 502, { ok: false, error: 'delivery' }, origin);
    }
  });
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  createServer().listen(PORT, '127.0.0.1', () => {
    console.log(`VIONEX lead server listening on 127.0.0.1:${PORT}`);
  });
}
