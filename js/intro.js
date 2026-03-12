// ═══════════════════════════════════════════════════════════
//  HYPER-REALISTIC 3D CARD ENGINE — full Canvas2D renderer
//  Each card is drawn with:
//   • perspective projection (z-depth → scale + shadow offset)
//   • surface normal lighting (directional + ambient)
//   • specular glint strip
//   • edge bevel highlights
//   • cast shadow on background
//   • motion blur ghost at high velocity
// ═══════════════════════════════════════════════════════════

const canvas = document.getElementById('intro-canvas');
const ctx    = canvas.getContext('2d');
const $      = id => document.getElementById(id);
const rand   = (a,b) => a + Math.random()*(b-a);
const clamp  = (v,a,b) => Math.max(a,Math.min(b,v));
const delay  = ms => new Promise(r => setTimeout(r,ms));
const TAU    = Math.PI*2;
const PHI    = Math.PI*(3-Math.sqrt(5));

let W, H, cx, cy;
function resize(){
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
  cx = W/2; cy = H/2;
}
resize();
window.addEventListener('resize', resize);

// ─── LIGHT SOURCE (world-space) ────────────────────────────
const LIGHT = { x:0.4, y:-0.7, z:0.6 };
const mag = Math.hypot(LIGHT.x,LIGHT.y,LIGHT.z);
LIGHT.x/=mag; LIGHT.y/=mag; LIGHT.z/=mag;

// ─── CARD GEOMETRY ─────────────────────────────────────────
const CARD_W = 0.063;
const CARD_H = CARD_W * 1.4;
const FOV    = 700;

function project(x3,y3,z3){
  const s = FOV / (FOV + z3);
  return { x: cx + x3*s, y: cy + y3*s, s };
}

// ─── DRAW ONE CARD FACE ─────────────────────────────────────
function drawCardFace(ctx, w, h, suit, rank, isBack, lightX, lightY, lightZ){
  const r = w*0.07;
  const diffuse = clamp(lightZ*0.7 + 0.3, 0, 1);

  // 1 — Rich base gradient with warm/cool shift
  const g = ctx.createLinearGradient(-w/2,-h/2,w/2,h/2);
  if(isBack){
    g.addColorStop(0,'#120a2a');
    g.addColorStop(0.3,'#2a1660');
    g.addColorStop(0.5,'#341d72');
    g.addColorStop(0.7,'#2a1660');
    g.addColorStop(1,'#120a2a');
  } else {
    g.addColorStop(0,'#fffdf8');
    g.addColorStop(0.25,'#faf5ea');
    g.addColorStop(0.5,'#f5edd8');
    g.addColorStop(0.75,'#f0e6cc');
    g.addColorStop(1,'#ebe0c2');
  }
  roundRect(ctx,-w/2,-h/2,w,h,r);
  ctx.fillStyle = g;
  ctx.fill();

  // 2 — Paper / cloth texture noise (subtle tint variation)
  if(!isBack){
    const tg = ctx.createRadialGradient(w*0.15,-h*0.2,0, 0,0,Math.max(w,h)*0.8);
    tg.addColorStop(0,'rgba(255,248,235,0.18)');
    tg.addColorStop(0.5,'rgba(245,230,200,0.06)');
    tg.addColorStop(1,'rgba(220,200,160,0.08)');
    roundRect(ctx,-w/2,-h/2,w,h,r);
    ctx.fillStyle = tg;
    ctx.fill();
  }

  // 3 — Directional diffuse lighting
  const diffG = ctx.createRadialGradient(
    lightX*w*0.45, lightY*h*0.45, 0,
    0, 0, Math.max(w,h)*1.1
  );
  if(isBack){
    diffG.addColorStop(0, `rgba(100,70,180,${0.4*diffuse})`);
    diffG.addColorStop(0.5,`rgba(40,20,80,${0.2*diffuse})`);
    diffG.addColorStop(1, `rgba(0,0,0,${0.5*(1-diffuse*0.4)})`);
  } else {
    diffG.addColorStop(0, `rgba(255,255,250,${0.6*diffuse})`);
    diffG.addColorStop(0.4,`rgba(255,248,230,${0.25*diffuse})`);
    diffG.addColorStop(1, `rgba(180,160,120,${0.25*(1-diffuse*0.35)})`);
  }
  roundRect(ctx,-w/2,-h/2,w,h,r);
  ctx.fillStyle = diffG;
  ctx.fill();

  // 4 — Primary specular highlight (broad hot-spot)
  const specAngle = Math.atan2(lightY,lightX);
  const specX = Math.cos(specAngle)*w*0.22;
  const specY = Math.sin(specAngle)*h*0.22;
  const specPow = clamp(lightZ,0,1);
  const hotspot = ctx.createRadialGradient(specX,specY,0, specX,specY, w*0.55);
  hotspot.addColorStop(0,`rgba(255,255,255,${0.5*specPow})`);
  hotspot.addColorStop(0.35,`rgba(255,255,250,${0.18*specPow})`);
  hotspot.addColorStop(1,'rgba(255,255,255,0)');
  roundRect(ctx,-w/2,-h/2,w,h,r);
  ctx.fillStyle = hotspot;
  ctx.fill();

  // 5 — Sharp specular glint strip (the glossy "swipe")
  const sG = ctx.createLinearGradient(
    specX-w*0.35, specY-h*0.35,
    specX+w*0.35, specY+h*0.35
  );
  sG.addColorStop(0,'rgba(255,255,255,0)');
  sG.addColorStop(0.42,'rgba(255,255,255,0)');
  sG.addColorStop(0.5, `rgba(255,255,255,${0.55*specPow})`);
  sG.addColorStop(0.58,'rgba(255,255,255,0)');
  sG.addColorStop(1,'rgba(255,255,255,0)');
  roundRect(ctx,-w/2,-h/2,w,h,r);
  ctx.fillStyle = sG;
  ctx.fill();

  // 6 — Inner edge shadow (ambient occlusion around edges)
  ctx.save();
  roundRect(ctx,-w/2,-h/2,w,h,r);
  ctx.clip();
  const aoG = ctx.createRadialGradient(0,0, Math.min(w,h)*0.28, 0,0, Math.max(w,h)*0.62);
  aoG.addColorStop(0,'rgba(0,0,0,0)');
  aoG.addColorStop(1, isBack ? 'rgba(0,0,20,0.35)' : 'rgba(60,40,10,0.12)');
  ctx.fillStyle = aoG;
  ctx.fillRect(-w/2,-h/2,w,h);

  // 7 — Bright edge bevel on lit sides
  const bevelAlpha = clamp(lightZ*0.9,0.08,0.6);
  ctx.strokeStyle = isBack
    ? `rgba(160,120,255,${bevelAlpha})`
    : `rgba(255,255,245,${bevelAlpha*1.5})`;
  ctx.lineWidth = 2.5;
  roundRect(ctx,-w/2+1,-h/2+1,w-2,h-2,r);
  ctx.stroke();
  ctx.strokeStyle = isBack
    ? `rgba(0,0,20,${bevelAlpha*0.6})`
    : `rgba(120,100,60,${bevelAlpha*0.3})`;
  ctx.lineWidth = 1.5;
  roundRect(ctx,-w/2+0.5,-h/2+0.5,w-1,h-1,r);
  ctx.stroke();
  ctx.restore();

  // 8 — Crisp outer border
  ctx.strokeStyle = isBack
    ? 'rgba(200,168,74,0.7)'
    : 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 1.8;
  roundRect(ctx,-w/2,-h/2,w,h,r);
  ctx.stroke();

  // 9 — Content
  if(isBack){
    drawBackDesign(ctx, w, h);
  } else {
    drawFaceContent(ctx, w, h, suit, rank);
  }
}

