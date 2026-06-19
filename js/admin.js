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

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const enteredCode = passcodeField.value.trim();
    // Default clinic passcode: sukham@126 (or customizable)
    if (enteredCode === 'sukham12' || enteredCode === 'sukham@12' || enteredCode === 'sukham123') {
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

  function checkSessionAuth() {
    if (sessionStorage.getItem('sukham_admin_logged_in') === 'true') {
      loginOverlay.style.display = 'none';
      loggedIn = true;
      initDashboard();
    }
  }

  // --- 2. Dashboard Initialization ---
  async function initDashboard() {
    // Load database
    try {
      // First try localStorage to recover unsaved sessions
      const cached = localStorage.getItem('sukham_clinic_db');
      if (cached) {
        state = JSON.parse(cached);
        setDirty(true);
      } else {
        const response = await fetch('data/data.json');
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
    return url;
  }

  // --- 6. Local caching and Sync State ---
  function saveLocal() {
    localStorage.setItem('sukham_clinic_db', JSON.stringify(state));
    localStorage.setItem('sukham_upload_cache', JSON.stringify(uploadCache));
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

  function saveGithubConfig() {
    const user = document.getElementById('github-user').value.trim();
    const repo = document.getElementById('github-repo').value.trim();
    const token = document.getElementById('github-token').value.trim();

    localStorage.setItem('sukham_gh_user', user);
    localStorage.setItem('sukham_gh_repo', repo);
    localStorage.setItem('sukham_gh_token', token);

    state.clinicInfo.githubUser = user;
    state.clinicInfo.githubRepo = repo;
    state.clinicInfo.githubToken = token;
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

  // Bind Add Buttons
  document.getElementById('btn-add-doctor').onclick = () => openDoctorModal();
  document.getElementById('btn-add-service').onclick = () => openServiceModal();
  document.getElementById('btn-add-facility').onclick = () => openFacilityModal();
  document.getElementById('btn-add-testimony').onclick = () => openTestimonyModal();
  document.getElementById('btn-add-gallery').onclick = () => openGalleryModal();
  document.getElementById('btn-add-blog').onclick = () => openBlogModal();

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

  function processHeroSlideFile(file, statusDiv) {
    if (!file) return;
    statusDiv.textContent = 'Reading file...';
    const reader = new FileReader();

    reader.onload = function (event) {
      const dataUrl = event.target.result;
      const base64Content = dataUrl.split(',')[1];
      const filename = `hero_${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
      const relativePath = `assets/uploads/${filename}`;

      if (!state.hero.slides) {
        state.hero.slides = [];
      }

      // Add to database array
      state.hero.slides.push(relativePath);

      // Add to upload cache for GitHub push
      uploadCache.push({
        path: relativePath,
        content: base64Content,
        originalUrl: dataUrl
      });

      statusDiv.textContent = `File ready: ${file.name}`;
      saveLocal();
      renderHeroSlidesList();
      updatePreview();
    };

    reader.readAsDataURL(file);
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

  function processFile(file, targetInput, statusDiv) {
    if (!file) return;

    // Show processing
    statusDiv.textContent = 'Reading file...';

    const reader = new FileReader();

    // Store in cache for binary push to GitHub on Save
    reader.onload = function (event) {
      const dataUrl = event.target.result;
      const base64Content = dataUrl.split(',')[1];
      const filename = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
      const relativePath = `assets/uploads/${filename}`;

      // Insert base64 URL directly into the local editor so the live preview renders immediately!
      targetInput.value = relativePath;
      
      // Save base64 payload to uploads queue
      uploadCache.push({
        path: relativePath,
        content: base64Content,
        originalUrl: dataUrl
      });

      // Update state temporarily for local review
      statusDiv.textContent = `File ready: ${file.name}`;
      
      // Dispatch a change event
      targetInput.dispatchEvent(new Event('input'));
    };

    reader.readAsDataURL(file);
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
      // Remove GitHub config tokens from the public repository json for security!
      const exportState = JSON.parse(JSON.stringify(state));
      exportState.clinicInfo.githubUser = "";
      exportState.clinicInfo.githubRepo = "";
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
      localStorage.removeItem('sukham_clinic_db'); // Clear local cache on successful git push
      localStorage.removeItem('sukham_upload_cache'); // Clear local upload cache
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
});

// Modal Helpers
function openAdminModal(id) {
  document.getElementById(id).classList.add('active');
}

function closeAdminModal(id) {
  document.getElementById(id).classList.remove('active');
}
