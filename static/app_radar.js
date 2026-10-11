/**
 * InReal Dashboard
 * Tactile Neo-Brutalist Hardware (Teenage Engineering × Linear)
 * Features:
 * - Low-latency Three.js Topographical Wireframe Radar Terrain
 * - Tactile Hardware Modules with Precision Screws & Telemetry Brackets
 * - Segmented Rocker Switches & Physical LED Pill Indicators
 * - Keyboard shortcuts, slide-over telemetry inspection drawer & live scraping fleet
 */

let allInternships = [];
let activeLocation = 'all';
let activeStipend = 'all';
let activeSource = 'all';
let showBookmarkedOnly = false;
let bookmarks = JSON.parse(localStorage.getItem('inreal_bookmarks') || '[]');
let activeDrawerJob = null;

document.addEventListener('DOMContentLoaded', () => {
  initTopoRadarCanvas();
  bindEventHandlers();
  loadData();
  pollScraperStatus();
  pollAlerts();
  updateBookmarkCounter();
});

// ==========================================
// 1. Three.js Interactive Topographical Wireframe Radar
// Subtle engineering grid / point-cloud elevation reacting to cursor
// ==========================================
function initTopoRadarCanvas() {
  const canvas = document.getElementById('topo-radar-canvas');
  if (!canvas || typeof THREE === 'undefined') return;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, -28, 22);
  camera.lookAt(0, 4, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Topographical terrain mesh
  const cols = 56;
  const rows = 42;
  const planeGeo = new THREE.PlaneGeometry(80, 60, cols, rows);
  
  // Wireframe material in technical slate with micro transparency
  const wireMaterial = new THREE.MeshBasicMaterial({
    color: 0x1E2024,
    wireframe: true,
    transparent: true,
    opacity: 0.22
  });

  const terrainMesh = new THREE.Mesh(planeGeo, wireMaterial);
  scene.add(terrainMesh);

  // Secondary subtle radar scan point cloud
  const pointsGeo = new THREE.BufferGeometry();
  const pointsCount = cols * rows;
  const posArray = new Float32Array(pointsCount * 3);
  for (let i = 0; i < pointsCount * 3; i++) {
    posArray[i] = planeGeo.attributes.position.array[i];
  }
  pointsGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));

  const pointsMaterial = new THREE.PointsMaterial({
    size: 0.45,
    color: 0xFF5C00,
    transparent: true,
    opacity: 0.35
  });
  const pointsMesh = new THREE.Points(pointsGeo, pointsMaterial);
  scene.add(pointsMesh);

  // Mouse interaction state
  let targetMouseX = 0;
  let targetMouseY = 0;
  let curMouseX = 0;
  let curMouseY = 0;

  window.addEventListener('mousemove', (e) => {
    targetMouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    targetMouseY = -(e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  let clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);

    const elapsed = clock.getElapsedTime();
    curMouseX += (targetMouseX - curMouseX) * 0.05;
    curMouseY += (targetMouseY - curMouseY) * 0.05;

    // Gentle camera parallax
    camera.position.x = curMouseX * 5;
    camera.position.y = -28 + curMouseY * 3;
    camera.lookAt(0, 4, 0);

    // Dynamic wave elevation simulation on terrain vertices
    const position = planeGeo.attributes.position;
    const ptPosition = pointsGeo.attributes.position;

    for (let i = 0; i < position.count; i++) {
      const u = position.getX(i);
      const v = position.getY(i);

      // Distance from mouse projection center
      const dx = u - (curMouseX * 25);
      const dy = v - (curMouseY * 20);
      const dist = Math.sqrt(dx * dx + dy * dy);
      const ripple = Math.sin(dist * 0.3 - elapsed * 1.5) * Math.exp(-dist * 0.08) * 2.2;
      const ambientWave = Math.sin(u * 0.12 + elapsed * 0.8) * Math.cos(v * 0.15 + elapsed * 0.6) * 0.8;

      const z = ripple + ambientWave;
      position.setZ(i, z);
      ptPosition.setZ(i, z);
    }

    position.needsUpdate = true;
    ptPosition.needsUpdate = true;

    renderer.render(scene, camera);
  }

  animate();
}