function roundRect(ctx,x,y,w,h,r){
  r = Math.max(0, Math.min(r, Math.abs(w)/2, Math.abs(h)/2));
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.lineTo(x+w-r,y);ctx.arcTo(x+w,y,x+w,y+r,r);
  ctx.lineTo(x+w,y+h-r);ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
  ctx.lineTo(x+r,y+h);ctx.arcTo(x,y+h,x,y+h-r,r);
  ctx.lineTo(x,y+r);ctx.arcTo(x,y,x+r,y,r);
  ctx.closePath();
}

function drawBackDesign(ctx,w,h){
  ctx.save();
  const ib = w*0.08;
  ctx.strokeStyle='rgba(200,168,74,0.55)';
  ctx.lineWidth=1.5;
  roundRect(ctx,-w/2+ib,-h/2+ib,w-ib*2,h-ib*2,w*0.04);
  ctx.stroke();
  ctx.strokeStyle='rgba(200,168,74,0.25)';
  ctx.lineWidth=0.8;
  roundRect(ctx,-w/2+ib*1.5,-h/2+ib*1.5,w-ib*3,h-ib*3,w*0.03);
  ctx.stroke();
  ctx.save();
  roundRect(ctx,-w/2+ib,-h/2+ib,w-ib*2,h-ib*2,w*0.04);
  ctx.clip();
  ctx.globalAlpha=0.09;
  ctx.strokeStyle='rgba(200,168,74,1)';
  ctx.lineWidth=0.5;
  const step=w*0.06;
  for(let i=-w*1.5;i<w*1.5;i+=step){
    ctx.beginPath();ctx.moveTo(i,-h/2);ctx.lineTo(i+h,h/2);ctx.stroke();
    ctx.beginPath();ctx.moveTo(i,-h/2);ctx.lineTo(i-h,h/2);ctx.stroke();
  }
  ctx.globalAlpha=1;
  ctx.restore();
  ctx.save();
  ctx.rotate(Math.PI/4);
  const dSz=w*0.14;
  ctx.shadowColor='rgba(200,168,74,0.35)';
  ctx.shadowBlur=w*0.08;
  ctx.fillStyle='rgba(200,168,74,0.18)';
  ctx.fillRect(-dSz,-dSz,dSz*2,dSz*2);
  ctx.shadowBlur=0;
  ctx.strokeStyle='rgba(200,168,74,0.6)';
  ctx.lineWidth=1.2;
  ctx.strokeRect(-dSz,-dSz,dSz*2,dSz*2);
  ctx.strokeStyle='rgba(200,168,74,0.3)';
  ctx.lineWidth=0.6;
  ctx.strokeRect(-dSz*0.6,-dSz*0.6,dSz*1.2,dSz*1.2);
  ctx.restore();
  const dotR=w*0.015;
  ctx.fillStyle='rgba(200,168,74,0.45)';
  [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([dx,dy])=>{
    ctx.beginPath();
    ctx.arc(dx*(w/2-ib*1.3), dy*(h/2-ib*1.3), dotR, 0, TAU);
    ctx.fill();
  });
  ctx.restore();
}

