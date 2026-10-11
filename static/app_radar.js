/**
 * InReal Dashboard Application Script
 * Liquid Metallic Cream & Burgundy Aesthetic
 * Free of emojis, em dashes, and generic vibe-coded tropes.
 */

let allInternships = [];
let activeLocation = 'all';
let activeStipend = 'all';
let activeSource = 'all';
let showBookmarkedOnly = false;
let bookmarks = JSON.parse(localStorage.getItem('inreal_bookmarks') || '[]');
let activeDrawerJob = null;

document.addEventListener('DOMContentLoaded', () => {
  initLiquidMetallicCanvas();
  bindEventHandlers();
  loadData();
  pollScraperStatus();
  pollAlerts();
  updateBookmarkCounter();
});

// ==========================================
// 1. 3D Web Experience: Liquid Metallic Ribbons & Waves
// ==========================================
function initLiquidMetallicCanvas() {
  const canvas = document.getElementById('liquid-metal-canvas');
  if (!canvas || typeof THREE === 'undefined') return;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 15, 60);

  const renderer = new THREE.WebGLRenderer({ 
    canvas, 
    alpha: true, 
    antialias: true, 
    powerPreference: 'high-performance' 
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

  // Liquid metallic wave plane geometry
  const geometry = new THREE.PlaneGeometry(160, 110, 48, 48);
  geometry.rotateX(-Math.PI / 2.3);

  // Custom vertex deformation inside shader material or wireframe liquid metal sheen
  const material = new THREE.MeshStandardMaterial({
    color: 0x4A0E17,          // Burgundy base
    roughness: 0.25,          // Liquid reflection
    metalness: 0.95,          // High metallic chrome sheen
    wireframe: false,
    transparent: true,
    opacity: 0.14,
  });

  const liquidMesh = new THREE.Mesh(geometry, material);
  scene.add(liquidMesh);

  // Soft liquid wireframe contour overlay
  const wireMat = new THREE.MeshBasicMaterial({
    color: 0xB89065,          // Bronze / Champagne highlight
    wireframe: true,
    transparent: true,
    opacity: 0.08
  });
  const wireMesh = new THREE.Mesh(geometry, wireMat);
  scene.add(wireMesh);

  // Studio lighting for metallic reflections
  const ambientLight = new THREE.AmbientLight(0xFDFBF7, 1.2);
  scene.add(ambientLight);

  const pointLight1 = new THREE.PointLight(0xB89065, 3.5, 180);
  pointLight1.position.set(40, 40, 30);
  scene.add(pointLight1);

  const pointLight2 = new THREE.PointLight(0x6B1724, 2.5, 180);
  pointLight2.position.set(-40, 20, 20);
  scene.add(pointLight2);

  // Interactive mouse parallax
  let mouseX = 0, mouseY = 0;
  window.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX - window.innerWidth / 2) * 0.0004;
    mouseY = (e.clientY - window.innerHeight / 2) * 0.0004;
  }, { passive: true });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const pos = geometry.attributes.position;
  const initialPositions = pos.clone();
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime() * 0.8;

    // Simulate liquid waves on vertex heights
    for (let i = 0; i < pos.count; i++) {
      const u = initialPositions.getX(i);
      const v = initialPositions.getY(i);
      const wave = Math.sin(u * 0.08 + time) * 3.5 + Math.cos(v * 0.08 + time * 0.6) * 3.5;
      pos.setZ(i, wave);
    }
    pos.needsUpdate = true;

    liquidMesh.rotation.z = Math.sin(time * 0.1) * 0.05 + mouseX;
    wireMesh.rotation.z = liquidMesh.rotation.z;

    camera.position.x = mouseX * 25;
    camera.position.y = 15 - mouseY * 20;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }
  animate();
}

// ==========================================
// 2. Data Fetching & Curation
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

  // Breakdown counts
  document.getElementById('count-all').innerText = total;
  document.getElementById('count-india').innerText = allInternships.filter(i => (i.location_type || '').toLowerCase() === 'india').length;
  document.getElementById('count-remote').innerText = allInternships.filter(i => (i.location_type || '').toLowerCase() === 'remote').length;
  document.getElementById('count-global').innerText = allInternships.filter(i => (i.location_type || '').toLowerCase() === 'international').length;
}

