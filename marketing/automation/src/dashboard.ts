/**
 * Dreamz Marketing Dashboard — local-only HTTP cockpit.
 *
 * Serves a single-page control panel on http://127.0.0.1:4455.
 * - See per-platform credential + toggle state + queue metrics
 * - Paste credentials into forms that write .env atomically
 * - Flip per-platform kill switches without a restart
 * - Trigger generate / post-now runs as isolated child processes
 * - Start/stop the in-process node-cron scheduler
 *
 * Security model: loopback bind + Host-header allowlist. Defense-in-depth
 * against DNS rebinding. Never returns secret values on GET responses.
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import cron, { ScheduledTask } from 'node-cron';
import { getStats, load as loadQueue } from './queue/store.js';
import { loadPosters, processDueItems } from './index.js';
import { readPlatformState, writePlatformState } from './lib/platformState.js';
import { mergeEnv, readEnvKeys } from './lib/envFile.js';
import { log } from './utils/logger.js';
import type { Platform, PlatformPoster, QueueItem } from './types.js';

const PORT = 4455;
const HOST = '127.0.0.1';
const ALLOWED_HOSTS = new Set([`127.0.0.1:${PORT}`, `localhost:${PORT}`]);
const TAG = 'dashboard';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUTOMATION_DIR = resolve(__dirname, '..');

// ── Credential schema per platform (presence-only, values never leak) ─────
const PLATFORM_FIELDS: Record<Platform, readonly string[]> = {
  pinterest: ['PINTEREST_ACCESS_TOKEN', 'PINTEREST_BOARD_ID'],
  reddit: [
    'REDDIT_CLIENT_ID',
    'REDDIT_CLIENT_SECRET',
    'REDDIT_USERNAME',
    'REDDIT_PASSWORD',
    'REDDIT_USER_AGENT',
  ],
  facebook: ['FACEBOOK_PAGE_ACCESS_TOKEN', 'FACEBOOK_PAGE_ID'],
  tiktok: ['TIKTOK_ACCESS_TOKEN'],
};

const GLOBAL_FIELDS = ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY'] as const;

// ── In-process scheduler handle ───────────────────────────────────────────
let cronTask: ScheduledTask | null = null;
let cronPosters: PlatformPoster[] = [];
let schedulerRunning = false;

async function startScheduler(): Promise<{ ok: boolean; message: string }> {
  if (schedulerRunning) return { ok: true, message: 'Scheduler already running' };
  cronPosters = await loadPosters();
  if (cronPosters.length === 0) {
    return { ok: false, message: 'No posters enabled — check credentials' };
  }
  cronTask = cron.schedule('*/5 * * * *', () => {
    processDueItems(cronPosters).catch((err) => {
      log.err(TAG, `Tick error: ${err}`);
    });
  });
  schedulerRunning = true;
  log.ok(TAG, `Scheduler started with ${cronPosters.length} posters`);
  processDueItems(cronPosters).catch((err) => log.err(TAG, `Initial tick: ${err}`));
  return { ok: true, message: `Scheduler started with ${cronPosters.length} posters` };
}

function stopScheduler(): { ok: boolean; message: string } {
  if (!schedulerRunning || !cronTask) {
    return { ok: true, message: 'Scheduler already stopped' };
  }
  cronTask.stop();
  cronTask = null;
  cronPosters = [];
  schedulerRunning = false;
  log.ok(TAG, 'Scheduler stopped');
  return { ok: true, message: 'Scheduler stopped' };
}

