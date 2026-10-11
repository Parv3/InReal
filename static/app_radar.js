/**
 * INREAL / MERCURY RADAR
 * Ultrarealistic Brutalism + Real World Photos + Flowing Liquid Chrome Mercury Simulation
 * Free of emojis and em dashes.
 */

let allInternships = [];
let activeLocation = 'all';
let activeStipend = 'all';
let activeSource = 'all';
let showBookmarkedOnly = false;
let bookmarks = JSON.parse(localStorage.getItem('inreal_bookmarks') || '[]');
let activeDrawerJob = null;

document.addEventListener('DOMContentLoaded', () => {
  initLiquidMercuryCanvas();
  bindEventHandlers();
  loadData();
  pollScraperStatus();
  pollAlerts();
  updateBookmarkCounter();
});

// ==========================================
// 1. 3D Web Experience: Real-time Liquid Chrome Mercury Simulation
// ==========================================
function initLiquidMercuryCanvas() {
  const canvas = document.getElementById('liquid-mercury-canvas');
  if (!canvas || typeof THREE === 'undefined') return;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 20, 60);

  const renderer = new THREE.WebGLRenderer({ 
    canvas, 
    alpha: true, 
    antialias: true, 
    powerPreference: 'high-performance' 
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

  // Dense liquid mercury surface
  const geometry = new THREE.PlaneGeometry(160, 120, 64, 64);
  geometry.rotateX(-Math.PI / 2.2);

  // Chrome mercury material with mirror metallic reflections and burgundy rim shadows
  const mercuryMat = new THREE.MeshStandardMaterial({
    color: 0xCBD5E1,          // High mirror chrome silver
    roughness: 0.08,          // Mirror liquid reflection
    metalness: 0.98,          // Pure liquid mercury metal
    wireframe: false,
    transparent: true,
    opacity: 0.22,
  });

  const mercuryMesh = new THREE.Mesh(geometry, mercuryMat);
  scene.add(mercuryMesh);

  // Flowing mercury droplets (floating spheres following physical liquid mercury viscosity)
  const dropletCount = 18;
  const dropletGeometry = new THREE.SphereGeometry(1.8, 24, 24);
  const dropletMat = new THREE.MeshStandardMaterial({
    color: 0xE2E8F0,
    metalness: 0.99,
    roughness: 0.05,
    transparent: true,
    opacity: 0.35,
  });

  const droplets = [];
  for (let i = 0; i < dropletCount; i++) {
    const sphere = new THREE.Mesh(dropletGeometry, dropletMat);
    sphere.position.set(
      (Math.random() - 0.5) * 120,
      (Math.random() - 0.5) * 15 + 5,
      (Math.random() - 0.5) * 70
    );
    const scale = 0.5 + Math.random() * 1.6;
    sphere.scale.set(scale, scale * 0.7, scale); // Flattened liquid droplet bead
    scene.add(sphere);
    droplets.push({
      mesh: sphere,
      speedX: (Math.random() - 0.5) * 0.04,
      speedZ: 0.03 + Math.random() * 0.05,
      baseY: sphere.position.y
    });
  }

  // Dramatic studio lights for authentic brutal liquid metal highlights
  const ambientLight = new THREE.AmbientLight(0xF7F2E8, 1.8);
  scene.add(ambientLight);

  const mainLight = new THREE.DirectionalLight(0xFFFFFF, 3.2);
  mainLight.position.set(50, 80, 50);
  scene.add(mainLight);

  const burgundyRimLight = new THREE.DirectionalLight(0x520B15, 4.0);
  burgundyRimLight.position.set(-60, 20, -30);
  scene.add(burgundyRimLight);

  // Interactive mouse tracking
  let mouseX = 0, mouseY = 0;
  window.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX - window.innerWidth / 2) * 0.0005;
    mouseY = (e.clientY - window.innerHeight / 2) * 0.0005;
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
    const time = clock.getElapsedTime() * 0.9;

    // Organic fluid mercury wave equations
    for (let i = 0; i < pos.count; i++) {
      const u = initialPositions.getX(i);
      const v = initialPositions.getY(i);
      const wave = Math.sin(u * 0.07 + time) * 4.2 + 
                   Math.cos(v * 0.09 + time * 0.8) * 3.8 +
                   Math.sin((u + v) * 0.05 + time * 1.2) * 2.5;
      pos.setZ(i, wave);
    }
    pos.needsUpdate = true;

    // Drift flowing mercury droplets
    droplets.forEach(d => {
      d.mesh.position.z += d.speedZ;
      d.mesh.position.x += d.speedX;
      d.mesh.position.y = d.baseY + Math.sin(time * 2 + d.mesh.position.x) * 1.5;

      if (d.mesh.position.z > 40) {
        d.mesh.position.z = -50;
      }
    });

    camera.position.x = mouseX * 25;
    camera.position.y = 20 - mouseY * 20;
    camera.lookAt(0, 0, 0);

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

  document.getElementById('stat-total-jobs').innerText = total;
  document.getElementById('stat-paid-jobs').innerText = paidCount;

  document.getElementById('count-all').innerText = total;
  document.getElementById('count-india').innerText = allInternships.filter(i => (i.location_type || '').toLowerCase() === 'india').length;
  document.getElementById('count-remote').innerText = allInternships.filter(i => (i.location_type || '').toLowerCase() === 'remote').length;
  document.getElementById('count-global').innerText = allInternships.filter(i => (i.location_type || '').toLowerCase() === 'international').length;
}

