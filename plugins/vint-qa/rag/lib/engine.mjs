/**
 * Motor RAG do vint-qa — busca BM25 local, sem dependências.
 *
 * Fontes:
 *   plugin  → knowledge/, skills/, rules/, agents/, commands/  (base curada do time)
 *   project → .vint-qa/learnings/, docs/test-docs/, docs/test-scenarios/, docs/regression-automation/,
 *             e2e/docs/wiki/, código de e2e/ e robot/
 *
 * O índice guarda só texto + metadados; as estatísticas BM25 são calculadas em memória ao carregar.
 */
import { createHash } from 'crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { basename, dirname, extname, join, relative, resolve, sep } from 'path';
import { HUB_FILE, PLUGIN_ROOT, USER_HOME_DIR, findProjectRoot, pluginVersion, slugify, usableDir } from '../../runtime/lib/project.mjs';

const INDEX_VERSION = 1;
const MAX_FILE_BYTES = 400 * 1024;
const MAX_FILES_PER_SOURCE = 4000;
const MD_CHUNK_MAX_CHARS = 1800;
const CODE_CHUNK_LINES = 60;
const CODE_CHUNK_OVERLAP = 10;
const K1 = 1.2;
const B = 0.75;

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'test-results', 'playwright-report', 'blob-report', 'results', 'dist', 'build',
  'coverage', '.auth', '.cache', 'cache', '__pycache__', '.venv', 'venv', 'output', 'screenshots', 'videos',
]);

const KIND_BOOST = { learning: 1.6, knowledge: 1.4, rule: 1.1 };

/** kind → { scope, base dir, extensões, filtro } */
function sourceDefs(projectDir) {
  const defs = [
    { scope: 'plugin', kind: 'knowledge', root: PLUGIN_ROOT, dir: 'knowledge', exts: ['.md'] },
    { scope: 'plugin', kind: 'skill', root: PLUGIN_ROOT, dir: 'skills', exts: ['.md'] },
    { scope: 'plugin', kind: 'rule', root: PLUGIN_ROOT, dir: 'rules', exts: ['.mdc', '.md'] },
    { scope: 'plugin', kind: 'agent', root: PLUGIN_ROOT, dir: 'agents', exts: ['.md'] },
    { scope: 'plugin', kind: 'command', root: PLUGIN_ROOT, dir: 'commands', exts: ['.md'] },
  ];
  if (projectDir) {
    defs.push(
      { scope: 'project', kind: 'learning', root: projectDir, dir: '.vint-qa/learnings', exts: ['.md'], skip: (f) => basename(f) === 'README.md' },
      { scope: 'project', kind: 'test-doc', root: projectDir, dir: 'docs/test-docs', exts: ['.md'] },
      { scope: 'project', kind: 'scenario', root: projectDir, dir: 'docs/test-scenarios', exts: ['.md'] },
      { scope: 'project', kind: 'regression', root: projectDir, dir: 'docs/regression-automation', exts: ['.md', '.json'] },
      { scope: 'project', kind: 'wiki', root: projectDir, dir: 'e2e/docs/wiki', exts: ['.md'] },
      {
        scope: 'project', kind: 'code', root: projectDir, dir: 'e2e', exts: ['.ts', '.js', '.mjs', '.robot', '.resource', '.py', '.md'],
        skip: (f) => f.includes(`${sep}docs${sep}wiki${sep}`) || /\.env/.test(basename(f)),
      },
      { scope: 'project', kind: 'code', root: projectDir, dir: 'robot', exts: ['.robot', '.resource', '.py'] },
    );
  }
  return defs;
}

// ───────────────────────── texto ─────────────────────────

const STOP = new Set(
  (
    'de da do das dos a o as os e ou um uma uns umas em no na nos nas por para pra com sem que se ao aos à às ' +
    'é ser foi são está estão ter tem como mais mas não nao sim seu sua seus suas ele ela isso este esta esse essa ' +
    'the of and or to in on for with is are be this that it as at by from an if not'
  ).split(' '),
);

function fold(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function stem(t) {
  if (t.length > 4 && t.endsWith('es') && !t.endsWith('ões')) return t.slice(0, -2);
  if (t.length > 3 && t.endsWith('s')) return t.slice(0, -1);
  return t;
}

export function tokenize(text) {
  return fold(String(text).replace(/([a-z0-9])([A-Z])/g, '$1 $2'))
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && t.length < 40 && !STOP.has(t))
    .map(stem);
}

function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { meta: {}, body: text, offset: 0 };
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (kv) meta[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
  }
  return { meta, body: text.slice(m[0].length), offset: m[0].split('\n').length - 1 };
}

