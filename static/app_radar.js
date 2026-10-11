/**
 * InReal Dashboard
 * Colorful Hand-Sketched Art Design + SideNote Font Stack
 * Interactive Holographic Liquid Mercury Canvas (Gentle on the eyes, dynamic pointer interaction)
 * No unnecessary vibe-coded filler text.
 */

let allInternships = [];
let activeLocation = 'all';
let activeStipend = 'all';
let activeSource = 'all';
let showBookmarkedOnly = false;
let bookmarks = JSON.parse(localStorage.getItem('inreal_bookmarks') || '[]');
let activeDrawerJob = null;

// Palette for cards: cheerful pastel tints that pop on paper
const cardBgPalette = [
  '#FEF08A', // pastel yellow
  '#BAE6FD', // pastel sky
  '#A7F3D0', // pastel mint
  '#DDD6FE', // pastel lavender
  '#FED7AA', // pastel peach
  '#FBCFE8'  // pastel pink
];

document.addEventListener('DOMContentLoaded', () => {
  initHolographicLiquidMercury();
  bindEventHandlers();
  loadData();
  pollScraperStatus();
  pollAlerts();
  updateBookmarkCounter();
});

// ==========================================
// 1. 3D Web Experience: Holographic Liquid Chrome / Mercury Shader
// Soft, prismatic, flowing with cursor, comfortable on eyes
// ==========================================
function initHolographicLiquidMercury() {
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

  // Soft holographic pearl/mercury liquid flow shader
  const fragmentShader = `
    uniform float u_time;
    uniform vec2 u_resolution;
    uniform vec2 u_mouse;
    varying vec2 vUv;

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
      vec2 aspectSt = st;
      aspectSt.x *= u_resolution.x / u_resolution.y;

      vec2 aspectMouse = u_mouse;
      aspectMouse.x *= u_resolution.x / u_resolution.y;

      // Cursor fluid push
      float distToMouse = length(aspectSt - aspectMouse);
      float mouseInfluence = exp(-distToMouse * 3.2);

      vec2 mousePush = (aspectSt - aspectMouse) * mouseInfluence * 1.6;
      vec2 vortex = vec2(-aspectSt.y + aspectMouse.y, aspectSt.x - aspectMouse.x) * mouseInfluence * 2.0;

      // Fluid domain coordinates
      vec2 p = aspectSt * 1.5 + mousePush + vortex;
      float t = u_time * 0.22;

      // Layered domain warping
      vec2 q = vec2(
        noise(p + vec2(0.0, 0.0) + t * 0.3),
        noise(p + vec2(5.2, 1.3) + t * 0.28)
      );

      vec2 r = vec2(
        noise(p + 3.2 * q + vec2(1.7, 9.2) + 0.15 * t + (u_mouse - 0.5) * 0.6),
        noise(p + 3.2 * q + vec2(8.3, 2.8) + 0.12 * t + (u_mouse - 0.5) * 0.6)
      );

      float f = noise(p + 3.5 * r + t * 0.18);

      // Liquid specular highlight
      float chromeContour = sin(f * 6.0 + r.x * 4.0 + r.y * 3.5);
      float specular = pow(clamp(chromeContour, 0.0, 1.0), 3.0);
      float darkCrevice = pow(clamp(-chromeContour, 0.0, 1.0), 1.8);

      // Cheerful holographic pastel palette: Warm Gold -> Soft Mint -> Sky Blue -> Pearl
      vec3 colGold = vec3(0.99, 0.88, 0.54);
      vec3 colMint = vec3(0.65, 0.95, 0.82);
      vec3 colSky  = vec3(0.73, 0.90, 0.99);
      vec3 colPaper = vec3(0.98, 0.96, 0.93);
      vec3 colInk = vec3(0.12, 0.11, 0.09);

      vec3 col = mix(colPaper, colSky, clamp(f * f * 2.2, 0.0, 1.0));
      col = mix(col, colMint, clamp(length(q) * 1.1, 0.0, 1.0));
      col = mix(col, colGold, clamp(length(r.x) * 1.2, 0.0, 1.0));
      
      // Chrome highlight
      col = mix(col, vec3(1.0, 1.0, 1.0), specular * 0.85);
      col = mix(col, colInk * 0.6, darkCrevice * 0.35);

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

    mouseCurrentX += (mouseTargetX - mouseCurrentX) * 0.07;
    mouseCurrentY += (mouseTargetY - mouseCurrentY) * 0.07;

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
// 3. Card Grid Rendering with Colorful Palette
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

  container.innerHTML = items.map((item, idx) => {
    const isBookmarked = bookmarks.includes(item.id);
    const skills = (item.required_skills || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 3);
    const cardColor = cardBgPalette[idx % cardBgPalette.length];

    return `
      <article 
        class="sketch-card p-5 flex flex-col justify-between cursor-pointer"
        style="background-color: ${cardColor};"
        onclick="openDetailDrawer('${escapeHtml(item.id)}')"
      >
        <div>
          <!-- Header -->
          <div class="flex items-center justify-between mb-2">
            <span class="px-2 py-0.5 bg-white border-2 border-[#1E1B18] rounded-[255px_15px_225px_15px/15px_225px_15px_255px] text-[11px] font-bold uppercase">
              ${escapeHtml(item.source_platform || 'Portal')}
            </span>

            <button 
              type="button" 
              class="p-1.5 bg-white border-2 border-[#1E1B18] rounded-[255px_15px_225px_15px/15px_225px_15px_255px] text-[#1E1B18] hover:scale-105 transition shadow-[1px_1px_0px_#1E1B18]"
              onclick="event.stopPropagation(); toggleBookmark('${escapeHtml(item.id)}')"
            >
              <i class="ph ${isBookmarked ? 'ph-fill ph-bookmark text-[#F472B6]' : 'ph-bookmark'} text-base"></i>
            </button>
          </div>

          <!-- Role & Company -->
          <h3 class="text-xl font-bold text-[#1E1B18] leading-snug line-clamp-2 mt-1">
            ${escapeHtml(item.role_title || 'Internship')}
          </h3>
          
          <div class="text-xs text-[#1E1B18]/85 mt-1.5 flex items-center gap-1.5 font-bold">
            <span class="text-[#1E1B18] font-black">${escapeHtml(item.company_name || 'Organization')}</span>
            <span>&bull;</span>
            <span class="truncate">${escapeHtml(item.location || 'Location Not Specified')}</span>
          </div>

          <!-- Skills tags -->
          <div class="flex flex-wrap gap-1.5 mt-4">
            ${skills.map(skill => `<span class="px-2.5 py-0.5 text-xs bg-white border-1.5 border-[#1E1B18] rounded-[255px_15px_225px_15px/15px_225px_15px_255px] font-bold">${escapeHtml(skill)}</span>`).join('')}
          </div>
        </div>

        <!-- Footer -->
        <div class="pt-3.5 mt-5 border-t-2 border-[#1E1B18]/25 flex items-center justify-between text-xs font-bold">
          <div>
            <span class="text-[#1E1B18] font-black">${escapeHtml(item.stipend || 'Unspecified')}</span>
          </div>
          <div>
            <span class="px-2 py-1 bg-white border border-[#1E1B18] rounded text-xs font-bold">Details &rarr;</span>
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
  document.getElementById('drawer-role-title').innerText = item.role_title || 'Internship';
  document.getElementById('drawer-company-name').innerText = item.company_name || '';
  document.getElementById('drawer-location').innerText = item.location || 'Remote';
  document.getElementById('drawer-duration').innerText = item.duration || 'Flexible';
  document.getElementById('drawer-stipend').innerText = item.stipend || 'Unspecified';
  document.getElementById('drawer-deadline').innerText = item.application_deadline || 'Rolling';
  document.getElementById('drawer-source').innerText = item.source_platform || 'Portal';
  document.getElementById('drawer-date').innerText = item.date_scraped || 'Recent';
  document.getElementById('drawer-org-badge').innerText = item.org_type || 'Company';

  const applyLink = document.getElementById('drawer-apply-link');
  applyLink.href = item.apply_link || '#';

  const skillsContainer = document.getElementById('drawer-skills-list');
  const skills = (item.required_skills || '').split(',').map(s => s.trim()).filter(Boolean);
  skillsContainer.innerHTML = skills.length
    ? skills.map(s => `<span class="px-3 py-1 bg-white border-2 border-[#1E1B18] rounded-[255px_15px_225px_15px/15px_225px_15px_255px] text-xs font-bold">${escapeHtml(s)}</span>`).join('')
    : '<span class="text-xs text-[#1E1B18]/70">Standard qualifications.</span>';

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
  btn.innerHTML = `<i class="ph ${isBookmarked ? 'ph-fill ph-bookmark text-[#F472B6]' : 'ph-bookmark'} text-base"></i>`;
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
      dot.className = 'w-2.5 h-2.5 rounded-full bg-[#FB923C] animate-pulse border border-[#1E1B18]';
      text.innerText = 'Scraping Live';
      fetchLogs();
    } else {
      dot.className = 'w-2.5 h-2.5 rounded-full bg-[#34D399] border border-[#1E1B18]';
      text.innerText = 'Radar Active';
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
      document.getElementById('action-title').innerText = data.alert.title || 'Notice';
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

  document.querySelectorAll('#location-tabs .sketch-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#location-tabs .sketch-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeLocation = btn.getAttribute('data-val');
      applyFiltersAndRender();
    });
  });

  document.querySelectorAll('#stipend-filters .sketch-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#stipend-filters .sketch-tab').forEach(b => b.classList.remove('active'));
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
