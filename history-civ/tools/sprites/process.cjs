// Higgsfield 원본(raw/*.png) → 게임 스프라이트(out/*.png)
//  - 지형: 정사각 텍스처를 축소한 뒤 아이소메트릭 마름모(128x64)로 변환
//  - 유닛/도시: 2x2 시트를 사분면으로 나누고, 배경(마젠타/그라데이션) 제거,
//    가장 큰 덩어리만 남겨 글자·격자선 제거, 잘라서 축소
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const RAW = path.join(__dirname, 'raw');
const OUT = process.argv[2] || path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

const read = (f) => PNG.sync.read(fs.readFileSync(path.join(RAW, f)));
const write = (png, f) => fs.writeFileSync(path.join(OUT, f), PNG.sync.write(png));

function boxDownscale(src, sw, sh, x0, y0, w, h, tw, th) {
  // src: RGBA Uint8 buffer of width sw. Region (x0,y0,w,h) → tw x th, premultiplied alpha average.
  const out = new PNG({ width: tw, height: th });
  for (let ty = 0; ty < th; ty++) {
    for (let tx = 0; tx < tw; tx++) {
      const xa = x0 + Math.floor((tx * w) / tw), xb = x0 + Math.max(Math.floor(((tx + 1) * w) / tw), Math.floor((tx * w) / tw) + 1);
      const ya = y0 + Math.floor((ty * h) / th), yb = y0 + Math.max(Math.floor(((ty + 1) * h) / th), Math.floor((ty * h) / th) + 1);
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let y = ya; y < yb; y++) for (let x = xa; x < xb; x++) {
        const i = (y * sw + x) * 4, al = src[i + 3] / 255;
        r += src[i] * al; g += src[i + 1] * al; b += src[i + 2] * al; a += al; n++;
      }
      const o = (ty * tw + tx) * 4;
      out.data[o] = a ? r / a : 0; out.data[o + 1] = a ? g / a : 0; out.data[o + 2] = a ? b / a : 0;
      out.data[o + 3] = Math.round((a / n) * 255);
    }
  }
  return out;
}

// ---------- 지형 ----------
const TW = 128, TH = 64, TEX = 256;
for (const t of ['plains', 'grassland', 'hills', 'forest', 'mountain', 'water']) {
  const img = read(`${t}.png`);
  // 가장자리 인공물을 피해 가운데 영역을 사용
  const m = Math.floor(img.width * 0.1), s = img.width - 2 * m;
  const tex = boxDownscale(img.data, img.width, img.height, m, m, s, s, TEX, TEX);
  const out = new PNG({ width: TW, height: TH });
  for (let v = 0; v < TH; v++) for (let u = 0; u < TW; u++) {
    const a = (u + 0.5) / TW + (v + 0.5) / TH - 0.5;
    const b = (v + 0.5) / TH - (u + 0.5) / TW + 0.5;
    const o = (v * TW + u) * 4;
    if (a < 0 || a > 1 || b < 0 || b > 1) { out.data[o + 3] = 0; continue; }
    const i = (Math.min(TEX - 1, Math.floor(b * TEX)) * TEX + Math.min(TEX - 1, Math.floor(a * TEX))) * 4;
    out.data[o] = tex.data[i]; out.data[o + 1] = tex.data[i + 1]; out.data[o + 2] = tex.data[i + 2];
    // 마름모 경계 1px 부드럽게
    const edge = Math.min(a, 1 - a, b, 1 - b) * TEX;
    out.data[o + 3] = edge < 1 ? Math.round(edge * 255) : 255;
  }
  write(out, `terrain_${t}.png`);
}

// ---------- 스프라이트 ----------
// sheetA는 글자 라벨과 그라데이션이 있어 그림 영역을 직접 지정 (원본 2048px 기준 [x, y, 한 변])
const RECTS = {
  settler: [120, 150, 560],
  militia: [880, 100, 600],
  line_infantry: [150, 840, 560],
  cavalry: [760, 770, 690],
};
const SHEETS = {
  'sheetA.png': ['settler', 'militia', 'line_infantry', 'cavalry'],
  'sheetB.png': ['artillery', 'machine_gunner', 'ironclad', 'hero_napoleon'],
  'sheetC.png': ['hero_robespierre', 'hero_watt', 'city', 'capital'],
};

const isMagenta = (r, g, b) => r > g + 45 && b > g + 25;

