/* ---------------------------------------------------------
   Hero LiDAR point-cloud scan
--------------------------------------------------------- */
(function(){
  const canvas = document.getElementById('lidarCanvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W, H, DPR;

  function resize(){
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.parentElement.getBoundingClientRect();
    W = rect.width; H = rect.height;
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = W+'px'; canvas.style.height = H+'px';
    ctx.setTransform(DPR,0,0,DPR,0,0);
    buildPoints();
  }

  let points = [];
  const anomalies = [
    {label:'CRACK', tRatio:0.28, yRatio:0.52},
    {label:'CORROSION', tRatio:0.62, yRatio:0.38},
    {label:'VOID', tRatio:0.83, yRatio:0.58}
  ];

  function buildPoints(){
    points = [];
    const margin = W*0.08;
    const deckY = H*0.52;
    const deckLen = W - margin*2;

    // deck: multiple rows for thickness
    for(let row=0; row<5; row++){
      const y = deckY + row*3.2;
      const n = 140;
      for(let i=0;i<=n;i++){
        const x = margin + (i/n)*deckLen + (Math.random()-0.5)*3;
        points.push({x, y: y+(Math.random()-0.5)*1.5, z: row, type:'deck'});
      }
    }
    // rail line above deck
    for(let i=0;i<=90;i++){
      const x = margin + (i/90)*deckLen;
      points.push({x, y: deckY-14+(Math.random()-0.5)*2, z:-2, type:'rail'});
    }
    // piers
    const piers = [0.18, 0.5, 0.82];
    piers.forEach(pr=>{
      const px = margin + pr*deckLen;
      for(let i=0;i<70;i++){
        const y = deckY + 6 + (i/70)*(H*0.36);
        const width = 10*(1-  (i/70)*0.15);
        const x = px + (Math.random()-0.5)*width;
        points.push({x, y, z: 4+ (Math.random()*2), type:'pier'});
      }
    });
    // cross bracing sparse points
    for(let i=0;i<80;i++){
      const x = margin + Math.random()*deckLen;
      const y = deckY - Math.random()*26 - 4;
      points.push({x, y, z: -1+Math.random()*2, type:'truss'});
    }

    canvas._margin = margin;
    canvas._deckLen = deckLen;
  }

  function colorForZ(z, alpha){
    // turbo-ish gradient from lidar teal (low) to hazard/rust (high)
    const t = Math.max(0, Math.min(1, (z+2)/8));
    const c1 = [73,214,198];   // teal
    const c2 = [232,185,74];   // hazard yellow
    const c3 = [224,122,63];   // rust
    let r,g,b;
    if(t<0.5){
      const k=t/0.5;
      r=c1[0]+(c2[0]-c1[0])*k; g=c1[1]+(c2[1]-c1[1])*k; b=c1[2]+(c2[2]-c1[2])*k;
    } else {
      const k=(t-0.5)/0.5;
      r=c2[0]+(c3[0]-c2[0])*k; g=c2[1]+(c3[1]-c2[1])*k; b=c2[2]+(c3[2]-c2[2])*k;
    }
    return `rgba(${r|0},${g|0},${b|0},${alpha})`;
  }

  let t0 = performance.now();
  const cycle = 5200; // ms per sweep

  function draw(now){
    const elapsed = (now - t0) % cycle;
    const sweepX = canvas._margin + (elapsed/cycle) * canvas._deckLen;

    ctx.clearRect(0,0,W,H);

    // faint baseline grid
    ctx.strokeStyle = 'rgba(35,50,65,0.5)';
    ctx.lineWidth = 1;
    for(let gx=0; gx<W; gx+=28){ ctx.beginPath(); ctx.moveTo(gx,0); ctx.lineTo(gx,H); ctx.stroke(); }

    points.forEach(p=>{
      const revealed = p.x <= sweepX + 6;
      const alpha = revealed ? 0.85 : 0.12;
      ctx.fillStyle = colorForZ(p.z, alpha);
      const size = p.type==='pier' ? 1.6 : 1.3;
      ctx.fillRect(p.x, p.y, size, size);
    });

    // sweep line
    ctx.strokeStyle = 'rgba(73,214,198,0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(sweepX,4); ctx.lineTo(sweepX,H-4); ctx.stroke();
    ctx.fillStyle='rgba(73,214,198,0.06)';
    ctx.fillRect(sweepX-22,0,22,H);

    // anomaly markers, revealed once swept past
    ctx.font = '10px "IBM Plex Mono", monospace';
    anomalies.forEach(a=>{
      const ax = canvas._margin + a.tRatio*canvas._deckLen;
      const ay = a.yRatio*H;
      if(sweepX > ax){
        const fadeIn = Math.min(1, (sweepX-ax)/40);
        ctx.strokeStyle = `rgba(224,122,63,${0.8*fadeIn})`;
        ctx.lineWidth = 1.2;
        const s=7;
        // bracket marker
        ctx.beginPath();
        ctx.moveTo(ax-s, ay-s+4); ctx.lineTo(ax-s, ay-s); ctx.lineTo(ax-s+4, ay-s);
        ctx.moveTo(ax+s-4, ay-s); ctx.lineTo(ax+s, ay-s); ctx.lineTo(ax+s, ay-s+4);
        ctx.moveTo(ax-s, ay+s-4); ctx.lineTo(ax-s, ay+s); ctx.lineTo(ax-s+4, ay+s);
        ctx.moveTo(ax+s-4, ay+s); ctx.lineTo(ax+s, ay+s); ctx.lineTo(ax+s, ay+s-4);
        ctx.stroke();
        ctx.fillStyle = `rgba(232,185,74,${0.9*fadeIn})`;
        ctx.fillText(a.label, ax+s+4, ay+3);
      }
    });

    if(!reduceMotion) requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  resize();
  if(reduceMotion){
    draw(t0+cycle*0.6);
  } else {
    requestAnimationFrame(draw);
  }
})();

/* ---------------------------------------------------------
   3D reconstruction deviation heatmap (simplified mesh)
--------------------------------------------------------- */
(function(){
  const canvas = document.getElementById('reconCanvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W,H,DPR;

  function resize(){
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.parentElement.getBoundingClientRect();
    W = rect.width; H = rect.height;
    canvas.width = W*DPR; canvas.height = H*DPR;
    canvas.style.width=W+'px'; canvas.style.height=H+'px';
    ctx.setTransform(DPR,0,0,DPR,0,0);
  }

  const cols = 26, rows = 14;
  // deviation field: mostly 0, a couple of "hot" regions
  const hotspots = [
    {cx:0.3, cy:0.4, r:0.14, mag:1},
    {cx:0.68, cy:0.62, r:0.10, mag:0.7},
    {cx:0.5, cy:0.25, r:0.08, mag:0.5}
  ];

  function deviationAt(u,v){
    let val = 0;
    hotspots.forEach(h=>{
      const d = Math.hypot(u-h.cx, v-h.cy);
      if(d < h.r) val = Math.max(val, h.mag*(1-d/h.r));
    });
    return val; // 0..1
  }

  function colorForDev(v, alpha){
    // teal (0) -> hazard -> rust (1)
    const c1=[35,50,65], c2=[232,185,74], c3=[224,122,63];
    let r,g,b;
    if(v<0.5){const k=v/0.5; r=c1[0]+(c2[0]-c1[0])*k; g=c1[1]+(c2[1]-c1[1])*k; b=c1[2]+(c2[2]-c1[2])*k;}
    else {const k=(v-0.5)/0.5; r=c2[0]+(c3[0]-c2[0])*k; g=c2[1]+(c3[1]-c2[1])*k; b=c2[2]+(c3[2]-c2[2])*k;}
    return `rgba(${r|0},${g|0},${b|0},${alpha})`;
  }

  let t0 = performance.now();
  function draw(now){
    ctx.clearRect(0,0,W,H);
    const pulse = 0.85 + 0.15*Math.sin((now-t0)/900);
    const cellW = W/cols, cellH = H/rows;
    for(let i=0;i<cols;i++){
      for(let j=0;j<rows;j++){
        const u=i/cols, v=j/rows;
        const dev = deviationAt(u,v);
        const alpha = dev>0.02 ? 0.25+0.65*dev*pulse : 0.5;
        ctx.fillStyle = dev>0.02 ? colorForDev(dev, Math.min(0.95,alpha)) : 'rgba(35,50,65,0.55)';
        ctx.fillRect(i*cellW+1, j*cellH+1, cellW-2, cellH-2);
      }
    }
    if(!reduceMotion) requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  resize();
  if(reduceMotion){ draw(t0); } else { requestAnimationFrame(draw); }
})();


/* ---------------------------------------------------------
   Embedded drone video for 3D reconstruction
   Autoplay + muted + infinite loop
--------------------------------------------------------- */
(function(){
  const player = document.getElementById('reconstructionVideoPlayer');
  if(!player) return;

  player.muted = true;
  player.loop = true;
  player.autoplay = true;

  const startVideo = () => {
    const playPromise = player.play();
    if(playPromise && typeof playPromise.catch === 'function'){
      playPromise.catch(() => {
        // Browser autoplay policies may require a first user interaction.
        // The video remains muted and will start as soon as playback is allowed.
      });
    }
  };

  player.addEventListener('loadeddata', startVideo);
  player.addEventListener('canplay', startVideo);
  player.addEventListener('ended', () => {
    player.currentTime = 0;
    startVideo();
  });

  startVideo();
})();


/* ---------------------------------------------------------
   Pipeline1 nav dropdown
   Opens on click, stays open until an option is chosen
   (or the user clicks elsewhere / presses Escape).
--------------------------------------------------------- */
(function(){
  const dropdown = document.querySelector('.nav-dropdown');
  if(!dropdown) return;
  const trigger = dropdown.querySelector('.nav-dropdown-trigger');
  const menu = dropdown.querySelector('.nav-dropdown-menu');

  function closeDropdown(){
    dropdown.classList.remove('open');
    trigger.setAttribute('aria-expanded','false');
  }
  function openDropdown(){
    dropdown.classList.add('open');
    trigger.setAttribute('aria-expanded','true');
  }

  trigger.addEventListener('click', function(e){
    e.preventDefault();
    if(dropdown.classList.contains('open')){
      closeDropdown();
    } else {
      openDropdown();
    }
  });

  menu.querySelectorAll('a').forEach(function(link){
    link.addEventListener('click', function(){
      closeDropdown();
    });
  });

  document.addEventListener('click', function(e){
    if(!dropdown.contains(e.target)) closeDropdown();
  });

  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape') closeDropdown();
  });
})();

/* ---------------------------------------------------------
   About Us: read more / read less toggle
--------------------------------------------------------- */
(function(){
  const text = document.getElementById('aboutText');
  const toggle = document.getElementById('aboutToggle');
  if(!text || !toggle) return;

  toggle.addEventListener('click', function(){
    const expanded = text.classList.toggle('expanded');
    toggle.textContent = expanded ? '\u2026Less' : '\u2026More';
    toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  });
})();

/* ---------------------------------------------------------
   Background audio: click to start/stop, loops while playing
--------------------------------------------------------- */
(function(){
  const audio = document.getElementById('bg-audio');
  const btn = document.getElementById('audio-toggle');
  if(!audio || !btn) return;

  audio.loop = true;
  audio.volume = 0.6;

  function setPlayingUI(isPlaying){
    btn.setAttribute('aria-pressed', isPlaying ? 'true' : 'false');
    btn.setAttribute('aria-label', isPlaying ? 'Stop background audio' : 'Play background audio');
  }

  btn.addEventListener('click', function(){
    if(audio.paused){
      audio.play().then(function(){
        setPlayingUI(true);
      }).catch(function(){
        setPlayingUI(false);
      });
    } else {
      audio.pause();
      setPlayingUI(false);
    }
  });

  audio.addEventListener('ended', function(){
    // loop=true handles this automatically, but keep UI in sync just in case
    if(audio.loop){
      setPlayingUI(true);
    } else {
      setPlayingUI(false);
    }
  });

  audio.addEventListener('pause', function(){ setPlayingUI(false); });
  audio.addEventListener('play', function(){ setPlayingUI(true); });
})();
