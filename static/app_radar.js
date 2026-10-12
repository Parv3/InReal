/**
 * InReal Dashboard
 * Corporate Polished UI with Genuine Company Logos, Consistent Actions, and Robust Filtering
 */

let allInternships = [];
let activeLocation = 'all';
let activeStipend = 'all';
let activeSource = 'all';
let activeRoleType = 'all';
let activeExperience = 'all';        // 'all', '0', '1-2', '3+'
let activeModeration = 'verified';   // Strict verification: only approved (verified) listings are shown!
let visibleCount = 5;                // Minimum 5 and maximum 5 shown at a time
let isModeratingBatch = false;
let showBookmarkedOnly = false;
let bookmarks = JSON.parse(localStorage.getItem('inreal_bookmarks') || '[]');
let activeDrawerJob = null;
let currentUser = null;              // Logged-in user state from SQLite backend

// Genuine SVGs for company/organization logos
const companyLogos = {
  anthropic: `<svg viewBox="0 0 24 24" width="24" height="24" fill="#0F172A"><path d="M14.05 3.5h3.45L10.95 20.5H7.5L14.05 3.5zm-4.1 0h3.45L6.85 20.5H3.4L9.95 3.5z"/></svg>`,
  deepmind: `<svg viewBox="0 0 24 24" width="24" height="24"><path fill="#4285F4" d="M12 2L15 9L22 12L15 15L12 22L9 15L2 12L9 9Z"/></svg>`,
  maxplanck: `<svg viewBox="0 0 24 24" width="24" height="24" fill="#0F172A"><circle cx="12" cy="12" r="9" stroke="#0F172A" stroke-width="1.8" fill="none"/><circle cx="12" cy="12" r="4" fill="#0F172A"/></svg>`,
  mistral: `<svg viewBox="0 0 24 24" width="24" height="24"><rect x="3" y="4" width="5" height="16" fill="#F97316"/><rect x="10" y="4" width="5" height="10" fill="#EA580C"/><rect x="17" y="4" width="5" height="16" fill="#C2410C"/></svg>`,
  iisc: `<svg viewBox="0 0 24 24" width="24" height="24" fill="#0D9488"><path d="M12 3L2 9l10 6 10-6-10-6zm0 14l-8-4.8v3.6L12 21l8-5.2v-3.6L12 17z"/></svg>`,
  cohere: `<svg viewBox="0 0 24 24" width="24" height="24"><circle cx="8" cy="12" r="5" fill="#39594C"/><circle cx="16" cy="12" r="5" fill="#FF7759"/></svg>`,
  default: `<svg viewBox="0 0 24 24" width="24" height="24" fill="#64748B"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm6 12H6v-1.4c0-2 4-3.1 6-3.1s6 1.1 6 3.1V18z"/></svg>`
};

function getCompanyLogoSvg(companyName) {
  const norm = (companyName || '').toLowerCase();
  if (norm.includes('anthropic')) return companyLogos.anthropic;
  if (norm.includes('deepmind') || norm.includes('google')) return companyLogos.deepmind;
  if (norm.includes('max planck') || norm.includes('mpi')) return companyLogos.maxplanck;
  if (norm.includes('mistral')) return companyLogos.mistral;
  if (norm.includes('iisc') || norm.includes('bangalore')) return companyLogos.iisc;
  if (norm.includes('cohere')) return companyLogos.cohere;
  return companyLogos.default;
}

document.addEventListener('DOMContentLoaded', () => {
  initGlassTranslucentBackground();
  bindEventHandlers();
  bindAuthHandlers();
  checkAuthSession();
  loadData();
  pollScraperStatus();
  pollAlerts();
  pollModeration();
  updateBookmarkCounter();
});

// ==========================================
// 1. Subtle Translucent 3D Ambient Mesh
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

  const group = new THREE.Group();
  scene.add(group);

  const materials = [
    new THREE.MeshBasicMaterial({ color: 0xF59E0B, transparent: true, opacity: 0.12 }),
    new THREE.MeshBasicMaterial({ color: 0x3B82F6, transparent: true, opacity: 0.10 }),
    new THREE.MeshBasicMaterial({ color: 0x10B981, transparent: true, opacity: 0.10 }),
  ];

  const meshes = [];

  for (let i = 0; i < 16; i++) {
    const geo = (i % 2 === 0) 
      ? new THREE.IcosahedronGeometry(Math.random() * 2.2 + 1.2, 0)
      : new THREE.TorusGeometry(Math.random() * 2 + 1.2, 0.4, 12, 24);

    const mat = materials[i % materials.length];
    const mesh = new THREE.Mesh(geo, mat);

    mesh.position.set(
      (Math.random() - 0.5) * 60,
      (Math.random() - 0.5) * 45,
      (Math.random() - 0.5) * 15
    );

    mesh.userData = {
      rotX: (Math.random() - 0.5) * 0.006,
      rotY: (Math.random() - 0.5) * 0.006,
      floatSpeed: Math.random() * 0.4 + 0.3,
      startY: mesh.position.y
    };

    group.add(mesh);
    meshes.push(mesh);
  }

  let targetMouseX = 0, targetMouseY = 0, curMouseX = 0, curMouseY = 0;

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

    group.rotation.y = curMouseX * 0.12;
    group.rotation.x = -curMouseY * 0.12;

    meshes.forEach((m) => {
      m.rotation.x += m.userData.rotX;
      m.rotation.y += m.userData.rotY;
      m.position.y = m.userData.startY + Math.sin(elapsed * m.userData.floatSpeed) * 1.2;
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
    applyFiltersAndRender();
  } catch (err) {
    console.error('Failed to load internships:', err);
  }
}

