/**
 * InReal Dashboard
 * Aesthetic: Glassmorphism & Translucent Style paired with Flat Illustration
 * (Bold Geometry, Clean Color Blocks, Minimal Shading, iOS-grade Frosted Glass Clarity)
 */

let allInternships = [];
let activeLocation = 'all';
let activeStipend = 'all';
let activeSource = 'all';
let showBookmarkedOnly = false;
let bookmarks = JSON.parse(localStorage.getItem('inreal_bookmarks') || '[]');
let activeDrawerJob = null;

// Flat clean color blocks for category tags & badges
const flatColorThemes = [
  { bg: 'bg-blue-50', text: 'text-blue-600', dot: 'bg-blue-500', border: 'border-blue-100' },
  { bg: 'bg-indigo-50', text: 'text-indigo-600', dot: 'bg-indigo-500', border: 'border-indigo-100' },
  { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-500', border: 'border-emerald-100' },
  { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', border: 'border-amber-100' },
  { bg: 'bg-rose-50', text: 'text-rose-600', dot: 'bg-rose-500', border: 'border-rose-100' },
  { bg: 'bg-purple-50', text: 'text-purple-600', dot: 'bg-purple-500', border: 'border-purple-100' }
];

document.addEventListener('DOMContentLoaded', () => {
  initGlassTranslucentBackground();
  bindEventHandlers();
  loadData();
  pollScraperStatus();
  pollAlerts();
  updateBookmarkCounter();
});

// ==========================================
// 1. Interactive Translucent 3D Floating Geometric Canvas
// Soft pastel floating mesh & light spheres interacting with pointer
// ==========================================
function initGlassTranslucentBackground() {
  const canvas = document.getElementById('topo-radar-canvas');
  if (!canvas || typeof THREE === 'undefined') return;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 40);

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Floating geometric primitives in flat soft pastel colors
  const group = new THREE.Group();
  scene.add(group);

  const materials = [
    new THREE.MeshBasicMaterial({ color: 0x3B82F6, transparent: true, opacity: 0.12 }),
    new THREE.MeshBasicMaterial({ color: 0x8B5CF6, transparent: true, opacity: 0.10 }),
    new THREE.MeshBasicMaterial({ color: 0x10B981, transparent: true, opacity: 0.10 }),
    new THREE.MeshBasicMaterial({ color: 0xEC4899, transparent: true, opacity: 0.08 }),
  ];

  const meshes = [];

  // Soft geometric shapes: Icosahedrons, Torus, Octahedrons
  for (let i = 0; i < 18; i++) {
    const geo = (i % 3 === 0) 
      ? new THREE.IcosahedronGeometry(Math.random() * 2.5 + 1.5, 0)
      : (i % 3 === 1) 
        ? new THREE.TorusGeometry(Math.random() * 2 + 1.2, 0.45, 12, 24)
        : new THREE.OctahedronGeometry(Math.random() * 2 + 1.2, 0);

    const mat = materials[i % materials.length];
    const mesh = new THREE.Mesh(geo, mat);

    mesh.position.set(
      (Math.random() - 0.5) * 55,
      (Math.random() - 0.5) * 40,
      (Math.random() - 0.5) * 15
    );

    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    mesh.userData = {
      rotX: (Math.random() - 0.5) * 0.008,
      rotY: (Math.random() - 0.5) * 0.008,
      floatSpeed: Math.random() * 0.5 + 0.3,
      startY: mesh.position.y
    };

    group.add(mesh);
    meshes.push(mesh);
  }

  // Soft connected wireframe plane at the back
  const planeGeo = new THREE.PlaneGeometry(80, 50, 24, 18);
  const planeMat = new THREE.MeshBasicMaterial({
    color: 0x6366F1,
    wireframe: true,
    transparent: true,
    opacity: 0.06
  });
  const backgroundPlane = new THREE.Mesh(planeGeo, planeMat);
  backgroundPlane.position.z = -10;
  scene.add(backgroundPlane);

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

    curMouseX += (targetMouseX - curMouseX) * 0.04;
    curMouseY += (targetMouseY - curMouseY) * 0.04;

    group.rotation.y = curMouseX * 0.15;
    group.rotation.x = -curMouseY * 0.15;

    meshes.forEach((m) => {
      m.rotation.x += m.userData.rotX;
      m.rotation.y += m.userData.rotY;
      m.position.y = m.userData.startY + Math.sin(elapsed * m.userData.floatSpeed) * 1.5;
    });

    renderer.render(scene, camera);
  }

  animate();
}