function chunkMarkdown(text, fileTitle) {
  const { meta, body, offset } = parseFrontmatter(text);
  const baseTitle = meta.title || meta.name || fileTitle;
  const prefix = [meta.description, meta.tags, meta.categoria, meta.feature].filter(Boolean).join(' · ');
  const lines = body.split(/\r?\n/);
  const chunks = [];
  const headings = [];
  let cur = { start: 0, lines: [] };

  const flush = (end) => {
    const t = cur.lines.join('\n').trim();
    if (t) {
      const title = [baseTitle, ...headings.filter((h) => h && h !== baseTitle)].join(' › ');
      chunks.push({ title, startLine: cur.start + offset + 1, endLine: end + offset, text: prefix && chunks.length === 0 ? `${prefix}\n${t}` : t });
    }
  };

  lines.forEach((line, i) => {
    const h = line.match(/^(#{1,4})\s+(.+?)\s*#*$/);
    const tooBig = cur.lines.join('\n').length > MD_CHUNK_MAX_CHARS;
    if (h || tooBig) {
      flush(i);
      if (h) {
        const level = h[1].length;
        headings.length = level - 1;
        headings[level - 1] = h[2].replace(/[*_`]/g, '');
      }
      cur = { start: i, lines: [] };
    }
    cur.lines.push(line);
  });
  flush(lines.length);
  return chunks;
}

function chunkCode(text, fileTitle) {
  const lines = text.split(/\r?\n/);
  const chunks = [];
  for (let start = 0; start < lines.length; start += CODE_CHUNK_LINES - CODE_CHUNK_OVERLAP) {
    const end = Math.min(lines.length, start + CODE_CHUNK_LINES);
    const t = lines.slice(start, end).join('\n').trim();
    if (t) chunks.push({ title: `${fileTitle} (linhas ${start + 1}-${end})`, startLine: start + 1, endLine: end, text: t });
    if (end === lines.length) break;
  }
  return chunks;
}

function chunkFile(absPath, relPath) {
  const text = readFileSync(absPath, 'utf8');
  const ext = extname(absPath).toLowerCase();
  return ext === '.md' || ext === '.mdc' ? chunkMarkdown(text, relPath) : chunkCode(text, relPath);
}

// ───────────────────────── arquivos ─────────────────────────

function walk(dir, exts, skip, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (out.length >= MAX_FILES_PER_SOURCE) break;
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name) && !e.name.startsWith('.')) walk(p, exts, skip, out);
    } else if (exts.includes(extname(e.name).toLowerCase()) && !(skip && skip(p))) {
      out.push(p);
    }
  }
  return out;
}

// ───────────────────────── projeto ─────────────────────────

let rootsHint = null;
/** O servidor MCP informa aqui a pasta recebida via `roots/list`. */
export function setRootsHint(dir) {
  rootsHint = usableDir(dir);
}

function isRealProject(dir) {
  if (!dir) return false;
  const d = resolve(dir);
  if (d === resolve(homedir()) || d === resolve(dirname(d))) return false;
  return true;
}

export function resolveProjectDir(explicit) {
  const candidates = [
    usableDir(explicit),
    usableDir(process.env.VINT_QA_PROJECT_DIR),
    usableDir(process.env.CURSOR_PROJECT_DIR),
    rootsHint,
    findProjectRoot(process.cwd()),
  ];
  for (const c of candidates) {
    if (!c) continue;
    const root = existsSync(join(c, HUB_FILE)) ? c : findProjectRoot(c);
    if (isRealProject(root)) return root;
  }
  return null;
}

function indexPathFor(projectDir) {
  if (projectDir && existsSync(join(projectDir, HUB_FILE))) return join(projectDir, '.vint-qa', 'cache', 'rag-index.json');
  const id = projectDir ? createHash('sha1').update(projectDir).digest('hex').slice(0, 12) : 'plugin';
  return join(USER_HOME_DIR, 'cache', `rag-${id}.json`);
}

// ───────────────────────── índice ─────────────────────────

class Index {
  constructor(projectDir) {
    this.projectDir = projectDir;
    this.path = indexPathFor(projectDir);
    this.files = {};
    this.chunks = [];
    this.builtAt = null;
    this.lastRefresh = 0;
    this.stats = null;
    this.load();
  }

  load() {
    try {
      const data = JSON.parse(readFileSync(this.path, 'utf8'));
      if (data.version !== INDEX_VERSION || data.pluginRoot !== PLUGIN_ROOT) return;
      this.files = data.files || {};
      this.chunks = data.chunks || [];
      this.builtAt = data.builtAt || null;
    } catch {
      /* índice inexistente ou corrompido → reconstruir */
    }
  }

  save() {
    mkdirSync(dirname(this.path), { recursive: true });
    const data = {
      version: INDEX_VERSION,
      pluginRoot: PLUGIN_ROOT,
      pluginVersion: pluginVersion(),
      projectDir: this.projectDir,
      builtAt: this.builtAt,
      files: this.files,
      chunks: this.chunks,
    };
    writeFileSync(this.path, JSON.stringify(data));
  }

  /** Reindexa só o que mudou (mtime/tamanho). Retorna { added, updated, removed, files, chunks }. */
  refresh({ force = false } = {}) {
    const seen = new Set();
    const changed = { added: 0, updated: 0, removed: 0 };
    const byFile = new Map();
    for (const c of this.chunks) {
      if (!byFile.has(c.file)) byFile.set(c.file, []);
      byFile.get(c.file).push(c);
    }

    for (const def of sourceDefs(this.projectDir)) {
      const base = join(def.root, def.dir);
      if (!existsSync(base)) continue;
      for (const abs of walk(base, def.exts, def.skip)) {
        const rel = relative(def.root, abs).split(sep).join('/');
        const key = `${def.scope}:${rel}`;
        if (seen.has(key)) continue;
        seen.add(key);
        let st;
        try {
          st = statSync(abs);
        } catch {
          continue;
        }
        if (st.size > MAX_FILE_BYTES) continue;
        const prev = this.files[key];
        if (!force && prev && prev.mtime === st.mtimeMs && prev.size === st.size) continue;
        let parts;
        try {
          parts = chunkFile(abs, rel);
        } catch {
          continue;
        }
        byFile.set(
          key,
          parts.map((p, i) => ({ id: `${key}#${i}`, file: key, scope: def.scope, kind: def.kind, path: rel, ...p })),
        );
        this.files[key] = { mtime: st.mtimeMs, size: st.size, kind: def.kind };
        changed[prev ? 'updated' : 'added']++;
      }
    }

    for (const key of Object.keys(this.files)) {
      if (!seen.has(key)) {
        delete this.files[key];
        byFile.delete(key);
        changed.removed++;
      }
    }

    const dirty = changed.added || changed.updated || changed.removed || force || !this.builtAt;
    if (dirty) {
      this.chunks = [...byFile.entries()].filter(([k]) => this.files[k]).flatMap(([, list]) => list);
      this.builtAt = new Date().toISOString();
      this.stats = null;
      this.save();
    }
    this.lastRefresh = Date.now();
    return { ...changed, files: Object.keys(this.files).length, chunks: this.chunks.length };
  }

  ensureStats() {
    if (this.stats) return this.stats;
    const df = new Map();
    let totalLen = 0;
    const docs = this.chunks.map((c) => {
      const toks = tokenize(`${c.title}\n${c.title}\n${c.text}`);
      const tf = new Map();
      for (const t of toks) tf.set(t, (tf.get(t) || 0) + 1);
      for (const t of tf.keys()) df.set(t, (df.get(t) || 0) + 1);
      totalLen += toks.length;
      return { tf, len: toks.length };
    });
    this.stats = { df, docs, avgLen: docs.length ? totalLen / docs.length : 0 };
    return this.stats;
  }

  search(query, { k = 6, scope = 'all', kinds = null } = {}) {
    const q = [...new Set(tokenize(query))];
    if (!q.length || !this.chunks.length) return [];
    const { df, docs, avgLen } = this.ensureStats();
    const N = docs.length;
    const results = [];
    this.chunks.forEach((c, i) => {
      if (scope !== 'all' && c.scope !== scope) return;
      if (kinds && kinds.length && !kinds.includes(c.kind)) return;
      const d = docs[i];
      let score = 0;
      let hits = 0;
      for (const t of q) {
        const f = d.tf.get(t);
        if (!f) continue;
        hits++;
        const n = df.get(t) || 0;
        const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
        score += idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * d.len) / (avgLen || 1))));
      }
      if (!score) return;
      score *= (KIND_BOOST[c.kind] || 1) * (0.6 + 0.4 * (hits / q.length));
      results.push({ score, c });
    });
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, Math.max(1, Math.min(20, k))).map(({ score, c }) => ({
      score: Number(score.toFixed(3)),
      scope: c.scope,
      kind: c.kind,
      path: c.scope === 'plugin' ? `{VINT_QA_ROOT}/${c.path}` : c.path,
      lines: `${c.startLine}-${c.endLine}`,
      title: c.title,
      snippet: snippet(c.text, q),
    }));
  }

  summary() {
    const byKind = {};
    for (const f of Object.values(this.files)) byKind[f.kind] = (byKind[f.kind] || 0) + 1;
    return {
      projectDir: this.projectDir,
      indexPath: this.path,
      builtAt: this.builtAt,
      files: Object.keys(this.files).length,
      chunks: this.chunks.length,
      filesByKind: byKind,
    };
  }
}

