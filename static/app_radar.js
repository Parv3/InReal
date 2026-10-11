/**
 * InReal Dashboard
 * Interactive Sketchbook Background Canvas:
 * Users can sketch directly on the background! Marks look like ink sketch pens and fade smoothly after 10 seconds.
 */

let allInternships = [];
let activeLocation = 'all';
let activeStipend = 'all';
let activeSource = 'all';
let showBookmarkedOnly = false;
let bookmarks = JSON.parse(localStorage.getItem('inreal_bookmarks') || '[]');
let activeDrawerJob = null;

// Cheerful card pastel palette
const cardBgPalette = [
  '#FEF08A', // pastel yellow
  '#BAE6FD', // pastel sky
  '#A7F3D0', // pastel mint
  '#DDD6FE', // pastel lavender
  '#FED7AA', // pastel peach
  '#FBCFE8'  // pastel pink
];

document.addEventListener('DOMContentLoaded', () => {
  initSketchbookCanvas();
  bindEventHandlers();
  loadData();
  pollScraperStatus();
  pollAlerts();
  updateBookmarkCounter();
});

// ==========================================
// 1. Interactive Sketchbook Background Canvas
// Draws ink sketch pen strokes that smoothly fade over 10 seconds
// ==========================================
function initSketchbookCanvas() {
  const canvas = document.getElementById('sketchbook-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  // Array of active drawing strokes
  // Each stroke point has { x, y, prevX, prevY, timestamp, color, width }
  const strokes = [];
  const STROKE_LIFETIME_MS = 10000; // 10 seconds fade duration

  // Vibrant sketch pen ink colors
  const penColors = [
    '#1E1B18', // classic ink black
    '#2563EB', // ballpoint blue
    '#DC2626', // red sketch pen
    '#059669', // green marker
    '#7C3AED'  // violet marker
  ];
  let currentPenColorIndex = 0;

  let lastX = null;
  let lastY = null;
  let lastMoveTime = 0;

  window.addEventListener('mousemove', (e) => {
    const x = e.clientX;
    const y = e.clientY;
    const now = Date.now();

    // Check if moving
    if (lastX !== null && lastY !== null) {
      const dist = Math.hypot(x - lastX, y - lastY);
      // Create sketch pen segment if moved sufficiently
      if (dist > 2) {
        // Vary width slightly like a real pressure-sensitive felt tip pen
        const speed = Math.min(dist / Math.max(now - lastMoveTime, 1), 5);
        const strokeWidth = Math.max(1.8, 4.2 - speed * 0.4);

        strokes.push({
          x,
          y,
          prevX: lastX,
          prevY: lastY,
          time: now,
          color: penColors[currentPenColorIndex],
          width: strokeWidth
        });
      }
    }

    lastX = x;
    lastY = y;
    lastMoveTime = now;
  }, { passive: true });

  // Optional: Click cycles the sketch pen ink color for user fun!
  window.addEventListener('click', (e) => {
    // Only if clicking on the open background
    if (e.target.tagName === 'BODY' || e.target.id === 'sketchbook-canvas') {
      currentPenColorIndex = (currentPenColorIndex + 1) % penColors.length;
    }
  });

  // Continuous render loop: draws lines & fades them based on their exact 10s age
  function render() {
    requestAnimationFrame(render);
    ctx.clearRect(0, 0, width, height);

    const now = Date.now();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let i = strokes.length - 1; i >= 0; i--) {
      const stroke = strokes[i];
      const age = now - stroke.time;

      if (age >= STROKE_LIFETIME_MS) {
        strokes.splice(i, 1);
        continue;
      }

      // Smooth cubic fade-out over 10 seconds
      // Stays strong for the first 3 seconds, then fades smoothly to 0 by 10s
      const progress = age / STROKE_LIFETIME_MS;
      let alpha = 1.0;
      if (progress > 0.3) {
        alpha = Math.max(0, 1.0 - ((progress - 0.3) / 0.7));
      }

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;

      ctx.beginPath();
      ctx.moveTo(stroke.prevX, stroke.prevY);
      ctx.lineTo(stroke.x, stroke.y);
      ctx.stroke();
      ctx.restore();
    }
  }
  render();
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
