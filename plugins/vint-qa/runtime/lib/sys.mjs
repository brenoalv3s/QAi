import { spawnSync } from 'child_process';

export const IS_WIN = process.platform === 'win32';
export const IS_MAC = process.platform === 'darwin';

function quote(a) {
  const s = String(a);
  return /[\s"&|<>^]/.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s;
}

/** Executa um comando e devolve { ok, status, stdout, stderr }. Nunca lança. */
export function run(cmd, args = [], { cwd, timeout = 20_000, inherit = false, env } = {}) {
  try {
    const opts = {
      cwd,
      env: env ? { ...process.env, ...env } : process.env,
      encoding: 'utf8',
      timeout,
      windowsHide: true,
      stdio: inherit ? 'inherit' : 'pipe',
    };
    const r = IS_WIN
      ? spawnSync([cmd, ...args].map(quote).join(' '), { ...opts, shell: true })
      : spawnSync(cmd, args, opts);
    return {
      ok: r.status === 0,
      status: r.status,
      stdout: String(r.stdout || '').trim(),
      stderr: String(r.stderr || '').trim(),
    };
  } catch (err) {
    return { ok: false, status: -1, stdout: '', stderr: String(err?.message || err) };
  }
}

export function version(cmd, args = ['--version']) {
  const r = run(cmd, args, { timeout: 15_000 });
  if (!r.ok) return null;
  const m = `${r.stdout}\n${r.stderr}`.match(/(\d+\.\d+(?:\.\d+)?)/);
  return m ? m[1] : r.stdout.split(/\r?\n/)[0] || 'ok';
}

export function majorOf(v) {
  return Number(String(v || '0').split('.')[0]) || 0;
}