function snippet(text, qTokens, maxChars = 700) {
  const lines = text.split('\n');
  let best = 0;
  let bestHits = -1;
  lines.forEach((l, i) => {
    const toks = new Set(tokenize(l));
    const h = qTokens.filter((t) => toks.has(t)).length;
    if (h > bestHits) {
      bestHits = h;
      best = i;
    }
  });
  const from = Math.max(0, best - 3);
  let out = lines.slice(from, from + 12).join('\n');
  if (out.length > maxChars) out = out.slice(0, maxChars) + '…';
  return out;
}

// ───────────────────────── API pública ─────────────────────────

const cache = new Map();

export function getIndex(projectDir) {
  const key = projectDir || '(plugin)';
  if (!cache.has(key)) cache.set(key, new Index(projectDir));
  return cache.get(key);
}

export function search(query, { projectDir, k, scope, kinds, maxAgeMs = 30_000 } = {}) {
  const idx = getIndex(resolveProjectDir(projectDir));
  if (Date.now() - idx.lastRefresh > maxAgeMs) idx.refresh();
  return { projectDir: idx.projectDir, results: idx.search(query, { k, scope, kinds }) };
}

export function reindex({ projectDir, force = false } = {}) {
  const idx = getIndex(resolveProjectDir(projectDir));
  return { ...idx.refresh({ force }), ...idx.summary() };
}