// ==========================================
// 3. Brutalist Card Grid Rendering with Real-World Photos
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

  // Realistic photos fallback gallery
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
        class="brutal-box flex flex-col justify-between cursor-pointer group"
        onclick="openDetailDrawer('${escapeHtml(item.id)}')"
      >
        <!-- Real-world lab/facility image banner -->
        <div class="w-full h-36 border-b-2 border-[#2E040A] overflow-hidden relative">
          <img 
            src="${photoUrl}" 
            alt="Research facility" 
            class="w-full h-full object-cover grayscale contrast-125 group-hover:scale-105 transition-transform duration-300"
          >
          <div class="absolute top-2 left-2 flex items-center gap-1.5">
            <span class="px-2 py-0.5 bg-[#2E040A] text-[#F7F2E8] font-mono font-bold text-[10px] uppercase border border-[#2E040A]">
              ${score}% MATCH
            </span>
            ${item.is_new ? '<span class="px-2 py-0.5 bg-[#3B070E] text-[#F7F2E8] font-mono font-bold text-[10px] uppercase border border-[#2E040A]">VERIFIED</span>' : ''}
          </div>

          <button 
            type="button" 
            class="absolute top-2 right-2 p-1.5 bg-white border-2 border-[#2E040A] text-[#2E040A] hover:bg-[#3B070E] hover:text-[#F7F2E8] transition shadow-[2px_2px_0px_#2E040A]"
            onclick="event.stopPropagation(); toggleBookmark('${escapeHtml(item.id)}')"
          >
            <i class="ph ${isBookmarked ? 'ph-fill ph-bookmark text-[#3B070E]' : 'ph-bookmark'} text-sm font-bold"></i>
          </button>
        </div>

        <div class="p-5 flex-1 flex flex-col justify-between">
          <div>
            <h3 class="font-brutal text-lg font-black text-[#2E040A] leading-snug group-hover:text-[#3B070E] transition-colors line-clamp-2">
              ${escapeHtml(item.role_title || 'RESEARCH FELLOWSHIP')}
            </h3>
            
            <div class="font-mono text-xs text-[#3B070E] mt-2 flex items-center gap-2 font-bold uppercase">
              <span>${escapeHtml(item.company_name || 'INSTITUTION')}</span>
              <span>/</span>
              <span class="truncate">${escapeHtml(item.location || 'GLOBAL')}</span>
            </div>

            <!-- Skills Badges -->
            <div class="flex flex-wrap gap-1.5 mt-4">
              ${skills.map(skill => `<span class="px-2 py-0.5 font-mono text-[10px] uppercase bg-[#F7F2E8] text-[#2E040A] border border-[#2E040A] font-bold">${escapeHtml(skill)}</span>`).join('')}
            </div>
          </div>

          <!-- Bottom Metric Bar -->
          <div class="pt-4 mt-5 border-t-2 border-[#2E040A] flex items-center justify-between">
            <div>
              <div class="font-mono text-[9px] uppercase font-bold text-[#3B070E]">STIPEND</div>
              <div class="font-mono font-extrabold text-[#2E040A] text-xs mt-0.5">${escapeHtml(item.stipend || 'UNSPECIFIED')}</div>
            </div>
            <div class="text-right">
              <span class="px-2 py-1 bg-[#F7F2E8] border border-[#2E040A] font-mono font-bold text-[10px] uppercase">
                ${escapeHtml(item.source_platform || 'PORTAL')}
              </span>
            </div>
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
  document.getElementById('drawer-org-badge').innerText = (item.org_type || 'INSTITUTION').toUpperCase();
  document.getElementById('drawer-match-badge').innerText = `${item.match_score || 95}% MATCH`;

  // Update photo in drawer
  const drawerImg = document.getElementById('drawer-image');
  if (drawerImg) {
    drawerImg.src = item.image_url || 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=800&q=80';
  }

  const applyLink = document.getElementById('drawer-apply-link');
  applyLink.href = item.apply_link || '#';

  const skillsContainer = document.getElementById('drawer-skills-list');
  const skills = (item.required_skills || '').split(',').map(s => s.trim()).filter(Boolean);
  skillsContainer.innerHTML = skills.length
    ? skills.map(s => `<span class="px-2.5 py-1 bg-white border-2 border-[#2E040A] font-mono text-xs font-bold text-[#2E040A] uppercase">${escapeHtml(s)}</span>`).join('')
    : '<span class="font-mono text-xs text-[#2E040A]">STANDARD SPECIFICATIONS APPLY.</span>';

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
  btn.innerHTML = `<i class="ph ${isBookmarked ? 'ph-fill ph-bookmark text-[#3B070E]' : 'ph-bookmark'} text-lg"></i>`;
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
  if (spotlight) spotlight.innerText = `${count} ITEMS`;
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
      dot.className = 'w-2.5 h-2.5 bg-amber-600 border border-[#2E040A] animate-pulse';
      text.innerText = 'SCANNING FEEDS';
      fetchLogs();
    } else {
      dot.className = 'w-2.5 h-2.5 bg-emerald-700 border border-[#2E040A]';
      text.innerText = 'TELEMETRY LIVE';
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
      document.getElementById('action-title').innerText = data.alert.title || 'SYSTEM ALERT';
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

  document.querySelectorAll('#location-tabs .filter-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#location-tabs .filter-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeLocation = btn.getAttribute('data-val');
      applyFiltersAndRender();
    });
  });

  document.querySelectorAll('#stipend-filters .filter-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#stipend-filters .filter-pill').forEach(b => b.classList.remove('active'));
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