// ==========================================
// 2. Data Fetching & Telemetry Statistics
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
  sourceSelect.innerHTML = '<option value="all">ALL SOURCES</option>';
  sources.forEach(src => {
    const opt = document.createElement('option');
    opt.value = src;
    opt.textContent = src.toUpperCase();
    sourceSelect.appendChild(opt);
  });
}

function renderOverviewStats() {
  const total = allInternships.length;
  const paidCount = allInternships.filter(i => {
    const val = Number(i.stipend_numeric || 0);
    return val > 0 || (i.stipend && !i.stipend.toLowerCase().includes('unpaid'));
  }).length;
  const newCount = allInternships.filter(i => i.is_new).length;

  const totalEl = document.getElementById('stat-total-jobs');
  const paidEl = document.getElementById('stat-paid-jobs');
  const newEl = document.getElementById('stat-new-jobs');

  if (totalEl) totalEl.innerText = total;
  if (paidEl) paidEl.innerText = paidCount;
  if (newEl) newEl.innerText = newCount || '0';

  const countAll = document.getElementById('count-all');
  const countIndia = document.getElementById('count-india');
  const countRemote = document.getElementById('count-remote');
  const countGlobal = document.getElementById('count-global');

  if (countAll) countAll.innerText = total;
  if (countIndia) countIndia.innerText = allInternships.filter(i => (i.location_type || '').toLowerCase() === 'india').length;
  if (countRemote) countRemote.innerText = allInternships.filter(i => (i.location_type || '').toLowerCase() === 'remote').length;
  if (countGlobal) countGlobal.innerText = allInternships.filter(i => (i.location_type || '').toLowerCase() === 'international').length;
}

