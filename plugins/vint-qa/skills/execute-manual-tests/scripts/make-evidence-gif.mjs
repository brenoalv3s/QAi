#!/usr/bin/env node
/**
 * Gera fluxo.gif + fluxo.png a partir de frames PNG/JPG em um diretório.
 * Uso: node make-evidence-gif.mjs --dir path/frames --out path/fluxo.gif
 *
 * - Sempre grava fluxo.png (último frame ou composição simples) — preferido no Test Plans.
 * - fluxo.gif só é gerado se ffmpeg conseguir um GIF válido (não copia PNG renomeado).
 */
import { readdirSync, existsSync, copyFileSync, mkdirSync } from 'fs';
import { resolve, join, extname, dirname } from 'path';
import { spawnSync } from 'child_process';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2).replace(/-/g, '_');
      args[key] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    }
  }
  return args;
}

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp']);

function listFrames(dir) {
  return readdirSync(dir)
    .filter((f) => IMAGE_EXT.has(extname(f).toLowerCase()))
    .sort()
    .map((f) => join(dir, f));
}

function tryFfmpegGif(frames, outGif) {
  const ffmpeg = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  if (ffmpeg.status !== 0) return false;

  // Lista de inputs + filter concat → GIF
  const args = ['-y', '-framerate', '1'];
  for (const f of frames) {
    args.push('-loop', '1', '-t', '1.2', '-i', f);
  }
  args.push(
    '-filter_complex',
    `concat=n=${frames.length}:v=1:a=0,scale=1280:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`,
    outGif,
  );
  const run = spawnSync('ffmpeg', args, { encoding: 'utf8' });
  return run.status === 0 && existsSync(outGif);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dir = resolve(String(args.dir || ''));
  const outGif = resolve(String(args.out || join(dir, '..', 'fluxo.gif')));
  const outPng = outGif.replace(/\.gif$/i, '.png');

  if (!dir || !existsSync(dir)) throw new Error('--dir inválido');
  const frames = listFrames(dir);
  if (!frames.length) throw new Error(`Sem frames em ${dir}`);

  mkdirSync(dirname(outGif), { recursive: true });

  // PNG sempre (último frame) — anexo confiável no Test Plans
  copyFileSync(frames[frames.length - 1], outPng);

  let gifOk = false;
  if (tryFfmpegGif(frames, outGif)) {
    gifOk = true;
  } else {
    // NÃO gravar PNG com extensão .gif (quebrava o Test Plans com HTTP 400)
    console.warn('ffmpeg indisponível ou falhou — fluxo.gif omitido; use fluxo.png no --evidence');
  }

  console.log(
    JSON.stringify(
      {
        outGif: gifOk ? outGif : null,
        outPng,
        frames: frames.length,
        evidenceHint: gifOk ? `${outGif},${outPng}` : outPng,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