// ==========================================
// 3. Filtering & Editorial Card Layout
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
        class="card-liquid rounded-2xl p-6 flex flex-col justify-between cursor-pointer group"
        onclick="openDetailDrawer('${escapeHtml(item.id)}')"
      >
        <div>
          <!-- Top Row -->
          <div class="flex items-center justify-between mb-3.5">
            <div class="flex items-center gap-2">
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-tight bg-burgundy/10 text-burgundy border border-burgundy/20">
                ${score}% Match
              </span>
              ${item.is_new ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-bronze/20 text-burgundy font-bold border border-bronze/30">Verified</span>' : ''}
            </div>

            <button 
              type="button" 
              class="p-1.5 rounded-lg text-burgundy/40 hover:text-burgundy transition"
              onclick="event.stopPropagation(); toggleBookmark('${escapeHtml(item.id)}')"
            >
              <i class="ph ${isBookmarked ? 'ph-fill ph-bookmark text-burgundy' : 'ph-bookmark'} text-base"></i>
            </button>
          </div>

          <!-- Role & Company -->
          <h3 class="font-display text-xl font-bold text-burgundy tracking-tight leading-snug group-hover:text-burgundy-light transition-colors line-clamp-2">
            ${escapeHtml(item.role_title || 'Fellowship')}
          </h3>
          <div class="text-xs text-burgundy/70 mt-1.5 flex items-center gap-2 font-medium">
            <span class="text-burgundy-deep font-semibold">${escapeHtml(item.company_name || 'Institution')}</span>
            <span>|</span>
            <span class="truncate">${escapeHtml(item.location || 'Location Unspecified')}</span>
          </div>

          <!-- Skills Badges -->
          <div class="flex flex-wrap gap-1.5 mt-4">
            ${skills.map(skill => `<span class="px-2.5 py-1 rounded-md text-[11px] font-mono bg-cream-100 text-burgundy/80 border border-[#E6DCce]">${escapeHtml(skill)}</span>`).join('')}
          </div>
        </div>

        <!-- Footer -->
        <div class="pt-4 mt-5 border-t border-[#E6DCce]/70 flex items-center justify-between text-xs">
          <div>
            <div class="text-[10px] font-mono uppercase tracking-wider text-burgundy/50 font-semibold">Compensation</div>
            <div class="font-mono font-bold text-burgundy text-sm mt-0.5">${escapeHtml(item.stipend || 'Unspecified')}</div>
          </div>
          <div class="text-right">
            <span class="px-2.5 py-1 rounded-lg bg-cream-100 border border-[#E6DCce] text-[11px] font-mono text-burgundy/70">
              ${escapeHtml(item.source_platform || 'Direct')}
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
  document.getElementById('drawer-deadline').innerText = item.application_deadline || 'Rolling basis';
  document.getElementById('drawer-source').innerText = item.source_platform || 'Portal';
  document.getElementById('drawer-date').innerText = item.date_scraped || 'Recent';
  document.getElementById('drawer-org-badge').innerText = item.org_type || 'Institution';
  document.getElementById('drawer-match-badge').innerText = `${item.match_score || 95}% Match`;

  const applyLink = document.getElementById('drawer-apply-link');
  applyLink.href = item.apply_link || '#';

  const skillsContainer = document.getElementById('drawer-skills-list');
  const skills = (item.required_skills || '').split(',').map(s => s.trim()).filter(Boolean);
  skillsContainer.innerHTML = skills.length
    ? skills.map(s => `<span class="px-3 py-1 rounded-lg bg-white border border-[#E6DCce] text-xs font-mono text-burgundy font-medium">${escapeHtml(s)}</span>`).join('')
    : '<span class="text-xs text-burgundy/50">Standard engineering qualifications apply.</span>';

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
  btn.innerHTML = `<i class="ph ${isBookmarked ? 'ph-fill ph-bookmark text-burgundy' : 'ph-bookmark'} text-lg"></i>`;
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
      dot.className = 'w-2 h-2 rounded-full bg-amber-600 animate-pulse';
      text.innerText = 'Engines Scanning';
      fetchLogs();
    } else {
      dot.className = 'w-2 h-2 rounded-full bg-emerald-600';
      text.innerText = 'System Ready';
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
      document.getElementById('action-title').innerText = data.alert.title || 'Verification Alert';
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

  // Region tabs
  document.querySelectorAll('#location-tabs .region-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#location-tabs .region-tab').forEach(b => {
        b.classList.remove('active');
      });
      btn.classList.add('active');
      activeLocation = btn.getAttribute('data-val');
      applyFiltersAndRender();
    });
  });

  // Stipend chips
  document.querySelectorAll('#stipend-filters .stipend-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#stipend-filters .stipend-chip').forEach(b => {
        b.classList.remove('active');
      });
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