function populateSourceFilter(internships) {
  const sourceSelect = document.getElementById('source-filter');
  if (!sourceSelect) return;
  const sources = new Set(internships.map(i => i.source_platform).filter(Boolean));
  if (activeSource !== 'all') sources.add(activeSource);
  sourceSelect.innerHTML = '<option value="all">Source: All</option>';
  sources.forEach(src => {
    const opt = document.createElement('option');
    opt.value = src;
    opt.textContent = `Source: ${src}`;
    sourceSelect.appendChild(opt);
  });
  sourceSelect.value = activeSource;   // the list reloads as n8n verdicts arrive; keep the user's choice
}

function renderOverviewStats(shown, base) {
  // Headline numbers = the cards currently shown (all filters applied, incl. the scam-check filter)
  shown = shown || [];
  base = base || shown;
  const verified = shown;
  const total = shown.length;
  const paidCount = verified.filter(i => {
    const val = Number(i.stipend_numeric || 0);
    return val > 0 || (i.stipend && !i.stipend.toLowerCase().includes('unpaid'));
  }).length;
  const newCount = verified.filter(isNewToday).length;

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

  if (countAll) countAll.innerText = base.length;
  if (countIndia) countIndia.innerText = base.filter(i => (i.location_type || '').toLowerCase() === 'india').length;
  if (countRemote) countRemote.innerText = base.filter(i => (i.location_type || '').toLowerCase() === 'remote').length;
  if (countGlobal) countGlobal.innerText = base.filter(i => (i.location_type || '').toLowerCase() === 'international').length;
}

