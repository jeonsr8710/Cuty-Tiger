import * as THREE from 'three';

export interface ProceduralTextureSet {
  tigerFurMap: THREE.CanvasTexture;
  tigerFurBump: THREE.CanvasTexture;
  tigerHeadMap: THREE.CanvasTexture;
  tigerTailMap: THREE.CanvasTexture;
  roadMap: THREE.CanvasTexture;
  roadRoughness: THREE.CanvasTexture;
  grassMap: THREE.CanvasTexture;
  wickerMap: THREE.CanvasTexture;
  scarfMap: THREE.CanvasTexture;
  contactShadowMap: THREE.CanvasTexture;
  dispose: () => void;
}

function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function configureColorTexture(
  canvas: HTMLCanvasElement,
  maxAnisotropy: number,
  repeatX = 1,
  repeatY = 1,
  wrap = THREE.RepeatWrapping,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = wrap;
  tex.wrapT = wrap;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

function configureDataTexture(
  canvas: HTMLCanvasElement,
  maxAnisotropy: number,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

function drawFurStrokes(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  rand: () => number,
  count: number,
  alpha: number,
) {
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const len = 8 + rand() * 14;
    const angle = (rand() - 0.5) * 0.35 + Math.PI * 0.5;
    const light = rand() > 0.5;
    ctx.strokeStyle = light
      ? `rgba(255, 210, 145, ${alpha})`
      : `rgba(110, 44, 12, ${alpha * 0.85})`;
    ctx.lineWidth = 1 + rand() * 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();
  }
  ctx.restore();
}

function createTigerFurTextures(maxAnisotropy: number) {
  const size = 512;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const ctx = colorCanvas.getContext('2d')!;
  const rand = seededRandom(4207);

  // Rich warm tiger base coat gradient
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, '#c85814');
  grad.addColorStop(0.32, '#e2741f');
  grad.addColorStop(0.72, '#ea862a');
  grad.addColorStop(1, '#d16218');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Organic tapered tiger stripes across wrap-safe coordinates
  const stripeBands = 11;
  for (let i = 0; i < stripeBands; i++) {
    const baseY = (i / stripeBands) * size + (rand() - 0.5) * 14;
    const thickness = 11 + rand() * 11;

    ctx.fillStyle = '#1b1411';
    for (let repeat = -1; repeat <= 1; repeat++) {
      const startX = repeat * size + rand() * 35;
      const span = size * (0.48 + rand() * 0.36);

      ctx.beginPath();
      ctx.moveTo(startX, baseY);
      const midX = startX + span * 0.5;
      const curveDip = (rand() - 0.5) * 34;
      ctx.quadraticCurveTo(midX, baseY + curveDip - thickness, startX + span, baseY + (rand() - 0.5) * 16);
      ctx.quadraticCurveTo(midX, baseY + curveDip + thickness, startX, baseY);
      ctx.closePath();
      ctx.fill();

      // Secondary split fork on some stripes
      if (rand() > 0.45) {
        const forkX = startX + span * (0.28 + rand() * 0.32);
        const forkLen = 40 + rand() * 65;
        const forkDir = rand() > 0.5 ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(forkX, baseY + curveDip * 0.5);
        ctx.quadraticCurveTo(
          forkX + forkLen * 0.5,
          baseY + curveDip * 0.5 + forkDir * (12 + rand() * 14),
          forkX + forkLen,
          baseY + curveDip * 0.5 + forkDir * (20 + rand() * 16),
        );
        ctx.lineWidth = 4 + rand() * 5;
        ctx.strokeStyle = '#1b1411';
        ctx.lineCap = 'round';
        ctx.stroke();
      }
    }
  }

  // Fine fur brush strokes for tactile depth
  drawFurStrokes(ctx, size, size, rand, 1800, 0.14);

  // Matching fur bump map
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 256;
  bumpCanvas.height = 256;
  const bCtx = bumpCanvas.getContext('2d')!;
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, 256, 256);
  const bRand = seededRandom(881);
  bCtx.lineCap = 'round';
  for (let i = 0; i < 1600; i++) {
    const x = bRand() * 256;
    const y = bRand() * 256;
    const v = Math.floor(95 + bRand() * 75);
    bCtx.strokeStyle = `rgb(${v},${v},${v})`;
    bCtx.lineWidth = 1.2;
    bCtx.beginPath();
    bCtx.moveTo(x, y);
    bCtx.lineTo(x + (bRand() - 0.5) * 4, y + 7 + bRand() * 9);
    bCtx.stroke();
  }

  return {
    tigerFurMap: configureColorTexture(colorCanvas, maxAnisotropy, 1, 1),
    tigerFurBump: configureDataTexture(bumpCanvas, maxAnisotropy, 2, 2),
  };
}

function createTigerHeadTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRandom(9912);

  // Base warm tangerine gradient (top darker orange, cheeks lighter golden)
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, '#c75714');
  grad.addColorStop(0.55, '#e87c24');
  grad.addColorStop(0.85, '#f2a24c');
  grad.addColorStop(1, '#f7dfb8');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Iconic forehead 王-like tiger crown markings near u = 0.5 (front +Z of sphere maps around u = 0.25 or 0.75 depending on rotation, so we paint symmetrical stripes around the upper dome)
  ctx.fillStyle = '#18120f';
  ctx.strokeStyle = '#18120f';
  ctx.lineCap = 'round';

  // Side cheek stripes & crown stripes distributed cleanly
  for (let i = 0; i < 10; i++) {
    const u = (i / 10) * size;
    const stripeW = 9 + rand() * 8;
    ctx.beginPath();
    ctx.moveTo(u, size * 0.14);
    ctx.quadraticCurveTo(u + 12, size * 0.34, u - 6, size * 0.56);
    ctx.lineWidth = stripeW;
    ctx.stroke();
  }

  // Horizontal forehead bands
  for (let row = 0; row < 3; row++) {
    const y = size * (0.22 + row * 0.085);
    ctx.beginPath();
    ctx.moveTo(size * 0.12, y);
    ctx.quadraticCurveTo(size * 0.25, y - 10, size * 0.38, y);
    ctx.moveTo(size * 0.62, y);
    ctx.quadraticCurveTo(size * 0.75, y - 10, size * 0.88, y);
    ctx.lineWidth = 7 - row;
    ctx.stroke();
  }

  drawFurStrokes(ctx, size, size, rand, 1400, 0.13);
  return configureColorTexture(canvas, maxAnisotropy, 1, 1);
}

function createTigerTailTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 256;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRandom(551);

  ctx.fillStyle = '#e47722';
  ctx.fillRect(0, 0, w, h);

  // Crisp alternating dark rings along tail length, dark tip
  const rings = 8;
  for (let i = 0; i < rings; i++) {
    const y = (i / rings) * h * 0.86 + 18;
    const bandH = 18 + (i % 2) * 6;
    ctx.fillStyle = '#18120f';
    ctx.fillRect(0, y, w, bandH);
  }
  // Black tail tip
  ctx.fillStyle = '#16110e';
  ctx.fillRect(0, h * 0.88, w, h * 0.12);

  drawFurStrokes(ctx, w, h, rand, 700, 0.12);
  return configureColorTexture(canvas, maxAnisotropy, 1, 1);
}