// ── Response helpers ──────────────────────────────────────────────────────
function json(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

function text(res: ServerResponse, status: number, body: string, ct = 'text/plain'): void {
  res.writeHead(status, {
    'Content-Type': `${ct}; charset=utf-8`,
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolveBody, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    const MAX = 64 * 1024;
    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8');
      if (!raw) return resolveBody({});
      try {
        resolveBody(JSON.parse(raw));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

// ── Endpoint handlers ─────────────────────────────────────────────────────

function buildStatus() {
  const envKeys = new Set(readEnvKeys());
  const state = readPlatformState();
  const platforms: Record<string, unknown> = {};

  for (const [name, fields] of Object.entries(PLATFORM_FIELDS) as [Platform, readonly string[]][]) {
    const configured = fields.every((k) => envKeys.has(k));
    platforms[name] = {
      configured,
      enabled: state[name],
      fields: fields.map((k) => ({ key: k, set: envKeys.has(k) })),
    };
  }

  return {
    platforms,
    global: GLOBAL_FIELDS.map((k) => ({ key: k, set: envKeys.has(k) })),
    queue: getStats(),
    scheduler: { running: schedulerRunning },
  };
}

function buildQueue(limit = 50) {
  const items = loadQueue();
  items.sort((a, b) => (b.scheduledFor ?? '').localeCompare(a.scheduledFor ?? ''));
  return items.slice(0, limit).map((item: QueueItem) => ({
    id: item.id,
    platform: item.platform,
    status: item.status,
    title: item.content.title ?? item.content.text.slice(0, 80),
    scheduledFor: item.scheduledFor,
    postedAt: item.postedAt ?? null,
    postedUrl: (item as any).postedUrl ?? null,
    error: item.error ?? null,
    retries: item.retries,
  }));
}

async function handleCredentials(req: IncomingMessage, res: ServerResponse) {
  const body = (await readJsonBody(req)) as { fields?: Record<string, string> };
  if (!body.fields || typeof body.fields !== 'object') {
    return json(res, 400, { ok: false, error: 'Missing fields' });
  }
  const knownKeys = new Set<string>([...GLOBAL_FIELDS]);
  for (const list of Object.values(PLATFORM_FIELDS)) for (const k of list) knownKeys.add(k);

  const filtered: Record<string, string> = {};
  for (const [k, v] of Object.entries(body.fields)) {
    if (!knownKeys.has(k)) continue;
    if (typeof v !== 'string') continue;
    if (v.trim() === '') continue;
    filtered[k] = v.trim();
  }
  if (Object.keys(filtered).length === 0) {
    return json(res, 400, { ok: false, error: 'No valid fields to update' });
  }

  const touched = mergeEnv(filtered);
  log.ok(TAG, `Credentials written: ${touched.join(', ')}`);
  return json(res, 200, {
    ok: true,
    restartRequired: true,
    touched,
    message:
      'Credentials saved. Restart the dashboard (Ctrl+C then `npm run dashboard`) for the scheduler to pick them up.',
  });
}

async function handleToggle(req: IncomingMessage, res: ServerResponse) {
  const body = (await readJsonBody(req)) as { platform?: Platform; enabled?: boolean };
  if (!body.platform || typeof body.enabled !== 'boolean') {
    return json(res, 400, { ok: false, error: 'Missing platform or enabled' });
  }
  if (!(body.platform in PLATFORM_FIELDS)) {
    return json(res, 400, { ok: false, error: 'Unknown platform' });
  }
  const next = writePlatformState({ [body.platform]: body.enabled });
  log.ok(TAG, `${body.platform} toggled to ${body.enabled}`);
  return json(res, 200, { ok: true, state: next });
}

async function handleGenerate(req: IncomingMessage, res: ServerResponse) {
  const body = (await readJsonBody(req)) as { count?: number };
  const count = Math.max(1, Math.min(10, Number(body.count) || 1));
  const output = await runChild(['tsx', 'src/generator/content.ts', String(count)]);
  return json(res, output.ok ? 200 : 500, output);
}

async function handlePostNow(_req: IncomingMessage, res: ServerResponse) {
  const output = await runChild(['tsx', 'src/post-now.ts']);
  return json(res, output.ok ? 200 : 500, output);
}

async function handleSchedulerAction(req: IncomingMessage, res: ServerResponse) {
  const body = (await readJsonBody(req)) as { action?: 'start' | 'stop' };
  if (body.action === 'start') {
    const r = await startScheduler();
    return json(res, r.ok ? 200 : 500, { ok: r.ok, running: schedulerRunning, message: r.message });
  }
  if (body.action === 'stop') {
    const r = stopScheduler();
    return json(res, 200, { ok: r.ok, running: schedulerRunning, message: r.message });
  }
  return json(res, 400, { ok: false, error: 'action must be "start" or "stop"' });
}

function runChild(args: string[]): Promise<{ ok: boolean; stdout: string; stderr: string; code: number }> {
  return new Promise((resolveRun) => {
    const child = spawn('npx', args, {
      cwd: AUTOMATION_DIR,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on('data', (c: Buffer) => stdout.push(c));
    child.stderr.on('data', (c: Buffer) => stderr.push(c));
    child.on('close', (code) => {
      resolveRun({
        ok: code === 0,
        stdout: Buffer.concat(stdout).toString('utf-8'),
        stderr: Buffer.concat(stderr).toString('utf-8'),
        code: code ?? -1,
      });
    });
    child.on('error', (err) => {
      resolveRun({ ok: false, stdout: '', stderr: err.message, code: -1 });
    });
  });
}

// ── Router ────────────────────────────────────────────────────────────────
async function route(req: IncomingMessage, res: ServerResponse) {
  const host = req.headers.host ?? '';
  if (!ALLOWED_HOSTS.has(host)) {
    return text(res, 403, 'Forbidden: unexpected Host header');
  }

  const url = new URL(req.url ?? '/', `http://${host}`);
  const path = url.pathname;
  const method = req.method ?? 'GET';

  try {
    if (method === 'GET' && path === '/') return text(res, 200, HTML, 'text/html');
    if (method === 'GET' && path === '/api/status') return json(res, 200, buildStatus());
    if (method === 'GET' && path === '/api/queue') return json(res, 200, buildQueue());
    if (method === 'POST' && path === '/api/credentials') return handleCredentials(req, res);
    if (method === 'POST' && path === '/api/toggle') return handleToggle(req, res);
    if (method === 'POST' && path === '/api/generate') return handleGenerate(req, res);
    if (method === 'POST' && path === '/api/post-now') return handlePostNow(req, res);
    if (method === 'POST' && path === '/api/scheduler') return handleSchedulerAction(req, res);
    return text(res, 404, 'Not found');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.err(TAG, `${method} ${path}: ${msg}`);
    return json(res, 500, { ok: false, error: msg });
  }
}

// ── Inline HTML page ──────────────────────────────────────────────────────
// All client-side rendering uses safe DOM methods (textContent, createElement,
// appendChild) — no innerHTML assignment. User-generated queue titles/errors
// are set via textContent so they cannot break out of their cells.
const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Dreamz Marketing Cockpit</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    :root {
      --bg-deep: #0d1b2a;
      --bg-purple-dark: #1a0a2e;
      --bg-purple-mid: #2d1b69;
      --gold: #c9a84c;
      --gold-light: #e0c872;
      --text-primary: #f0e6d3;
      --text-secondary: #a89bb0;
      --text-muted: #6b5f73;
      --green: #7fc796;
      --red: #d4726a;
      --card: rgba(26, 10, 46, 0.5);
      --border: rgba(201, 168, 76, 0.18);
      font-family: -apple-system, 'Inter', system-ui, sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg-deep);
      color: var(--text-primary);
      min-height: 100vh;
      padding: 2rem 1.5rem 4rem;
      background-image:
        radial-gradient(ellipse 60% 40% at 50% 0%, var(--bg-purple-mid) 0%, transparent 70%),
        radial-gradient(ellipse 40% 30% at 80% 60%, rgba(45, 27, 105, 0.4) 0%, transparent 60%);
    }
    h1 {
      font-family: 'Playfair Display', Georgia, serif;
      font-weight: 700;
      font-size: 2rem;
      margin-bottom: 0.25rem;
    }
    h1 em { color: var(--gold); font-style: italic; }
    .subtitle { color: var(--text-secondary); font-size: 0.95rem; margin-bottom: 2rem; }
    .container { max-width: 1080px; margin: 0 auto; }
    .row { display: grid; grid-template-columns: 1fr; gap: 1rem; margin-bottom: 2rem; }
    @media (min-width: 800px) {
      .row.metrics { grid-template-columns: repeat(4, 1fr); }
      .row.platforms { grid-template-columns: repeat(2, 1fr); }
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 1.25rem 1.5rem;
    }
    .metric { text-align: center; }
    .metric .label {
      font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.15em;
      color: var(--gold); margin-bottom: 0.35rem;
    }
    .metric .value {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 2.25rem; color: var(--text-primary);
    }
    .platform { display: flex; flex-direction: column; gap: 0.85rem; }
    .platform-header { display: flex; align-items: center; justify-content: space-between; }
    .platform-name {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 1.25rem; text-transform: capitalize;
    }
    .pill {
      display: inline-block; font-size: 0.7rem; text-transform: uppercase;
      letter-spacing: 0.1em; padding: 0.25rem 0.65rem; border-radius: 20px;
      border: 1px solid var(--border);
    }
    .pill.ok { color: var(--green); border-color: rgba(127, 199, 150, 0.35); }
    .pill.off { color: var(--text-muted); border-color: var(--border); }
    .pill.warn { color: var(--red); border-color: rgba(212, 114, 106, 0.35); }
    .fields { display: flex; flex-direction: column; gap: 0.5rem; }
    .field { display: flex; flex-direction: column; gap: 0.2rem; }
    .field label {
      font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em;
      color: var(--text-secondary);
    }
    .field input {
      background: rgba(13, 27, 42, 0.6);
      border: 1px solid var(--border);
      border-radius: 8px; padding: 0.55rem 0.75rem;
      color: var(--text-primary);
      font-family: 'SF Mono', Menlo, Consolas, monospace;
      font-size: 0.85rem;
    }
    .field input:focus {
      outline: none;
      border-color: var(--gold);
      box-shadow: 0 0 12px rgba(201, 168, 76, 0.15);
    }
    .row-buttons { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    button {
      background: var(--gold); border: none; color: var(--bg-deep);
      font-family: inherit; font-size: 0.85rem; font-weight: 600;
      padding: 0.6rem 1.1rem; border-radius: 8px; cursor: pointer;
      transition: background 0.15s ease;
    }
    button:hover { background: var(--gold-light); }
    button.ghost {
      background: transparent; color: var(--text-primary);
      border: 1px solid var(--border);
    }
    button.ghost:hover { border-color: var(--gold); color: var(--gold); }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .toggle {
      display: inline-flex; align-items: center; gap: 0.5rem;
      cursor: pointer; user-select: none;
      font-size: 0.85rem; color: var(--text-secondary);
    }
    .toggle input { display: none; }
    .toggle .track {
      width: 38px; height: 22px;
      background: rgba(107, 95, 115, 0.4);
      border-radius: 20px; position: relative;
      transition: background 0.2s ease;
    }
    .toggle .track::after {
      content: ''; position: absolute; top: 2px; left: 2px;
      width: 18px; height: 18px;
      background: var(--text-primary);
      border-radius: 50%; transition: transform 0.2s ease;
    }
    .toggle input:checked + .track { background: var(--gold); }
    .toggle input:checked + .track::after { transform: translateX(16px); }
    .banner {
      background: rgba(201, 168, 76, 0.12);
      border: 1px solid var(--gold);
      color: var(--gold-light);
      padding: 0.9rem 1.2rem;
      border-radius: 10px; margin-bottom: 1.5rem;
      font-size: 0.9rem; display: none;
    }
    .banner.show { display: block; }
    .activity { max-height: 360px; overflow-y: auto; }
    .activity table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
    .activity th, .activity td {
      text-align: left; padding: 0.55rem 0.4rem;
      border-bottom: 1px solid var(--border);
      color: var(--text-secondary);
    }
    .activity th {
      color: var(--gold); font-weight: 600;
      text-transform: uppercase; font-size: 0.7rem;
      letter-spacing: 0.1em; position: sticky; top: 0;
      background: var(--bg-deep);
    }
    .activity td.status-posted { color: var(--green); }
    .activity td.status-pending { color: var(--gold); }
    .activity td.status-failed { color: var(--red); }
    .activity a { color: var(--gold); text-decoration: none; }
    .activity a:hover { text-decoration: underline; }
    .activity td.title-cell {
      max-width: 260px; overflow: hidden;
      text-overflow: ellipsis; white-space: nowrap;
    }
    .log-output {
      background: rgba(13, 27, 42, 0.8);
      border: 1px solid var(--border);
      border-radius: 8px; padding: 0.75rem 1rem;
      font-family: 'SF Mono', Menlo, Consolas, monospace;
      font-size: 0.78rem; color: var(--text-secondary);
      max-height: 220px; overflow-y: auto;
      white-space: pre-wrap; margin-top: 0.75rem; display: none;
    }
    .log-output.show { display: block; }
    .section-header {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 1.3rem; margin-bottom: 0.9rem; color: var(--gold-light);
    }
    .scheduler-row {
      display: flex; align-items: center; justify-content: space-between;
      flex-wrap: wrap; gap: 1rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Dreamz <em>Marketing Cockpit</em></h1>
    <p class="subtitle">Local control panel for the automation pipeline. Bound to 127.0.0.1 — never exposed.</p>

    <div class="banner" id="banner"></div>

    <div class="row metrics">
      <div class="card metric"><div class="label">Pending</div><div class="value" id="m-pending">—</div></div>
      <div class="card metric"><div class="label">Posted</div><div class="value" id="m-posted">—</div></div>
      <div class="card metric"><div class="label">Failed</div><div class="value" id="m-failed">—</div></div>
      <div class="card metric"><div class="label">Total</div><div class="value" id="m-total">—</div></div>
    </div>

    <div class="card" style="margin-bottom: 2rem;">
      <div class="section-header">Scheduler</div>
      <div class="scheduler-row">
        <div>
          Status: <span class="pill" id="sched-pill">unknown</span>
          <span style="color: var(--text-muted); font-size: 0.8rem; margin-left: 0.5rem;">ticks every 5 minutes</span>
        </div>
        <div class="row-buttons">
          <button id="btn-sched-start">Start scheduler</button>
          <button id="btn-sched-stop" class="ghost">Stop</button>
          <button id="btn-post-now" class="ghost">Post due now</button>
          <button id="btn-generate" class="ghost">Generate 1 batch</button>
        </div>
      </div>
      <div class="log-output" id="cmd-log"></div>
    </div>

    <div class="card" style="margin-bottom: 2rem;">
      <div class="section-header">Content generation keys</div>
      <div class="fields" id="global-fields"></div>
      <div class="row-buttons" style="margin-top: 1rem;">
        <button id="btn-save-global">Save keys</button>
      </div>
    </div>

    <div class="row platforms" id="platforms"></div>

    <div class="card">
      <div class="section-header">Recent activity</div>
      <div class="activity">
        <table>
          <thead>
            <tr><th>When</th><th>Platform</th><th>Title</th><th>Status</th><th>Link / error</th></tr>
          </thead>
          <tbody id="activity-body"></tbody>
        </table>
      </div>
    </div>
  </div>

<script>
/* eslint-disable */
(function () {
  'use strict';

  // DOM helper: create element with attributes and children, safe by default.
  // Children are appended as text nodes unless they are already Node instances.
  function h(tag, props, ...children) {
    var el = document.createElement(tag);
    if (props) {
      for (var key in props) {
        if (!Object.prototype.hasOwnProperty.call(props, key)) continue;
        var value = props[key];
        if (value == null) continue;
        if (key === 'class') el.className = value;
        else if (key === 'dataset') {
          for (var dk in value) el.dataset[dk] = value[dk];
        } else if (key === 'on') {
          for (var ev in value) el.addEventListener(ev, value[ev]);
        } else if (key in el) {
          try { el[key] = value; } catch (_) { el.setAttribute(key, value); }
        } else {
          el.setAttribute(key, value);
        }
      }
    }
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      if (child == null || child === false) continue;
      if (Array.isArray(child)) {
        for (var j = 0; j < child.length; j++) {
          var sub = child[j];
          if (sub == null || sub === false) continue;
          el.appendChild(sub instanceof Node ? sub : document.createTextNode(String(sub)));
        }
      } else {
        el.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
      }
    }
    return el;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function api(path, opts) {
    opts = opts || {};
    var init = {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json' },
    };
    if (opts.body) init.body = JSON.stringify(opts.body);
    return fetch(path, init).then(function (r) {
      return r.json().then(function (j) { return { status: r.status, body: j }; });
    });
  }

  var $ = function (id) { return document.getElementById(id); };

  function banner(msg, kind) {
    var b = $('banner');
    b.textContent = msg;
    b.className = 'banner show';
    if (kind === 'success') setTimeout(function () { b.classList.remove('show'); }, 6000);
  }

  function showLog(txt) {
    var el = $('cmd-log');
    el.textContent = txt;
    el.classList.add('show');
  }

  function fieldInput(key, alreadySet) {
    var placeholder = alreadySet ? '\u2713 already set (leave blank to keep)' : 'not set';
    return h('div', { class: 'field' },
      h('label', { htmlFor: 'inp-' + key }, key),
      h('input', { id: 'inp-' + key, type: 'password', placeholder: placeholder, autocomplete: 'off' })
    );
  }

  function renderGlobalFields(globals) {
    var gf = $('global-fields');
    if (gf.dataset.rendered) return;
    for (var i = 0; i < globals.length; i++) {
      gf.appendChild(fieldInput(globals[i].key, globals[i].set));
    }
    gf.dataset.rendered = '1';
  }

  function renderPlatforms(platforms) {
    var wrap = $('platforms');
    if (wrap.dataset.rendered) {
      // Subsequent refresh: only update pill text + toggle state,
      // preserving the password inputs the user may be typing into.
      var names = Object.keys(platforms);
      for (var i = 0; i < names.length; i++) {
        var name = names[i];
        var p = platforms[name];
        var card = wrap.querySelector('[data-platform="' + name + '"]');
        if (!card) continue;
        var pill = card.querySelector('.pill');
        pill.textContent = p.configured ? 'configured' : 'missing creds';
        pill.className = 'pill ' + (p.configured ? 'ok' : 'off');
        var cb = card.querySelector('[data-toggle]');
        if (cb && cb.checked !== p.enabled) cb.checked = p.enabled;
      }
      return;
    }

    var entries = Object.keys(platforms);
    for (var j = 0; j < entries.length; j++) {
      var name = entries[j];
      var p = platforms[name];
      wrap.appendChild(buildPlatformCard(name, p));
    }
    wrap.dataset.rendered = '1';
  }

  function buildPlatformCard(name, p) {
    var pill = h('span', {
      class: 'pill ' + (p.configured ? 'ok' : 'off'),
    }, p.configured ? 'configured' : 'missing creds');

    var checkbox = h('input', { type: 'checkbox', checked: p.enabled });
    checkbox.dataset.toggle = name;
    checkbox.addEventListener('change', function (ev) {
      var enabled = ev.target.checked;
      api('/api/toggle', { method: 'POST', body: { platform: name, enabled: enabled } })
        .then(function (r) {
          if (!r.body.ok) {
            banner('Toggle failed: ' + (r.body.error || 'unknown'), 'warn');
            ev.target.checked = !enabled;
          }
        });
    });

    var toggleLabel = h('label', { class: 'toggle' },
      checkbox,
      h('span', { class: 'track' })
    );

    var fieldsWrap = h('div', { class: 'fields' });
    for (var i = 0; i < p.fields.length; i++) {
      fieldsWrap.appendChild(fieldInput(p.fields[i].key, p.fields[i].set));
    }

    var saveBtn = h('button', {}, 'Save ' + name + ' credentials');
    saveBtn.addEventListener('click', function () { saveFields(card, name); });
    var buttonRow = h('div', { class: 'row-buttons', style: 'margin-top:0.25rem' }, saveBtn);

    var card = h('div', { class: 'card platform' },
      h('div', { class: 'platform-header' },
        h('div', { class: 'platform-name' }, name),
        h('div', { style: 'display:flex;gap:0.5rem;align-items:center;' }, pill, toggleLabel)
      ),
      fieldsWrap,
      buttonRow
    );
    card.dataset.platform = name;
    return card;
  }

  function refreshStatus() {
    return api('/api/status').then(function (r) {
      var s = r.body;
      $('m-pending').textContent = s.queue.pending;
      $('m-posted').textContent = s.queue.posted;
      $('m-failed').textContent = s.queue.failed;
      $('m-total').textContent = s.queue.total;

      var pill = $('sched-pill');
      if (s.scheduler.running) {
        pill.textContent = 'running';
        pill.className = 'pill ok';
      } else {
        pill.textContent = 'stopped';
        pill.className = 'pill off';
      }

      renderGlobalFields(s.global);
      renderPlatforms(s.platforms);
    });
  }

  function refreshQueue() {
    return api('/api/queue').then(function (r) {
      var items = r.body;
      var tbody = $('activity-body');
      clear(tbody);
      if (!items.length) {
        var emptyCell = h('td', {
          colspan: 5,
          style: 'text-align:center;padding:1.5rem;color:var(--text-muted)',
        }, 'No activity yet');
        tbody.appendChild(h('tr', {}, emptyCell));
        return;
      }
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var when = item.postedAt || item.scheduledFor || '';
        var whenShort = when ? new Date(when).toLocaleString() : '\u2014';

        // Link/error cell — uses textContent for error, anchor for URL.
        var linkCell;
        if (item.postedUrl) {
          var a = h('a', { href: item.postedUrl, target: '_blank', rel: 'noopener' }, 'view');
          linkCell = h('td', {}, a);
        } else if (item.error) {
          var span = h('span', { style: 'color:var(--red)' }, item.error.slice(0, 80));
          linkCell = h('td', {}, span);
        } else {
          linkCell = h('td', {}, '\u2014');
        }

        tbody.appendChild(h('tr', {},
          h('td', {}, whenShort),
          h('td', {}, item.platform),
          h('td', { class: 'title-cell' }, item.title || ''),
          h('td', { class: 'status-' + item.status }, item.status),
          linkCell
        ));
      }
    });
  }

  function collectFields(container) {
    var inputs = container.querySelectorAll('input[id^="inp-"]');
    var out = {};
    for (var i = 0; i < inputs.length; i++) {
      var key = inputs[i].id.replace('inp-', '');
      if (inputs[i].value.trim()) out[key] = inputs[i].value.trim();
    }
    return out;
  }

  function saveFields(container, label) {
    var fields = collectFields(container);
    if (Object.keys(fields).length === 0) {
      banner('Nothing to save — all fields are blank.', 'warn');
      return;
    }
    api('/api/credentials', { method: 'POST', body: { fields: fields } }).then(function (r) {
      if (r.body.ok) {
        banner(label + ' saved (' + r.body.touched.length + ' keys). Restart the dashboard to apply.', 'success');
        var inputs = container.querySelectorAll('input[id^="inp-"]');
        for (var i = 0; i < inputs.length; i++) inputs[i].value = '';
        refreshStatus();
      } else {
        banner('Error: ' + (r.body.error || 'unknown'), 'warn');
      }
    });
  }

  $('btn-save-global').addEventListener('click', function () {
    saveFields($('global-fields').parentElement, 'Global keys');
  });
  $('btn-sched-start').addEventListener('click', function () {
    api('/api/scheduler', { method: 'POST', body: { action: 'start' } }).then(function (r) {
      banner(r.body.message, r.body.ok ? 'success' : 'warn');
      refreshStatus();
    });
  });
  $('btn-sched-stop').addEventListener('click', function () {
    api('/api/scheduler', { method: 'POST', body: { action: 'stop' } }).then(function (r) {
      banner(r.body.message, 'success');
      refreshStatus();
    });
  });
  $('btn-post-now').addEventListener('click', function () {
    banner('Running post-now\u2026', 'info');
    api('/api/post-now', { method: 'POST' }).then(function (r) {
      showLog((r.body.stdout || '') + (r.body.stderr ? '\\n--- stderr ---\\n' + r.body.stderr : ''));
      banner(r.body.ok ? 'post-now finished' : 'post-now failed (see log)', r.body.ok ? 'success' : 'warn');
      refreshStatus();
      refreshQueue();
    });
  });
  $('btn-generate').addEventListener('click', function () {
    banner('Generating content\u2026', 'info');
    api('/api/generate', { method: 'POST', body: { count: 1 } }).then(function (r) {
      showLog((r.body.stdout || '') + (r.body.stderr ? '\\n--- stderr ---\\n' + r.body.stderr : ''));
      banner(r.body.ok ? 'Generation finished' : 'Generation failed (see log)', r.body.ok ? 'success' : 'warn');
      refreshStatus();
      refreshQueue();
    });
  });

  refreshStatus().catch(function (e) { banner('Status load failed: ' + e.message, 'warn'); });
  refreshQueue().catch(function () {});
  setInterval(function () {
    refreshStatus().catch(function () {});
    refreshQueue().catch(function () {});
  }, 15000);
})();
</script>
</body>
</html>`;

// ── Server boot ───────────────────────────────────────────────────────────
const server = createServer((req, res) => {
  route(req, res).catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    log.err(TAG, `Unhandled: ${msg}`);
    if (!res.headersSent) json(res, 500, { ok: false, error: msg });
  });
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    log.warn(TAG, `Dashboard already running at http://${HOST}:${PORT} — open it in your browser`);
    process.exit(0);
  }
  log.err(TAG, `Server error: ${err.message}`);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  log.ok(TAG, `Dashboard listening on http://${HOST}:${PORT}`);
  log.info(TAG, `Open in your browser. Scheduler is stopped by default — click Start scheduler when ready.`);
});

function shutdown() {
  log.info(TAG, 'Shutting down...');
  stopScheduler();
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