// ==========================================
// 3. Hardware Module Card Grid Rendering
// Teenage Engineering / Linear Telemetry Aesthetic
// ==========================================
function applyFiltersAndRender() {
  const searchInput = document.getElementById('search-input');
  const searchQuery = (searchInput ? searchInput.value : '').toLowerCase().trim();

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
    if (emptyState) {
      emptyState.classList.remove('hidden');
      emptyState.classList.add('flex');
    }
    return;
  }

  if (emptyState) {
    emptyState.classList.add('hidden');
    emptyState.classList.remove('flex');
  }

  container.innerHTML = items.map((item, idx) => {
    const isBookmarked = bookmarks.includes(item.id);
    const score = item.match_score || 96;
    const skills = (item.required_skills || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 3);
    const channelId = String(idx + 1).padStart(2, '0');

    return `
      <article 
        class="hardware-module p-5 flex flex-col justify-between cursor-pointer group relative bg-[#FFFFFF]"
        onclick="openDetailDrawer('${escapeHtml(item.id)}')"
      >
        <div>
          <!-- Hardware Header: Channel index, Platform Tag, Mechanical Screw -->
          <div class="flex items-center justify-between pb-3 mb-3 border-b border-[#E8E8E0]">
            <div class="flex items-center gap-2">
              <span class="font-mono text-[10px] font-bold text-[#686B73] tracking-widest">[CH.${channelId}]</span>
              <span class="px-2 py-0.5 bg-[#F5F5F0] border border-[#1E2024] rounded text-[10px] font-mono font-bold uppercase tracking-wider text-[#141517]">
                ${escapeHtml(item.source_platform || 'RADAR')}
              </span>
              ${item.is_new ? '<span class="px-1.5 py-0.5 bg-[#FF5C00] text-white rounded text-[9px] font-mono font-bold tracking-wider">NEW</span>' : ''}
            </div>

            <div class="flex items-center gap-2">
              <button 
                type="button" 
                class="w-7 h-7 rounded border border-[#1E2024] bg-[#FFFFFF] hover:bg-[#F5F5F0] flex items-center justify-center transition"
                onclick="event.stopPropagation(); toggleBookmark('${escapeHtml(item.id)}')"
                title="Toggle Telemetry Bookmark"
              >
                <i class="ph ${isBookmarked ? 'ph-fill ph-bookmark text-[#FF5C00]' : 'ph-bookmark text-[#141517]'} text-xs"></i>
              </button>
              <div class="hardware-screw"></div>
            </div>
          </div>

          <!-- Role & Organization -->
          <h3 class="font-mono text-base font-extrabold text-[#141517] leading-snug line-clamp-2 group-hover:text-[#FF5C00] transition-colors uppercase tracking-tight">
            ${escapeHtml(item.role_title || 'OPPORTUNITY')}
          </h3>
          
          <div class="text-xs font-mono text-[#686B73] mt-1.5 flex items-center gap-2 font-bold uppercase">
            <span class="text-[#141517]">${escapeHtml(item.company_name || 'RESEARCH LAB')}</span>
            <span>//</span>
            <span class="truncate">${escapeHtml(item.location || 'REMOTE')}</span>
          </div>

          <!-- Tactile Parameter Badges -->
          <div class="flex flex-wrap gap-1.5 mt-3.5">
            ${skills.map(skill => `<span class="px-2 py-0.5 bg-[#F5F5F0] border border-[#D5D5CA] text-[#141517] rounded text-[10px] font-mono font-bold uppercase tracking-wider">${escapeHtml(skill)}</span>`).join('')}
          </div>
        </div>

        <!-- Hardware Footer: Stipend Readout & Detail Trigger -->
        <div class="pt-3.5 mt-4 border-t-1.5 border-[#1E2024] flex items-center justify-between font-mono">
          <div>
            <div class="text-[9px] text-[#686B73] uppercase font-bold tracking-widest">[STIPEND]</div>
            <div class="font-extrabold text-[#141517] text-xs mt-0.5">${escapeHtml(item.stipend || 'UNSPECIFIED')}</div>
          </div>
          <div>
            <span class="tactile-btn px-2.5 py-1 text-[10px] flex items-center gap-1 group-hover:bg-[#FF5C00] group-hover:text-white transition">
              <span>INSPECT</span>
              <i class="ph ph-arrow-right text-[10px]"></i>
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
  document.getElementById('drawer-role-title').innerText = item.role_title || 'INTERNSHIP';
  document.getElementById('drawer-company-name').innerText = item.company_name || '';
  document.getElementById('drawer-location').innerText = item.location || 'REMOTE';
  document.getElementById('drawer-duration').innerText = item.duration || 'FLEXIBLE';
  document.getElementById('drawer-stipend').innerText = item.stipend || 'UNSPECIFIED';
  document.getElementById('drawer-deadline').innerText = item.application_deadline || 'OPEN / ROLLING';
  document.getElementById('drawer-source').innerText = item.source_platform || 'RADAR';
  document.getElementById('drawer-date').innerText = item.date_scraped || 'RECENT';
  document.getElementById('drawer-org-badge').innerText = (item.org_type || 'ORGANIZATION').toUpperCase();

  const applyLink = document.getElementById('drawer-apply-link');
  applyLink.href = item.apply_link || '#';

  const skillsContainer = document.getElementById('drawer-skills-list');
  const skills = (item.required_skills || '').split(',').map(s => s.trim()).filter(Boolean);
  skillsContainer.innerHTML = skills.length
    ? skills.map(s => `<span class="px-2.5 py-1 bg-[#FFFFFF] border border-[#1E2024] text-[#141517] rounded text-xs font-mono font-bold uppercase tracking-wider">${escapeHtml(s)}</span>`).join('')
    : '<span class="text-xs font-mono text-[#686B73]">[STANDARD RESEARCH CRITERIA]</span>';

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
  btn.innerHTML = `<i class="ph ${isBookmarked ? 'ph-fill ph-bookmark text-[#FF5C00]' : 'ph-bookmark text-[#141517]'} text-base"></i>`;
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
// 6. Scraper Status & Telemetry Console
// ==========================================
async function pollScraperStatus() {
  try {
    const res = await fetch('/api/scrape/status');
    const data = await res.json();
    const isRunning = data.status === 'running';

    const dot = document.getElementById('ping-dot');
    const text = document.getElementById('scraper-status-text');

    if (isRunning) {
      if (dot) dot.className = 'w-2.5 h-2.5 rounded-full bg-[#FF5C00] animate-ping border border-[#1E2024]';
      if (text) text.innerText = '[SCANNING]';
      fetchLogs();
    } else {
      if (dot) dot.className = 'w-2.5 h-2.5 rounded-full bg-[#10B981] border border-[#1E2024]';
      if (text) text.innerText = '[SYS_OK]';
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
      logsContainer.innerHTML = data.logs.map(log => `<div class="font-mono text-xs text-[#141517] leading-relaxed">${escapeHtml(log)}</div>`).join('');
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
      document.getElementById('action-title').innerText = data.alert.title || 'TELEMETRY ALERT';
      document.getElementById('action-message').innerText = data.alert.message || 'ACTION REQUIRED IN BROWSER';
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  } catch (e) {}
  setTimeout(pollAlerts, 3000);
}

// ==========================================
// 7. Event Handlers & Rocker Switches
// ==========================================
function bindEventHandlers() {
  document.getElementById('search-input')?.addEventListener('input', applyFiltersAndRender);

  // Region Rocker Switch
  document.querySelectorAll('#location-tabs .rocker-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#location-tabs .rocker-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeLocation = btn.getAttribute('data-val');
      applyFiltersAndRender();
    });
  });

  // Stipend Rocker Switch
  document.querySelectorAll('#stipend-filters .rocker-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#stipend-filters .rocker-item').forEach(b => b.classList.remove('active'));
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
      btn.classList.add('bg-[#141517]', 'text-white');
    } else {
      btn.classList.remove('bg-[#141517]', 'text-white');
    }
    applyFiltersAndRender();
  });

  const resetAll = () => {
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';
    activeLocation = 'all';
    activeStipend = 'all';
    activeSource = 'all';
    showBookmarkedOnly = false;
    
    const sourceSelect = document.getElementById('source-filter');
    if (sourceSelect) sourceSelect.value = 'all';
    
    const bookmarkBtn = document.getElementById('filter-bookmarks-btn');
    if (bookmarkBtn) bookmarkBtn.classList.remove('bg-[#141517]', 'text-white');

    const allTab = document.querySelector('#location-tabs [data-val="all"]');
    if (allTab) {
      document.querySelectorAll('#location-tabs .rocker-item').forEach(b => b.classList.remove('active'));
      allTab.classList.add('active');
    }

    const allStipend = document.querySelector('#stipend-filters [data-val="all"]');
    if (allStipend) {
      document.querySelectorAll('#stipend-filters .rocker-item').forEach(b => b.classList.remove('active'));
      allStipend.classList.add('active');
    }

    applyFiltersAndRender();
  };

  document.getElementById('reset-filters-btn')?.addEventListener('click', resetAll);
  document.getElementById('empty-reset-btn')?.addEventListener('click', resetAll);

  // Detail Drawer Interactions
  document.getElementById('close-drawer-btn')?.addEventListener('click', closeDetailDrawer);
  document.getElementById('detail-drawer-overlay')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('detail-drawer-overlay')) {
      closeDetailDrawer();
    }
  });
  document.getElementById('drawer-bookmark-btn')?.addEventListener('click', () => {
    if (activeDrawerJob) toggleBookmark(activeDrawerJob.id);
  });

  // Telemetry Log Console
  const logsPanel = document.getElementById('logs-panel');
  document.getElementById('open-logs-btn')?.addEventListener('click', () => {
    logsPanel.classList.toggle('hidden');
    fetchLogs();
  });
  document.getElementById('close-logs-btn')?.addEventListener('click', () => {
    logsPanel.classList.add('hidden');
  });

  // Scraper Fleet Modal
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

  // Keyboard navigation
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