const RED_SUITS  = new Set(['♥','♦']);
function suitColor(suit){ return RED_SUITS.has(suit)?'#c0182a':'#1a1a2e'; }

function drawFaceContent(ctx,w,h,suit,rank){
  ctx.save();
  const col = suitColor(suit);
  const isRed = RED_SUITS.has(suit);
  const cPad = w*0.1;
  const cFontSz = w*0.19;

  ctx.textAlign='center'; ctx.textBaseline='middle';

  function drawCorner(){
    ctx.font = `700 ${cFontSz}px 'Space Grotesk',sans-serif`;
    ctx.fillStyle = col;
    if(isRed){
      ctx.shadowColor='rgba(192,24,42,0.3)';
      ctx.shadowBlur=w*0.04;
    } else {
      ctx.shadowColor='rgba(10,10,30,0.25)';
      ctx.shadowBlur=w*0.03;
    }
    ctx.fillText(rank, -w/2+cPad+cFontSz*0.32, -h/2+cPad+cFontSz*0.05);
    ctx.shadowBlur=0;
    ctx.font = `${cFontSz*0.8}px serif`;
    ctx.fillText(suit, -w/2+cPad+cFontSz*0.32, -h/2+cPad+cFontSz*1.05);
  }

  drawCorner();
  ctx.save();
  ctx.rotate(Math.PI);
  drawCorner();
  ctx.restore();

  const pipSize = w*0.55;
  ctx.font = `${pipSize}px serif`;
  ctx.fillStyle = col;
  ctx.globalAlpha = 0.92;
  if(isRed){
    ctx.shadowColor='rgba(192,24,42,0.6)';
    ctx.shadowBlur=w*0.2;
  } else {
    ctx.shadowColor='rgba(10,10,40,0.45)';
    ctx.shadowBlur=w*0.15;
  }
  ctx.fillText(suit, 0, h*0.02);
  ctx.shadowBlur=0;
  ctx.globalAlpha=0.12;
  ctx.fillStyle='#fff';
  ctx.fillText(suit, -w*0.008, -h*0.008);
  ctx.globalAlpha=1;
  ctx.restore();
}

