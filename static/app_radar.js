/**
 * InReal Dashboard Application Script
 * Powered by frontend-expert, uiux-designer, and 3d-web-experience skills.
 */

// Global State
let allInternships = [];
let activeLocation = 'all';
let activeStipend = 'all';
let activeSource = 'all';
let showBookmarkedOnly = false;
let bookmarks = JSON.parse(localStorage.getItem('inreal_bookmarks') || '[]');
let activeDrawerJob = null;

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  init3DHeroCanvas();
  bindEventHandlers();
  loadData();
  pollScraperStatus();
  pollAlerts();
  updateBookmarkCounter();
});

// ==========================================
// 1. 3D Web Experience (Three.js WebGL Radar Field)
// ==========================================
function init3DHeroCanvas() {
  const canvas = document.getElementById('hero-3d-canvas');
  if (!canvas || typeof THREE === 'undefined') return;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 85;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

  // Particle constellation representing global opportunities
  const particleCount = 140;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);

  const colorIndigo = new THREE.Color('#6366f1');
  const colorCyan = new THREE.Color('#06b6d4');

  for (let i = 0; i < particleCount; i++) {
    const i3 = i * 3;
    positions[i3] = (Math.random() - 0.5) * 160;
    positions[i3 + 1] = (Math.random() - 0.5) * 100;
    positions[i3 + 2] = (Math.random() - 0.5) * 80;

    const mixedColor = colorIndigo.clone().lerp(colorCyan, Math.random());
    colors[i3] = mixedColor.r;
    colors[i3 + 1] = mixedColor.g;
    colors[i3 + 2] = mixedColor.b;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 2.2,
    vertexColors: true,
    transparent: true,
    opacity: 0.75,
    blending: THREE.AdditiveBlending
  });

  const particleSystem = new THREE.Points(geometry, material);
  scene.add(particleSystem);

  // Subtle interactive mouse parallax
  let mouseX = 0, mouseY = 0;
  window.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX - window.innerWidth / 2) * 0.0008;
    mouseY = (e.clientY - window.innerHeight / 2) * 0.0008;
  }, { passive: true });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  let clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const elapsedTime = clock.getElapsedTime();

    particleSystem.rotation.y = elapsedTime * 0.03 + mouseX;
    particleSystem.rotation.x = Math.sin(elapsedTime * 0.02) * 0.05 + mouseY;

    renderer.render(scene, camera);
  }
  animate();
}

// ==========================================
// 2. Data Fetching & State
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
  sourceSelect.innerHTML = '<option value="all">All Platforms</option>';
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

  // Region breakdown counts
  document.getElementById('count-all').innerText = total;
  document.getElementById('count-india').innerText = allInternships.filter(i => (i.location_type || '').toLowerCase() === 'india').length;
  document.getElementById('count-remote').innerText = allInternships.filter(i => (i.location_type || '').toLowerCase() === 'remote').length;
  document.getElementById('count-global').innerText = allInternships.filter(i => (i.location_type || '').toLowerCase() === 'international').length;
}

