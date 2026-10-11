/**
 * INREAL // GLITCH ART CYBER ENGINE
 * Digital Errors, RGB Chromatic Aberrations, Pixel Corruption, and Interactive Scanline Distortion
 */

let allInternships = [];
let activeLocation = 'all';
let activeStipend = 'all';
let activeSource = 'all';
let showBookmarkedOnly = false;
let bookmarks = JSON.parse(localStorage.getItem('inreal_bookmarks') || '[]');
let activeDrawerJob = null;

document.addEventListener('DOMContentLoaded', () => {
  initGlitchArtCanvas();
  bindEventHandlers();
  loadData();
  pollScraperStatus();
  pollAlerts();
  updateBookmarkCounter();
});

// ==========================================
// 1. 3D Web Experience: Interactive GLSL Glitch Art & RGB Displacement Shader
// Real-time digital signal corruption, scanline tears, and cursor chromatic shift
// ==========================================
function initGlitchArtCanvas() {
  const canvas = document.getElementById('glitch-mesh-canvas');
  if (!canvas || typeof THREE === 'undefined') return;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const renderer = new THREE.WebGLRenderer({ 
    canvas, 
    alpha: true, 
    antialias: false, // Intentional pixel-sharp digital corruption
    powerPreference: 'high-performance' 
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

  const uniforms = {
    u_time: { value: 0.0 },
    u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    u_mouse: { value: new THREE.Vector2(0.5, 0.5) }
  };

  const vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }
  `;

  // Glitch Art Fragment Shader with RGB Split, Block Pixel Corruption, and Scanline Noise
  const fragmentShader = `
    uniform float u_time;
    uniform vec2 u_resolution;
    uniform vec2 u_mouse;
    varying vec2 vUv;

    // Pseudorandom noise generator
    float random(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
    }

    // Block noise for digital compression artifacts
    float blockNoise(vec2 p) {
      vec2 ipos = floor(p);
      return random(ipos);
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / u_resolution.xy;
      float time = u_time * 1.5;

      // Distance to cursor
      float distToMouse = length(uv - u_mouse);
      float mouseImpact = exp(-distToMouse * 4.0);

      // Digital scanline & horizontal glitch displacement slice
      float sliceNoise = blockNoise(vec2(0.0, floor(uv.y * 35.0) + time * 12.0));
      float sliceDisplacement = step(0.88, sliceNoise) * (random(vec2(time, uv.y)) - 0.5) * 0.12;

      // Cursor-triggered localized glitch shockwave
      float cursorGlitch = sin(distToMouse * 25.0 - time * 8.0) * mouseImpact * 0.08;
      
      vec2 glitchUv = uv;
      glitchUv.x += sliceDisplacement + cursorGlitch;

      // Multi-frequency pixel grid corruption
      vec2 grid = floor(glitchUv * vec2(120.0, 75.0));
      float pixelCorrupt = random(grid + floor(time * 6.0));

      // Chromatic Aberration RGB Shift calculation
      float rOffset = 0.008 + mouseImpact * 0.02;
      float bOffset = -0.008 - mouseImpact * 0.02;

      // Channel generation with synthetic digital errors
      float rPattern = sin((glitchUv.x + rOffset) * 45.0 + time * 2.0) * cos(glitchUv.y * 30.0);
      float gPattern = sin(glitchUv.x * 45.0 + time * 1.5) * cos(glitchUv.y * 30.0);
      float bPattern = sin((glitchUv.x + bOffset) * 45.0 + time * 1.2) * cos(glitchUv.y * 30.0);

      // Color matrix
      float r = smoothstep(0.4, 0.9, rPattern) + step(0.96, pixelCorrupt) * 0.8;
      float g = smoothstep(0.5, 0.95, gPattern) * 0.4;
      float b = smoothstep(0.35, 0.85, bPattern) * 1.2 + step(0.94, pixelCorrupt) * 0.9;

      // Add digital noise grain
      float grain = random(uv * 50.0 + time) * 0.12;
      r += grain;
      g += grain * 0.6;
      b += grain;

      // Cyber palette tuning: Cyan (#00F0FF), Magenta (#FF0055), Matrix Dark
      vec3 col = vec3(r * 0.95, g * 0.8, b * 1.05);

      // Deep void background attenuation
      col *= 0.35 + mouseImpact * 0.45;

      gl_FragColor = vec4(col, 0.85);
    }
  `;

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms
  });

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  scene.add(quad);

  // Mouse interaction
  let mouseTargetX = 0.5, mouseTargetY = 0.5;
  let mouseCurrentX = 0.5, mouseCurrentY = 0.5;

  window.addEventListener('mousemove', (e) => {
    mouseTargetX = e.clientX / window.innerWidth;
    mouseTargetY = 1.0 - (e.clientY / window.innerHeight);
  }, { passive: true });

  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    uniforms.u_resolution.value.set(window.innerWidth, window.innerHeight);
  });

  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const elapsed = clock.getElapsedTime();

    mouseCurrentX += (mouseTargetX - mouseCurrentX) * 0.1;
    mouseCurrentY += (mouseTargetY - mouseCurrentY) * 0.1;

    uniforms.u_time.value = elapsed;
    uniforms.u_mouse.value.set(mouseCurrentX, mouseCurrentY);

    renderer.render(scene, camera);
  }
  animate();
}

// ==========================================
// 2. Data Fetching & Processing
// ==========================================
async function loadData() {
  try {
    const res = await fetch('/api/internships');
    const data = await res.json();
    allInternships = data || [];

    populateSourceFilter(allInternships);
    renderOverviewStats();
    applyFiltersAndRender();
  } catch (err) {
    console.error('Failed to load internships:', err);
  }
}

function populateSourceFilter(internships) {
  const sourceSelect = document.getElementById('source-filter');
  if (!sourceSelect) return;
  const sources = new Set(internships.map(i => i.source_platform).filter(Boolean));
  sourceSelect.innerHTML = '<option value="all">ALL STREAMS</option>';
  sources.forEach(src => {
    const opt = document.createElement('option');
    opt.value = src;
    opt.textContent = src.toUpperCase();
    sourceSelect.appendChild(opt);
  });
}

function renderOverviewStats() {
  const total = allInternships.length;
  const newCount = allInternships.filter(i => i.is_new).length;
  const paidCount = allInternships.filter(i => {
    const val = Number(i.stipend_numeric || 0);
    return val > 0 || (i.stipend && !i.stipend.toLowerCase().includes('unpaid'));
  }).length;

  document.getElementById('stat-total-jobs').innerText = total;
  document.getElementById('stat-new-jobs').innerText = newCount;
  document.getElementById('stat-paid-jobs').innerText = paidCount;

  document.getElementById('count-all').innerText = total;
  document.getElementById('count-india').innerText = allInternships.filter(i => (i.location_type || '').toLowerCase() === 'india').length;
  document.getElementById('count-remote').innerText = allInternships.filter(i => (i.location_type || '').toLowerCase() === 'remote').length;
  document.getElementById('count-global').innerText = allInternships.filter(i => (i.location_type || '').toLowerCase() === 'international').length;
}

// ==========================================
// 3. Cyberpunk Glitch Card Grid Rendering
// ==========================================
function applyFiltersAndRender() {
  const searchQuery = (document.getElementById('search-input')?.value || '').toLowerCase().trim();

  const filtered = allInternships.filter(item => {
    if (showBookmarkedOnly && !bookmarks.includes(item.id)) return false;

    if (activeLocation !== 'all') {
      if ((item.location_type || '').toLowerCase() !== activeLocation.toLowerCase()) {
        return false;
      }
    }

    if (activeSource !== 'all' && item.source_platform !== activeSource) {
      return false;
    }

    if (activeStipend === 'paid') {
      const num = Number(item.stipend_numeric || 0);
      if (num <= 0 && (!item.stipend || item.stipend.toLowerCase().includes('unpaid'))) return false;
    } else if (activeStipend === '20k') {
      if (Number(item.stipend_numeric || 0) < 20000) return false;
    } else if (activeStipend === '50k') {
      if (Number(item.stipend_numeric || 0) < 50000) return false;
    }

    if (searchQuery) {
      const text = `${item.role_title || ''} ${item.company_name || ''} ${item.required_skills || ''} ${item.location || ''}`.toLowerCase();
      if (!text.includes(searchQuery)) return false;
    }

    return true;
  });

  renderListings(filtered);
}

function renderListings(items) {
  const container = document.getElementById('listings-container');
  const emptyState = document.getElementById('empty-state');
  if (!container) return;

  if (items.length === 0) {
    container.innerHTML = '';
    emptyState.classList.remove('hidden');
    emptyState.classList.add('flex');
    return;
  }

  emptyState.classList.add('hidden');
  emptyState.classList.remove('flex');

  container.innerHTML = items.map(item => {
    const isBookmarked = bookmarks.includes(item.id);
    const score = item.match_score || 95;
    const skills = (item.required_skills || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 3);

    return `
      <article 
        class="cyber-card p-5 flex flex-col justify-between cursor-pointer group"
        onclick="openDetailDrawer('${escapeHtml(item.id)}')"
      >
        <div>
          <!-- Header Bar -->
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 bg-[#00F0FF]/15 border border-[#00F0FF] text-[10px] font-bold text-[#00F0FF] font-mono tracking-wider">
                ${score}% SYNC
              </span>
              ${item.is_new ? '<span class="px-2 py-0.5 bg-[#FF0055]/20 border border-[#FF0055] text-[10px] font-bold text-[#FF0055] font-mono">NEW_ENTRY</span>' : ''}
            </div>

            <button 
              type="button" 
              class="p-1 text-slate-400 hover:text-[#FF0055] transition"
              onclick="event.stopPropagation(); toggleBookmark('${escapeHtml(item.id)}')"
            >
              <i class="ph ${isBookmarked ? 'ph-fill ph-bookmark text-[#FF0055]' : 'ph-bookmark'} text-base"></i>
            </button>
          </div>

          <!-- Role & Company -->
          <h3 class="font-cyber text-base font-black text-white leading-snug tracking-wide group-hover:text-[#00F0FF] transition-colors line-clamp-2">
            ${escapeHtml(item.role_title || 'RESEARCH ENG')}
          </h3>
          
          <div class="text-xs text-slate-400 mt-2 flex items-center gap-1.5 font-mono">
            <span class="text-[#00F0FF] font-bold">${escapeHtml(item.company_name || 'ENTITY')}</span>
            <span>//</span>
            <span class="truncate text-slate-300">${escapeHtml(item.location || 'UNKNOWN')}</span>
          </div>

          <!-- Skills tags -->
          <div class="flex flex-wrap gap-1.5 mt-4">
            ${skills.map(skill => `<span class="px-2 py-0.5 text-[11px] bg-[#050508] border border-[#00F0FF]/30 text-slate-300 font-mono">${escapeHtml(skill)}</span>`).join('')}
          </div>
        </div>

        <!-- Footer -->
        <div class="pt-3.5 mt-5 border-t border-[#00F0FF]/20 flex items-center justify-between text-xs font-mono">
          <div>
            <span class="text-[#00FF66] font-bold tracking-wider">${escapeHtml(item.stipend || 'UNLISTED')}</span>
          </div>
          <div>
            <span class="text-[#00F0FF] text-[11px] uppercase tracking-wider group-hover:underline">INSPECT &gt;&gt;</span>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

// ==========================================
// 4. Slide-Over Detail Drawer
// ==========================================
function openDetailDrawer(id) {
  const item = allInternships.find(i => i.id === id);
  if (!item) return;

  activeDrawerJob = item;
  document.getElementById('drawer-role-title').innerText = item.role_title || 'FELLOWSHIP';
  document.getElementById('drawer-company-name').innerText = item.company_name || '';
  document.getElementById('drawer-location').innerText = item.location || 'REMOTE';
  document.getElementById('drawer-duration').innerText = item.duration || 'FLEXIBLE';
  document.getElementById('drawer-stipend').innerText = item.stipend || 'UNSPECIFIED';
  document.getElementById('drawer-deadline').innerText = item.application_deadline || 'OPEN';
  document.getElementById('drawer-source').innerText = (item.source_platform || 'PORTAL').toUpperCase();
  document.getElementById('drawer-date').innerText = item.date_scraped || 'RECENT';
  document.getElementById('drawer-org-badge').innerText = (item.org_type || 'ORGANIZATION').toUpperCase();

  const applyLink = document.getElementById('drawer-apply-link');
  applyLink.href = item.apply_link || '#';

  const skillsContainer = document.getElementById('drawer-skills-list');
  const skills = (item.required_skills || '').split(',').map(s => s.trim()).filter(Boolean);
  skillsContainer.innerHTML = skills.length
    ? skills.map(s => `<span class="px-2.5 py-1 bg-[#050508] border border-[#00F0FF] text-xs font-mono text-[#00F0FF]">${escapeHtml(s)}</span>`).join('')
    : '<span class="text-xs text-slate-500">STANDARD ARCHITECTURE PROTOCOLS.</span>';

  updateDrawerBookmarkIcon();

  const overlay = document.getElementById('detail-drawer-overlay');
  const drawer = document.getElementById('detail-drawer');
  overlay.classList.remove('hidden');
  setTimeout(() => drawer.classList.remove('translate-x-full'), 10);
}

function closeDetailDrawer() {
  const overlay = document.getElementById('detail-drawer-overlay');
  const drawer = document.getElementById('detail-drawer');
  drawer.classList.add('translate-x-full');
  setTimeout(() => overlay.classList.add('hidden'), 200);
}

function updateDrawerBookmarkIcon() {
  const btn = document.getElementById('drawer-bookmark-btn');
  if (!btn || !activeDrawerJob) return;
  const isBookmarked = bookmarks.includes(activeDrawerJob.id);
  btn.innerHTML = `<i class="ph ${isBookmarked ? 'ph-fill ph-bookmark text-[#FF0055]' : 'ph-bookmark'} text-base"></i>`;
}

// ==========================================
// 5. Bookmarks & Local Storage
// ==========================================
function toggleBookmark(id) {
  if (bookmarks.includes(id)) {
    bookmarks = bookmarks.filter(b => b !== id);
  } else {
    bookmarks.push(id);
  }
  localStorage.setItem('inreal_bookmarks', JSON.stringify(bookmarks));
  updateBookmarkCounter();
  applyFiltersAndRender();
  if (activeDrawerJob && activeDrawerJob.id === id) {
    updateDrawerBookmarkIcon();
  }
}

function updateBookmarkCounter() {
  const count = bookmarks.length;
  const counter = document.getElementById('bookmark-count');
  if (counter) counter.innerText = count;
}

// ==========================================
// 6. Scraper Status & Telemetry
// ==========================================
async function pollScraperStatus() {
  try {
    const res = await fetch('/api/scrape/status');
    const data = await res.json();
    const isRunning = data.status === 'running';

    const dot = document.getElementById('ping-dot');
    const text = document.getElementById('scraper-status-text');

    if (isRunning) {
      dot.className = 'w-2 h-2 rounded-full bg-[#FF0055] shadow-[0_0_8px_#FF0055] animate-ping';
      text.innerText = 'HARVESTING';
      text.className = 'text-[#FF0055] text-[11px] uppercase tracking-wider font-bold';
      fetchLogs();
    } else {
      dot.className = 'w-2 h-2 rounded-full bg-[#00FF66] shadow-[0_0_8px_#00FF66]';
      text.innerText = 'ONLINE';
      text.className = 'text-[#00FF66] text-[11px] uppercase tracking-wider';
    }
  } catch (e) {}

  setTimeout(pollScraperStatus, 3500);
}

async function fetchLogs() {
  try {
    const res = await fetch('/api/logs');
    const data = await res.json();
    const logsContainer = document.getElementById('logs-content');
    if (logsContainer && data.logs) {
      logsContainer.innerHTML = data.logs.map(log => `<div>&gt;&gt; ${escapeHtml(log)}</div>`).join('');
      logsContainer.scrollTop = logsContainer.scrollHeight;
    }
  } catch (e) {}
}

async function pollAlerts() {
  try {
    const res = await fetch('/api/alerts');
    const data = await res.json();
    const banner = document.getElementById('action-banner');

    if (data.alert) {
      document.getElementById('action-title').innerText = data.alert.title || 'SYSTEM INTERRUPT';
      document.getElementById('action-message').innerText = data.alert.message || 'MANUAL BYPASS REQUIRED';
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  } catch (e) {}
  setTimeout(pollAlerts, 3000);
}

// ==========================================
// 7. Event Handlers
// ==========================================
function bindEventHandlers() {
  document.getElementById('search-input')?.addEventListener('input', applyFiltersAndRender);

  document.querySelectorAll('#location-tabs .glitch-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#location-tabs .glitch-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeLocation = btn.getAttribute('data-val');
      applyFiltersAndRender();
    });
  });

  document.querySelectorAll('#stipend-filters .glitch-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#stipend-filters .glitch-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeStipend = btn.getAttribute('data-val');
      applyFiltersAndRender();
    });
  });

  document.getElementById('source-filter')?.addEventListener('change', (e) => {
    activeSource = e.target.value;
    applyFiltersAndRender();
  });

  document.getElementById('filter-bookmarks-btn')?.addEventListener('click', () => {
    showBookmarkedOnly = !showBookmarkedOnly;
    const btn = document.getElementById('filter-bookmarks-btn');
    if (showBookmarkedOnly) {
      btn.classList.add('bg-[#FF0055]', 'text-white', 'border-[#FF0055]');
    } else {
      btn.classList.remove('bg-[#FF0055]', 'text-white', 'border-[#FF0055]');
    }
    applyFiltersAndRender();
  });

  const resetAll = () => {
    document.getElementById('search-input').value = '';
    activeLocation = 'all';
    activeStipend = 'all';
    activeSource = 'all';
    showBookmarkedOnly = false;
    document.getElementById('source-filter').value = 'all';
    document.getElementById('filter-bookmarks-btn')?.classList.remove('bg-[#FF0055]', 'text-white', 'border-[#FF0055]');

    const allTab = document.querySelector('#location-tabs [data-val="all"]');
    if (allTab) allTab.click();

    const allStipend = document.querySelector('#stipend-filters [data-val="all"]');
    if (allStipend) allStipend.click();

    applyFiltersAndRender();
  };

  document.getElementById('reset-filters-btn')?.addEventListener('click', resetAll);
  document.getElementById('empty-reset-btn')?.addEventListener('click', resetAll);

  // Drawer
  document.getElementById('close-drawer-btn')?.addEventListener('click', closeDetailDrawer);
  document.getElementById('detail-drawer-overlay')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('detail-drawer-overlay')) {
      closeDetailDrawer();
    }
  });
  document.getElementById('drawer-bookmark-btn')?.addEventListener('click', () => {
    if (activeDrawerJob) toggleBookmark(activeDrawerJob.id);
  });

  // Logs
  const logsPanel = document.getElementById('logs-panel');
  document.getElementById('open-logs-btn')?.addEventListener('click', () => {
    logsPanel.classList.toggle('hidden');
    fetchLogs();
  });
  document.getElementById('close-logs-btn')?.addEventListener('click', () => {
    logsPanel.classList.add('hidden');
  });

  // Modal
  const modal = document.getElementById('scrape-config-modal');
  document.getElementById('trigger-scrape-btn')?.addEventListener('click', () => {
    modal.classList.remove('hidden');
  });
  document.getElementById('close-config-btn')?.addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  document.getElementById('scrape-config-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    modal.classList.add('hidden');
    logsPanel.classList.remove('hidden');

    const checkedValues = (name) => Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(cb => cb.value);
    const config = {
      regions: checkedValues('regions'),
      sources: checkedValues('sources')
    };

    try {
      await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      fetchLogs();
    } catch (err) {
      console.error(err);
    }
  });

  document.getElementById('action-dismiss-btn')?.addEventListener('click', async () => {
    document.getElementById('action-banner').classList.add('hidden');
    try {
      await fetch('/api/alerts/dismiss', { method: 'POST' });
    } catch (e) {}
  });

  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      document.getElementById('search-input')?.focus();
    }
    if (e.key === 'Escape') {
      closeDetailDrawer();
      modal.classList.add('hidden');
      logsPanel.classList.add('hidden');
    }
  });
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
