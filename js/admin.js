/* Admin Dashboard Logic - Sukham Physiotherapy and Rehab */

document.addEventListener('DOMContentLoaded', () => {
  // --- Admin State ---
  let state = null;
  let isDirty = false;
  let loggedIn = false;
  
  // File Upload Cache (Stores base64 media to commit on Publish)
  const uploadCache = [];

  // DOM Elements
  const loginOverlay = document.getElementById('login-overlay');
  const loginForm = document.getElementById('admin-login-form');
  const loginError = document.getElementById('login-error');
  const passcodeField = document.getElementById('admin-passcode');
  const syncDot = document.getElementById('sync-dot');
  const syncText = document.getElementById('sync-text');
  const publishBtn = document.getElementById('btn-publish');
  const logoutBtn = document.getElementById('admin-logout');
  const previewFrame = document.getElementById('preview-frame');
  const refreshPreviewBtn = document.getElementById('btn-refresh-preview');

  // --- 1. Passcode Gate Authentication ---
  checkSessionAuth();

  // Helper to hash passcode
  async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const enteredCode = passcodeField.value.trim();
    const enteredHash = await sha256(enteredCode);

    // Hashed allowed passcodes (prevent plain text exposure on public repo)
    const allowedHashes = [
      '7434e8444510b32ce5ead6f8528ddd53171192921a0fa53cf9ce80113a0df5da'  // Sukham@6009
    ];

    if (allowedHashes.includes(enteredHash)) {
      sessionStorage.setItem('sukham_admin_logged_in', 'true');
      loginOverlay.style.opacity = '0';
      setTimeout(() => loginOverlay.style.display = 'none', 500);
      loggedIn = true;
      initDashboard();
    } else {
      loginError.style.display = 'block';
      passcodeField.value = '';
    }
  });

  logoutBtn.addEventListener('click', () => {
    sessionStorage.removeItem('sukham_admin_logged_in');
    window.location.reload();
  });

  // Passcode Visibility Toggle
  const toggleVisibilityBtn = document.getElementById('toggle-passcode-visibility');
  const toggleIcon = document.getElementById('toggle-passcode-icon');

  if (toggleVisibilityBtn && passcodeField && toggleIcon) {
    toggleVisibilityBtn.addEventListener('click', () => {
      const isPassword = passcodeField.type === 'password';
      passcodeField.type = isPassword ? 'text' : 'password';

      if (isPassword) {
        toggleIcon.className = 'fa-solid fa-eye';
        passcodeField.style.letterSpacing = '2px';
      } else {
        toggleIcon.className = 'fa-solid fa-eye-slash';
        passcodeField.style.letterSpacing = '12px';
      }
    });
  }

  function checkSessionAuth() {
    if (sessionStorage.getItem('sukham_admin_logged_in') === 'true') {
      loginOverlay.style.display = 'none';
      loggedIn = true;
      initDashboard();
    }
  }

  // --- 2. Dashboard Initialization ---
  async function initDashboard() {
    // Load upload cache from localStorage to prevent overwriting on save
    try {
      const cacheStr = localStorage.getItem('sukham_upload_cache');
      if (cacheStr) {
        const parsed = JSON.parse(cacheStr);
        if (Array.isArray(parsed)) {
          uploadCache.length = 0;
          uploadCache.push(...parsed);
        }
      }
    } catch (e) {
      console.warn('Could not parse upload cache from browser storage', e);
    }

    // Load database
    try {
      // First try localStorage to recover unsaved sessions
      const cached = localStorage.getItem('sukham_clinic_db');
      if (cached) {
        state = JSON.parse(cached);
        setDirty(true);
      } else {
        const response = await fetch(`data/data.json?t=${Date.now()}`);
        if (!response.ok) throw new Error('Not found');
        state = await response.json();
      }
    } catch (e) {
      console.warn('Could not fetch data.json, loading config-default', e);
      state = window.DEFAULT_CLINIC_DATA;
    }

    if (!state) return;

    // Load GitHub Config from local storage
    loadGithubConfig();
    detectDefaultBranch(state.clinicInfo.githubUser, state.clinicInfo.githubRepo, state.clinicInfo.githubToken);

    // Populate general settings inputs
    populateSettings();

    // Bind sidebar tabs navigation
    setupSidebarTabs();

    // Render CRUD managers
    renderAllLists();

    // Setup color pickers dynamic bindings
    setupColorPickers();

    // Setup live preview iframe synchronization
    setupLivePreview();

    // Setup Drag-and-Drop file uploads
    setupUploadZones();

    // Setup form submit handlers
    setupFormSubmissions();

    // Publish click handler
    publishBtn.addEventListener('click', publishToGithub);

    // Download config click handler
    document.getElementById('btn-download-config').addEventListener('click', downloadConfigJSON);
  }

  // --- 3. Sidebar Tabs ---
  function setupSidebarTabs() {
    const links = document.querySelectorAll('.sidebar-link');
    const panels = document.querySelectorAll('.admin-panel');
    const titleElement = document.getElementById('admin-page-title');

    links.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        links.forEach(l => l.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));

        link.classList.add('active');
        const targetId = link.dataset.target;
        document.getElementById(targetId).classList.add('active');
        
        // Update Title
        titleElement.textContent = link.textContent.trim();
      });
    });
  }

  // --- 4. Populate & Sync settings ---
  function populateSettings() {
    const info = state.clinicInfo;
    const theme = state.theme;

    document.getElementById('setting-name').value = info.name || '';
    document.getElementById('setting-tagline').value = info.tagline || '';
    document.getElementById('setting-phone').value = info.phone || '';
    document.getElementById('setting-email').value = info.email || '';
    document.getElementById('setting-address').value = info.address || '';
    document.getElementById('setting-timing').value = info.workingHours || '';
    document.getElementById('setting-map').value = info.mapEmbed || '';

    // Hero details
    document.getElementById('setting-hero-badge').value = state.hero.badgeText || '';
    document.getElementById('setting-hero-title').value = state.hero.title || '';
    document.getElementById('setting-hero-desc').value = state.hero.description || '';
    renderHeroSlidesList();

    document.getElementById('color-primary').value = theme.primaryColor || '#5D2B7E';
    document.getElementById('color-primary-hex').value = theme.primaryColor || '#5D2B7E';
    document.getElementById('color-secondary').value = theme.secondaryColor || '#8E44AD';
    document.getElementById('color-secondary-hex').value = theme.secondaryColor || '#8E44AD';
    document.getElementById('color-accent').value = theme.accentColor || '#1ABC9C';
    document.getElementById('color-accent-hex').value = theme.accentColor || '#1ABC9C';

    // Hook changes to settings form fields
    const settingsPanel = document.getElementById('settings-panel');
    settingsPanel.querySelectorAll('.admin-input, .admin-textarea').forEach(input => {
      input.addEventListener('input', (e) => {
        const id = e.target.id;
        
        if (id.startsWith('setting-')) {
          const key = id.replace('setting-', '');
          if (key.startsWith('hero-')) {
            const heroKey = key.replace('hero-', '');
            const configKey = heroKey === 'badge' ? 'badgeText' : heroKey === 'title' ? 'title' : heroKey === 'desc' ? 'description' : heroKey;
            state.hero[configKey] = e.target.value;
          } else {
            const configKey = key === 'timing' ? 'workingHours' : key === 'map' ? 'mapEmbed' : key;
            state.clinicInfo[configKey] = e.target.value;
          }
        } else if (id.endsWith('-hex')) {
          const colorKey = id.split('-')[1] + 'Color';
          state.theme[colorKey] = e.target.value;
          document.getElementById(id.replace('-hex', '')).value = e.target.value;
        }

        saveLocal();
        updatePreview();
      });
    });
  }

  function setupColorPickers() {
    const colors = ['primary', 'secondary', 'accent'];
    colors.forEach(col => {
      const picker = document.getElementById(`color-${col}`);
      const text = document.getElementById(`color-${col}-hex`);
      
      picker.addEventListener('input', (e) => {
        text.value = e.target.value;
        state.theme[`${col}Color`] = e.target.value;
        saveLocal();
        updatePreview();
      });
    });
  }

  // --- 5. Live Preview Framework ---
  function setupLivePreview() {
    refreshPreviewBtn.addEventListener('click', () => {
      previewFrame.src = 'index.html';
    });

    previewFrame.addEventListener('load', () => {
      updatePreview();
    });
  }

  function updatePreview() {
    if (previewFrame.contentWindow) {
      // Create a copy of state to avoid mutating the original database
      const previewState = JSON.parse(JSON.stringify(state));
      substituteBase64Urls(previewState);

      previewFrame.contentWindow.postMessage({
        type: 'UPDATE_DATA',
        data: previewState
      }, '*');
    }
  }

  function substituteBase64Urls(obj) {
    if (!obj) return;
    if (typeof obj === 'object') {
      for (const key in obj) {
        if (typeof obj[key] === 'string') {
          const cached = uploadCache.find(item => item.path === obj[key]);
          if (cached) {
            obj[key] = cached.originalUrl;
          }
        } else if (typeof obj[key] === 'object') {
          substituteBase64Urls(obj[key]);
        }
      }
    }
  }

  function getLocalUrl(url) {
    if (!url) return 'assets/logo.jpg';
    const cached = uploadCache.find(item => item.path === url);
    if (cached) {
      return cached.originalUrl;
    }
    // Fallback to GitHub raw CDN if it's an uploaded asset and we don't have it in local cache
    if (url.startsWith('assets/uploads/')) {
      const user = localStorage.getItem('sukham_gh_user') || (state && state.clinicInfo && state.clinicInfo.githubUser);
      const repo = localStorage.getItem('sukham_gh_repo') || (state && state.clinicInfo && state.clinicInfo.githubRepo);
      const branch = localStorage.getItem('sukham_gh_branch') || 'main';
      if (user && repo) {
        return `https://raw.githubusercontent.com/${user}/${repo}/${branch}/${url}`;
      }
    }
    return url;
  }

  // --- 6. Local caching and Sync State ---
  function saveLocal() {
    try {
      localStorage.setItem('sukham_clinic_db', JSON.stringify(state));
      localStorage.setItem('sukham_upload_cache', JSON.stringify(uploadCache));
    } catch (e) {
      console.warn('Local browser storage quota exceeded. Edits are kept in memory and can still be published.', e);
    }
    setDirty(true);
  }

  function setDirty(dirty) {
    isDirty = dirty;
    if (dirty) {
      syncDot.className = 'status-dot unsaved';
      syncText.textContent = 'Local changes unsaved';
    } else {
      syncDot.className = 'status-dot synced';
      syncText.textContent = 'Synced with Server';
    }
  }

  // --- 7. GitHub Config Persistence ---
  function loadGithubConfig() {
    const user = localStorage.getItem('sukham_gh_user') || '';
    const repo = localStorage.getItem('sukham_gh_repo') || '';
    const token = localStorage.getItem('sukham_gh_token') || '';

    document.getElementById('github-user').value = user;
    document.getElementById('github-repo').value = repo;
    document.getElementById('github-token').value = token;

    state.clinicInfo.githubUser = user;
    state.clinicInfo.githubRepo = repo;
    state.clinicInfo.githubToken = token;
  }

  async function saveGithubConfig() {
    const user = document.getElementById('github-user').value.trim();
    const repo = document.getElementById('github-repo').value.trim();
    const token = document.getElementById('github-token').value.trim();

    localStorage.setItem('sukham_gh_user', user);
    localStorage.setItem('sukham_gh_repo', repo);
    localStorage.setItem('sukham_gh_token', token);

    state.clinicInfo.githubUser = user;
    state.clinicInfo.githubRepo = repo;
    state.clinicInfo.githubToken = token;

    // Detect and store the default branch for raw CDN fallbacks
    await detectDefaultBranch(user, repo, token);
    
    // Refresh the live preview to load from the correct branch CDN fallback if applicable
    updatePreview();
  }

  async function detectDefaultBranch(user, repo, token) {
    if (!user || !repo) return;
    try {
      const headers = {
        'Accept': 'application/vnd.github.v3+json'
      };
      if (token) {
        headers['Authorization'] = `token ${token}`;
      }
      const res = await fetch(`https://api.github.com/repos/${user}/${repo}`, { headers });
      if (res.ok) {
        const repoData = await res.json();
        if (repoData.default_branch) {
          localStorage.setItem('sukham_gh_branch', repoData.default_branch);
          console.log(`Detected default branch: ${repoData.default_branch}`);
        }
      }
    } catch (e) {
      console.warn('Could not detect default branch from GitHub API:', e);
    }
  }

  // Hook changes to repository inputs
  ['github-user', 'github-repo', 'github-token'].forEach(id => {
    document.getElementById(id).addEventListener('change', saveGithubConfig);
  });

  // --- 8. CRUD Lists Renderers ---

  function renderAllLists() {
    renderDoctorsList();
    renderServicesList();
    renderFacilitiesList();
    renderTestimoniesList();
    renderGalleryList();
    renderBlogsList();
    renderHeroSlidesList();
    renderFaqsList();
    renderConditionsList();
  }

  function renderHeroSlidesList() {
    const container = document.getElementById('hero-slides-list');
    if (!container) return;
    container.innerHTML = '';

    if (!state.hero.slides) {
      state.hero.slides = [];
    }

    state.hero.slides.forEach((slideUrl, index) => {
      const item = document.createElement('div');
      item.className = 'crud-item';
      item.innerHTML = `
        <div class="crud-info">
          <img src="${getLocalUrl(slideUrl)}" class="crud-thumb" alt="Hero Slide ${index + 1}">
          <div class="crud-details">
            <h4>Slide #${index + 1}</h4>
            <p style="word-break: break-all; font-size:11px;">${slideUrl.substring(0, 60)}${slideUrl.length > 60 ? '...' : ''}</p>
          </div>
        </div>
        <div class="crud-actions">
          <button class="admin-btn admin-btn-danger btn-delete-slide" data-index="${index}"><i class="fa-solid fa-trash"></i> Delete</button>
        </div>
      `;
      container.appendChild(item);
    });

    container.querySelectorAll('.btn-delete-slide').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.index);
        state.hero.slides.splice(index, 1);
        saveLocal();
        renderHeroSlidesList();
        updatePreview();
      });
    });
  }

  // Doctors
  function renderDoctorsList() {
    const container = document.getElementById('doctor-crud-list');
    container.innerHTML = '';
    
    state.doctors.forEach(doc => {
      const item = document.createElement('div');
      item.className = 'crud-item';
      item.innerHTML = `
        <div class="crud-info">
          <img src="${getLocalUrl(doc.image)}" class="crud-thumb" alt="">
          <div class="crud-details">
            <h4>${doc.name}</h4>
            <p>${doc.title} (${doc.gender})</p>
          </div>
        </div>
        <div class="crud-actions">
          <button class="admin-btn admin-btn-secondary btn-edit-doc" data-id="${doc.id}"><i class="fa-solid fa-pen"></i> Edit</button>
          <button class="admin-btn admin-btn-danger btn-delete-doc" data-id="${doc.id}"><i class="fa-solid fa-trash"></i> Delete</button>
        </div>
      `;
      container.appendChild(item);
    });

    // Hook buttons
    container.querySelectorAll('.btn-edit-doc').forEach(btn => {
      btn.addEventListener('click', () => openDoctorModal(btn.dataset.id));
    });
    container.querySelectorAll('.btn-delete-doc').forEach(btn => {
      btn.addEventListener('click', () => deleteDoctor(btn.dataset.id));
    });
  }

  // Services
  function renderServicesList() {
    const container = document.getElementById('service-crud-list');
    container.innerHTML = '';

    state.services.forEach(srv => {
      const item = document.createElement('div');
      item.className = 'crud-item';
      item.innerHTML = `
        <div class="crud-info">
          <div class="crud-thumb" style="font-size: 24px; display: flex; align-items: center; justify-content: center; background-color:#1E172A;">${srv.icon}</div>
          <div class="crud-details">
            <h4>${srv.title}</h4>
            <p>${srv.desc.substring(0, 80)}...</p>
          </div>
        </div>
        <div class="crud-actions">
          <button class="admin-btn admin-btn-secondary btn-edit-srv" data-id="${srv.id}"><i class="fa-solid fa-pen"></i> Edit</button>
          <button class="admin-btn admin-btn-danger btn-delete-srv" data-id="${srv.id}"><i class="fa-solid fa-trash"></i> Delete</button>
        </div>
      `;
      container.appendChild(item);
    });

    container.querySelectorAll('.btn-edit-srv').forEach(btn => {
      btn.addEventListener('click', () => openServiceModal(btn.dataset.id));
    });
    container.querySelectorAll('.btn-delete-srv').forEach(btn => {
      btn.addEventListener('click', () => deleteService(btn.dataset.id));
    });
  }

  // Facilities
  function renderFacilitiesList() {
    const container = document.getElementById('facility-crud-list');
    container.innerHTML = '';

    state.facilities.forEach(fac => {
      const item = document.createElement('div');
      item.className = 'crud-item';
      item.innerHTML = `
        <div class="crud-info">
          <img src="${getLocalUrl(fac.image)}" class="crud-thumb" alt="">
          <div class="crud-details">
            <h4>${fac.name}</h4>
            <p>${fac.category} - ${fac.desc.substring(0, 60)}...</p>
          </div>
        </div>
        <div class="crud-actions">
          <button class="admin-btn admin-btn-secondary btn-edit-fac" data-id="${fac.id}"><i class="fa-solid fa-pen"></i> Edit</button>
          <button class="admin-btn admin-btn-danger btn-delete-fac" data-id="${fac.id}"><i class="fa-solid fa-trash"></i> Delete</button>
        </div>
      `;
      container.appendChild(item);
    });

    container.querySelectorAll('.btn-edit-fac').forEach(btn => {
      btn.addEventListener('click', () => openFacilityModal(btn.dataset.id));
    });
    container.querySelectorAll('.btn-delete-fac').forEach(btn => {
      btn.addEventListener('click', () => deleteFacility(btn.dataset.id));
    });
  }

  // Testimonials
  function renderTestimoniesList() {
    const container = document.getElementById('testimony-crud-list');
    container.innerHTML = '';

    state.testimonies.forEach(t => {
      const item = document.createElement('div');
      item.className = 'crud-item';
      item.innerHTML = `
        <div class="crud-info">
          <div class="crud-thumb" style="display: flex; align-items: center; justify-content: center; background-color:#1E172A;"><i class="fa-solid fa-star" style="color:#F1C40F;"></i></div>
          <div class="crud-details">
            <h4>${t.name} (${t.condition})</h4>
            <p>${t.text.substring(0, 80)}...</p>
          </div>
        </div>
        <div class="crud-actions">
          <button class="admin-btn admin-btn-secondary btn-edit-test" data-id="${t.id}"><i class="fa-solid fa-pen"></i> Edit</button>
          <button class="admin-btn admin-btn-danger btn-delete-test" data-id="${t.id}"><i class="fa-solid fa-trash"></i> Delete</button>
        </div>
      `;
      container.appendChild(item);
    });

    container.querySelectorAll('.btn-edit-test').forEach(btn => {
      btn.addEventListener('click', () => openTestimonyModal(btn.dataset.id));
    });
    container.querySelectorAll('.btn-delete-test').forEach(btn => {
      btn.addEventListener('click', () => deleteTestimony(btn.dataset.id));
    });
  }

  // Gallery
  function renderGalleryList() {
    const container = document.getElementById('gallery-crud-list');
    container.innerHTML = '';

    state.gallery.forEach(g => {
      const item = document.createElement('div');
      item.className = 'crud-item';
      
      const isVideo = g.type === 'video' || g.url.includes('.mp4');
      const localUrl = getLocalUrl(g.url);
      const mediaHtml = isVideo 
        ? `<video src="${localUrl}" class="crud-thumb" muted></video>`
        : `<img src="${localUrl}" class="crud-thumb" alt="">`;

      item.innerHTML = `
        <div class="crud-info">
          ${mediaHtml}
          <div class="crud-details">
            <h4>${g.title}</h4>
            <p>${g.type.toUpperCase()} - ${g.category}</p>
          </div>
        </div>
        <div class="crud-actions">
          <button class="admin-btn admin-btn-secondary btn-edit-gal" data-id="${g.id}"><i class="fa-solid fa-pen"></i> Edit</button>
          <button class="admin-btn admin-btn-danger btn-delete-gal" data-id="${g.id}"><i class="fa-solid fa-trash"></i> Delete</button>
        </div>
      `;
      container.appendChild(item);
    });

    container.querySelectorAll('.btn-edit-gal').forEach(btn => {
      btn.addEventListener('click', () => openGalleryModal(btn.dataset.id));
    });
    container.querySelectorAll('.btn-delete-gal').forEach(btn => {
      btn.addEventListener('click', () => deleteGallery(btn.dataset.id));
    });
  }

  // Blogs
  function renderBlogsList() {
    const container = document.getElementById('blog-crud-list');
    container.innerHTML = '';

    state.blogs.forEach(b => {
      const item = document.createElement('div');
      item.className = 'crud-item';
      item.innerHTML = `
        <div class="crud-info">
          <img src="${getLocalUrl(b.image)}" class="crud-thumb" alt="">
          <div class="crud-details">
            <h4>${b.title}</h4>
            <p>Published: ${b.date} | Author: ${b.author || 'Dr. Disha'}</p>
          </div>
        </div>
        <div class="crud-actions">
          <button class="admin-btn admin-btn-secondary btn-edit-blog" data-id="${b.id}"><i class="fa-solid fa-pen"></i> Edit</button>
          <button class="admin-btn admin-btn-danger btn-delete-blog" data-id="${b.id}"><i class="fa-solid fa-trash"></i> Delete</button>
        </div>
      `;
      container.appendChild(item);
    });

    container.querySelectorAll('.btn-edit-blog').forEach(btn => {
      btn.addEventListener('click', () => openBlogModal(btn.dataset.id));
    });
    container.querySelectorAll('.btn-delete-blog').forEach(btn => {
      btn.addEventListener('click', () => deleteBlog(btn.dataset.id));
    });
  }

  // FAQs
  function renderFaqsList() {
    const container = document.getElementById('faq-crud-list');
    if (!container) return;
    container.innerHTML = '';

    if (!state.faqs) {
      state.faqs = [];
    }

    state.faqs.forEach(faq => {
      const item = document.createElement('div');
      item.className = 'crud-item';
      item.innerHTML = `
        <div class="crud-info">
          <div class="crud-thumb" style="display: flex; align-items: center; justify-content: center; background-color:#1E172A;"><i class="fa-solid fa-circle-question" style="color:var(--accent-color);"></i></div>
          <div class="crud-details">
            <h4>${faq.question}</h4>
            <p>${faq.answer.substring(0, 80)}...</p>
          </div>
        </div>
        <div class="crud-actions">
          <button class="admin-btn admin-btn-secondary btn-edit-faq" data-id="${faq.id}"><i class="fa-solid fa-pen"></i> Edit</button>
          <button class="admin-btn admin-btn-danger btn-delete-faq" data-id="${faq.id}"><i class="fa-solid fa-trash"></i> Delete</button>
        </div>
      `;
      container.appendChild(item);
    });

    container.querySelectorAll('.btn-edit-faq').forEach(btn => {
      btn.addEventListener('click', () => openFaqModal(btn.dataset.id));
    });
    container.querySelectorAll('.btn-delete-faq').forEach(btn => {
      btn.addEventListener('click', () => deleteFaq(btn.dataset.id));
    });
  }

  // Conditions
  function renderConditionsList() {
    const container = document.getElementById('conditions-crud-container');
    if (!container) return;
    container.innerHTML = '';

    if (!state.conditions) {
      state.conditions = {};
    }

    Object.keys(state.conditions).forEach(cat => {
      const items = state.conditions[cat];
      const card = document.createElement('div');
      card.className = 'conditions-category-card';
      card.style.cssText = `
        background-color: var(--bg-surface);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        padding: 20px;
        margin-bottom: 20px;
      `;

      const listHtml = items.map((item, index) => `
        <div class="condition-chip" style="display:inline-flex; align-items:center; background-color:rgba(255,255,255,0.03); border:1px solid var(--border-color); padding: 6px 12px; border-radius: 50px; margin: 4px; font-size:13px;">
          <span class="btn-edit-condition-item" data-category="${cat}" data-index="${index}" style="cursor:pointer; margin-right:8px; color:var(--accent-color);"><i class="fa-solid fa-pen" style="font-size:10px;"></i></span>
          <span style="color:var(--text-main); font-weight:500;">${item}</span>
          <span class="btn-delete-condition-item" data-category="${cat}" data-index="${index}" style="margin-left:10px; cursor:pointer; color:var(--text-muted); font-weight:bold; font-size:15px;">&times;</span>
        </div>
      `).join('');

      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-color); padding-bottom:10px; margin-bottom:15px; flex-wrap:wrap; gap:10px;">
          <h4 style="font-size:16px; font-weight:700; color:var(--primary-color);">${cat}</h4>
          <div style="display:flex; gap:8px;">
            <button class="admin-btn admin-btn-primary btn-add-condition-item" data-category="${cat}" style="padding: 4px 10px; font-size:12px;"><i class="fa-solid fa-plus"></i> Add Item</button>
            <button class="admin-btn admin-btn-secondary btn-edit-category" data-category="${cat}" style="padding: 4px 10px; font-size:12px;"><i class="fa-solid fa-pen"></i> Rename</button>
            <button class="admin-btn admin-btn-danger btn-delete-category" data-category="${cat}" style="padding: 4px 10px; font-size:12px;"><i class="fa-solid fa-trash"></i> Delete</button>
          </div>
        </div>
        <div class="conditions-chips-list">
          ${listHtml}
          ${items.length === 0 ? '<p style="color:var(--text-muted); font-size:12px; font-style:italic;">No conditions in this category yet. Click Add Item to start.</p>' : ''}
        </div>
      `;
      container.appendChild(card);
    });

    // Add Item Click Listeners
    container.querySelectorAll('.btn-add-condition-item').forEach(btn => {
      btn.addEventListener('click', () => {
        openConditionItemModal(btn.dataset.category);
      });
    });

    // Edit Item Click Listeners
    container.querySelectorAll('.btn-edit-condition-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const cat = btn.dataset.category;
        const idx = parseInt(btn.dataset.index);
        openConditionItemModal(cat, idx);
      });
    });

    // Delete Item Click Listeners
    container.querySelectorAll('.btn-delete-condition-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const cat = btn.dataset.category;
        const idx = parseInt(btn.dataset.index);
        deleteConditionItem(cat, idx);
      });
    });

    // Edit Category click listeners
    container.querySelectorAll('.btn-edit-category').forEach(btn => {
      btn.addEventListener('click', () => {
        openConditionCategoryModal(btn.dataset.category);
      });
    });

    // Delete Category click listeners
    container.querySelectorAll('.btn-delete-category').forEach(btn => {
      btn.addEventListener('click', () => {
        deleteConditionCategory(btn.dataset.category);
      });
    });
  }

  // --- 9. Modals Open Functions ---

  function openDoctorModal(id) {
    const doc = state.doctors.find(d => d.id === id);
    document.getElementById('doctor-modal-title').textContent = doc ? 'Edit Hired Doctor' : 'Add New Hired Doctor';
    document.getElementById('doctor-form-id').value = id || '';
    document.getElementById('doctor-form-name').value = doc ? doc.name : '';
    document.getElementById('doctor-form-title').value = doc ? doc.title : '';
    document.getElementById('doctor-form-gender').value = doc ? doc.gender : 'Female';
    document.getElementById('doctor-form-img').value = doc ? doc.image : '';
    document.getElementById('doctor-form-bio').value = doc ? doc.bio : '';
    document.getElementById('doctor-form-specs').value = doc ? (doc.specialties ? doc.specialties.join(', ') : '') : '';
    document.getElementById('doctor-form-fb').value = doc ? doc.facebook : '#';
    document.getElementById('doctor-form-insta').value = doc ? doc.instagram : '#';
    document.getElementById('doctor-img-upload-status').textContent = '';

    openAdminModal('doctor-modal');
  }

  function openServiceModal(id) {
    const srv = state.services.find(s => s.id === id);
    document.getElementById('service-modal-title').textContent = srv ? 'Edit Treatment Card' : 'Add Treatment Card';
    document.getElementById('service-form-id').value = id || '';
    document.getElementById('service-form-title').value = srv ? srv.title : '';
    document.getElementById('service-form-icon').value = srv ? srv.icon : '';
    document.getElementById('service-form-desc').value = srv ? srv.desc : '';

    openAdminModal('service-modal');
  }

  function openFacilityModal(id) {
    const fac = state.facilities.find(f => f.id === id);
    document.getElementById('facility-modal-title').textContent = fac ? 'Edit Facility details' : 'Add Facility / Equipment';
    document.getElementById('facility-form-id').value = id || '';
    document.getElementById('facility-form-name').value = fac ? fac.name : '';
    document.getElementById('facility-form-category').value = fac ? fac.category : 'Latest Tech';
    document.getElementById('facility-form-img').value = fac ? fac.image : '';
    document.getElementById('facility-form-desc').value = fac ? fac.desc : '';
    document.getElementById('facility-img-upload-status').textContent = '';

    openAdminModal('facility-modal');
  }

  function openTestimonyModal(id) {
    const test = state.testimonies.find(t => t.id === id);
    document.getElementById('testimony-modal-title').textContent = test ? 'Edit Testimonial' : 'Add Testimonial';
    document.getElementById('testimony-form-id').value = id || '';
    document.getElementById('testimony-form-name').value = test ? test.name : '';
    document.getElementById('testimony-form-condition').value = test ? test.condition : '';
    document.getElementById('testimony-form-rating').value = test ? test.rating : '5';
    document.getElementById('testimony-form-text').value = test ? test.text : '';

    openAdminModal('testimony-modal');
  }

  function openGalleryModal(id) {
    const gal = state.gallery.find(g => g.id === id);
    document.getElementById('gallery-modal-title').textContent = gal ? 'Edit Media Details' : 'Add Photo / Video';
    document.getElementById('gallery-form-id').value = id || '';
    document.getElementById('gallery-form-title').value = gal ? gal.title : '';
    document.getElementById('gallery-form-type').value = gal ? gal.type : 'image';
    document.getElementById('gallery-form-category').value = gal ? gal.category : 'facility';
    document.getElementById('gallery-form-url').value = gal ? gal.url : '';
    document.getElementById('gallery-form-desc').value = gal ? gal.desc : '';
    document.getElementById('gallery-upload-status').textContent = '';

    openAdminModal('gallery-modal');
  }

  function openBlogModal(id) {
    const blog = state.blogs.find(b => b.id === id);
    document.getElementById('blog-modal-title-label').textContent = blog ? 'Edit Blog Post' : 'Write New Blog Post';
    document.getElementById('blog-form-id').value = id || '';
    document.getElementById('blog-form-title').value = blog ? blog.title : '';
    document.getElementById('blog-form-author').value = blog ? blog.author : 'Dr. Disha Viraj Ranade';
    document.getElementById('blog-form-image').value = blog ? blog.image : '';
    document.getElementById('blog-form-excerpt').value = blog ? blog.excerpt : '';
    document.getElementById('blog-form-content').value = blog ? blog.content : '';
    document.getElementById('blog-img-upload-status').textContent = '';

    openAdminModal('blog-modal');
  }

  function openFaqModal(id) {
    if (!state.faqs) state.faqs = [];
    const faq = state.faqs.find(f => f.id === id);
    document.getElementById('faq-modal-title').textContent = faq ? 'Edit FAQ Details' : 'Add New FAQ';
    document.getElementById('faq-form-id').value = id || '';
    document.getElementById('faq-form-question').value = faq ? faq.question : '';
    document.getElementById('faq-form-answer').value = faq ? faq.answer : '';

    openAdminModal('faq-modal');
  }

  function openConditionCategoryModal(originalName) {
    document.getElementById('condition-category-modal-title').textContent = originalName ? 'Rename Category' : 'Add New Category';
    document.getElementById('condition-category-form-original-name').value = originalName || '';
    document.getElementById('condition-category-form-name').value = originalName || '';
    openAdminModal('condition-category-modal');
  }

  function openConditionItemModal(category, index) {
    const isEdit = typeof index !== 'undefined';
    document.getElementById('condition-item-modal-title').textContent = isEdit ? 'Edit Condition Name' : 'Add New Condition';
    document.getElementById('condition-item-form-category').value = category;
    document.getElementById('condition-item-form-index').value = isEdit ? index : '';
    
    let currentName = '';
    if (isEdit && state.conditions[category]) {
      currentName = state.conditions[category][index] || '';
    }
    document.getElementById('condition-item-form-name').value = currentName;
    openAdminModal('condition-item-modal');
  }

  // --- Delete Functions ---
  function deleteDoctor(id) {
    if (confirm('Are you sure you want to delete this doctor profile?')) {
      state.doctors = state.doctors.filter(d => d.id !== id);
      saveLocal();
      renderDoctorsList();
      updatePreview();
    }
  }

  function deleteService(id) {
    if (confirm('Delete this treatment card?')) {
      state.services = state.services.filter(s => s.id !== id);
      saveLocal();
      renderServicesList();
      updatePreview();
    }
  }

  function deleteFacility(id) {
    if (confirm('Delete this facility card?')) {
      state.facilities = state.facilities.filter(f => f.id !== id);
      saveLocal();
      renderFacilitiesList();
      updatePreview();
    }
  }

  function deleteConditionCategory(category) {
    if (confirm(`Are you sure you want to delete the entire "${category}" category and all its conditions? This action cannot be undone.`)) {
      if (state.conditions && state.conditions[category]) {
        delete state.conditions[category];
        saveLocal();
        renderConditionsList();
        updatePreview();
      }
    }
  }

  function deleteConditionItem(category, index) {
    if (confirm(`Remove this condition?`)) {
      if (state.conditions && state.conditions[category]) {
        state.conditions[category].splice(index, 1);
        saveLocal();
        renderConditionsList();
        updatePreview();
      }
    }
  }

  function deleteTestimony(id) {
    if (confirm('Delete this testimonial?')) {
      state.testimonies = state.testimonies.filter(t => t.id !== id);
      saveLocal();
      renderTestimoniesList();
      updatePreview();
    }
  }

  function deleteGallery(id) {
    if (confirm('Delete this gallery media?')) {
      state.gallery = state.gallery.filter(g => g.id !== id);
      saveLocal();
      renderGalleryList();
      updatePreview();
    }
  }

  function deleteBlog(id) {
    if (confirm('Delete this blog post?')) {
      state.blogs = state.blogs.filter(b => b.id !== id);
      saveLocal();
      renderBlogsList();
      updatePreview();
    }
  }

  function deleteFaq(id) {
    if (confirm('Delete this FAQ?')) {
      state.faqs = state.faqs.filter(f => f.id !== id);
      saveLocal();
      renderFaqsList();
      updatePreview();
    }
  }

  // Bind Add Buttons
  document.getElementById('btn-add-doctor').onclick = () => openDoctorModal();
  document.getElementById('btn-add-service').onclick = () => openServiceModal();
  document.getElementById('btn-add-facility').onclick = () => openFacilityModal();
  document.getElementById('btn-add-testimony').onclick = () => openTestimonyModal();
  document.getElementById('btn-add-gallery').onclick = () => openGalleryModal();
  document.getElementById('btn-add-blog').onclick = () => openBlogModal();
  document.getElementById('btn-add-faq').onclick = () => openFaqModal();

  // --- 10. File Uploader & Drag and Drop Setup ---

  function setupUploadZones() {
    bindUploadZone('doctor-img-upload-zone', 'doctor-img-file-input', 'doctor-form-img', 'doctor-img-upload-status');
    bindUploadZone('facility-img-upload-zone', 'facility-img-file-input', 'facility-form-img', 'facility-img-upload-status');
    bindUploadZone('gallery-media-upload-zone', 'gallery-media-file-input', 'gallery-form-url', 'gallery-upload-status');
    bindUploadZone('blog-img-upload-zone', 'blog-img-file-input', 'blog-form-image', 'blog-img-upload-status');

    // Hero slide uploader
    const heroZone = document.getElementById('hero-slide-upload-zone');
    const heroInput = document.getElementById('hero-slide-file-input');
    const heroStatus = document.getElementById('hero-slide-upload-status');

    if (heroZone && heroInput) {
      heroZone.addEventListener('click', () => heroInput.click());
      heroZone.addEventListener('dragover', (e) => { e.preventDefault(); heroZone.style.borderColor = '#8E44AD'; });
      heroZone.addEventListener('dragleave', () => { heroZone.style.borderColor = '#2F253F'; });
      heroZone.addEventListener('drop', (e) => {
        e.preventDefault();
        heroZone.style.borderColor = '#2F253F';
        if (e.dataTransfer.files.length > 0) {
          processHeroSlideFile(e.dataTransfer.files[0], heroStatus);
        }
      });
      heroInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          processHeroSlideFile(e.target.files[0], heroStatus);
        }
      });
    }
  }

  async function processHeroSlideFile(file, statusDiv) {
    if (!file) return;
    
    const relativePath = getCleanUploadPath(file);
    const existsInState = isPathInState(state, relativePath);
    const existsInCache = uploadCache.some(item => item.path === relativePath);

    // If already in use, don't re-upload
    if (existsInState || existsInCache) {
      if (!state.hero.slides) {
        state.hero.slides = [];
      }
      
      // If already in slideshow list, avoid adding it twice in the slideshow list itself
      if (state.hero.slides.includes(relativePath)) {
        statusDiv.textContent = `Image already in slideshow: ${file.name}`;
        return;
      }

      state.hero.slides.push(relativePath);
      statusDiv.textContent = `Using existing uploaded file: ${file.name}`;
      saveLocal();
      renderHeroSlidesList();
      updatePreview();
      return;
    }

    statusDiv.textContent = 'Compressing image...';
    
    try {
      let dataUrl;
      if (file.type.startsWith('image/')) {
        dataUrl = await compressImage(file, 1200, 800, 0.75);
      } else {
        dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = e => resolve(e.target.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

      const base64Content = dataUrl.split(',')[1];

      if (!state.hero.slides) {
        state.hero.slides = [];
      }

      state.hero.slides.push(relativePath);

      uploadCache.push({
        path: relativePath,
        content: base64Content,
        originalUrl: dataUrl
      });

      statusDiv.textContent = `File ready: ${file.name} (Compressed)`;
      saveLocal();
      renderHeroSlidesList();
      updatePreview();
    } catch (err) {
      console.error(err);
      statusDiv.textContent = 'Upload failed during processing.';
    }
  }

  function bindUploadZone(zoneId, inputId, targetInputId, statusId) {
    const zone = document.getElementById(zoneId);
    const input = document.getElementById(inputId);
    const target = document.getElementById(targetInputId);
    const status = document.getElementById(statusId);

    if (!zone || !input) return;

    zone.addEventListener('click', () => input.click());

    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.style.borderColor = '#8E44AD';
    });

    zone.addEventListener('dragleave', () => {
      zone.style.borderColor = '#2F253F';
    });

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.style.borderColor = '#2F253F';
      if (e.dataTransfer.files.length > 0) {
        processFile(e.dataTransfer.files[0], target, status);
      }
    });

    input.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        processFile(e.target.files[0], target, status);
      }
    });
  }

  async function processFile(file, targetInput, statusDiv) {
    if (!file) return;

    const relativePath = getCleanUploadPath(file);
    const existsInState = isPathInState(state, relativePath);
    const existsInCache = uploadCache.some(item => item.path === relativePath);

    // If already in use, don't re-upload, just use it
    if (existsInState || existsInCache) {
      targetInput.value = relativePath;
      statusDiv.textContent = `Using existing uploaded file: ${file.name}`;
      targetInput.dispatchEvent(new Event('input'));
      return;
    }

    statusDiv.textContent = 'Compressing image...';

    try {
      let dataUrl;
      if (file.type.startsWith('image/')) {
        dataUrl = await compressImage(file, 1200, 800, 0.75);
      } else {
        dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = e => resolve(e.target.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

      const base64Content = dataUrl.split(',')[1];

      targetInput.value = relativePath;
      
      uploadCache.push({
        path: relativePath,
        content: base64Content,
        originalUrl: dataUrl
      });

      statusDiv.textContent = `File ready: ${file.name} (Compressed)`;
      targetInput.dispatchEvent(new Event('input'));
    } catch (err) {
      console.error(err);
      statusDiv.textContent = 'Upload failed during processing.';
    }
  }

  // --- 11. Modal Forms Submit Handlers ---

  function setupFormSubmissions() {
    // Doctors
    document.getElementById('doctor-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const id = document.getElementById('doctor-form-id').value;
      const name = document.getElementById('doctor-form-name').value.trim();
      const title = document.getElementById('doctor-form-title').value.trim();
      const gender = document.getElementById('doctor-form-gender').value;
      const img = document.getElementById('doctor-form-img').value.trim() || 'assets/logo.jpg';
      const bio = document.getElementById('doctor-form-bio').value.trim();
      const specsInput = document.getElementById('doctor-form-specs').value.trim();
      const specialties = specsInput ? specsInput.split(',').map(s => s.trim()) : [];
      const facebook = document.getElementById('doctor-form-fb').value.trim();
      const instagram = document.getElementById('doctor-form-insta').value.trim();

      if (id) {
        // Edit
        const doc = state.doctors.find(d => d.id === id);
        if (doc) {
          Object.assign(doc, { name, title, gender, image: img, bio, specialties, facebook, instagram });
        }
      } else {
        // Add
        const newDoc = {
          id: 'd_' + Date.now(),
          name, title, gender, image: img, bio, specialties, facebook, instagram, linkedin: '#'
        };
        state.doctors.push(newDoc);
      }

      saveLocal();
      renderDoctorsList();
      closeAdminModal('doctor-modal');
      updatePreview();
    });

    // Services
    document.getElementById('service-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const id = document.getElementById('service-form-id').value;
      const title = document.getElementById('service-form-title').value.trim();
      const icon = document.getElementById('service-form-icon').value.trim();
      const desc = document.getElementById('service-form-desc').value.trim();

      if (id) {
        const srv = state.services.find(s => s.id === id);
        if (srv) Object.assign(srv, { title, icon, desc });
      } else {
        state.services.push({
          id: 's_' + Date.now(),
          title, icon, desc
        });
      }

      saveLocal();
      renderServicesList();
      closeAdminModal('service-modal');
      updatePreview();
    });

    // Facilities
    document.getElementById('facility-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const id = document.getElementById('facility-form-id').value;
      const name = document.getElementById('facility-form-name').value.trim();
      const category = document.getElementById('facility-form-category').value;
      const img = document.getElementById('facility-form-img').value.trim() || 'assets/logo.jpg';
      const desc = document.getElementById('facility-form-desc').value.trim();

      if (id) {
        const fac = state.facilities.find(f => f.id === id);
        if (fac) Object.assign(fac, { name, category, image: img, desc });
      } else {
        state.facilities.push({
          id: 'f_' + Date.now(),
          name, category, image: img, desc
        });
      }

      saveLocal();
      renderFacilitiesList();
      closeAdminModal('facility-modal');
      updatePreview();
    });

    // Testimonials
    document.getElementById('testimony-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const id = document.getElementById('testimony-form-id').value;
      const name = document.getElementById('testimony-form-name').value.trim();
      const condition = document.getElementById('testimony-form-condition').value.trim();
      const rating = parseInt(document.getElementById('testimony-form-rating').value);
      const text = document.getElementById('testimony-form-text').value.trim();

      if (id) {
        const test = state.testimonies.find(t => t.id === id);
        if (test) Object.assign(test, { name, condition, rating, text });
      } else {
        state.testimonies.push({
          id: 't_' + Date.now(),
          name, condition, rating, text, date: new Date().toISOString().split('T')[0]
        });
      }

      saveLocal();
      renderTestimoniesList();
      closeAdminModal('testimony-modal');
      updatePreview();
    });

    // Gallery
    document.getElementById('gallery-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const id = document.getElementById('gallery-form-id').value;
      const title = document.getElementById('gallery-form-title').value.trim();
      const type = document.getElementById('gallery-form-type').value;
      const category = document.getElementById('gallery-form-category').value;
      const url = document.getElementById('gallery-form-url').value.trim();
      const desc = document.getElementById('gallery-form-desc').value.trim();

      if (id) {
        const gal = state.gallery.find(g => g.id === id);
        if (gal) Object.assign(gal, { title, type, category, url, desc });
      } else {
        state.gallery.push({
          id: 'g_' + Date.now(),
          title, type, category, url, desc
        });
      }

      saveLocal();
      renderGalleryList();
      closeAdminModal('gallery-modal');
      updatePreview();
    });

    // Blogs
    document.getElementById('blog-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const id = document.getElementById('blog-form-id').value;
      const title = document.getElementById('blog-form-title').value.trim();
      const author = document.getElementById('blog-form-author').value.trim();
      const image = document.getElementById('blog-form-image').value.trim() || 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=600&q=80';
      const excerpt = document.getElementById('blog-form-excerpt').value.trim();
      const content = document.getElementById('blog-form-content').value.trim();

      if (id) {
        const blog = state.blogs.find(b => b.id === id);
        if (blog) Object.assign(blog, { title, author, image, excerpt, content });
      } else {
        state.blogs.push({
          id: 'b_' + Date.now(),
          title, author, image, excerpt, content, date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        });
      }

      saveLocal();
      renderBlogsList();
      closeAdminModal('blog-modal');
      updatePreview();
    });

    // FAQs
    document.getElementById('faq-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const id = document.getElementById('faq-form-id').value;
      const question = document.getElementById('faq-form-question').value.trim();
      const answer = document.getElementById('faq-form-answer').value.trim();

      if (!state.faqs) state.faqs = [];

      if (id) {
        const faq = state.faqs.find(f => f.id === id);
        if (faq) Object.assign(faq, { question, answer });
      } else {
        state.faqs.push({
          id: 'faq_' + Date.now(),
          question, answer
        });
      }

      saveLocal();
      renderFaqsList();
      closeAdminModal('faq-modal');
      updatePreview();
    });

    // Add Condition Category Click
    document.getElementById('btn-add-condition-category').addEventListener('click', () => {
      openConditionCategoryModal();
    });

    // Condition Category Form Submit
    document.getElementById('condition-category-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const originalName = document.getElementById('condition-category-form-original-name').value;
      const newName = document.getElementById('condition-category-form-name').value.trim();

      if (!state.conditions) state.conditions = {};

      if (originalName) {
        // Renaming Category
        if (originalName !== newName) {
          state.conditions[newName] = state.conditions[originalName] || [];
          delete state.conditions[originalName];
        }
      } else {
        // Creating new Category
        if (state.conditions[newName]) {
          alert('A category with this name already exists!');
          return;
        }
        state.conditions[newName] = [];
      }

      saveLocal();
      renderConditionsList();
      closeAdminModal('condition-category-modal');
      updatePreview();
    });

    // Condition Item Form Submit
    document.getElementById('condition-item-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const category = document.getElementById('condition-item-form-category').value;
      const indexStr = document.getElementById('condition-item-form-index').value;
      const name = document.getElementById('condition-item-form-name').value.trim();

      if (!state.conditions[category]) state.conditions[category] = [];

      if (indexStr !== '') {
        // Editing Item
        const index = parseInt(indexStr);
        state.conditions[category][index] = name;
      } else {
        // Appending Item
        state.conditions[category].push(name);
      }

      saveLocal();
      renderConditionsList();
      closeAdminModal('condition-item-modal');
      updatePreview();
    });
  }

  // --- 12. GitHub API Publishing ---

  async function publishToGithub() {
    const owner = state.clinicInfo.githubUser;
    const repo = state.clinicInfo.githubRepo;
    const token = state.clinicInfo.githubToken;

    if (!owner || !repo || !token) {
      alert('GitHub Configuration Incomplete! Please fill in your Username, Repository name, and Access Token in the Settings panel.');
      return;
    }

    publishBtn.disabled = true;
    publishBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving to GitHub...';
    syncText.textContent = 'Publishing changes...';

    try {
      // Step A: Upload any queued image files
      if (uploadCache.length > 0) {
        syncText.textContent = `Uploading files (0/${uploadCache.length})...`;
        
        for (let i = 0; i < uploadCache.length; i++) {
          const fileToUpload = uploadCache[i];
          syncText.textContent = `Uploading ${fileToUpload.path.split('/').pop()} (${i + 1}/${uploadCache.length})...`;
          
          await uploadFileToGitHub(owner, repo, token, fileToUpload.path, fileToUpload.content);
        }
        
        // Clear queue once fully uploaded
        uploadCache.length = 0;
      }

      // Step B: Fetch the latest SHA of data/data.json (so we can overwrite it)
      syncText.textContent = 'Updating configuration file...';
      const getUrl = `https://api.github.com/repos/${owner}/${repo}/contents/data/data.json`;
      let sha = '';
      
      const getResponse = await fetch(getUrl, {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (getResponse.ok) {
        const fileMeta = await getResponse.json();
        sha = fileMeta.sha;
      }

      // Step C: Push the updated JSON database file
      // Keep githubUser, githubRepo, and githubBranch for public CDN fallback but remove token for security
      const exportState = JSON.parse(JSON.stringify(state));
      exportState.clinicInfo.githubToken = "";

      const jsonStr = JSON.stringify(exportState, null, 2);
      const base64Json = btoa(unescape(encodeURIComponent(jsonStr))); // UTF-8 safe base64 encoding

      const putResponse = await fetch(getUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: 'admin: update website content database via clinic dashboard',
          content: base64Json,
          sha: sha || undefined
        })
      });

      if (!putResponse.ok) {
        const errData = await putResponse.json();
        throw new Error(errData.message || 'Failed to update data.json');
      }

      // Complete Success
      setDirty(false);
      // Keep database in localStorage so the local preview website remains active
      localStorage.removeItem('sukham_upload_cache'); // Clear local upload cache since they are now on GitHub
      alert('Success! Your website updates have been committed to GitHub. GitHub Pages will take 1-2 minutes to redeploy the changes.');
      
    } catch (error) {
      console.error(error);
      alert(`Publishing Failed: ${error.message}. Please verify your Repository name and GitHub Personal Access Token permissions.`);
      setDirty(true);
    } finally {
      publishBtn.disabled = false;
      publishBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Publish to Github';
    }
  }

  // Helpers to push file binary payloads
  async function uploadFileToGitHub(owner, repo, token, path, base64Content) {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    
    // Check if file already exists to get its SHA
    let sha = '';
    const getResp = await fetch(url, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (getResp.ok) {
      const meta = await getResp.json();
      sha = meta.sha;
    }

    const putResp = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `admin: upload asset ${path.split('/').pop()}`,
        content: base64Content,
        sha: sha || undefined
      })
    });

    if (!putResp.ok) {
      const err = await putResp.json();
      throw new Error(`File upload failed: ${err.message}`);
    }
  }

  function downloadConfigJSON() {
    // Create copy of state
    const exportState = JSON.parse(JSON.stringify(state));
    // Remove GitHub tokens for safety before file export
    exportState.clinicInfo.githubUser = "";
    exportState.clinicInfo.githubRepo = "";
    exportState.clinicInfo.githubToken = "";

    const jsonStr = JSON.stringify(exportState, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(jsonStr);
    
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataUri);
    downloadAnchor.setAttribute("download", "data.json");
    document.body.appendChild(downloadAnchor);
    
    downloadAnchor.click();
    downloadAnchor.remove();
  }
});

// Modal Helpers
function openAdminModal(id) {
  document.getElementById(id).classList.add('active');
}

function closeAdminModal(id) {
  document.getElementById(id).classList.remove('active');
}

function compressImage(file, maxWidth, maxHeight, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getCleanUploadPath(file) {
  const cleanName = file.name.replace(/\s+/g, '_').replace(/\.[^/.]+$/, "");
  const ext = file.type.startsWith('image/') ? 'jpg' : file.name.split('.').pop();
  return `assets/uploads/${cleanName}.${ext}`;
}

function isPathInState(obj, path) {
  if (!obj) return false;
  if (typeof obj === 'string') {
    return obj === path;
  }
  if (typeof obj === 'object') {
    for (const key in obj) {
      if (isPathInState(obj[key], path)) {
        return true;
      }
    }
  }
  return false;
}
