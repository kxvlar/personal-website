(function(){
  const canvas = document.getElementById('saddle-canvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');

  const DPR = window.devicePixelRatio || 1;
  let W, H;

  function resize(){
    const rect = canvas.parentElement.getBoundingClientRect();
    W = rect.width;
    H = W; // square canvas
    canvas.style.height = W + 'px';
    canvas.style.paddingBottom = '0';
    canvas.width  = W * DPR;
    canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  // ─── MESH GENERATION ─────────────────────────────────────
  // Monkey's saddle: z = x³ - 3xy²
  const GRID = 40;
  const RANGE = 1.2;
  const SCALE = 0.32;

  function saddleZ(x, y){
    return (x*x*x - 3*x*y*y) * SCALE;
  }

  // Pre-compute mesh vertices (grid of points on the surface)
  const verts = [];
  for(let i = 0; i <= GRID; i++){
    const row = [];
    const u = (i / GRID) * 2 - 1;
    for(let j = 0; j <= GRID; j++){
      const v = (j / GRID) * 2 - 1;
      const x = u * RANGE;
      const y = v * RANGE;
      const z = saddleZ(x, y);
      row.push([x, y, z]);
    }
    verts.push(row);
  }

  // ─── 3D PROJECTION ───────────────────────────────────────
  const FOV = 3.5;
  const CAM_DIST = 4.0;

  function rotateY(p, a){
    const c = Math.cos(a), s = Math.sin(a);
    return [c*p[0] + s*p[2], p[1], -s*p[0] + c*p[2]];
  }
  function rotateX(p, a){
    const c = Math.cos(a), s = Math.sin(a);
    return [p[0], c*p[1] - s*p[2], s*p[1] + c*p[2]];
  }

  function project(p, angleY, angleX){
    let pt = rotateY(p, angleY);
    pt = rotateX(pt, angleX);
    const z = pt[2] + CAM_DIST;
    if(z < 0.1) return null;
    const scale = FOV / z;
    return {
      x: W/2 + pt[0] * scale * W * 0.22,
      y: H/2 - pt[1] * scale * W * 0.22,
      z: z,
      nz: pt[2]
    };
  }

  // ─── RENDER ───────────────────────────────────────────────
  const ACCENT = [200, 168, 74];
  const ACCENT2 = [232, 228, 220];

  function draw(time){
    ctx.clearRect(0, 0, W, H);

    const angleY = time * 0.0002;
    const angleX = -0.55;

    // Project all vertices
    const projected = [];
    for(let i = 0; i <= GRID; i++){
      const row = [];
      for(let j = 0; j <= GRID; j++){
        row.push(project(verts[i][j], angleY, angleX));
      }
      projected.push(row);
    }

    // Collect line segments with depth for painter's sort
    const segments = [];

    // Grid lines along u-direction
    for(let i = 0; i <= GRID; i++){
      for(let j = 0; j < GRID; j++){
        const a = projected[i][j];
        const b = projected[i][j+1];
        if(!a || !b) continue;
        segments.push({ ax:a.x, ay:a.y, bx:b.x, by:b.y, z:(a.z+b.z)/2, nz:(a.nz+b.nz)/2 });
      }
    }
    // Grid lines along v-direction
    for(let j = 0; j <= GRID; j++){
      for(let i = 0; i < GRID; i++){
        const a = projected[i][j];
        const b = projected[i+1][j];
        if(!a || !b) continue;
        segments.push({ ax:a.x, ay:a.y, bx:b.x, by:b.y, z:(a.z+b.z)/2, nz:(a.nz+b.nz)/2 });
      }
    }

    // Sort back-to-front
    segments.sort((a, b) => b.z - a.z);

    // Draw
    for(const seg of segments){
      // Depth-based opacity: closer = brighter
      const depthNorm = (seg.z - 2.5) / 3.0;
      const facing = Math.max(0, -seg.nz * 0.5 + 0.5);
      const alpha = Math.max(0.04, Math.min(0.55, (1 - depthNorm) * 0.4 * facing + 0.08));

      // Blend accent gold → pale white based on surface normal
      const blend = Math.max(0, Math.min(1, facing));
      const r = Math.round(ACCENT[0] + (ACCENT2[0] - ACCENT[0]) * blend * 0.3);
      const g = Math.round(ACCENT[1] + (ACCENT2[1] - ACCENT[1]) * blend * 0.3);
      const bv = Math.round(ACCENT[2] + (ACCENT2[2] - ACCENT[2]) * blend * 0.3);

      ctx.beginPath();
      ctx.moveTo(seg.ax, seg.ay);
      ctx.lineTo(seg.bx, seg.by);
      ctx.strokeStyle = `rgba(${r},${g},${bv},${alpha})`;
      ctx.lineWidth = 0.6 + facing * 0.4;
      ctx.stroke();
    }

    // Subtle glow at centre
    const glow = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, W*0.28);
    glow.addColorStop(0, 'rgba(200,168,74,0.04)');
    glow.addColorStop(1, 'rgba(200,168,74,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);
})();
