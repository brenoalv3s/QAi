import { existsSync, readdirSync } from 'fs';
import { homedir } from 'os';
import { delimiter, join } from 'path';
import { IS_WIN, run } from './sys.mjs';

const EXE = IS_WIN ? '.exe' : '';

function subdirs(base, pattern) {
  try {
    return readdirSync(base, { withFileTypes: true })
      .filter((d) => d.isDirectory() && pattern.test(d.name))
      .map((d) => join(base, d.name));
  } catch {
    return [];
  }
}

/**
 * Pastas onde o uv costuma ficar. Inclui as de instalações recentes (winget, pip --user, instalador oficial),
 * que só entram no PATH do Cursor depois de reiniciá-lo.
 */
function candidateDirs() {
  const home = homedir();
  const dirs = (process.env.PATH || '').split(delimiter).filter(Boolean);
  if (process.env.UV_INSTALL_DIR) dirs.push(process.env.UV_INSTALL_DIR);
  dirs.push(join(home, '.local', 'bin'), join(home, '.cargo', 'bin'));
  if (IS_WIN) {
    const local = process.env.LOCALAPPDATA || join(home, 'AppData', 'Local');
    const roaming = process.env.APPDATA || join(home, 'AppData', 'Roaming');
    dirs.push(join(local, 'Microsoft', 'WinGet', 'Links'));
    for (const py of subdirs(join(roaming, 'Python'), /^Python3\d+$/)) dirs.push(join(py, 'Scripts'));
    for (const py of subdirs(join(local, 'Programs', 'Python'), /^Python3\d+$/)) dirs.push(join(py, 'Scripts'));
    for (const pkg of subdirs(join(local, 'Microsoft', 'WinGet', 'Packages'), /^astral-sh\.uv/i)) dirs.push(pkg);
  } else {
    dirs.push('/opt/homebrew/bin', '/usr/local/bin');
    for (const py of subdirs(join(home, 'Library', 'Python'), /^3\.\d+$/)) dirs.push(join(py, 'bin'));
  }
  return [...new Set(dirs)];
}

/** Caminho absoluto do uvx, ou null. */
export function findUvx() {
  for (const dir of candidateDirs()) {
    const p = join(dir, `uvx${EXE}`);
    if (existsSync(p)) return p;
  }
  return null;
}

export function uvxVersion() {
  const uvx = findUvx();
  if (!uvx) return null;
  const r = run(uvx, ['--version'], { timeout: 15_000 });
  const m = `${r.stdout}\n${r.stderr}`.match(/(\d+\.\d+(?:\.\d+)?)/);
  return r.ok ? (m ? m[1] : 'ok') : null;
}
