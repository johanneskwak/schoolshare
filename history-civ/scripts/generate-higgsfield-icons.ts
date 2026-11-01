// 위인 초상 아이콘 생성 (Higgsfield)
//
//   node scripts/generate-higgsfield-icons.ts            → 프롬프트 목록만 출력 + manifest 저장 (크레딧 사용 없음)
//   node scripts/generate-higgsfield-icons.ts --generate → 없는 아이콘만 생성해 public/portraits/{id}.png 로 저장
//   --only=watt,darwin  특정 인물만
//
// 생성 모드 환경변수 (키는 절대 커밋하지 말 것 — .env.local 또는 셸에서만):
//   HIGGSFIELD_API_KEY   API 키
//   HIGGSFIELD_API_URL   이미지 생성 엔드포인트 (POST { prompt, aspect_ratio } → { image_url } 또는 { images: [{ url }] })
//
// 프롬프트·대상 목록은 src/constants/figureIcons.ts 한 곳에서 관리한다 (UI와 같은 테이블).
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIGURE_ICONS, iconPrompt } from '../src/constants/figureIcons.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'portraits');
const args = process.argv.slice(2);
const generate = args.includes('--generate');
const only = args.find((a) => a.startsWith('--only='))?.slice(7).split(',');

const jobs = Object.entries(FIGURE_ICONS)
  .filter(([id]) => !only || only.includes(id))
  .map(([id, f]) => ({ id, name: f.name, group: f.group, prompt: iconPrompt(f.name), file: join(outDir, `${id}.png`) }));

mkdirSync(outDir, { recursive: true });
writeFileSync(
  join(root, 'scripts', 'higgsfield-icons.manifest.json'),
  JSON.stringify(jobs.map(({ file: _file, ...j }) => j), null, 2) + '\n',
);

const missing = jobs.filter((j) => !existsSync(j.file));
console.log(`인물 ${jobs.length}명 · 이미지 없음 ${missing.length}명`);
for (const j of missing) console.log(`- [${j.group}] ${j.id}: ${j.prompt}`);

if (!generate) {
  console.log('\n(미리보기만 했어요. 실제로 만들려면 --generate — Higgsfield 크레딧이 사용됩니다.)');
  process.exit(0);
}

const key = process.env.HIGGSFIELD_API_KEY;
const url = process.env.HIGGSFIELD_API_URL;
if (!key || !url) {
  console.error('HIGGSFIELD_API_KEY 와 HIGGSFIELD_API_URL 을 설정하세요.');
  process.exit(1);
}

for (const j of missing) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: j.prompt, aspect_ratio: '1:1' }),
  });
  if (!res.ok) {
    console.error(`✗ ${j.id}: HTTP ${res.status} ${await res.text()}`);
    continue;
  }
  const data = (await res.json()) as { image_url?: string; images?: { url: string }[] };
  const imageUrl = data.image_url ?? data.images?.[0]?.url;
  if (!imageUrl) {
    console.error(`✗ ${j.id}: 응답에 이미지 URL이 없어요`, data);
    continue;
  }
  const img = await fetch(imageUrl);
  writeFileSync(j.file, Buffer.from(await img.arrayBuffer()));
  console.log(`✓ ${j.id} → public/portraits/${j.id}.png`);
}