export function stats({ projectDir } = {}) {
  const idx = getIndex(resolveProjectDir(projectDir));
  if (!idx.builtAt) idx.refresh();
  return idx.summary();
}

const SECRET_PATTERNS = [
  /\b[a-z0-9]{52}\b/i, // PAT Azure DevOps
  /\bglpat-[\w-]{20,}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
  /\beyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}\b/, // JWT
  /\b(senha|password|passwd|pwd|token|secret)\s*[:=]\s*["']?(?=[^\s"']*[0-9!@#$%^&*])(?=[^\s"']*[A-Za-z])[^\s"']{6,}/i,
];

export function containsSecret(text) {
  return SECRET_PATTERNS.some((re) => re.test(text));
}

const LEARNING_CATEGORIES = ['locator', 'regra-de-negocio', 'ambiente', 'massa-de-dados', 'flaky', 'api', 'processo', 'geral'];

/** Grava um aprendizado em .vint-qa/learnings/ e reindexa. */
export function addLearning({ title, content, tags = [], categoria = 'geral', feature = '', projectDir } = {}) {
  const dir = resolveProjectDir(projectDir);
  if (!dir) throw new Error('Projeto não identificado: abra a pasta do projeto no Cursor (ou informe projectDir).');
  if (!title || !String(title).trim()) throw new Error('Informe o título do aprendizado.');
  if (!content || String(content).trim().length < 20) throw new Error('Descreva o aprendizado (mínimo de 20 caracteres).');
  if (containsSecret(`${title}\n${content}\n${tags}`)) {
    throw new Error('O texto parece conter senha, token ou PAT. Remova o segredo e tente de novo.');
  }
  const cat = LEARNING_CATEGORIES.includes(categoria) ? categoria : 'geral';
  const tagList = (Array.isArray(tags) ? tags : String(tags).split(',')).map((t) => String(t).trim()).filter(Boolean);
  let email = '';
  let projeto = '';
  try {
    const hub = JSON.parse(readFileSync(join(dir, HUB_FILE), 'utf8'));
    email = hub.email || '';
    projeto = hub.projeto || '';
  } catch {
    /* sem hub */
  }
  const date = new Date().toISOString().slice(0, 10);
  const learnDir = join(dir, '.vint-qa', 'learnings');
  mkdirSync(learnDir, { recursive: true });
  let file = join(learnDir, `${date}-${slugify(title).slice(0, 60) || 'aprendizado'}.md`);
  for (let i = 2; existsSync(file); i++) file = file.replace(/(-\d+)?\.md$/, `-${i}.md`);
  const q = (s) => JSON.stringify(String(s));
  const md = [
    '---',
    `title: ${q(title.trim())}`,
    `date: ${date}`,
    `categoria: ${cat}`,
    `tags: ${q(tagList.join(', '))}`,
    feature ? `feature: ${q(feature)}` : null,
    projeto ? `projeto: ${q(projeto)}` : null,
    email ? `autor: ${q(email)}` : null,
    '---',
    '',
    `# ${title.trim()}`,
    '',
    String(content).trim(),
    '',
  ]
    .filter((l) => l !== null)
    .join('\n');
  writeFileSync(file, md);
  const r = reindex({ projectDir: dir });
  return { file: relative(dir, file).split(sep).join('/'), categoria: cat, tags: tagList, indexed: r.chunks };
}

export { LEARNING_CATEGORIES };
