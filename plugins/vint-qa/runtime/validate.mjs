#!/usr/bin/env node
/**
 * Valida se .hub-projeto.json e .env têm o que a ação do menu precisa.
 *
 *   vqa validate --action manual --json
 *   vqa validate --action startup --json     (só confere se os arquivos existem)
 *
 * Saída: { ok, missing: [{ key, file, label, secret, choices, example, suggestion }], next }
 */
import { existsSync } from 'fs';
import { basename } from 'path';
import { ENV_FILE, HUB_FILE, PROJECT_ROOT, getPath, projectPath, readHub, readProjectEnv } from './lib/project.mjs';
import { FIELDS, MENU, filled, requiredFor } from './lib/schema.mjs';
import { run } from './lib/sys.mjs';

const argv = process.argv.slice(2);
const JSON_ONLY = argv.includes('--json');
const ai = argv.indexOf('--action');
const action = ai >= 0 ? argv[ai + 1] : 'startup';

const hubExists = existsSync(projectPath(HUB_FILE));
const envExists = existsSync(projectPath(ENV_FILE));
const hub = readHub();
const env = { ...readProjectEnv(), ...Object.fromEntries(Object.entries(process.env).filter(([k]) => /^(AZURE_DEVOPS_PAT|GITLAB_PERSONAL_ACCESS_TOKEN|GITHUB_PERSONAL_ACCESS_TOKEN)$/.test(k))) };

let gitEmail = null;
function suggestionFor(key) {
  if (key === 'hub.projeto') return basename(PROJECT_ROOT);
  if (key === 'hub.email') {
    if (gitEmail == null) gitEmail = run('git', ['config', 'user.email'], { cwd: PROJECT_ROOT }).stdout || '';
    return gitEmail || null;
  }
  if (key === 'hub.gitlab.url') return 'https://gitlab.com';
  if (key === 'env.BASE_URL') {
    const envs = hub?.ambientes || {};
    const pref = hub?.ambientePadrao;
    return envs[pref]?.url || Object.values(envs).find((a) => a?.url)?.url || null;
  }
  return null;
}

function isOk(key) {
  const def = FIELDS[key] || {};
  if (def.check) return def.check(hub || {}, env);
  const [file, ...rest] = key.split('.');
  const path = rest.join('.');
  return file === 'hub' ? filled(getPath(hub || {}, path)) : filled(env[path]);
}

const required = requiredFor(action, hub || {});
const missing = required
  .filter((k) => !isOk(k))
  .map((key) => {
    const def = FIELDS[key] || {};
    return {
      key,
      file: key.startsWith('hub.') ? HUB_FILE : ENV_FILE,
      label: def.label || key,
      secret: Boolean(def.secret),
      choices: def.choices || null,
      example: def.example || null,
      suggestion: suggestionFor(key),
    };
  });

const menuItem = MENU.find((m) => m.id === action);
const out = {
  projectRoot: PROJECT_ROOT,
  action,
  actionLabel: menuItem?.label || action,
  files: { hub: hubExists, env: envExists, hubValidJson: hubExists ? Boolean(hub) : null },
  plataforma: hub?.plataforma || null,
  ok: hubExists && envExists && Boolean(hub) && missing.length === 0,
  missing,
  next: !hubExists || !envExists ? 'run-init' : !hub ? 'fix-hub-json' : missing.length ? 'ask-user' : 'ok',
};

if (JSON_ONLY) console.log(JSON.stringify(out, null, 2));
else {
  console.log(`vint-qa validate — ${out.actionLabel}`);
  if (out.ok) console.log('✅ Tudo preenchido.');
  for (const m of missing) console.log(`❌ ${m.file} → ${m.key.replace(/^(hub|env)\./, '')} (${m.label})`);
  console.log('next:', out.next);
}