// rect: [x0, y0, size] 정사각 영역 (원본 픽셀). 기본은 2x2 사분면.
function extract(img, rect, maxSize, keepRatio = 0.3, mauve = false) {
  const W = img.width, [x0, y0, half] = rect, n = half * half;
  const px = (x, y) => ((y0 + y) * W + (x0 + x)) * 4;
  const d = img.data;
  const bg = new Uint8Array(n);
  const stack = [];
  const push = (x, y) => { const k = y * half + x; if (!bg[k]) { bg[k] = 1; stack.push(k); } };
  for (let i = 0; i < half; i++) { push(i, 0); push(i, half - 1); push(0, i); push(half - 1, i); }
  // 배경 색 추정: 열마다 위/아래 가장자리 색을 세로로 보간 (가로 그라데이션 대응)
  const band = 12;
  const edgeAvg = (x, top) => {
    let r = 0, g = 0, b = 0;
    for (let y = 0; y < band; y++) { const i = px(x, top ? y : half - 1 - y); r += d[i]; g += d[i + 1]; b += d[i + 2]; }
    return [r / band, g / band, b / band];
  };
  const topC = [], botC = [];
  for (let x = 0; x < half; x++) { topC.push(edgeAvg(x, true)); botC.push(edgeAvg(x, false)); }
  const nearBg = (x, y) => {
    const t = y / (half - 1), T = topC[x], B = botC[x], i = px(x, y);
    const er = T[0] + (B[0] - T[0]) * t, eg = T[1] + (B[1] - T[1]) * t, eb = T[2] + (B[2] - T[2]) * t;
    const dist = Math.abs(d[i] - er) + Math.abs(d[i + 1] - eg) + Math.abs(d[i + 2] - eb);
    return dist < 75 || isMagenta(d[i], d[i + 1], d[i + 2]);
  };
  // 가장자리에서 연결된 배경만 제거 (스프라이트 내부의 비슷한 색은 보존)
  while (stack.length) {
    const k = stack.pop(), x = k % half, y = (k / half) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= half || ny >= half) continue;
      const nk = ny * half + nx; if (bg[nk]) continue;
      if (nearBg(nx, ny)) { bg[nk] = 1; stack.push(nk); }
    }
  }
  // 전경 연결요소 (8방향)
  const label = new Int32Array(n).fill(-1);
  const comps = [];
  for (let k = 0; k < n; k++) {
    if (bg[k] || label[k] >= 0) continue;
    const id = comps.length, c = { size: 0, minx: 1e9, miny: 1e9, maxx: -1, maxy: -1, border: false };
    const st = [k]; label[k] = id;
    while (st.length) {
      const q = st.pop(), x = q % half, y = (q / half) | 0;
      c.size++; c.minx = Math.min(c.minx, x); c.maxx = Math.max(c.maxx, x); c.miny = Math.min(c.miny, y); c.maxy = Math.max(c.maxy, y);
      if (x < 4 || y < 4 || x >= half - 4 || y >= half - 4) c.border = true;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= half || ny >= half) continue;
        const nk = ny * half + nx;
        if (!bg[nk] && label[nk] < 0) { label[nk] = id; st.push(nk); }
      }
    }
    comps.push(c);
  }
  // 격자선처럼 사분면을 가로지르는 가늘고 긴 덩어리만 제외 (가장자리에 닿은 그림은 유지)
  const candidates = comps.map((c, id) => ({ ...c, id })).filter((c) => {
    const w = c.maxx - c.minx + 1, h = c.maxy - c.miny + 1;
    return !(c.border && (w > half * 0.6 || h > half * 0.6) && c.size < w * h * 0.1);
  });
  const biggest = candidates.reduce((m, c) => (c.size > m.size ? c : m), { size: 0 });
  const keep = new Set(candidates.filter((c) => c.size >= biggest.size * keepRatio).map((c) => c.id));
  let minx = 1e9, miny = 1e9, maxx = -1, maxy = -1;
  for (const c of candidates) if (keep.has(c.id)) {
    minx = Math.min(minx, c.minx); miny = Math.min(miny, c.miny); maxx = Math.max(maxx, c.maxx); maxy = Math.max(maxy, c.maxy);
  }
  const pad = 6;
  minx = Math.max(0, minx - pad); miny = Math.max(0, miny - pad); maxx = Math.min(half - 1, maxx + pad); maxy = Math.min(half - 1, maxy + pad);
  const cw = maxx - minx + 1, ch = maxy - miny + 1;
  const crop = Buffer.alloc(cw * ch * 4);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const k = (miny + y) * half + (minx + x), i = px(minx + x, miny + y), o = (y * cw + x) * 4;
    // 그림 안쪽에 갇힌 진한 마젠타(그림자 틈)도 제거
    const hotPink = (d[i] > 170 && d[i + 2] > 120 && d[i + 1] < 120 && d[i] - d[i + 1] > 90)
      // sheetA 그라데이션의 보라-회색 띠
      || (mauve && Math.abs(d[i] - d[i + 2]) < 45 && d[i] - d[i + 1] > 18 && d[i + 2] - d[i + 1] > 12 && d[i] > 100);
    const on = !bg[k] && keep.has(label[k]) && !hotPink;
    crop[o] = d[i]; crop[o + 1] = d[i + 1]; crop[o + 2] = d[i + 2]; crop[o + 3] = on ? 255 : 0;
  }
  const scale = maxSize / Math.max(cw, ch);
  return boxDownscale(crop, cw, ch, 0, 0, cw, ch, Math.max(1, Math.round(cw * scale)), Math.max(1, Math.round(ch * scale)));
}

for (const [sheet, names] of Object.entries(SHEETS)) {
  const img = read(sheet);
  names.forEach((name, q) => {
    const big = name === 'city' || name === 'capital';
    const half = img.width / 2;
    const rect = RECTS[name] ?? [(q % 2) * half, Math.floor(q / 2) * half, half];
    const sprite = extract(img, rect, big ? 160 : 112, name === 'ironclad' ? 1 : 0.3, sheet === 'sheetA.png');
    write(sprite, `${big ? '' : 'unit_'}${name}.png`);
    console.log(name, sprite.width, 'x', sprite.height);
  });
}
console.log('done →', OUT);