// ==========================================
// 2. Data Fetching & Overview Metrics
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
// 3. Card Grid Rendering with Translucent Glass & Flat Color Blocks
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
    const skills = (item.required_skills || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 3);
    const theme = flatColorThemes[idx % flatColorThemes.length];

    return `
      <article 
        class="glass-card p-6 flex flex-col justify-between cursor-pointer group"
        onclick="openDetailDrawer('${escapeHtml(item.id)}')"
      >
        <div>
          <!-- Header: Source Flat Color Block & Bookmark -->
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <span class="flat-badge ${theme.bg} ${theme.text} border ${theme.border}">
                <span class="w-1.5 h-1.5 rounded-full ${theme.dot}"></span>
                ${escapeHtml(item.source_platform || 'Portal')}
              </span>
              ${item.is_new ? '<span class="px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-md text-[11px] font-bold">New</span>' : ''}
            </div>

            <button 
              type="button" 
              class="w-8 h-8 rounded-xl bg-slate-50/80 hover:bg-slate-100 border border-slate-200/60 flex items-center justify-center text-slate-400 hover:text-rose-500 transition"
              onclick="event.stopPropagation(); toggleBookmark('${escapeHtml(item.id)}')"
              title="Bookmark opportunity"
            >
              <i class="ph ${isBookmarked ? 'ph-fill ph-bookmark text-rose-500' : 'ph-bookmark'} text-base"></i>
            </button>
          </div>

          <!-- Role & Company (Crisp typography, minimal clutter) -->
          <h3 class="text-base font-bold text-slate-900 leading-snug line-clamp-2 group-hover:text-blue-600 transition-colors">
            ${escapeHtml(item.role_title || 'Internship Opportunity')}
          </h3>
          
          <div class="text-xs text-slate-500 mt-2 flex items-center gap-2 font-medium">
            <span class="font-bold text-slate-800">${escapeHtml(item.company_name || 'Organization')}</span>
            <span>&bull;</span>
            <span class="truncate">${escapeHtml(item.location || 'Remote')}</span>
          </div>

          <!-- Flat Clean Skill Pills -->
          <div class="flex flex-wrap gap-1.5 mt-4">
            ${skills.map(skill => `<span class="px-2.5 py-1 bg-slate-100/90 text-slate-700 rounded-lg text-[11px] font-semibold">${escapeHtml(skill)}</span>`).join('')}
          </div>
        </div>

        <!-- Footer: Clean Stipend readout & Action Pill -->
        <div class="pt-4 mt-5 border-t border-slate-200/60 flex items-center justify-between text-xs">
          <div>
            <div class="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Stipend</div>
            <div class="font-extrabold text-slate-900 text-sm mt-0.5">${escapeHtml(item.stipend || 'Unspecified')}</div>
          </div>
          <div>
            <span class="px-3.5 py-1.5 bg-blue-50 text-blue-600 font-bold rounded-xl group-hover:bg-blue-600 group-hover:text-white transition flex items-center gap-1">
              <span>View Details</span>
              <i class="ph ph-arrow-right text-xs"></i>
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
  document.getElementById('drawer-role-title').innerText = item.role_title || 'Opportunity';
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
    ? skills.map(s => `<span class="px-3 py-1 bg-slate-100 text-slate-800 rounded-lg text-xs font-semibold">${escapeHtml(s)}</span>`).join('')
    : '<span class="text-xs text-slate-500">General qualifications.</span>';

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
  btn.innerHTML = `<i class="ph ${isBookmarked ? 'ph-fill ph-bookmark text-rose-500' : 'ph-bookmark text-slate-600'} text-base"></i>`;
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
// 6. Scraper Status & Activity Feeds
// ==========================================
async function pollScraperStatus() {
  try {
    const res = await fetch('/api/scrape/status');
    const data = await res.json();
    const isRunning = data.status === 'running';

    const dot = document.getElementById('ping-dot');
    const text = document.getElementById('scraper-status-text');

    if (isRunning) {
      if (dot) dot.className = 'w-2 h-2 rounded-full bg-amber-500 animate-pulse';
      if (text) text.innerText = 'Scanning...';
      fetchLogs();
    } else {
      if (dot) dot.className = 'w-2 h-2 rounded-full bg-emerald-500';
      if (text) text.innerText = 'System Ready';
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
      document.getElementById('action-title').innerText = data.alert.title || 'Notification';
      document.getElementById('action-message').innerText = data.alert.message || 'Action required in browser window.';
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  } catch (e) {}
  setTimeout(pollAlerts, 3000);
}

// ==========================================
// 7. Event Handlers & Segmented Controls
// ==========================================
function bindEventHandlers() {
  document.getElementById('search-input')?.addEventListener('input', applyFiltersAndRender);

  // Region Segmented Rocker Switches
  document.querySelectorAll('#location-tabs .pill-segmented-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#location-tabs .pill-segmented-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeLocation = btn.getAttribute('data-val');
      applyFiltersAndRender();
    });
  });

  // Stipend Segmented Rocker Switches
  document.querySelectorAll('#stipend-filters .pill-segmented-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#stipend-filters .pill-segmented-item').forEach(b => b.classList.remove('active'));
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
      btn.classList.add('bg-rose-50', 'text-rose-600', 'border-rose-200');
    } else {
      btn.classList.remove('bg-rose-50', 'text-rose-600', 'border-rose-200');
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
    if (bookmarkBtn) bookmarkBtn.classList.remove('bg-rose-50', 'text-rose-600', 'border-rose-200');

    const allTab = document.querySelector('#location-tabs [data-val="all"]');
    if (allTab) {
      document.querySelectorAll('#location-tabs .pill-segmented-item').forEach(b => b.classList.remove('active'));
      allTab.classList.add('active');
    }

    const allStipend = document.querySelector('#stipend-filters [data-val="all"]');
    if (allStipend) {
      document.querySelectorAll('#stipend-filters .pill-segmented-item').forEach(b => b.classList.remove('active'));
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