// ==========================================
// 3. UI/UX: Filtering & Rendering
// ==========================================
function applyFiltersAndRender() {
  const searchQuery = (document.getElementById('search-input')?.value || '').toLowerCase().trim();

  const filtered = allInternships.filter(item => {
    // 1. Bookmarked
    if (showBookmarkedOnly && !bookmarks.includes(item.id)) return false;

    // 2. Region / Location
    if (activeLocation !== 'all') {
      if ((item.location_type || '').toLowerCase() !== activeLocation.toLowerCase()) {
        return false;
      }
    }

    // 3. Source Platform
    if (activeSource !== 'all' && item.source_platform !== activeSource) {
      return false;
    }

    // 4. Stipend
    if (activeStipend === 'paid') {
      const num = Number(item.stipend_numeric || 0);
      if (num <= 0 && (!item.stipend || item.stipend.toLowerCase().includes('unpaid'))) return false;
    } else if (activeStipend === '20k') {
      if (Number(item.stipend_numeric || 0) < 20000) return false;
    } else if (activeStipend === '50k') {
      if (Number(item.stipend_numeric || 0) < 50000) return false;
    }

    // 5. Search Text (Role, Company, Skills)
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
    const score = item.match_score || 90;
    const skills = (item.required_skills || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 3);

    return `
      <article 
        class="group relative glass-panel rounded-xl p-5 border border-surface-border hover:border-surface-borderHover hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-200 cursor-pointer flex flex-col justify-between"
        onclick="openDetailDrawer('${escapeHtml(item.id)}')"
      >
        <div>
          <!-- Header: Score + Bookmarking -->
          <div class="flex items-center justify-between gap-2 mb-3">
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                ${score}% Match
              </span>
              ${item.is_new ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">NEW</span>' : ''}
            </div>

            <button 
              type="button" 
              class="bookmark-action-btn p-1.5 rounded-lg text-slate-400 hover:text-amber-400 transition" 
              onclick="event.stopPropagation(); toggleBookmark('${escapeHtml(item.id)}')"
            >
              <i class="ph ${isBookmarked ? 'ph-fill ph-bookmark-simple text-amber-400' : 'ph-bookmark-simple'} text-base"></i>
            </button>
          </div>

          <!-- Role & Company -->
          <h3 class="text-base font-semibold text-white tracking-tight group-hover:text-indigo-400 transition-colors line-clamp-2">
            ${escapeHtml(item.role_title || 'Untitled Internship')}
          </h3>
          <div class="text-xs font-medium text-slate-400 mt-1 flex items-center gap-1.5">
            <span class="text-slate-200 font-semibold">${escapeHtml(item.company_name || 'Organization')}</span>
            <span class="text-slate-600">&bull;</span>
            <span class="truncate">${escapeHtml(item.location || 'Location Not Specified')}</span>
          </div>

          <!-- Skills tags -->
          <div class="flex flex-wrap gap-1.5 mt-3">
            ${skills.map(skill => `<span class="px-2 py-0.5 rounded-md text-[11px] bg-slate-800/80 text-slate-300 font-mono">${escapeHtml(skill)}</span>`).join('')}
          </div>
        </div>

        <!-- Footer: Stipend & Source Platform -->
        <div class="pt-4 mt-4 border-t border-white/5 flex items-center justify-between text-xs">
          <div>
            <div class="text-[10px] uppercase font-mono text-slate-500">Compensation</div>
            <div class="font-mono font-bold text-emerald-400 mt-0.5">${escapeHtml(item.stipend || 'Unspecified')}</div>
          </div>
          <div class="text-right">
            <span class="px-2 py-1 rounded bg-[#0b0f17] border border-surface-border text-[11px] font-mono text-slate-400">
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
  document.getElementById('drawer-role-title').innerText = item.role_title || 'Internship';
  document.getElementById('drawer-company-name').innerText = item.company_name || '';
  document.getElementById('drawer-location').innerText = item.location || 'Remote / Hybrid';
  document.getElementById('drawer-duration').innerText = item.duration || 'Not specified';
  document.getElementById('drawer-stipend').innerText = item.stipend || 'Unpaid / Hidden';
  document.getElementById('drawer-deadline').innerText = item.application_deadline || 'Open / Rolling';
  document.getElementById('drawer-source').innerText = item.source_platform || 'Web Portal';
  document.getElementById('drawer-date').innerText = item.date_scraped || 'Recent';
  document.getElementById('drawer-org-badge').innerText = item.org_type || 'Company';
  document.getElementById('drawer-match-badge').innerText = `${item.match_score || 95}% Match`;

  // Apply Link
  const applyLink = document.getElementById('drawer-apply-link');
  applyLink.href = item.apply_link || '#';

  // Skills
  const skillsContainer = document.getElementById('drawer-skills-list');
  const skills = (item.required_skills || '').split(',').map(s => s.trim()).filter(Boolean);
  skillsContainer.innerHTML = skills.length
    ? skills.map(s => `<span class="px-2.5 py-1 rounded-lg bg-surface-elevated text-xs font-mono text-indigo-300 border border-surface-border">${escapeHtml(s)}</span>`).join('')
    : '<span class="text-xs text-slate-500">No specific skills listed.</span>';

  // Bookmark button state
  updateDrawerBookmarkIcon();

  // Show drawer
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
  btn.innerHTML = `<i class="ph ${isBookmarked ? 'ph-fill ph-bookmark-simple text-amber-400' : 'ph-bookmark-simple'} text-lg"></i>`;
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
  const counter = document.getElementById('bookmark-count');
  if (counter) counter.innerText = bookmarks.length;
}

// ==========================================
// 6. Scraper Controls & Telemetry
// ==========================================
async function pollScraperStatus() {
  try {
    const res = await fetch('/api/scrape/status');
    const data = await res.json();
    const isRunning = data.status === 'running';

    const pill = document.getElementById('status-indicator-pill');
    const dot = document.getElementById('ping-dot');
    const ring = document.getElementById('ping-ring');
    const text = document.getElementById('scraper-status-text');

    if (isRunning) {
      ring.classList.remove('hidden');
      dot.className = 'relative inline-flex rounded-full h-2 w-2 bg-emerald-400';
      text.innerText = 'Scanning Live Portals';
      fetchLogs();
    } else {
      ring.classList.add('hidden');
      dot.className = 'relative inline-flex rounded-full h-2 w-2 bg-slate-500';
      text.innerText = 'System Idle';
    }
  } catch (e) {}

  setTimeout(pollScraperStatus, 3000);
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
      document.getElementById('action-message').innerText = data.alert.message || 'Please inspect browser';
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  } catch (e) {}
  setTimeout(pollAlerts, 2500);
}

// ==========================================
// 7. Event Handlers
// ==========================================
function bindEventHandlers() {
  // Search
  document.getElementById('search-input')?.addEventListener('input', applyFiltersAndRender);

  // Region tabs
  document.querySelectorAll('#location-tabs .region-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#location-tabs .region-tab').forEach(b => {
        b.classList.remove('active-tab', 'bg-indigo-600/20', 'text-indigo-300', 'border', 'border-indigo-500/30');
      });
      btn.classList.add('active-tab', 'bg-indigo-600/20', 'text-indigo-300', 'border', 'border-indigo-500/30');
      activeLocation = btn.getAttribute('data-val');
      applyFiltersAndRender();
    });
  });

  // Stipend chips
  document.querySelectorAll('#stipend-filters .stipend-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#stipend-filters .stipend-chip').forEach(b => {
        b.classList.remove('border-indigo-500/40', 'bg-indigo-500/10', 'text-indigo-300');
        b.classList.add('border-surface-border', 'text-slate-400');
      });
      btn.classList.remove('border-surface-border', 'text-slate-400');
      btn.classList.add('border-indigo-500/40', 'bg-indigo-500/10', 'text-indigo-300');
      activeStipend = btn.getAttribute('data-val');
      applyFiltersAndRender();
    });
  });

  // Source dropdown
  document.getElementById('source-filter')?.addEventListener('change', (e) => {
    activeSource = e.target.value;
    applyFiltersAndRender();
  });

  // Bookmarks filter toggle
  document.getElementById('filter-bookmarks-btn')?.addEventListener('click', (e) => {
    showBookmarkedOnly = !showBookmarkedOnly;
    const btn = document.getElementById('filter-bookmarks-btn');
    if (showBookmarkedOnly) {
      btn.classList.add('border-amber-500/40', 'text-amber-300', 'bg-amber-500/10');
    } else {
      btn.classList.remove('border-amber-500/40', 'text-amber-300', 'bg-amber-500/10');
    }
    applyFiltersAndRender();
  });

  // Reset filter buttons
  const resetAll = () => {
    document.getElementById('search-input').value = '';
    activeLocation = 'all';
    activeStipend = 'all';
    activeSource = 'all';
    showBookmarkedOnly = false;
    document.getElementById('source-filter').value = 'all';
    document.getElementById('filter-bookmarks-btn')?.classList.remove('border-amber-500/40', 'text-amber-300', 'bg-amber-500/10');

    // Reset tab active styling
    const allTab = document.querySelector('#location-tabs [data-val="all"]');
    if (allTab) allTab.click();
    applyFiltersAndRender();
  };

  document.getElementById('reset-filters-btn')?.addEventListener('click', resetAll);
  document.getElementById('empty-reset-btn')?.addEventListener('click', resetAll);

  // Drawer events
  document.getElementById('close-drawer-btn')?.addEventListener('click', closeDetailDrawer);
  document.getElementById('detail-drawer-overlay')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('detail-drawer-overlay')) {
      closeDetailDrawer();
    }
  });
  document.getElementById('drawer-bookmark-btn')?.addEventListener('click', () => {
    if (activeDrawerJob) toggleBookmark(activeDrawerJob.id);
  });

  // Telemetry logs panel toggle
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

  // Action Banner dismiss
  document.getElementById('action-dismiss-btn')?.addEventListener('click', async () => {
    document.getElementById('action-banner').classList.add('hidden');
    try {
      await fetch('/api/alerts/dismiss', { method: 'POST' });
    } catch (e) {}
  });

  // Keyboard shortcut (Cmd/Ctrl + K to focus search, Esc to close drawer/modals)
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