// ─── DRAW 3D CARD OBJECT ───────────────────────────────────
function drawCard3D(card){
  const { x, y, z, rx, ry, rz, suit, rank, isBack } = card;
  const baseS = Math.min(W,H);
  const heroMul = card.heroScale || 1;
  const cw = baseS*CARD_W*heroMul;
  const ch = baseS*CARD_H*heroMul;

  const s  = FOV/(FOV + z);
  const px = cx + x*s;
  const py = cy + y*s;

  const hw = cw*s*0.5;
  const hh = ch*s*0.5;

  const nx = Math.sin(ry);
  const ny = -Math.sin(rx)*Math.cos(ry);
  const nz = Math.cos(rx)*Math.cos(ry);
  const dot = nx*LIGHT.x + ny*LIGHT.y + nz*LIGHT.z;
  const diffuse = clamp(dot*0.65 + 0.45, 0.1, 1.0);

  const lightLocalX = LIGHT.x*Math.cos(rz) + LIGHT.y*Math.sin(rz);
  const lightLocalY =-LIGHT.x*Math.sin(rz) + LIGHT.y*Math.cos(rz);

  if(hw < 1 || hh < 1 || s <= 0){ return; }

  // Cast shadow
  const shadowDist = (500-z)*0.016;
  const shadowBlur  = Math.max(0, 22 + (500-z)*0.04);
  ctx.save();
  ctx.translate(px + LIGHT.x*shadowDist, py - LIGHT.y*shadowDist);
  ctx.rotate(rz);
  ctx.scale(1.02, Math.abs(Math.cos(rx))*1.02);
  roundRect(ctx, -hw*1.08, -hh*1.08, hw*2.16, hh*2.16, hw*0.07);
  ctx.fillStyle = `rgba(0,0,0,${clamp(0.65*(s*s),0.08,0.65)})`;
  ctx.filter = `blur(${shadowBlur}px)`;
  ctx.fill();
  ctx.filter='none';
  ctx.restore();

  // Contact shadow
  ctx.save();
  ctx.translate(px + LIGHT.x*shadowDist*0.3, py - LIGHT.y*shadowDist*0.3);
  ctx.rotate(rz);
  ctx.scale(1, Math.abs(Math.cos(rx)));
  roundRect(ctx, -hw*1.01, -hh*1.01, hw*2.02, hh*2.02, hw*0.06);
  ctx.fillStyle = `rgba(0,0,0,${clamp(0.3*(s*s),0.02,0.3)})`;
  ctx.filter = `blur(${Math.max(2,shadowBlur*0.25)}px)`;
  ctx.fill();
  ctx.filter='none';
  ctx.restore();

  // Motion ghost at high velocity
  if(card.vx !== undefined){
    const speed = Math.hypot(card.vx, card.vy, card.vz||0);
    if(speed > 3){
      const ghostCount = Math.min(4, Math.floor(speed/3.5));
      for(let g=1;g<=ghostCount;g++){
        const gf = g/ghostCount;
        ctx.save();
        ctx.globalAlpha = 0.09*(1-gf);
        ctx.translate(px - card.vx*g*0.45, py - card.vy*g*0.45);
        ctx.rotate(rz);
        ctx.scale(1*s, Math.cos(rx)*s);
        roundRect(ctx,-cw/2,-ch/2,cw,ch,cw*0.06);
        ctx.fillStyle='rgba(220,210,240,1)';
        ctx.fill();
        ctx.restore();
        ctx.globalAlpha=1;
      }
    }
  }

  // Actual card face
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(rz);
  const cosRx = Math.abs(Math.cos(rx));
  ctx.scale(s, cosRx*s);

  const showBack = isBack || (Math.abs(ry%(TAU)) > Math.PI/2 && Math.abs(ry%(TAU)) < Math.PI*1.5);

  ctx.globalAlpha = clamp(diffuse * 0.94 + 0.06, 0.18, 1.0);
  drawCardFace(ctx, cw, ch, suit, rank, showBack, lightLocalX, lightLocalY, nz);
  ctx.globalAlpha = 1;

  // Diffuse darkening on unlit side
  if(diffuse < 0.8){
    roundRect(ctx,-cw/2,-ch/2,cw,ch,cw*0.06);
    ctx.fillStyle = `rgba(0,0,10,${(1-diffuse)*0.5})`;
    ctx.fill();
  }

  // Rim-light effect on lit edges
  if(diffuse > 0.4){
    ctx.save();
    roundRect(ctx,-cw/2,-ch/2,cw,ch,cw*0.07);
    ctx.clip();
    const rimAlpha = (diffuse-0.4)*0.4;
    ctx.strokeStyle = showBack
      ? `rgba(180,140,255,${rimAlpha})`
      : `rgba(255,250,230,${rimAlpha})`;
    ctx.lineWidth = 3;
    roundRect(ctx,-cw/2,-ch/2,cw,ch,cw*0.07);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

// ─── CARD POOL ─────────────────────────────────────────────
const SUITS  = ['♥','♦','♠','♣'];
const RANKS  = ['A','K','Q','J','10','9','8','7','6','5','4','3','2'];
function rSuit(){ return SUITS[Math.floor(rand(0,4))]; }
function rRank(){ return RANKS[Math.floor(rand(0,13))]; }

// ─── SCENE STATE ───────────────────────────────────────────
let cards = [];
let phase = 'idle';

// ─── PHASE 1: RAIN ─────────────────────────────────────────
function spawnRainCard(delay_ms){
  return new Promise(resolve => {
    const suit  = rSuit();
    const rank  = rRank();
    const isBack= Math.random()<0.55;
    const startX = rand(-W*0.5, W*0.5);
    const startY = rand(-H*0.5, H*0.5);
    const startZ = rand(-1800, -800);
    const card = {
      x:startX, y:startY, z:startZ,
      vx:rand(-2,2), vy:rand(1,4), vz:rand(28,55),
      rx:rand(-0.4,0.4), ry:rand(-0.5,0.5), rz:rand(-0.6,0.6),
      vrx:rand(-0.02,0.02), vry:rand(-0.03,0.03), vrz:rand(-0.025,0.025),
      suit, rank, isBack, done:false, active:false
    };

    setTimeout(()=>{
      card.active = true;
      cards.push(card);
      const check = setInterval(()=>{
        if(card.z > 700){ card.done=true; clearInterval(check); resolve(); }
      },16);
    }, delay_ms);
  });
}

// ─── PHASE 2: CHAOS SHUFFLE ────────────────────────────────
function spawnShuffleCard(delay_ms){
  return new Promise(resolve=>{
    const suit=rSuit(),rank=rRank(),isBack=Math.random()<0.5;
    const angle = rand(0,TAU);
    const speed = rand(8,18);
    const card = {
      x:0, y:0, z:rand(50,300),
      vx:Math.cos(angle)*speed, vy:Math.sin(angle)*speed, vz:rand(-6,10),
      rx:rand(-1,1),ry:rand(-1,1),rz:rand(-1,1),
      vrx:rand(-0.06,0.06),vry:rand(-0.08,0.08),vrz:rand(-0.05,0.05),
      suit,rank,isBack,done:false,active:false,
      life:0, maxLife:40
    };
    setTimeout(()=>{
      card.active=true; cards.push(card);
      const check=setInterval(()=>{
        if(card.life>=card.maxLife){card.done=true;clearInterval(check);resolve();}
      },16);
    },delay_ms);
  });
}

// ─── PHASE 3: FIBONACCI VORTEX ─────────────────────────────
function spawnFibCard(i,N,delay_ms){
  return new Promise(resolve=>{
    const suit=rSuit(),rank=rRank(),isBack=Math.random()<0.45;
    const fibAngle = i*PHI;
    const fibR     = Math.sqrt(i/N)*Math.min(W,H)*0.45;
    const sx = Math.cos(fibAngle)*fibR;
    const sy = Math.sin(fibAngle)*fibR;
    const sz = rand(-200,200);
    const turns = (1.2 + fibR/300)*TAU;
    const card = {
      x:sx,y:sy,z:sz,
      vx:0,vy:0,vz:0,
      rx:rand(-0.6,0.6),ry:rand(-0.8,0.8),rz:fibAngle,
      vrx:rand(-0.04,0.04),vry:rand(-0.05,0.05),vrz:0,
      suit,rank,isBack,done:false,active:false,
      fibR,fibAngle,turns,
      spiralT:0
    };
    setTimeout(()=>{
      card.active=true; cards.push(card);
      const check=setInterval(()=>{
        if(card.spiralT>=1){card.done=true;clearInterval(check);resolve();}
      },16);
    },delay_ms);
  });
}

function updateFibCard(card){
  const dt = 0.018;
  card.spiralT = Math.min(1, card.spiralT+dt);
  const t = card.spiralT;
  const ease = t<0.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
  const curAngle = card.fibAngle + card.turns*ease;
  const curR = card.fibR*(1-ease);
  card.x = Math.cos(curAngle)*curR;
  card.y = Math.sin(curAngle)*curR;
  card.z = card.z*(1-ease*0.03);
  card.rz = curAngle;
  card.rx += card.vrx;
  card.ry += card.vry;
}

// ─── HERO CARDS (K♥ and A♥) ──────────────────────────────────
let heroL = null, heroR = null;

const HERO_SCALE = 5.5;

let orbitAngle   = Math.PI;
let orbitSpeed   = 0;
let orbitRadius  = 0;
let orbitActive  = false;
let orbitCollapse = false;
let orbitCollapseT = 0;

function spawnHeroCards(){
  return new Promise(resolve=>{
    heroL = {
      x:-W*0.28, y:0, z:-1800,
      vx:0, vy:0, vz:65,
      rx:0.08, ry:-0.18, rz:-0.03,
      vrx:-0.003, vry:0.005, vrz:0.001,
      suit:'♥', rank:'K', isBack:false,
      phase:'enter', done:false, active:true,
      targetZ:550,
      heroScale: HERO_SCALE
    };
    heroR = {
      x:W*0.28, y:0, z:-2000,
      vx:0, vy:0, vz:65,
      rx:-0.06, ry:0.15, rz:0.02,
      vrx:0.003, vry:-0.004, vrz:-0.001,
      suit:'♥', rank:'A', isBack:false,
      phase:'enter', done:false, active:true,
      targetZ:550,
      heroScale: HERO_SCALE
    };
    cards.push(heroL, heroR);
    const check = setInterval(()=>{
      if(heroL.phase==='hold' && heroR.phase==='hold'){
        clearInterval(check); resolve();
      }
    },16);
  });
}

function startOrbit(){
  orbitAngle    = Math.PI;
  orbitSpeed    = 0.008;
  orbitRadius   = W * 0.28;
  orbitActive   = true;
  orbitCollapse = false;
  orbitCollapseT = 0;
  if(heroL) heroL.phase = 'orbit';
  if(heroR) heroR.phase = 'orbit';
}

function collapseOrbit(){
  orbitCollapse  = true;
  orbitCollapseT = 0;
}

function updateHero(card){
  if(card.phase==='enter'){
    const dz = card.targetZ - card.z;
    if(dz <= 0.5){
      card.z = card.targetZ; card.vz = 0;
      card.phase = 'hold';
      card.rx = 0; card.ry = 0; card.rz = 0;
    } else {
      card.vz = Math.max(2, dz*0.08);
      card.z += card.vz;
      card.rx *= 0.96; card.ry *= 0.96; card.rz *= 0.96;
    }
  } else if(card.phase==='hold'){
    card.rx = Math.sin(Date.now()*0.001)*0.04;
    card.ry = Math.sin(Date.now()*0.0013)*0.06;
  } else if(card.phase==='orbit'){
    // position + tilt set by updateOrbit()
  }
}

function updateOrbit(){
  if(!orbitActive) return;

  if(orbitCollapse){
    orbitCollapseT = Math.min(1, orbitCollapseT + 0.02);
    const ease = orbitCollapseT < 0.5
      ? 2*orbitCollapseT*orbitCollapseT
      : 1 - Math.pow(-2*orbitCollapseT+2,2)/2;
    orbitSpeed = Math.min(orbitSpeed + 0.006, 0.6);
    orbitRadius = W * 0.28 * (1 - ease);
    const pullZ = -2500;
    if(heroL) heroL.z += (pullZ - heroL.z) * ease * 0.05;
    if(heroR) heroR.z += (pullZ - heroR.z) * ease * 0.05;

    if(orbitCollapseT >= 1){
      if(heroL){ heroL.done = true; }
      if(heroR){ heroR.done = true; }
      orbitActive = false;
      return;
    }
  } else {
    orbitSpeed = Math.min(orbitSpeed + 0.0006, 0.18);
  }

  orbitAngle += orbitSpeed;

  const rx = orbitRadius;
  const ry = orbitRadius * 0.38;

  if(heroL && heroL.phase==='orbit'){
    heroL.x  = Math.cos(orbitAngle) * rx;
    heroL.y  = Math.sin(orbitAngle) * ry;
    heroL.rz = orbitAngle + Math.PI/2;
    heroL.ry = Math.sin(orbitAngle) * Math.min(0.9, orbitSpeed * 30);
    heroL.rx = Math.cos(orbitAngle) * Math.min(0.4, orbitSpeed * 12);
  }
  if(heroR && heroR.phase==='orbit'){
    heroR.x  = Math.cos(orbitAngle + Math.PI) * rx;
    heroR.y  = Math.sin(orbitAngle + Math.PI) * ry;
    heroR.rz = orbitAngle + Math.PI + Math.PI/2;
    heroR.ry = Math.sin(orbitAngle + Math.PI) * Math.min(0.9, orbitSpeed * 30);
    heroR.rx = Math.cos(orbitAngle + Math.PI) * Math.min(0.4, orbitSpeed * 12);
  }
}

// ─── MAIN RENDER LOOP ──────────────────────────────────────
let rafId = null;
let sceneRunning = true;

function renderLoop(){
  if(!sceneRunning) return;
  ctx.clearRect(0,0,W,H);

  ctx.fillStyle='#03040a';
  ctx.fillRect(0,0,W,H);

  ctx.save();
  ctx.strokeStyle='rgba(200,168,74,0.025)';
  ctx.lineWidth=1;
  const gs=80;
  for(let gx=0;gx<W;gx+=gs){ ctx.beginPath();ctx.moveTo(gx,0);ctx.lineTo(gx,H);ctx.stroke(); }
  for(let gy=0;gy<H;gy+=gs){ ctx.beginPath();ctx.moveTo(0,gy);ctx.lineTo(W,gy);ctx.stroke(); }
  ctx.restore();

  cards.sort((a,b)=>a.z-b.z);

  for(const card of cards){
    if(!card.active) continue;
    if(card.spiralT !== undefined){
      updateFibCard(card);
    } else if(card===heroL || card===heroR){
      updateHero(card);
    } else if(card.life !== undefined){
      card.x += card.vx; card.y += card.vy; card.z += card.vz;
      card.rx+=card.vrx; card.ry+=card.vry; card.rz+=card.vrz;
      card.vx*=0.95; card.vy*=0.95; card.vz*=0.97;
      card.life++;
    } else {
      card.x+=card.vx; card.y+=card.vy; card.z+=card.vz;
      card.rx+=card.vrx; card.ry+=card.vry; card.rz+=card.vrz;
      card.vz*=1.015;
    }
    drawCard3D(card);
  }

  cards = cards.filter(c=>!c.done);

  updateOrbit();

  rafId = requestAnimationFrame(renderLoop);
}

// ─── HYPERSPACE TUNNEL ─────────────────────────────────────
let tunnelRunning = false;

function runTunnel(){
  return new Promise(resolve=>{
    tunnelRunning = true;
    const welcome = $('welcome');
    const start_ts = performance.now();
    const DURATION = 3800;

    const NUM_STARS = 600;
    const stars = Array.from({length: NUM_STARS}, () => {
      const angle  = Math.random() * TAU;
      const baseDist = 0.05 + Math.random() * 0.95;
      const tint = Math.random();
      const r = tint < 0.5 ? 220 + Math.floor(Math.random()*35) : 180 + Math.floor(Math.random()*40);
      const g = tint < 0.5 ? 230 + Math.floor(Math.random()*25) : 210 + Math.floor(Math.random()*30);
      const b = 255;
      return {
        angle,
        baseDist,
        speed: 0.55 + Math.random() * 0.9,
        r, g, b,
        baseWidth: 0.4 + Math.random() * 1.4,
        jitter: (Math.random() - 0.5) * 0.04
      };
    });

    const NUM_HERO = 40;
    const heroStreaks = Array.from({length: NUM_HERO}, () => ({
      angle: Math.random() * TAU,
      baseDist: 0.1 + Math.random() * 0.85,
      speed: 0.7 + Math.random() * 0.3,
      width: 1.5 + Math.random() * 3,
      opacity: 0.5 + Math.random() * 0.5
    }));

    function drawHyperspace(now){
      if(!tunnelRunning) return;
      const elapsed  = now - start_ts;
      const progress = Math.min(1, elapsed / DURATION);

      const dotPhase    = Math.min(1, progress / 0.18);
      const compressT   = Math.max(0, Math.min(1,(progress-0.18)/0.27));
      const warpT       = Math.max(0, Math.min(1,(progress-0.45)/0.43));
      const finalT      = Math.max(0, Math.min(1,(progress-0.88)/0.12));

      const warpPow = Math.pow(warpT, 0.55);

      ctx.fillStyle = '#00000a';
      ctx.fillRect(0, 0, W, H);

      if(warpT > 0){
        const nebulaR = Math.min(cx,cy) * (0.5 + warpPow * 3.5);
        const neb = ctx.createRadialGradient(cx,cy,0, cx,cy, nebulaR);
        neb.addColorStop(0,   `rgba(30,60,200,${0.06 + warpPow*0.28})`);
        neb.addColorStop(0.25,`rgba(10,25,120,${0.04 + warpPow*0.14})`);
        neb.addColorStop(0.6, `rgba(5,5,60,${warpPow*0.08})`);
        neb.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.fillStyle = neb;
        ctx.fillRect(0,0,W,H);
      }

      if(warpT < 0.5){
        for(const star of stars){
          let dist = star.baseDist;
          if(compressT > 0){
            const ringDist = 0.28;
            dist = star.baseDist + (ringDist - star.baseDist) * Math.pow(compressT,1.4);
          }
          const maxR = Math.hypot(cx, cy);
          const r = dist * maxR * (0.6 + dotPhase * 0.4);
          const sx = cx + Math.cos(star.angle) * r;
          const sy = cy + Math.sin(star.angle) * r;

          const alpha = Math.min(1, dotPhase * 1.5) * (1 - warpT * 1.5);
          if(alpha <= 0) continue;

          ctx.beginPath();
          ctx.arc(sx, sy, Math.max(0.3, star.baseWidth * 0.5), 0, TAU);
          ctx.fillStyle = `rgba(${star.r},${star.g},${star.b},${alpha})`;
          ctx.fill();
        }
      }

      if(warpT > 0){
        const maxR = Math.hypot(cx, cy);

        const sorted = [...stars].sort((a,b)=>a.baseDist-b.baseDist);

        for(const star of sorted){
          const expandDist = star.baseDist * maxR * (0.28 + warpPow * star.speed * 1.1);
          const streakLen = expandDist * (0.015 + warpPow * warpPow * 0.65) * star.speed;
          const tailDist  = Math.max(0, expandDist - streakLen);

          const headX = cx + Math.cos(star.angle + star.jitter) * Math.min(expandDist, maxR * 1.4);
          const headY = cy + Math.sin(star.angle + star.jitter) * Math.min(expandDist, maxR * 1.4);
          const tailX = cx + Math.cos(star.angle + star.jitter) * tailDist;
          const tailY = cy + Math.sin(star.angle + star.jitter) * tailDist;

          const offScreen = expandDist > maxR * 1.1;
          if(offScreen) continue;

          const brightness = (0.3 + star.baseDist * 0.7) * warpPow;
          const alpha = Math.min(1, brightness);
          if(alpha < 0.01) continue;

          const sg = ctx.createLinearGradient(tailX, tailY, headX, headY);
          sg.addColorStop(0,   `rgba(${star.r},${star.g},${star.b},0)`);
          sg.addColorStop(0.5, `rgba(${star.r},${star.g},${star.b},${alpha*0.35})`);
          sg.addColorStop(1,   `rgba(${star.r},${star.g},${star.b},${alpha})`);

          ctx.beginPath();
          ctx.moveTo(tailX, tailY);
          ctx.lineTo(headX, headY);
          ctx.strokeStyle = sg;
          ctx.lineWidth = Math.max(0.3, star.baseWidth * (0.4 + warpPow * star.baseDist * 2.5));
          ctx.lineCap = 'round';
          ctx.stroke();

          if(star.baseDist > 0.4 && warpPow > 0.3){
            const dotR = Math.max(0.4, star.baseWidth * warpPow * star.baseDist * 4);
            ctx.beginPath();
            ctx.arc(headX, headY, dotR, 0, TAU);
            ctx.fillStyle = `rgba(220,240,255,${alpha})`;
            ctx.fill();
          }
        }

        for(const hs of heroStreaks){
          const expandDist = hs.baseDist * maxR * (0.28 + warpPow * hs.speed * 1.2);
          const streakLen  = expandDist * (0.02 + warpPow * warpPow * 0.75) * hs.speed;
          const tailDist   = Math.max(0, expandDist - streakLen);
          if(expandDist > maxR * 1.1) continue;

          const hx = cx + Math.cos(hs.angle) * Math.min(expandDist, maxR*1.3);
          const hy = cy + Math.sin(hs.angle) * Math.min(expandDist, maxR*1.3);
          const tx = cx + Math.cos(hs.angle) * tailDist;
          const ty = cy + Math.sin(hs.angle) * tailDist;

          const a = Math.min(1, warpPow * hs.opacity * 0.8);
          if(a < 0.01) continue;

          const hg = ctx.createLinearGradient(tx,ty,hx,hy);
          hg.addColorStop(0, `rgba(180,220,255,0)`);
          hg.addColorStop(0.6,`rgba(200,230,255,${a*0.5})`);
          hg.addColorStop(1,  `rgba(240,250,255,${a})`);

          ctx.beginPath();
          ctx.moveTo(tx,ty);
          ctx.lineTo(hx,hy);
          ctx.strokeStyle=hg;
          ctx.lineWidth=Math.max(0.5, hs.width * warpPow);
          ctx.lineCap='round';
          ctx.stroke();
        }

        const coreProgress = warpPow;
        const numRings = 8;
        for(let ri=0; ri<numRings; ri++){
          const ringPhase = (ri/numRings + warpPow*0.8) % 1.0;
          const ringR = Math.min(cx,cy) * (0.08 + ringPhase * 0.75) * coreProgress;
          const ringAlpha = (1 - ringPhase) * coreProgress * 0.55;
          if(ringAlpha < 0.01) continue;

          const rg = ctx.createRadialGradient(cx,cy,ringR*0.88,cx,cy,ringR*1.08);
          rg.addColorStop(0,   `rgba(80,140,255,0)`);
          rg.addColorStop(0.4, `rgba(140,200,255,${ringAlpha*0.6})`);
          rg.addColorStop(0.6, `rgba(180,220,255,${ringAlpha})`);
          rg.addColorStop(1,   `rgba(80,140,255,0)`);
          ctx.fillStyle = rg;
          ctx.beginPath();
          ctx.arc(cx,cy,ringR*1.08,0,TAU);
          ctx.fill();

          ctx.beginPath();
          ctx.arc(cx,cy,ringR,0,TAU);
          ctx.strokeStyle=`rgba(160,210,255,${ringAlpha*0.7})`;
          ctx.lineWidth=Math.max(0.5, 1.5*coreProgress);
          ctx.stroke();
        }

        const coreR = Math.min(cx,cy) * (0.04 + coreProgress * 0.3);
        const core = ctx.createRadialGradient(cx,cy,0, cx,cy,coreR);
        core.addColorStop(0,   `rgba(255,255,255,${0.9*coreProgress})`);
        core.addColorStop(0.15,`rgba(200,230,255,${0.7*coreProgress})`);
        core.addColorStop(0.4, `rgba(100,160,255,${0.35*coreProgress})`);
        core.addColorStop(0.7, `rgba(30,60,180,${0.12*coreProgress})`);
        core.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.fillStyle=core;
        ctx.fillRect(0,0,W,H);

        if(coreProgress > 0.45){
          const ca = (coreProgress-0.45)/0.55;
          const caR = Math.min(cx,cy)*coreProgress*0.45;
          ctx.beginPath();
          ctx.arc(cx-3,cy,caR,0,TAU);
          ctx.strokeStyle=`rgba(255,50,50,${ca*0.3})`;
          ctx.lineWidth=2; ctx.stroke();
          ctx.beginPath();
          ctx.arc(cx+3,cy,caR*0.97,0,TAU);
          ctx.strokeStyle=`rgba(0,255,220,${ca*0.25})`;
          ctx.lineWidth=1.5; ctx.stroke();
          if(Math.random()<0.15){
            const sy2=rand(0,H);
            ctx.fillStyle=`rgba(180,220,255,${ca*0.04})`;
            ctx.fillRect(0,sy2,W,1);
          }
        }
      }

      const vg = ctx.createRadialGradient(cx,cy,Math.min(cx,cy)*0.25,cx,cy,Math.max(cx,cy)*1.1);
      vg.addColorStop(0,  'rgba(0,0,0,0)');
      vg.addColorStop(0.55,'rgba(0,0,5,0.1)');
      vg.addColorStop(0.8, 'rgba(0,0,8,0.65)');
      vg.addColorStop(1,   'rgba(0,0,10,0.97)');
      ctx.fillStyle=vg;
      ctx.fillRect(0,0,W,H);

      if(finalT > 0){
        ctx.fillStyle=`rgba(255,255,255,${Math.pow(finalT,0.7)})`;
        ctx.fillRect(0,0,W,H);
      }

      if(progress > 0.68){
        const wt = Math.min(1,(progress-0.68)/0.24);
        welcome.style.opacity = String(wt);
        if(wt>0.02 && !welcome.classList.contains('show')){
          welcome.classList.add('show');
        }
      }

      if(progress < 1){
        requestAnimationFrame(drawHyperspace);
      } else {
        setTimeout(()=>{ tunnelRunning=false; resolve(); }, 1000);
      }
    }

    requestAnimationFrame(drawHyperspace);
  });
}

// ─── SEQUENCE ──────────────────────────────────────────────

async function run(){
  renderLoop();
  await delay(100);

  // PHASE 1: RAIN
  const rainPromises=[];
  for(let i=0;i<20;i++){
    rainPromises.push(spawnRainCard(i*rand(18,35)));
  }
  await Promise.all(rainPromises);
  await delay(30);

  // PHASE 2: CHAOS SHUFFLE (2 passes)
  for(let pass=0;pass<2;pass++){
    const n=10+(pass*4);
    const pp=[];
    for(let i=0;i<n;i++) pp.push(spawnShuffleCard(i*16));
    await Promise.all(pp);
    await delay(40);
  }
  await delay(50);

  // PHASE 3: FIBONACCI VORTEX
  const N=30;
  const fp=[];
  for(let i=0;i<N;i++) fp.push(spawnFibCard(i,N,i*12));
  await Promise.all(fp);
  cards=[];

  // PHASE 4: HERO CARDS EMERGE
  await delay(80);
  await spawnHeroCards();

  await delay(700);

  // PHASE 5: K + A ORBIT, SPIN UP, COLLAPSE
  startOrbit();
  await delay(1200);

  collapseOrbit();
  await delay(700);

  $('flash').animate([{opacity:0},{opacity:1},{opacity:0}],
    {duration:300,easing:'ease',fill:'forwards'});

  // PHASE 6: TUNNEL WALK
  sceneRunning=false;
  cancelAnimationFrame(rafId);
  cards=[];
  await runTunnel();

  // PHASE 7: PORTFOLIO REVEAL
  await delay(200);
  $('welcome').animate([{opacity:1},{opacity:0}],{duration:600,fill:'forwards'});
  $('intro-canvas').animate([{opacity:1},{opacity:0}],{duration:700,fill:'forwards'});
  await delay(400);

  const portfolio=$('portfolio');
  portfolio.classList.add('visible');

  const obs=new IntersectionObserver(entries=>{
    entries.forEach(e=>{ if(e.isIntersecting) e.target.classList.add('in'); });
  },{threshold:.1});
  document.querySelectorAll('.reveal').forEach(el=>obs.observe(el));
}

run();