// ==========================================
// 3. Card Grid Rendering with Corporate Polish & Real Logos
// ==========================================
function applyFiltersAndRender() {
  const searchInput = document.getElementById('search-input');
  const searchQuery = (searchInput ? searchInput.value : '').toLowerCase().trim();

  const matches = (item, ignoreLocation) => {
    if (showBookmarkedOnly && !bookmarks.includes(item.id)) return false;

    // Scam check verdict (n8n). Default: only what n8n checked and passed.
    const mod = item.moderation_status || '';
    if (activeModeration === 'verified' && mod !== 'approved') return false;
    if (activeModeration === 'verified_review' && mod !== 'approved' && mod !== 'review') return false;
    if (activeModeration === 'hide_blocked' && mod === 'blocked') return false;
    if (activeModeration === 'blocked' && mod !== 'blocked') return false;

    // Location filter (from segmented tabs or dropdown)
    if (!ignoreLocation && activeLocation !== 'all') {
      if ((item.location_type || '').toLowerCase() !== activeLocation.toLowerCase()) {
        return false;
      }
    }

    // Role Type filter
    if (activeRoleType !== 'all') {
      const roleStr = `${item.role_title || ''} ${item.role_type || ''}`.toLowerCase();
      if (!roleStr.includes(activeRoleType.toLowerCase())) {
        return false;
      }
    }

    // Source platform filter
    if (activeSource !== 'all' && item.source_platform !== activeSource) {
      return false;
    }

    // Stipend filter
    if (activeStipend === 'paid') {
      const num = Number(item.stipend_numeric || 0);
      if (num <= 0 && (!item.stipend || item.stipend.toLowerCase().includes('unpaid'))) return false;
    } else if (activeStipend === '20k') {
      if (Number(item.stipend_numeric || 0) < 20000) return false;
    } else if (activeStipend === '50k') {
      if (Number(item.stipend_numeric || 0) < 50000) return false;
    } else if (activeStipend === '100k') {
      if (Number(item.stipend_numeric || 0) < 100000) return false;
    }

    // Experience Level filter
    if (activeExperience !== 'all') {
      const expText = `${item.experience_required || ''} ${item.description || ''} ${item.role_title || ''} ${item.eligibility || ''}`.toLowerCase();
      if (activeExperience === '0') {
        // Looking for freshers, 0 years, student, entry level, or no strict multi-year requirement
        const isSenior = /([2-9]|\d{2})\+?\s*(years?|yrs?)/i.test(expText) || /senior|lead|principal|experienced/i.test(expText);
        if (isSenior) return false;
      } else if (activeExperience === '1-2') {
        const matches12 = /1\s*[-–to]\s*2\s*(years?|yrs?)/i.test(expText) || /1\+?\s*(year|yr)/i.test(expText) || /2\+?\s*(years?|yrs?)/i.test(expText);
        if (!matches12) return false;
      } else if (activeExperience === '3+') {
        const matches3 = /([3-9]|\d{2})\+?\s*(years?|yrs?)/i.test(expText) || /3\s*[-–to]\s*[456]\s*(years?|yrs?)/i.test(expText) || /senior/i.test(expText);
        if (!matches3) return false;
      }
    }

    // Text search
    if (searchQuery) {
      const text = `${item.role_title || ''} ${item.company_name || ''} ${item.required_skills || ''} ${item.location || ''}`.toLowerCase();
      if (!text.includes(searchQuery)) return false;
    }

    return true;
  };

  // Every number on the page follows the filters (the location tabs count everything else that matches)
  const base = allInternships.filter(item => matches(item, true));
  let filtered = base.filter(item => matches(item, false));

  // Fix card scramble: Keep stable order and append newly verified items at the end
  filtered.sort((a, b) => {
    const timeA = a.moderated_at || '';
    const timeB = b.moderated_at || '';
    if (timeA && timeB && timeA !== timeB) {
      return timeA.localeCompare(timeB); // Older verified first, new batch appends to the end
    }
    return (a.id || '').localeCompare(b.id || '');
  });

  renderOverviewStats(filtered, base);
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

  // Minimum 5 and maximum 5 at a time
  const visibleItems = items.slice(0, visibleCount);

  // Update Load More Button state
  const loadMoreContainer = document.getElementById('load-more-container');
  const loadMoreBtn = document.getElementById('load-more-btn');
  const loadMoreLabel = document.getElementById('load-more-label');
  const loadMoreIcon = document.getElementById('load-more-icon');
  const loadMoreInfo = document.getElementById('load-more-info');

  if (loadMoreContainer) {
    if (items.length > visibleCount) {
      // More verified items already in local memory ready to reveal
      loadMoreContainer.classList.remove('hidden');
      if (loadMoreBtn) {
        loadMoreBtn.disabled = false;
        loadMoreLabel.innerText = `Load More (Next Batch of 5) • Showing ${visibleItems.length} of ${items.length}`;
      }
    } else {
      // Check if there are pending unmoderated items waiting in backend
      fetch('/api/moderation/status').then(r => r.json()).then(c => {
        const waiting = (c.pending || 0) + (c.checking || 0);
        if (waiting > 0) {
          loadMoreContainer.classList.remove('hidden');
          if (loadMoreBtn) {
            loadMoreBtn.disabled = isModeratingBatch;
            loadMoreLabel.innerText = isModeratingBatch 
              ? 'Moderating Next Batch with n8n...' 
              : `Moderate Next Batch of 5 (${waiting} waiting in queue)`;
          }
          if (loadMoreInfo) {
            loadMoreInfo.innerText = `${waiting} scraped opportunities waiting in round-robin queue. Click to trigger next 5.`;
          }
        } else {
          loadMoreContainer.classList.add('hidden');
        }
      }).catch(() => {});
    }
  }

  container.innerHTML = visibleItems.map((item, index) => {
    const isBookmarked = bookmarks.includes(item.id);
    const skills = (item.required_skills || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 3);
    const logoSvg = getCompanyLogoSvg(item.company_name);

    // Requirement: Only the first internship is visible before logging in; others are locked.
    const isLocked = !currentUser && index > 0;

    if (isLocked) {
      return `
        <article class="glass-card p-5 sm:p-6 flex flex-col justify-between relative overflow-hidden border-dashed border-slate-300 select-none group">
          <!-- Blurred preview underneath -->
          <div class="filter blur-sm opacity-40 pointer-events-none transition">
            <div class="flex items-start justify-between mb-3.5">
              <div class="flex items-center gap-3">
                <div class="company-logo-box">${logoSvg}</div>
                <div>
                  <div class="text-[11px] font-semibold text-slate-400">Locked Company • Verified</div>
                  <div class="text-xs font-bold text-slate-700 mt-0.5">Top Tier Frontier AI Lab</div>
                </div>
              </div>
            </div>
            <h3 class="text-base font-bold text-slate-800 leading-snug mt-2">
              Research Engineer / Robotics Specialist
            </h3>
            <div class="text-xs text-slate-400 mt-1.5 font-medium">Remote • 6 Months • Verified Stipend</div>
            <div class="flex flex-wrap gap-1.5 mt-4">
              <span class="px-2.5 py-0.5 bg-slate-100 text-slate-400 rounded-md text-[11px] font-semibold">PyTorch</span>
              <span class="px-2.5 py-0.5 bg-slate-100 text-slate-400 rounded-md text-[11px] font-semibold">Robotics</span>
            </div>
            <div class="pt-4 mt-5 border-t border-slate-100 flex items-center justify-between text-xs">
              <div class="text-sm font-extrabold text-slate-400">₹60,000 / mo</div>
            </div>
          </div>

          <!-- Glassmorphism Lock Overlay -->
          <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] flex flex-col items-center justify-center p-6 text-center text-white z-10 transition group-hover:bg-slate-900/65">
            <div class="w-11 h-11 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-orange-400 mb-3 shadow-lg group-hover:scale-105 transition-transform">
              <i class="ph ph-lock-key text-2xl font-bold"></i>
            </div>
            <h4 class="text-sm font-extrabold tracking-tight text-white">Internship Opportunity Locked</h4>
            <p class="text-[11px] text-slate-200 mt-1 max-w-[230px] font-medium leading-relaxed">
              Sign in with your account to unlock full application details, contact endpoints, and direct apply links.
            </p>
            <button 
              type="button" 
              class="mt-3.5 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-md hover:shadow-lg transition flex items-center gap-1.5 active:scale-95"
              onclick="event.stopPropagation(); openAuthModal('login');"
            >
              <i class="ph ph-lock-open text-sm"></i>
              <span>Log In to Unlock</span>
            </button>
          </div>
        </article>
      `;
    }

    return `
      <article 
        class="glass-card p-5 sm:p-6 flex flex-col justify-between cursor-pointer group"
        onclick="openDetailDrawer('${escapeHtml(item.id)}')"
      >
        <div>
          <!-- Top Row: Real Company Logo + Subtle Source Tag with colored dot + Bookmark -->
          <div class="flex items-start justify-between mb-3.5">
            <div class="flex items-center gap-3">
              <!-- Genuine Square-Rounded Company Logo -->
              <div class="company-logo-box" title="${escapeHtml(item.company_name || 'Organization')}">
                ${logoSvg}
              </div>

              <div>
                <!-- Subtle Source Badge with colored dot -->
                <div class="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                  <span class="w-1.5 h-1.5 rounded-full ${dotColor(item)}"></span>
                  <span>${escapeHtml(item.source_platform || 'Direct Portal')}</span>
                  ${isNewToday(item) ? '<span class="px-1.5 py-0.2 bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 rounded text-[10px] ml-1">NEW</span>' : ''}
                  ${moderationChip(item)}
                  ${item.trust_flags ? `<span class="px-1.5 py-0.2 bg-amber-50 text-amber-700 font-bold border border-amber-200 rounded text-[10px] ml-1 flex items-center gap-0.5" title="${escapeHtml(item.trust_flags)}"><i class="ph ph-warning"></i> NOTE</span>` : ''}
                </div>
                <div class="text-xs font-bold text-slate-800 mt-0.5">${escapeHtml(item.company_name || 'Company')}</div>
              </div>
            </div>

            <button 
              type="button" 
              class="w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 hover:text-rose-500 transition"
              onclick="event.stopPropagation(); toggleBookmark('${escapeHtml(item.id)}')"
              title="Bookmark opportunity"
            >
              <i class="ph ${isBookmarked ? 'ph-fill ph-bookmark text-rose-500' : 'ph-bookmark'} text-base"></i>
            </button>
          </div>

          <!-- Role Title -->
          <h3 class="text-base font-bold text-slate-900 leading-snug line-clamp-2 group-hover:text-orange-600 transition-colors mt-2">
            ${escapeHtml(item.role_title || 'Internship Opportunity')}
          </h3>
          
          <!-- Location and Duration -->
          <div class="text-xs text-slate-500 mt-1.5 flex items-center gap-2 font-medium">
            <span class="flex items-center gap-1"><i class="ph ph-map-pin text-slate-400"></i> ${escapeHtml(item.location || 'Remote')}</span>
            <span>&bull;</span>
            <span>${escapeHtml(item.duration || 'Flexible')}</span>
          </div>

          <!-- Uniform Neutral Tech Stack Pills -->
          <div class="flex flex-wrap gap-1.5 mt-4">
            ${skills.map(skill => `<span class="px-2.5 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[11px] font-semibold border border-slate-200/60">${escapeHtml(skill)}</span>`).join('')}
          </div>
        </div>

        <!-- Footer: Clean Stipend Readout & Consistent Dark CTA -->
        <div class="pt-4 mt-5 border-t border-slate-100 flex items-center justify-between text-xs">
          <div>
            <div class="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Stipend</div>
            <div class="font-extrabold text-slate-900 text-sm mt-0.5">${escapeHtml(item.stipend || 'Unspecified')}</div>
          </div>
          <div>
            <!-- Consistent Sleek Dark Slate Button Across All Cards -->
            <span class="px-3 py-1.5 bg-slate-900 text-white font-semibold rounded-lg group-hover:bg-orange-600 transition flex items-center gap-1 text-xs">
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
  applyLink.href = safeUrl(item.apply_link);

  // n8n verdict with its reasons
  const modBox = document.getElementById('drawer-mod-box');
  const view = MOD_VIEWS[item.moderation_status || ''] || MOD_VIEWS[''];
  modBox.className = `p-3 rounded-lg border text-xs ${view.box}`;
  const risk = item.scam_risk !== '' && item.scam_risk != null ? ` · risk ${Number(item.scam_risk).toFixed(2)}` : '';
  document.getElementById('drawer-mod-title').innerText = `${view.label}${risk}`;
  const reasons = String(item.moderation_reasons || '').split(' | ').map(r => r.trim()).filter(Boolean);
  document.getElementById('drawer-mod-reasons').innerHTML = reasons.map(r => `<li>${escapeHtml(r)}</li>`).join('');

  const desc = String(item.description || '').trim();
  document.getElementById('drawer-desc-box').classList.toggle('hidden', !desc);
  document.getElementById('drawer-description').innerText = desc;

  const skillsContainer = document.getElementById('drawer-skills-list');
  const skills = (item.required_skills || '').split(',').map(s => s.trim()).filter(Boolean);
  skillsContainer.innerHTML = skills.length
    ? skills.map(s => `<span class="px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-700 rounded-md text-xs font-semibold">${escapeHtml(s)}</span>`).join('')
    : '<span class="text-xs text-slate-500">General qualifications.</span>';

  const trustBox = document.getElementById('drawer-trust-box');
  const trustText = document.getElementById('drawer-trust-flags');
  if (trustBox && trustText) {
    if (item.trust_flags) {
      trustText.innerHTML = String(item.trust_flags).split(';').map(f => f.trim()).filter(Boolean)
        .map(f => `<li>${escapeHtml(f)}</li>`).join('');
      trustBox.classList.remove('hidden');
    } else {
      trustBox.classList.add('hidden');
    }
  }

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
    handleScrapeProgress(data.progress, isRunning);

    const dot = document.getElementById('ping-dot');
    const text = document.getElementById('scraper-status-text');

    if (isRunning) {
      if (dot) dot.className = 'w-2 h-2 rounded-full bg-orange-500 animate-pulse';
      if (text) text.innerText = 'Scanning...';
    } else {
      if (dot) dot.className = 'w-2 h-2 rounded-full bg-emerald-500';
      if (text) text.innerText = 'System Ready';
    }
  } catch (e) {}

  setTimeout(pollScraperStatus, 3500);
}

async function pollAlerts() {
  try {
    const res = await fetch('/api/alerts');
    const data = await res.json();
    const banner = document.getElementById('action-banner');

    if (data.alert) {
      document.getElementById('action-title').innerText = data.alert.title || `Action Required: ${data.alert.source || 'Scraper'}`;
      document.getElementById('action-message').innerText = data.alert.message || 'Action required in browser window.';
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  } catch (e) {}
  setTimeout(pollAlerts, 3000);
}

// ==========================================
// 7. Event Handlers & Corporate Filter Bindings
// ==========================================
function bindEventHandlers() {
  document.getElementById('search-input')?.addEventListener('input', applyFiltersAndRender);
  document.getElementById('mod-filter')?.addEventListener('change', (e) => {
    activeModeration = e.target.value;
    applyFiltersAndRender();
  });

  // Dropdown 1: Role Type
  document.getElementById('role-type-filter')?.addEventListener('change', (e) => {
    activeRoleType = e.target.value;
    applyFiltersAndRender();
  });

  // Dropdown 2: Location Select
  document.getElementById('location-select-filter')?.addEventListener('change', (e) => {
    activeLocation = e.target.value;
    // Sync segmented tabs
    document.querySelectorAll('#location-tabs .pill-segmented-item').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-val') === activeLocation);
    });
    applyFiltersAndRender();
  });

  // Dropdown 3: Min. Stipend
  document.getElementById('stipend-select-filter')?.addEventListener('change', (e) => {
    activeStipend = e.target.value;
    // Sync segmented tabs
    document.querySelectorAll('#stipend-filters .pill-segmented-item').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-val') === activeStipend);
    });
    applyFiltersAndRender();
  });

  // Dropdown 4: Source Filter
  document.getElementById('source-filter')?.addEventListener('change', (e) => {
    activeSource = e.target.value;
    applyFiltersAndRender();
  });

  // Segmented Region Buttons
  document.querySelectorAll('#location-tabs .pill-segmented-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#location-tabs .pill-segmented-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeLocation = btn.getAttribute('data-val');
      const locSelect = document.getElementById('location-select-filter');
      if (locSelect) locSelect.value = activeLocation;
      applyFiltersAndRender();
    });
  });

  // Segmented Stipend Buttons
  document.querySelectorAll('#stipend-filters .pill-segmented-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#stipend-filters .pill-segmented-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeStipend = btn.getAttribute('data-val');
      const stpSelect = document.getElementById('stipend-select-filter');
      if (stpSelect) stpSelect.value = activeStipend;
      applyFiltersAndRender();
    });
  });

  // Saved Bookmarks Button
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

  // Reset Filters Function
  const resetAll = () => {
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';
    activeLocation = 'all';
    activeStipend = 'all';
    activeSource = 'all';
    activeRoleType = 'all';
    showBookmarkedOnly = false;
    
    const roleSelect = document.getElementById('role-type-filter');
    if (roleSelect) roleSelect.value = 'all';

    const locSelect = document.getElementById('location-select-filter');
    if (locSelect) locSelect.value = 'all';

    const stpSelect = document.getElementById('stipend-select-filter');
    if (stpSelect) stpSelect.value = 'all';

    const sourceSelect = document.getElementById('source-filter');
    if (sourceSelect) sourceSelect.value = 'all';
    activeModeration = 'hide_blocked';
    const modSelect = document.getElementById('mod-filter');
    if (modSelect) modSelect.value = 'hide_blocked';
    
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

    if (currentUser && currentUser.experience) {
      activeExperience = currentUser.experience;
    } else {
      activeExperience = 'all';
    }

    visibleCount = 5;
    applyFiltersAndRender();
  };

  // Wire up Load More Button (Passes batch of 5 to n8n pipeline)
  document.getElementById('load-more-btn')?.addEventListener('click', async () => {
    visibleCount += 5;
    
    // Trigger n8n for next round-robin batch of 5
    isModeratingBatch = true;
    const btn = document.getElementById('load-more-btn');
    const label = document.getElementById('load-more-label');
    if (btn) btn.disabled = true;
    if (label) label.innerText = 'Triggering Next Batch to n8n...';

    try {
      await fetch('/api/moderation/trigger-batch', { method: 'POST' });
    } catch (e) {
      console.warn('Batch trigger error:', e);
    }
    
    // Refresh data and render
    await loadData();
    isModeratingBatch = false;
    applyFiltersAndRender();
  });

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

  // Opportunity Modal (Triggered by "Submit an Opportunity")
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

    const checkedValues = (name) => Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(cb => cb.value);
    const config = {
      regions: checkedValues('regions'),
      sources: checkedValues('sources')
    };

    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (res.status === 403) showToast('info', 'View-only link', 'Scraping can only be started on the host laptop.');
    } catch (err) {
      console.error(err);
    }
  });

  // Public (tunnel) visitors get a read-only dashboard: hide the scrape button for them
  fetch('/api/whoami').then(r => r.json()).then(w => {
    if (!w.can_edit) document.getElementById('trigger-scrape-btn')?.classList.add('hidden');
  }).catch(() => {});

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
    }
  });
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function safeUrl(url) {
  return /^https?:\/\//i.test(String(url || '')) ? url : '#';
}

function isNewToday(item) {
  const today = new Date().toISOString().slice(0, 10);
  return String(item.is_new).toLowerCase() === 'true' && String(item.date_scraped || '').slice(0, 10) === today;
}

// ==========================================
// 8. n8n scam check (moderation) — verdict chips and live queue
// ==========================================
const MOD_VIEWS = {
  '':        { label: 'Scam check pending', chip: 'bg-slate-50 text-slate-500 border-slate-200', dot: 'bg-slate-400', box: 'bg-slate-50 border-slate-200 text-slate-600', icon: 'ph-hourglass' },
  checking:  { label: 'Being checked by n8n', chip: 'bg-slate-50 text-slate-500 border-slate-200', dot: 'bg-slate-400', box: 'bg-slate-50 border-slate-200 text-slate-600', icon: 'ph-hourglass' },
  approved:  { label: 'Verified by scam check', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', box: 'bg-emerald-50 border-emerald-200 text-emerald-800', icon: 'ph-shield-check' },
  review:    { label: 'Needs a human look', chip: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500', box: 'bg-amber-50 border-amber-200 text-amber-800', icon: 'ph-eye' },
  blocked:   { label: 'Likely scam', chip: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500', box: 'bg-rose-50 border-rose-200 text-rose-800', icon: 'ph-prohibit' },
  expired:   { label: 'Apply link closed', chip: 'bg-slate-100 text-slate-500 border-slate-200', dot: 'bg-slate-400', box: 'bg-slate-50 border-slate-200 text-slate-600', icon: 'ph-link-break' },
};

function moderationChip(item) {
  const v = MOD_VIEWS[item.moderation_status || ''] || MOD_VIEWS[''];
  const short = { approved: 'VERIFIED', review: 'CHECK', blocked: 'SCAM?', expired: 'CLOSED', checking: 'CHECKING', '': 'PENDING' }[item.moderation_status || ''] || 'PENDING';
  return `<span class="px-1.5 py-0.2 font-bold border rounded text-[10px] ml-1 flex items-center gap-0.5 ${v.chip}" title="${escapeHtml(v.label)}"><i class="ph ${v.icon}"></i> ${short}</span>`;
}

function dotColor(item) {
  const st = item.moderation_status || '';
  if (st && st !== 'checking' && st !== 'approved') return (MOD_VIEWS[st] || MOD_VIEWS['']).dot;
  return item.trust_flags ? 'bg-amber-500' : (st === 'approved' ? 'bg-emerald-500' : 'bg-slate-400');
}

// Reload the cards whenever n8n has judged more listings (it runs while scraping continues)
let lastJudged = -1;
async function pollModeration() {
  try {
    const c = await fetch('/api/moderation/status').then(r => r.json());
    const judged = c.approved + c.review + c.blocked + c.expired;
    const waiting = c.pending + c.checking;
    const q = document.getElementById('mod-queue');
    if (q) q.innerText = waiting ? `${c.checking} being checked · ${c.pending} waiting` : '';
    if (judged !== lastJudged) { lastJudged = judged; loadData(); }
  } catch (e) { /* app restarting */ }
  setTimeout(pollModeration, 5000);
}


// ==========================================
// 9. Scrape popups & Live LLM Search Terminal Animation
// ==========================================
let seenRunId = null, seenSites = 0, runAnnounced = true;
let flickerInterval = null;

const SIMULATED_SITES = ["Internshala", "Unstop", "Naukri", "Apna", "Foundit", "Shine", "Big Tech Careers"];

function startLlmFlickerAnimation(currentSite) {
  const banner = document.getElementById('llm-scraper-banner');
  const textEl = document.getElementById('llm-flicker-text');
  if (!banner || !textEl) return;

  banner.classList.remove('hidden');

  if (flickerInterval) clearInterval(flickerInterval);

  let siteIdx = 0;
  flickerInterval = setInterval(() => {
    const activeSite = currentSite || SIMULATED_SITES[siteIdx % SIMULATED_SITES.length];
    siteIdx++;

    const states = [
      `Scraping from the site: <span class="text-amber-800 font-bold">${activeSite}</span>...`,
      `Harvested <span class="text-emerald-700 font-bold font-mono">live endpoints</span> from ${activeSite}`,
      `Analyzing opportunities from <span class="text-amber-800 font-bold">${activeSite}</span>...`
    ];
    const pick = states[Math.floor(Math.random() * states.length)];
    textEl.innerHTML = pick;
  }, 900);
}

function stopLlmFlickerAnimation() {
  if (flickerInterval) {
    clearInterval(flickerInterval);
    flickerInterval = null;
  }
  const banner = document.getElementById('llm-scraper-banner');
  if (banner) banner.classList.add('hidden');
}

function handleScrapeProgress(progress, isRunning) {
  if (!progress) return;

  const banner = document.getElementById('llm-scraper-banner');
  const textEl = document.getElementById('llm-flicker-text');
  const statsEl = document.getElementById('llm-stats-readout');

  if (isRunning) {
    if (banner) banner.classList.remove('hidden');
    if (!flickerInterval) startLlmFlickerAnimation();
    if (statsEl) {
      statsEl.innerText = `${progress.sites.length} site(s) parsed • ${progress.total_added || 0} scraped`;
    }
  } else {
    stopLlmFlickerAnimation();
  }

  if (seenRunId === null) {            // page just opened: don't replay an old run
    seenRunId = progress.run_id; seenSites = progress.sites.length; runAnnounced = progress.finished;
    return;
  }
  if (progress.run_id !== seenRunId) { seenRunId = progress.run_id; seenSites = 0; runAnnounced = false; }
  for (const site of progress.sites.slice(seenSites)) {
    const name = site.source.charAt(0).toUpperCase() + site.source.slice(1);
    if (textEl) {
      textEl.innerHTML = `Scraped <span class="text-emerald-600 font-bold">${site.added || 0}</span> opportunities from <span class="text-amber-800 font-bold">${name}</span>`;
    }
    if (site.ok) {
      showToast(site.added ? 'success' : 'info', `${name} scraped`,
        site.added ? `${site.added} new internship${site.added > 1 ? 's' : ''} saved.`
                   : 'No new internships this time.');
    } else {
      showToast('error', `${name} failed`, site.error || 'See the run log.');
    }
    loadData();
  }
  seenSites = progress.sites.length;
  if (progress.finished && !runAnnounced && !isRunning) {
    runAnnounced = true;
    stopLlmFlickerAnimation();
    const failed = progress.failed.length ? ` · ${progress.failed.length} site(s) failed` : '';
    showToast('success', 'Scraping finished', `${progress.total_added} opportunities scraped in background. Initial round-robin batch of 5 sent to n8n.`);
  }
}

function showToast(kind, title, message) {
  let box = document.getElementById('toast-stack');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toast-stack';
    box.className = 'fixed bottom-6 right-6 z-[60] flex flex-col gap-2 max-w-sm w-[calc(100%-3rem)]';
    document.body.appendChild(box);
  }
  const colors = { success: 'border-l-emerald-500', info: 'border-l-slate-400', error: 'border-l-rose-500' };
  const icons = { success: 'ph-check-circle text-emerald-600', info: 'ph-info text-slate-500', error: 'ph-warning-circle text-rose-600' };
  const t = document.createElement('div');
  t.className = `glass-panel p-3.5 shadow-xl border-l-4 ${colors[kind] || colors.info} flex gap-3 items-start transition-opacity duration-300`;
  t.setAttribute('role', 'status');
  t.innerHTML = `<i class="ph ${icons[kind] || icons.info} text-xl mt-0.5"></i>
    <div class="flex-1"><div class="text-sm font-bold text-slate-900">${escapeHtml(title)}</div>
    <div class="text-xs text-slate-600 mt-0.5">${escapeHtml(message)}</div></div>
    <button class="text-slate-400 hover:text-slate-700" aria-label="Close"><i class="ph ph-x"></i></button>`;
  t.querySelector('button').onclick = () => t.remove();
  box.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 7000);
}

// ==========================================
// 10. SQLite-backed User Authentication System
// ==========================================
async function checkAuthSession() {
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    if (data.logged_in && data.user) {
      setUserLoggedIn(data.user);
    } else {
      setUserLoggedOut();
    }
  } catch (err) {
    console.error('Session check failed:', err);
    setUserLoggedOut();
  }
}

function setUserLoggedIn(user) {
  currentUser = user;
  const loginBtn = document.getElementById('open-login-btn');
  const profilePill = document.getElementById('user-profile-pill');
  const displayName = document.getElementById('user-display-name');
  const displayEmail = document.getElementById('user-display-email');
  const avatarInitial = document.getElementById('user-avatar-initial');
  const menuAvatarInitial = document.getElementById('menu-avatar-initial');
  const expBadge = document.getElementById('user-experience-badge');

  if (loginBtn) loginBtn.classList.add('hidden');
  if (profilePill) {
    profilePill.classList.remove('hidden');
    profilePill.classList.add('flex');
  }
  const initial = (user.username || 'U').charAt(0).toUpperCase();
  if (displayName) displayName.innerText = user.username || 'User';
  if (displayEmail) displayEmail.innerText = user.email || `${user.username || 'user'}@inreal.com`;
  if (avatarInitial) avatarInitial.innerText = initial;
  if (menuAvatarInitial) menuAvatarInitial.innerText = initial;

  if (expBadge) {
    const expVal = user.experience || '0';
    const expLabels = { '0': '0 Exp', '1-2': '1-2 Yrs', '3+': '3+ Yrs' };
    expBadge.innerText = expLabels[expVal] || `${expVal} Exp`;
  }

  // Sync user's experience with the listings filter
  activeExperience = user.experience || 'all';

  // Re-render listings now that all cards are unlocked
  applyFiltersAndRender();
}

function setUserLoggedOut() {
  currentUser = null;
  const loginBtn = document.getElementById('open-login-btn');
  const profilePill = document.getElementById('user-profile-pill');
  const profileMenu = document.getElementById('user-profile-menu');

  if (loginBtn) loginBtn.classList.remove('hidden');
  if (profilePill) {
    profilePill.classList.add('hidden');
    profilePill.classList.remove('flex');
  }
  if (profileMenu) profileMenu.classList.add('hidden');

  // Re-render listings: lock all cards after the first one

  // Re-render listings: lock all cards after the first one
  applyFiltersAndRender();
}

function openAuthModal(defaultTab = 'login') {
  const modal = document.getElementById('auth-modal');
  const alertBox = document.getElementById('auth-alert');
  if (alertBox) alertBox.classList.add('hidden');
  if (modal) modal.classList.remove('hidden');
  switchAuthTab(defaultTab);
}

function closeAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) modal.classList.add('hidden');
}

function switchAuthTab(tab) {
  const loginForm = document.getElementById('login-form');
  const regForm = document.getElementById('register-form');
  const tabLogin = document.getElementById('tab-login');
  const tabReg = document.getElementById('tab-register');
  const modalTitle = document.getElementById('auth-modal-title');
  const modalSub = document.getElementById('auth-modal-subtitle');
  const alertBox = document.getElementById('auth-alert');
  if (alertBox) alertBox.classList.add('hidden');

  if (tab === 'register') {
    if (loginForm) loginForm.classList.add('hidden');
    if (regForm) regForm.classList.remove('hidden');
    if (tabReg) {
      tabReg.classList.add('bg-white', 'shadow-xs', 'text-slate-900');
      tabReg.classList.remove('text-slate-500');
    }
    if (tabLogin) {
      tabLogin.classList.remove('bg-white', 'shadow-xs', 'text-slate-900');
      tabLogin.classList.add('text-slate-500');
    }
    if (modalTitle) modalTitle.innerText = 'Create an Account';
    if (modalSub) modalSub.innerText = 'Sign up to unlock and apply to all verified internships';
  } else {
    if (loginForm) loginForm.classList.remove('hidden');
    if (regForm) regForm.classList.add('hidden');
    if (tabLogin) {
      tabLogin.classList.add('bg-white', 'shadow-xs', 'text-slate-900');
      tabLogin.classList.remove('text-slate-500');
    }
    if (tabReg) {
      tabReg.classList.remove('bg-white', 'shadow-xs', 'text-slate-900');
      tabReg.classList.add('text-slate-500');
    }
    if (modalTitle) modalTitle.innerText = 'Sign in to InReal';
    if (modalSub) modalSub.innerText = 'Unlock full access to all verified research & engineering internships';
  }
}

function showAuthAlert(msg, isSuccess = false) {
  const box = document.getElementById('auth-alert');
  if (!box) return;
  box.classList.remove('hidden', 'bg-rose-50', 'text-rose-700', 'border-rose-200', 'bg-emerald-50', 'text-emerald-700', 'border-emerald-200');
  if (isSuccess) {
    box.classList.add('bg-emerald-50', 'text-emerald-700', 'border-emerald-200');
  } else {
    box.classList.add('bg-rose-50', 'text-rose-700', 'border-rose-200');
  }
  box.innerText = msg;
}

function bindAuthHandlers() {
  document.getElementById('open-login-btn')?.addEventListener('click', () => openAuthModal('login'));
  document.getElementById('close-auth-modal-btn')?.addEventListener('click', closeAuthModal);
  document.getElementById('tab-login')?.addEventListener('click', () => switchAuthTab('login'));
  document.getElementById('tab-register')?.addEventListener('click', () => switchAuthTab('register'));

  // Close modal when clicking on the translucent backdrop
  document.getElementById('auth-modal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('auth-modal')) closeAuthModal();
  });

  // Login form submission
  document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const identifier = document.getElementById('login-identifier')?.value.trim();
    const password = document.getElementById('login-password')?.value;
    const submitBtn = document.getElementById('login-submit-btn');

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerText = 'Authenticating...';
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username_or_email: identifier, password })
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        showAuthAlert(data.message, true);
        setTimeout(() => {
          closeAuthModal();
          setUserLoggedIn(data.user);
          showToast('success', 'Logged In', `Welcome back, ${data.user.username}! All internships unlocked.`);
        }, 600);
      } else {
        showAuthAlert(data.message || 'Login failed. Please check credentials.');
      }
    } catch (err) {
      showAuthAlert('Unable to reach server. Please try again.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<i class="ph ph-sign-in text-base text-orange-400"></i><span>Log In to Unlock Opportunities</span>`;
      }
    }
  });

  // Register form submission
  document.getElementById('register-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('reg-username')?.value.trim();
    const email = document.getElementById('reg-email')?.value.trim();
    const password = document.getElementById('reg-password')?.value;
    const expRadio = document.querySelector('input[name="reg_experience"]:checked');
    const experience = expRadio ? expRadio.value : '0';
    const submitBtn = document.getElementById('reg-submit-btn');

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerText = 'Creating Account...';
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, experience })
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        showAuthAlert(data.message, true);
        setTimeout(() => {
          closeAuthModal();
          setUserLoggedIn(data.user);
          showToast('success', 'Account Created', `Welcome to InReal, ${data.user.username}! All internships unlocked.`);
        }, 600);
      } else {
        showAuthAlert(data.message || 'Registration failed.');
      }
    } catch (err) {
      showAuthAlert('Unable to reach server. Please try again.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<i class="ph ph-sparkle text-base text-orange-400"></i><span>Create Account & Unlock All</span>`;
      }
    }
  });

  // Google-style Profile Avatar Toggle
  const avatarBtn = document.getElementById('user-avatar-btn');
  const profileMenu = document.getElementById('user-profile-menu');
  if (avatarBtn && profileMenu) {
    avatarBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      profileMenu.classList.toggle('hidden');
    });
  }

  // Unified Filter Popover Toggle
  const unifiedFilterBtn = document.getElementById('unified-filter-btn');
  const unifiedFilterMenu = document.getElementById('unified-filter-menu');
  if (unifiedFilterBtn && unifiedFilterMenu) {
    unifiedFilterBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      unifiedFilterMenu.classList.toggle('hidden');
    });
  }

  document.getElementById('clear-popover-filters')?.addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('reset-filters-btn')?.click();
  });

  // Global outside-click dismiss for both popovers
  document.addEventListener('click', (e) => {
    if (profileMenu && !profileMenu.contains(e.target) && e.target !== avatarBtn) {
      profileMenu.classList.add('hidden');
    }
    if (unifiedFilterMenu && !unifiedFilterMenu.contains(e.target) && !unifiedFilterBtn.contains(e.target)) {
      unifiedFilterMenu.classList.add('hidden');
    }
  });

  // Logout button
  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUserLoggedOut();
      showToast('info', 'Logged Out', 'You have been logged out. Only first internship is previewable.');
    } catch (err) {
      console.error('Logout error:', err);
    }
  });
}