function drawRoadCanvasContent(
  ctx: CanvasRenderingContext2D,
  rCtx: CanvasRenderingContext2D,
  w: number,
  h: number,
) {
  const rand = seededRandom(3105);

  // Warm sunlit park bike-lane asphalt
  ctx.fillStyle = '#4e5459';
  ctx.fillRect(0, 0, w, h);

  // Fine mineral grain aggregate
  for (let i = 0; i < 16000; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const shade = Math.floor(58 + rand() * 44);
    ctx.fillStyle = `rgba(${shade}, ${shade + 3}, ${shade + 6}, 0.42)`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Subtle tire wear tracks along bike lane
  const trackGradL = ctx.createLinearGradient(w * 0.22, 0, w * 0.38, 0);
  trackGradL.addColorStop(0, 'rgba(30,33,36,0)');
  trackGradL.addColorStop(0.5, 'rgba(30,33,36,0.16)');
  trackGradL.addColorStop(1, 'rgba(30,33,36,0)');
  ctx.fillStyle = trackGradL;
  ctx.fillRect(w * 0.22, 0, w * 0.16, h);

  const trackGradR = ctx.createLinearGradient(w * 0.62, 0, w * 0.78, 0);
  trackGradR.addColorStop(0, 'rgba(30,33,36,0)');
  trackGradR.addColorStop(0.5, 'rgba(30,33,36,0.16)');
  trackGradR.addColorStop(1, 'rgba(30,33,36,0)');
  ctx.fillStyle = trackGradR;
  ctx.fillRect(w * 0.62, 0, w * 0.16, h);

  // Crisp park-lane side stripes (warm cream)
  ctx.fillStyle = '#e7e2d3';
  ctx.fillRect(48, 0, 22, h);
  ctx.fillRect(w - 70, 0, 22, h);

  // Center dashed yellow-amber bike path stripe (pauses cleanly around the road lettering zone)
  ctx.fillStyle = '#eab308';
  ctx.fillRect(w / 2 - 11, 24, 22, 165);
  ctx.fillRect(w / 2 - 11, h - 189, 22, 165);

  // Road-surface painted lettering: "행복한 망고"
  const textCenterY = h * 0.5;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 132px "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';

  // Subtle dark asphalt paint edge / shadow for crisp contrast
  ctx.lineWidth = 10;
  ctx.strokeStyle = 'rgba(28, 32, 36, 0.42)';
  ctx.lineJoin = 'round';
  ctx.strokeText('행복한 망고', w * 0.5, textCenterY);

  // Warm mango-cream thermoplastic road paint fill
  const textGrad = ctx.createLinearGradient(0, textCenterY - 75, 0, textCenterY + 75);
  textGrad.addColorStop(0, '#fff7dc');
  textGrad.addColorStop(1, '#ffd15c');
  ctx.fillStyle = textGrad;
  ctx.fillText('행복한 망고', w * 0.5, textCenterY);

  // Clean decorative bike-path accent bars framing the text
  ctx.fillStyle = 'rgba(255, 225, 130, 0.85)';
  ctx.fillRect(w * 0.16, textCenterY - 102, w * 0.68, 10);
  ctx.fillRect(w * 0.16, textCenterY + 94, w * 0.68, 10);
  ctx.restore();

  // Light asphalt speckles overlaid on paint so it feels naturally bonded to the road surface
  for (let i = 0; i < 650; i++) {
    const x = w * 0.12 + rand() * w * 0.76;
    const y = textCenterY - 110 + rand() * 220;
    ctx.fillStyle = 'rgba(72, 78, 84, 0.28)';
    ctx.fillRect(x, y, 3, 3);
  }

  // Roughness map (asphalt rough ~0.9, thermoplastic road stripes & lettering smoother ~0.55)
  const rw = rCtx.canvas.width;
  const rh = rCtx.canvas.height;
  rCtx.fillStyle = '#dadada';
  rCtx.fillRect(0, 0, rw, rh);
  for (let i = 0; i < 3200; i++) {
    const v = Math.floor(198 + rand() * 45);
    rCtx.fillStyle = `rgb(${v},${v},${v})`;
    rCtx.fillRect(rand() * rw, rand() * rh, 2, 2);
  }
  rCtx.fillStyle = '#969696';
  rCtx.fillRect(rw * (48 / w), 0, rw * (22 / w), rh);
  rCtx.fillRect(rw * ((w - 70) / w), 0, rw * (22 / w), rh);

  rCtx.save();
  rCtx.scale(rw / w, rh / h);
  rCtx.textAlign = 'center';
  rCtx.textBaseline = 'middle';
  rCtx.font = '700 132px "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
  rCtx.fillStyle = '#888888';
  rCtx.fillText('행복한 망고', w * 0.5, textCenterY);
  rCtx.fillRect(w * 0.16, textCenterY - 102, w * 0.68, 10);
  rCtx.fillRect(w * 0.16, textCenterY + 94, w * 0.68, 10);
  rCtx.restore();
}

function createRoadTextures(maxAnisotropy: number) {
  const w = 1024;
  const h = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = 512;
  roughCanvas.height = 512;
  const rCtx = roughCanvas.getContext('2d')!;

  drawRoadCanvasContent(ctx, rCtx, w, h);

  // 180m road / 18 repeats = 10m per tile so "행복한 망고" repeats cleanly with generous spacing
  const roadMap = configureColorTexture(canvas, maxAnisotropy, 1, 18);
  const roadRoughness = configureDataTexture(roughCanvas, maxAnisotropy, 1, 18);

  // Re-render once Google Font (Noto Sans KR) finishes loading for razor-sharp Korean typography
  if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
    void document.fonts.ready.then(() => {
      drawRoadCanvasContent(ctx, rCtx, w, h);
      roadMap.needsUpdate = true;
      roadRoughness.needsUpdate = true;
    });
  }

  return { roadMap, roadRoughness };
}

function createGrassTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRandom(7731);

  ctx.fillStyle = '#5e8b43';
  ctx.fillRect(0, 0, size, size);

  // Soft sunlit dappled meadow patches
  for (let i = 0; i < 60; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 30 + rand() * 75;
    const g = ctx.createRadialGradient(x, y, 2, x, y, r);
    const warm = rand() > 0.45;
    g.addColorStop(0, warm ? 'rgba(130, 174, 72, 0.28)' : 'rgba(65, 108, 45, 0.25)');
    g.addColorStop(1, 'rgba(94, 139, 67, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // Fine blades
  ctx.lineCap = 'round';
  for (let i = 0; i < 3500; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const h = 4 + rand() * 8;
    ctx.strokeStyle = rand() > 0.5 ? 'rgba(155, 195, 88, 0.32)' : 'rgba(54, 92, 38, 0.34)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - 0.5) * 4, y - h);
    ctx.stroke();
  }

  return configureColorTexture(canvas, maxAnisotropy, 24, 24);
}

function createWickerTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#9b6b38';
  ctx.fillRect(0, 0, size, size);

  const cell = 16;
  for (let y = 0; y < size; y += cell) {
    for (let x = 0; x < size; x += cell) {
      const alt = ((x / cell) + (y / cell)) % 2 === 0;
      ctx.fillStyle = alt ? '#c99352' : '#b27b3d';
      ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
      ctx.fillStyle = alt ? 'rgba(255,230,185,0.28)' : 'rgba(65,36,12,0.24)';
      if (alt) {
        ctx.fillRect(x + 2, y + 2, cell - 4, 4);
      } else {
        ctx.fillRect(x + 2, y + 2, 4, cell - 4);
      }
    }
  }

  return configureColorTexture(canvas, maxAnisotropy, 2, 1.5);
}

function createScarfTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 256;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Crimson & warm cream collegiate knit stripes
  ctx.fillStyle = '#c8342a';
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#f8ecd4';
  for (let y = 24; y < h; y += 64) {
    ctx.fillRect(0, y, w, 12);
    ctx.fillStyle = '#eab308';
    ctx.fillRect(0, y + 14, w, 5);
    ctx.fillStyle = '#f8ecd4';
  }

  // Subtle knit stitch texture
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 6) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }

  return configureColorTexture(canvas, maxAnisotropy, 1, 2);
}

function createContactShadowTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, size, size);
  const grad = ctx.createRadialGradient(
    size * 0.5,
    size * 0.5,
    size * 0.08,
    size * 0.5,
    size * 0.5,
    size * 0.48,
  );
  grad.addColorStop(0, 'rgba(12, 16, 14, 0.62)');
  grad.addColorStop(0.55, 'rgba(12, 16, 14, 0.28)');
  grad.addColorStop(1, 'rgba(12, 16, 14, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createProceduralTextures(renderer: THREE.WebGLRenderer): ProceduralTextureSet {
  const maxAniso = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  const { tigerFurMap, tigerFurBump } = createTigerFurTextures(maxAniso);
  const tigerHeadMap = createTigerHeadTexture(maxAniso);
  const tigerTailMap = createTigerTailTexture(maxAniso);
  const { roadMap, roadRoughness } = createRoadTextures(maxAniso);
  const grassMap = createGrassTexture(maxAniso);
  const wickerMap = createWickerTexture(maxAniso);
  const scarfMap = createScarfTexture(maxAniso);
  const contactShadowMap = createContactShadowTexture(maxAniso);

  return {
    tigerFurMap,
    tigerFurBump,
    tigerHeadMap,
    tigerTailMap,
    roadMap,
    roadRoughness,
    grassMap,
    wickerMap,
    scarfMap,
    contactShadowMap,
    dispose: () => {
      tigerFurMap.dispose();
      tigerFurBump.dispose();
      tigerHeadMap.dispose();
      tigerTailMap.dispose();
      roadMap.dispose();
      roadRoughness.dispose();
      grassMap.dispose();
      wickerMap.dispose();
      scarfMap.dispose();
      contactShadowMap.dispose();
    },
  };
}
