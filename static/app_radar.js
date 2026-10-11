/**
 * InReal Dashboard
 * Palette: #A6D9F3, #B7F0F5, #E8FFF7, #6FB0C8, #0F2E3A
 * Real-time GLSL Shader Liquid Chrome/Mercury Simulation (matching reference image)
 * Zero emojis, zero em dashes.
 */

let allInternships = [];
let activeLocation = 'all';
let activeStipend = 'all';
let activeSource = 'all';
let showBookmarkedOnly = false;
let bookmarks = JSON.parse(localStorage.getItem('inreal_bookmarks') || '[]');
let activeDrawerJob = null;

document.addEventListener('DOMContentLoaded', () => {
  initFullFluidChromeShader();
  bindEventHandlers();
  loadData();
  pollScraperStatus();
  pollAlerts();
  updateBookmarkCounter();
});

// ==========================================
// 1. 3D Web Experience: Real-time GLSL Liquid Mercury Shader
// Exactly replicating the swirling, high-contrast chrome ripples in the reference image
// ==========================================
function initFullFluidChromeShader() {
  const canvas = document.getElementById('liquid-river-canvas');
  if (!canvas || typeof THREE === 'undefined') return;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const renderer = new THREE.WebGLRenderer({ 
    canvas, 
    alpha: true, 
    antialias: true, 
    powerPreference: 'high-performance' 
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

  // Custom GLSL Fragment Shader for Swirling High-Contrast Chrome Liquid
  const uniforms = {
    u_time: { value: 0.0 },
    u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
    u_colorFoam: { value: new THREE.Color('#E8FFF7') },
    u_colorMint: { value: new THREE.Color('#B7F0F5') },
    u_colorSky: { value: new THREE.Color('#A6D9F3') },
    u_colorDeepSky: { value: new THREE.Color('#6FB0C8') },
    u_colorMidnight: { value: new THREE.Color('#0F2E3A') }
  };

  const vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }
  `;

  // Fractal domain-warping fluid shader with metallic specular Fresnel bands
  const fragmentShader = `
    uniform float u_time;
    uniform vec2 u_resolution;
    uniform vec2 u_mouse;
    uniform vec3 u_colorFoam;
    uniform vec3 u_colorMint;
    uniform vec3 u_colorSky;
    uniform vec3 u_colorDeepSky;
    uniform vec3 u_colorMidnight;
    varying vec2 vUv;

    // Simplex / harmonic wave equations
    vec2 hash(vec2 p) {
      p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
      return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
    }

    float noise(vec2 p) {
      const float K1 = 0.366025404;
      const float K2 = 0.211324865;
      vec2 i = floor(p + (p.x + p.y) * K1);
      vec2 a = p - i + (i.x + i.y) * K2;
      vec2 o = (a.x > a.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec2 b = a - o + K2;
      vec2 c = a - 1.0 + 2.0 * K2;
      vec3 h = max(0.5 - vec3(dot(a, a), dot(b, b), dot(c, c)), 0.0);
      vec3 n = h * h * h * h * vec3(dot(a, hash(i)), dot(b, hash(i + o)), dot(c, hash(i + 1.0)));
      return dot(n, vec3(70.0));
    }

    void main() {
      vec2 st = gl_FragCoord.xy / u_resolution.xy;
      st.x *= u_resolution.x / u_resolution.y;

      vec2 mouseOffset = (u_mouse - 0.5) * 0.45;
      vec2 p = st * 2.8 + mouseOffset;
      float t = u_time * 0.22;

      // Domain warping (fluid distortion layers)
      vec2 q = vec2(0.0);
      q.x = noise(p + vec2(0.0, 0.0) + t * 0.35);
      q.y = noise(p + vec2(5.2, 1.3) + t * 0.3);

      vec2 r = vec2(0.0);
      r.x = noise(p + 4.0 * q + vec2(1.7, 9.2) + 0.15 * t);
      r.y = noise(p + 4.0 * q + vec2(8.3, 2.8) + 0.126 * t);

      float f = noise(p + 4.2 * r + t * 0.2);

      // Metallic specular highlight contour mapping
      float chromeContour = sin(f * 9.0 + r.x * 6.0 + r.y * 5.0);
      float specular = pow(clamp(chromeContour, 0.0, 1.0), 3.5);
      float darkCrevice = pow(clamp(-chromeContour, 0.0, 1.0), 2.2);

      // Blend palette: Midnight crevices -> Deep Sky -> Mint -> Bright Chrome Foam
      vec3 col = mix(u_colorMidnight, u_colorDeepSky, clamp(f * f * 3.5, 0.0, 1.0));
      col = mix(col, u_colorSky, clamp(length(q), 0.0, 1.0));
      col = mix(col, u_colorMint, clamp(length(r.x), 0.0, 1.0));
      
      // Intense liquid chrome reflections (matching white-hot specular bands in image)
      col = mix(col, vec3(1.0, 1.0, 1.0), specular * 0.92);
      col = mix(col, u_colorMidnight * 0.5, darkCrevice * 0.75);

      // Fine metallic grain
      float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) * 0.035;
      col += grain;

      gl_FragColor = vec4(col, 1.0);
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

    // Smooth mouse lerp
    mouseCurrentX += (mouseTargetX - mouseCurrentX) * 0.05;
    mouseCurrentY += (mouseTargetY - mouseCurrentY) * 0.05;

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
  sourceSelect.innerHTML = '<option value="all">All Sources</option>';
  sources.forEach(src => {
    const opt = document.createElement('option');
    opt.value = src;
    opt.textContent = src;
    sourceSelect.appendChild(opt);
  });
}

function renderOverviewStats() {
  const total = allInternships.length;
  const paidCount = allInternships.filter(i => {
    const val = Number(i.stipend_numeric || 0);
    return val > 0 || (i.stipend && !i.stipend.toLowerCase().includes('unpaid'));
  }).length;

  document.getElementById('stat-total-jobs').innerText = total;
  document.getElementById('stat-paid-jobs').innerText = paidCount;

  document.getElementById('count-all').innerText = total;
  document.getElementById('count-india').innerText = allInternships.filter(i => (i.location_type || '').toLowerCase() === 'india').length;
  document.getElementById('count-remote').innerText = allInternships.filter(i => (i.location_type || '').toLowerCase() === 'remote').length;
  document.getElementById('count-global').innerText = allInternships.filter(i => (i.location_type || '').toLowerCase() === 'international').length;
}

// ==========================================
// 3. Card Grid Rendering
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

  const defaultPhotos = [
    'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1507668077129-56e32842fceb?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=800&q=80'
  ];

  container.innerHTML = items.map((item, idx) => {
    const isBookmarked = bookmarks.includes(item.id);
    const score = item.match_score || 95;
    const skills = (item.required_skills || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 3);
    const photoUrl = item.image_url || defaultPhotos[idx % defaultPhotos.length];

    return `
      <article 
        class="sketch-card flex flex-col justify-between cursor-pointer group p-5"
        onclick="openDetailDrawer('${escapeHtml(item.id)}')"
      >
        <div>
          <!-- Facility thumbnail banner -->
          <div class="w-full h-32 border-2 border-[#0F2E3A] rounded-[255px_15px_225px_15px/15px_225px_15px_255px] overflow-hidden relative mb-4">
            <img 
              src="${photoUrl}" 
              alt="Lab thumbnail" 
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            >
            <div class="absolute top-2 left-2 flex items-center gap-1.5">
              <span class="px-2 py-0.5 bg-[#0F2E3A] text-[#E8FFF7] font-mono font-bold text-[10px] rounded">
                ${score}% Match
              </span>
              ${item.is_new ? '<span class="px-2 py-0.5 bg-[#B7F0F5] text-[#0F2E3A] font-mono font-bold text-[10px] border border-[#0F2E3A] rounded">Verified</span>' : ''}
            </div>

            <button 
              type="button" 
              class="absolute top-2 right-2 p-1.5 bg-[#E8FFF7] border-2 border-[#0F2E3A] rounded text-[#0F2E3A] hover:bg-white transition"
              onclick="event.stopPropagation(); toggleBookmark('${escapeHtml(item.id)}')"
            >
              <i class="ph ${isBookmarked ? 'ph-fill ph-bookmark' : 'ph-bookmark'} text-sm font-bold"></i>
            </button>
          </div>

          <!-- Role & Institution -->
          <h3 class="font-serif text-xl font-bold text-[#0F2E3A] leading-snug group-hover:text-[#6FB0C8] transition-colors line-clamp-2">
            ${escapeHtml(item.role_title || 'Research Fellowship')}
          </h3>
          
          <div class="font-sans text-xs text-[#0F2E3A]/85 mt-2 flex items-center gap-2 font-semibold">
            <span class="text-[#0F2E3A] font-bold">${escapeHtml(item.company_name || 'Institution')}</span>
            <span>|</span>
            <span class="truncate">${escapeHtml(item.location || 'Location Not Listed')}</span>
          </div>

          <!-- Skills Badges -->
          <div class="flex flex-wrap gap-1.5 mt-4">
            ${skills.map(skill => `<span class="px-2 py-0.5 font-mono text-[10px] bg-white text-[#0F2E3A] border border-[#0F2E3A] rounded font-bold">${escapeHtml(skill)}</span>`).join('')}
          </div>
        </div>

        <!-- Metric Footer -->
        <div class="pt-4 mt-5 border-t-2 border-[#0F2E3A] flex items-center justify-between">
          <div>
            <div class="font-mono text-[9px] uppercase font-bold text-[#0F2E3A]/70">Compensation</div>
            <div class="font-mono font-bold text-[#0F2E3A] text-xs mt-0.5">${escapeHtml(item.stipend || 'Unspecified')}</div>
          </div>
          <div class="text-right">
            <span class="px-2 py-1 bg-[#B7F0F5] border border-[#0F2E3A] rounded font-mono font-bold text-[10px] text-[#0F2E3A]">
              ${escapeHtml(item.source_platform || 'Portal')}
            </span>
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
  document.getElementById('drawer-role-title').innerText = item.role_title || 'Fellowship';
  document.getElementById('drawer-company-name').innerText = item.company_name || '';
  document.getElementById('drawer-location').innerText = item.location || 'Remote';
  document.getElementById('drawer-duration').innerText = item.duration || 'Flexible';
  document.getElementById('drawer-stipend').innerText = item.stipend || 'Unspecified';
  document.getElementById('drawer-deadline').innerText = item.application_deadline || 'Rolling';
  document.getElementById('drawer-source').innerText = item.source_platform || 'Portal';
  document.getElementById('drawer-date').innerText = item.date_scraped || 'Recent';
  document.getElementById('drawer-org-badge').innerText = item.org_type || 'Institution';
  document.getElementById('drawer-match-badge').innerText = `${item.match_score || 95}% Match`;

  const drawerImg = document.getElementById('drawer-image');
  if (drawerImg) {
    drawerImg.src = item.image_url || 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=800&q=80';
  }

  const applyLink = document.getElementById('drawer-apply-link');
  applyLink.href = item.apply_link || '#';

  const skillsContainer = document.getElementById('drawer-skills-list');
  const skills = (item.required_skills || '').split(',').map(s => s.trim()).filter(Boolean);
  skillsContainer.innerHTML = skills.length
    ? skills.map(s => `<span class="px-2.5 py-1 bg-white border border-[#0F2E3A] font-mono text-xs font-bold text-[#0F2E3A] rounded">${escapeHtml(s)}</span>`).join('')
    : '<span class="font-serif text-xs text-[#0F2E3A]/80">Standard qualification specifications apply.</span>';

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
  setTimeout(() => overlay.classList.add('hidden'), 250);
}

function updateDrawerBookmarkIcon() {
  const btn = document.getElementById('drawer-bookmark-btn');
  if (!btn || !activeDrawerJob) return;
  const isBookmarked = bookmarks.includes(activeDrawerJob.id);
  btn.innerHTML = `<i class="ph ${isBookmarked ? 'ph-fill ph-bookmark' : 'ph-bookmark'} text-lg"></i>`;
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
  const spotlight = document.getElementById('spotlight-saved-count');
  if (counter) counter.innerText = count;
  if (spotlight) spotlight.innerText = `${count} Items`;
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
      dot.className = 'w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse';
      text.innerText = 'Scanning Feeds';
      fetchLogs();
    } else {
      dot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-600';
      text.innerText = 'Index Active';
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
      logsContainer.innerHTML = data.logs.map(log => `<div>${escapeHtml(log)}</div>`).join('');
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
      document.getElementById('action-title').innerText = data.alert.title || 'Verification Notice';
      document.getElementById('action-message').innerText = data.alert.message || 'Please check browser';
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

  document.querySelectorAll('#location-tabs .sketch-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#location-tabs .sketch-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeLocation = btn.getAttribute('data-val');
      applyFiltersAndRender();
    });
  });

  document.querySelectorAll('#stipend-filters .sketch-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#stipend-filters .sketch-pill').forEach(b => b.classList.remove('active'));
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
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
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
    document.getElementById('filter-bookmarks-btn')?.classList.remove('active');

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

  // Telemetry drawer
  const logsPanel = document.getElementById('logs-panel');
  document.getElementById('open-logs-btn')?.addEventListener('click', () => {
    logsPanel.classList.toggle('hidden');
    fetchLogs();
  });
  document.getElementById('close-logs-btn')?.addEventListener('click', () => {
    logsPanel.classList.add('hidden');
  });

  // Scraper config modal
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

  // Hotkeys
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
