/* Visitor Website Logic - Sukham Physiotherapy and Rehab */

document.addEventListener('DOMContentLoaded', () => {
  let clinicData = null;
  let uploadCache = [];

  // Load local unsaved uploads if present in browser storage
  try {
    const cacheStr = localStorage.getItem('sukham_upload_cache');
    if (cacheStr) {
      uploadCache = JSON.parse(cacheStr);
    }
  } catch (e) {
    console.warn('Could not parse upload cache from browser storage', e);
  }

  function getLocalUrl(url) {
    if (!url) return url;
    const cached = uploadCache.find(item => item.path === url);
    if (cached) {
      return cached.originalUrl;
    }
    // Fallback to GitHub raw CDN if it's an uploaded asset and we don't have it in local cache
    if (url.startsWith('assets/uploads/')) {
      const user = localStorage.getItem('sukham_gh_user') || (clinicData && clinicData.clinicInfo && clinicData.clinicInfo.githubUser);
      const repo = localStorage.getItem('sukham_gh_repo') || (clinicData && clinicData.clinicInfo && clinicData.clinicInfo.githubRepo);
      const branch = localStorage.getItem('sukham_gh_branch') || 'main';
      if (user && repo) {
        return `https://raw.githubusercontent.com/${user}/${repo}/${branch}/${url}`;
      }
    }
    return url;
  }

  function slugify(text) {
    if (!text) return '';
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  // Initialize Website
  init();

  // Listen for Live Preview updates from Admin Panel
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'UPDATE_DATA') {
      const updatedData = event.data.data;
      clinicData = updatedData;
      
      // Re-apply and re-render
      applyThemeColors(clinicData.theme);
      renderNavbarAndFooter(clinicData.clinicInfo);
      renderHero(clinicData.hero, clinicData.clinicInfo);
      renderServices(clinicData.services);
      renderFacilities(clinicData.facilities);
      renderDoctors(clinicData.doctors);
      renderTestimonials(clinicData.testimonies);
      renderGallery(clinicData.gallery);
      renderBlogs(clinicData.blogs);
      renderFAQs(clinicData.faqs);
      renderContactInfo(clinicData.clinicInfo);
      renderConditions(clinicData.conditions);
      
      // Re-initialize carousels and reveals
      setupCarousels();
      setupScrollReveals();
    }
  });

  async function init() {
    // 1. Load Data
    try {
      // Prioritize local unsaved database from local storage if running on localhost
      const cachedData = localStorage.getItem('sukham_clinic_db');
      const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (isLocalHost && cachedData) {
        clinicData = JSON.parse(cachedData);
        console.log('Loaded local unsaved database from browser cache.');
      } else {
        const response = await fetch(`data/data.json?t=${Date.now()}`);
        if (!response.ok) throw new Error('Failed to load JSON');
        clinicData = await response.json();
      }
    } catch (e) {
      console.warn('Could not load data/data.json, falling back to config-default.js', e);
      // Fallback is loaded globally in index.html via js/config-default.js
      clinicData = window.DEFAULT_CLINIC_DATA;
    }

    if (!clinicData) return;

    // 2. Apply Custom Theme
    applyThemeColors(clinicData.theme);

    // 3. Render Sections
    renderNavbarAndFooter(clinicData.clinicInfo);
    renderHero(clinicData.hero, clinicData.clinicInfo);
    renderServices(clinicData.services);
    renderFacilities(clinicData.facilities);
    renderDoctors(clinicData.doctors);
    renderTestimonials(clinicData.testimonies);
    renderGallery(clinicData.gallery);
    renderBlogs(clinicData.blogs);
    renderFAQs(clinicData.faqs);
    renderContactInfo(clinicData.clinicInfo);
    renderConditions(clinicData.conditions);

    // 4. Setup Interactive Handlers
    setupNavigation();
    setupThemeToggle();
    setupCarousels();
    setupGalleryLightbox();
    setupConditionsModal();
    setupScrollReveals();
    setupContactForm(clinicData.clinicInfo);
  }

  // --- 2. Color Variable Mapping ---
  function applyThemeColors(theme) {
    if (!theme) return;
    const root = document.documentElement;
    root.style.setProperty('--primary-color', theme.primaryColor);
    root.style.setProperty('--secondary-color', theme.secondaryColor);
    root.style.setProperty('--accent-color', theme.accentColor);
    
    // Convert hex to rgb for opacity-dependent styling
    const hexToRgb = (hex) => {
      let c;
      if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
        c = hex.substring(1).split('');
        if (c.length == 3) {
          c = [c[0], c[0], c[1], c[1], c[2], c[2]];
        }
        c = '0x' + c.join('');
        return [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(', ');
      }
      return '93, 43, 126'; // Default fallback purple RGB
    };

    root.style.setProperty('--primary-rgb', hexToRgb(theme.primaryColor));
    root.style.setProperty('--secondary-rgb', hexToRgb(theme.secondaryColor));
    root.style.setProperty('--accent-rgb', hexToRgb(theme.accentColor));
  }

  // --- 3. Dynamic Rendering Functions ---
  
  function renderNavbarAndFooter(info) {
    if (!info) return;
    
    // Nav elements
    document.getElementById('nav-clinic-name').textContent = info.name.split(' ')[0];
    document.getElementById('nav-clinic-sub').textContent = info.name.split(' ').slice(1).join(' ');
    document.getElementById('nav-cta-btn').href = `https://wa.me/91${info.phone}?text=${encodeURIComponent(info.whatsappText)}`;
    
    if (info.logoUrl) {
      document.getElementById('nav-logo').src = getLocalUrl(info.logoUrl);
    }

    // Footer elements
    document.getElementById('footer-clinic-name').textContent = info.name;
    document.getElementById('footer-clinic-desc').textContent = info.tagline || `Advanced rehabilitation and customized care designed to restore your movement and wellness.`;
    document.getElementById('info-address').textContent = info.address;
    document.getElementById('info-phone').textContent = info.phone;
    document.getElementById('info-phone').href = `tel:${info.phone}`;
    document.getElementById('info-timing').innerHTML = info.workingHours.replace(/\|/g, '<br>');
  }

  function renderHero(hero, info) {
    if (!hero) return;
    
    document.getElementById('hero-title-text').innerHTML = hero.title;
    document.getElementById('hero-desc-text').textContent = hero.description;
    
    if (hero.badgeText) {
      document.getElementById('hero-badge-tag').innerHTML = `<i class="fa-solid fa-user-doctor"></i> ${hero.badgeText}`;
    } else if (info) {
      document.getElementById('hero-badge-tag').innerHTML = `<i class="fa-solid fa-user-doctor"></i> ${info.name}`;
    }

    if (hero.ctaText) {
      document.getElementById('hero-cta-primary').textContent = hero.ctaText;
    }

    // Setup Slideshow Images
    const sliderContainer = document.getElementById('hero-slider');
    sliderContainer.innerHTML = '';
    
    const slides = hero.slides && hero.slides.length > 0 ? hero.slides : [
      "https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=1200&q=80"
    ];

    slides.forEach((slideUrl, idx) => {
      const slideDiv = document.createElement('div');
      slideDiv.className = `hero-slide ${idx === 0 ? 'active' : ''}`;
      slideDiv.style.backgroundImage = `url('${getLocalUrl(slideUrl)}')`;
      sliderContainer.appendChild(slideDiv);
    });

    // Start Hero Carousel Slideshow Timer
    let currentSlide = 0;
    const allSlides = sliderContainer.querySelectorAll('.hero-slide');
    if (allSlides.length > 1) {
      setInterval(() => {
        allSlides[currentSlide].classList.remove('active');
        currentSlide = (currentSlide + 1) % allSlides.length;
        allSlides[currentSlide].classList.add('active');
      }, 6000); // Transitions every 6 seconds
    }
  }

  function renderServices(services) {
    const grid = document.getElementById('services-grid');
    if (!grid || !services) return;
    grid.innerHTML = '';

    services.forEach((service, index) => {
      const card = document.createElement('div');
      card.className = 'service-card reveal';
      card.style.transitionDelay = `${(index % 3) * 0.1}s`;
      card.innerHTML = `
        <div class="service-icon">${service.icon || '🩺'}</div>
        <h3 class="service-title">${service.title}</h3>
        <p class="service-desc">${service.desc}</p>
        <a href="treatment.html?id=${slugify(service.title)}" class="service-link">Learn More <i class="fa-solid fa-arrow-right"></i></a>
      `;
      grid.appendChild(card);
    });

    // Mobile swipe-to-end CTA Card (View All Conditions)
    const viewAllCard = document.createElement('div');
    viewAllCard.className = 'service-card view-all-card reveal';
    viewAllCard.style.transitionDelay = `${(services.length % 3) * 0.1}s`;
    viewAllCard.innerHTML = `
      <div class="service-icon"><i class="fa-solid fa-notes-medical" style="color: var(--accent-color);"></i></div>
      <h3 class="service-title">Looking for a specific condition?</h3>
      <p class="service-desc">We treat over 100+ conditions including TMJ, sciatica, sports injuries, and spinal pain.</p>
      <button class="btn btn-accent btn-sm" id="btn-view-conditions-mobile" style="margin-top: 15px; width: 100%;">
        View All Conditions
      </button>
    `;
    grid.appendChild(viewAllCard);
  }

  function renderFacilities(facilities) {
    const track = document.getElementById('facility-track');
    if (!track || !facilities) return;
    track.innerHTML = '';

    facilities.forEach(item => {
      const card = document.createElement('div');
      card.className = 'facility-card';
      card.innerHTML = `
        <div class="facility-img-wrapper">
          <img src="${getLocalUrl(item.image || 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=600&q=80')}" alt="${item.name}" class="facility-img" loading="lazy">
          <span class="facility-tag">${item.category}</span>
        </div>
        <div class="facility-info">
          <h3 class="facility-name">${item.name}</h3>
          <p class="facility-desc">${item.desc}</p>
        </div>
      `;
      track.appendChild(card);
    });
  }

  function renderDoctors(doctors) {
    const grid = document.getElementById('doctors-grid');
    const supportGrid = document.getElementById('support-team-grid');
    if (!doctors) return;

    if (grid) grid.innerHTML = '';
    if (supportGrid) supportGrid.innerHTML = '';

    const medicalTeam = doctors.filter(d => d.category === 'medical' || !d.category);
    const supportTeam = doctors.filter(d => d.category === 'support');

    const supportSection = document.getElementById('support-staff-section');
    if (supportSection) {
      supportSection.style.display = supportTeam.length > 0 ? 'block' : 'none';
    }

    if (grid) {
      medicalTeam.forEach((doctor, index) => {
        const card = document.createElement('div');
        card.className = 'doctor-card reveal';
        card.style.transitionDelay = `${index * 0.1}s`;
        
        const genderIcon = doctor.gender === 'Female' ? 'fa-venus' : 'fa-mars';
        
        let specBadges = '';
        if (doctor.specialties) {
          doctor.specialties.forEach(spec => {
            specBadges += `<span class="spec-badge">${spec}</span>`;
          });
        }

        card.innerHTML = `
          <div class="doctor-img-wrapper">
            <img src="${getLocalUrl(doctor.image || 'assets/logo.jpg')}" alt="${doctor.name}" class="doctor-img" loading="lazy">
            <div class="doctor-overlay">
              <h3 class="doctor-name">${doctor.name} <span style="font-size: 15px;"><i class="fa-solid ${genderIcon}"></i></span></h3>
              <span class="doctor-title">${doctor.title}</span>
            </div>
          </div>
          <div class="doctor-details">
            <p class="doctor-bio">${doctor.bio}</p>
            <div class="doctor-specialties">
              ${specBadges}
            </div>
            <div style="margin-top: 15px; display: flex; justify-content: space-between; align-items: center;">
              <a href="doctor.html?id=${slugify(doctor.name)}" class="btn btn-primary btn-sm" style="font-size: 12px; padding: 6px 12px;">View Profile</a>
              <div class="social-links" style="margin: 0; display: flex; gap: 8px;">
                ${doctor.facebook ? `<a href="${doctor.facebook}" class="social-icon" style="width:30px; height:30px; font-size:12px; margin:0;"><i class="fa-brands fa-facebook-f"></i></a>` : ''}
                ${doctor.instagram ? `<a href="${doctor.instagram}" class="social-icon" style="width:30px; height:30px; font-size:12px; margin:0;"><i class="fa-brands fa-instagram"></i></a>` : ''}
              </div>
            </div>
          </div>
        `;
        grid.appendChild(card);
      });
    }

    if (supportGrid) {
      supportTeam.forEach((doctor, index) => {
        const card = document.createElement('div');
        card.className = 'doctor-card reveal';
        card.style.transitionDelay = `${index * 0.1}s`;
        
        card.innerHTML = `
          <div class="doctor-img-wrapper">
            <img src="${getLocalUrl(doctor.image || 'assets/logo.jpg')}" alt="${doctor.name}" class="doctor-img" loading="lazy">
            <div class="doctor-overlay">
              <h3 class="doctor-name">${doctor.name}</h3>
              <span class="doctor-title">${doctor.title}</span>
            </div>
          </div>
          <div class="doctor-details">
            <p class="doctor-bio">${doctor.bio}</p>
            <div class="social-links" style="margin-top: 15px; display: flex; gap: 8px;">
              ${doctor.facebook ? `<a href="${doctor.facebook}" class="social-icon"><i class="fa-brands fa-facebook-f"></i></a>` : ''}
              ${doctor.instagram ? `<a href="${doctor.instagram}" class="social-icon"><i class="fa-brands fa-instagram"></i></a>` : ''}
            </div>
          </div>
        `;
        supportGrid.appendChild(card);
      });
    }
  }

  function renderTestimonials(testimonies) {
    const track = document.getElementById('testimony-track');
    const dotsContainer = document.getElementById('testimony-dots');
    if (!track || !testimonies) return;
    track.innerHTML = '';
    dotsContainer.innerHTML = '';

    const getAvatarColor = (name) => {
      const colors = [
        '#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5',
        '#2196F3', '#03A9F4', '#00BCD4', '#009688', '#4CAF50',
        '#8BC34A', '#CDDC39', '#FFC107', '#FF9800', '#FF5722',
        '#795548', '#607D8B'
      ];
      let hash = 0;
      for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
      }
      return colors[Math.abs(hash) % colors.length];
    };

    testimonies.forEach((test, idx) => {
      // Create slide
      const slide = document.createElement('div');
      slide.className = 'testimony-slide';
      
      let stars = '';
      for (let i = 0; i < 5; i++) {
        stars += `<i class="${i < test.rating ? 'fa-solid' : 'fa-regular'} fa-star"></i>`;
      }

      const initial = test.name ? test.name.trim().charAt(0).toUpperCase() : 'P';
      const bgColor = getAvatarColor(test.name || 'Patient');

      slide.innerHTML = `
        <div class="testimony-card">
          <div class="google-review-header">
            <div class="google-review-avatar" style="background-color: ${bgColor};">
              ${initial}
            </div>
            <div class="google-review-user-info">
              <h4 class="google-review-name">${test.name}</h4>
              <div class="google-review-meta">
                <span class="google-review-badge"><i class="fa-brands fa-google"></i> Verified Google Review</span>
                ${test.date ? `<span class="google-review-date">• ${test.date}</span>` : ''}
              </div>
            </div>
          </div>
          <div class="patient-rating" style="margin-bottom: 15px;">${stars}</div>
          <p class="testimony-quote">${test.text}</p>
          <span class="patient-condition" style="display: inline-block; margin-top: 10px; font-size:12px; font-weight:700; color:var(--accent-color);">Treated for: ${test.condition}</span>
        </div>
      `;
      track.appendChild(slide);

      // Create dot
      const dot = document.createElement('span');
      dot.className = `testimony-dot ${idx === 0 ? 'active' : ''}`;
      dot.dataset.slide = idx;
      dotsContainer.appendChild(dot);
    });
  }

  function renderGallery(gallery) {
    const grid = document.getElementById('gallery-grid');
    if (!grid || !gallery) return;
    grid.innerHTML = '';

    gallery.forEach((item, index) => {
      const box = document.createElement('div');
      box.className = `gallery-item reveal`;
      box.dataset.category = item.category;
      box.dataset.index = index;
      box.style.transitionDelay = `${(index % 4) * 0.08}s`;

      const isVideo = item.type === 'video' || (item.url && item.url.includes('.mp4'));
      const localUrl = getLocalUrl(item.url);
      const mediaTag = isVideo 
        ? `<video src="${localUrl}" class="gallery-media" muted loop playsinline></video>`
        : `<img src="${localUrl}" alt="${item.title}" class="gallery-media" loading="lazy">`;

      const typeIcon = isVideo ? 'fa-play' : 'fa-magnifying-glass-plus';
      const typeText = isVideo ? 'Video Tour' : 'Treatment Photo';

      box.innerHTML = `
        ${mediaTag}
        <div class="gallery-item-overlay">
          <div class="gallery-item-icon"><i class="fa-solid ${typeIcon}"></i></div>
          <h4 class="gallery-item-title">${item.title}</h4>
          <span class="gallery-item-type">${typeText}</span>
        </div>
      `;
      grid.appendChild(box);
    });
  }

  function renderBlogs(blogs) {
    const grid = document.getElementById('blogs-grid');
    if (!grid || !blogs) return;
    grid.innerHTML = '';

    const sortedBlogs = [...blogs].slice(0, 3); // Max 3 on landing page

    sortedBlogs.forEach((blog, index) => {
      const card = document.createElement('div');
      card.className = 'blog-card reveal';
      card.style.transitionDelay = `${index * 0.1}s`;
      card.innerHTML = `
        <div class="blog-img-wrapper">
          <img src="${getLocalUrl(blog.image || 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=600&q=80')}" alt="${blog.title}" class="blog-img" loading="lazy">
        </div>
        <div class="blog-content">
          <div class="blog-meta">
            <span><i class="fa-regular fa-calendar"></i> ${blog.date}</span>
            <span><i class="fa-regular fa-user"></i> ${blog.author || 'Dr. Disha'}</span>
          </div>
          <h3 class="blog-title">${blog.title}</h3>
          <p class="blog-excerpt">${blog.excerpt}</p>
          <a href="blog.html?id=${blog.id}" class="blog-read-btn" style="text-align: center; justify-content: center; display: inline-flex;">Read Post <i class="fa-solid fa-angle-right"></i></a>
        </div>
      `;
      grid.appendChild(card);
    });
  }

  function renderContactInfo(info) {
    if (!info) return;
    if (info.mapEmbed) {
      document.getElementById('map-iframe').src = info.mapEmbed;
    }
  }

  function renderFAQs(faqs) {
    const container = document.getElementById('faq-accordion');
    if (!container) return;
    container.innerHTML = '';

    if (!faqs || faqs.length === 0) {
      const section = document.getElementById('faqs');
      if (section) section.style.display = 'none';
      return;
    } else {
      const section = document.getElementById('faqs');
      if (section) section.style.display = '';
    }

    const schema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": []
    };

    faqs.forEach((faq, index) => {
      const item = document.createElement('div');
      item.className = 'faq-item';
      if (index >= 3) {
        item.style.display = 'none';
      }
      item.innerHTML = `
        <button class="faq-question" aria-expanded="false">
          <span>${faq.question}</span>
          <i class="fa-solid fa-chevron-down faq-icon"></i>
        </button>
        <div class="faq-answer">
          <div class="faq-answer-content">
            <p>${faq.answer}</p>
          </div>
        </div>
      `;
      container.appendChild(item);

      schema.mainEntity.push({
        "@type": "Question",
        "name": faq.question,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": faq.answer
        }
      });
    });

    const questions = container.querySelectorAll('.faq-question');
    questions.forEach(q => {
      q.addEventListener('click', () => {
        const isExpanded = q.getAttribute('aria-expanded') === 'true';
        questions.forEach(otherQ => {
          if (otherQ !== q) {
            otherQ.setAttribute('aria-expanded', 'false');
            otherQ.nextElementSibling.style.maxHeight = null;
          }
        });
        q.setAttribute('aria-expanded', !isExpanded);
        const answer = q.nextElementSibling;
        if (!isExpanded) {
          answer.style.maxHeight = answer.scrollHeight + 'px';
        } else {
          answer.style.maxHeight = null;
        }
      });
    });

    // Handle View All Button
    const actionContainer = document.getElementById('faq-action-container');
    if (actionContainer) {
      actionContainer.innerHTML = '';
      if (faqs.length > 3) {
        actionContainer.innerHTML = `<button class="btn btn-secondary" id="btn-toggle-faqs" style="min-width: 200px;">View All FAQs <i class="fa-solid fa-chevron-right" style="margin-left:8px;"></i></button>`;
        
        const toggleBtn = document.getElementById('btn-toggle-faqs');
        if (toggleBtn) {
          toggleBtn.addEventListener('click', () => {
            window.location.href = 'faqs.html';
          });
        }
      }
    }

    let scriptTag = document.getElementById('faq-schema-jsonld');
    if (!scriptTag) {
      scriptTag = document.createElement('script');
      scriptTag.id = 'faq-schema-jsonld';
      scriptTag.type = 'application/ld+json';
      document.head.appendChild(scriptTag);
    }
    scriptTag.text = JSON.stringify(schema);
  }

  function renderConditions(conditions) {
    const grid = document.getElementById('conditions-modal-grid');
    if (!grid || !conditions) return;
    grid.innerHTML = '';

    const getIcon = (cat) => {
      const key = cat.toLowerCase();
      if (key.includes('head') || key.includes('jaw')) return 'fa-solid fa-head-side-virus';
      if (key.includes('neck')) return 'fa-solid fa-user';
      if (key.includes('shoulder')) return 'fa-solid fa-child-reaching';
      if (key.includes('elbow')) return 'fa-solid fa-bone';
      if (key.includes('wrist') || key.includes('hand')) return 'fa-solid fa-hand';
      if (key.includes('back') || key.includes('chest')) return 'fa-solid fa-align-justify';
      if (key.includes('hip')) return 'fa-solid fa-person-walking';
      if (key.includes('knee')) return 'fa-solid fa-person-walking-dashed-line';
      if (key.includes('leg')) return 'fa-solid fa-person-running';
      if (key.includes('ankle') || key.includes('foot')) return 'fa-solid fa-shoe-prints';
      if (key.includes('sports')) return 'fa-solid fa-dumbbell';
      return 'fa-solid fa-notes-medical';
    };

    Object.keys(conditions).forEach(cat => {
      const items = conditions[cat];
      const card = document.createElement('div');
      card.className = 'conditions-modal-category';
      
      const listHtml = items.map(item => `
        <li class="conditions-modal-item">
          <i class="fa-solid fa-circle-check"></i>
          <span>${item}</span>
        </li>
      `).join('');

      card.innerHTML = `
        <h4 class="conditions-modal-category-title">
          <i class="${getIcon(cat)}" style="color: var(--accent-color);"></i>
          <span>${cat}</span>
        </h4>
        <ul class="conditions-modal-list">
          ${listHtml}
        </ul>
      `;
      grid.appendChild(card);
    });
  }

  // --- 4. Interactive Scripts & Event Handlers ---
  
  function setupNavigation() {
    const navbar = document.getElementById('navbar');
    const menuToggle = document.getElementById('menu-toggle');
    const navMenu = document.getElementById('nav-menu');
    const navLinks = document.querySelectorAll('.nav-link');
    
    // Scrolled Navbar class
    window.addEventListener('scroll', () => {
      if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
      
      // Active link highlighting
      let currentSectionId = '';
      const sections = document.querySelectorAll('section');
      sections.forEach(sec => {
        const top = sec.offsetTop - 120;
        const bottom = top + sec.offsetHeight;
        if (window.scrollY >= top && window.scrollY < bottom) {
          currentSectionId = sec.getAttribute('id');
        }
      });
      
      if (currentSectionId) {
        navLinks.forEach(link => {
          link.classList.remove('active');
          if (link.getAttribute('href') === `#${currentSectionId}`) {
            link.classList.add('active');
          }
        });
      }
    });

    // Mobile Hamburger Toggle
    menuToggle.addEventListener('click', () => {
      navMenu.classList.toggle('active');
      const icon = menuToggle.querySelector('i');
      if (navMenu.classList.contains('active')) {
        icon.className = 'fa-solid fa-xmark';
      } else {
        icon.className = 'fa-solid fa-bars';
      }
    });

    // Close Menu & Custom Smooth Scroll on Link Click
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        if (href.startsWith('#')) {
          e.preventDefault();
          const targetId = href.substring(1);
          const targetSection = document.getElementById(targetId);
          if (targetSection) {
            // Close mobile menu
            navMenu.classList.remove('active');
            const menuIcon = menuToggle.querySelector('i');
            if (menuIcon) menuIcon.className = 'fa-solid fa-bars';

            // Wait a short moment for menu collapse to stabilize layout offsets
            setTimeout(() => {
              const navbarHeight = navbar.offsetHeight || 80;
              const targetTop = targetSection.offsetTop - navbarHeight;
              window.scrollTo({
                top: targetTop,
                behavior: 'smooth'
              });
            }, 150);
          }
        }
      });
    });
  }

  function setupThemeToggle() {
    const themeBtn = document.getElementById('theme-toggle');
    
    // Check saved theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.className = `${savedTheme}-theme`;
    updateToggleIcon(savedTheme);

    themeBtn.addEventListener('click', () => {
      let newTheme = 'light';
      if (document.body.classList.contains('light-theme')) {
        newTheme = 'dark';
      }
      document.body.className = `${newTheme}-theme`;
      localStorage.setItem('theme', newTheme);
      updateToggleIcon(newTheme);
    });

    function updateToggleIcon(theme) {
      const icon = themeBtn.querySelector('i');
      if (theme === 'dark') {
        icon.className = 'fa-solid fa-sun';
      } else {
        icon.className = 'fa-solid fa-moon';
      }
    }
  }

  function setupCarousels() {
    // 1. Facilities Horizontal Scroll Carousel
    const track = document.getElementById('facility-track');
    const prevBtn = document.getElementById('facility-prev');
    const nextBtn = document.getElementById('facility-next');
    
    if (track && prevBtn && nextBtn) {
      let scrollAmount = 0;
      const step = 410; // Card width 380 + gap 30
      
      nextBtn.addEventListener('click', () => {
        const maxScroll = track.scrollWidth - track.clientWidth;
        scrollAmount = Math.min(scrollAmount + step, maxScroll);
        track.style.transform = `translateX(-${scrollAmount}px)`;
      });
      
      prevBtn.addEventListener('click', () => {
        scrollAmount = Math.max(scrollAmount - step, 0);
        track.style.transform = `translateX(-${scrollAmount}px)`;
      });
    }

    // 2. Testimonials Slide Carousel
    const testTrack = document.getElementById('testimony-track');
    const dots = document.querySelectorAll('.testimony-dot');
    
    if (testTrack && dots.length > 0) {
      let currentIdx = 0;

      const slideTo = (idx) => {
        testTrack.style.transform = `translateX(-${idx * 100}%)`;
        dots.forEach(d => d.classList.remove('active'));
        dots[idx].classList.add('active');
        currentIdx = idx;
      };

      dots.forEach(dot => {
        dot.addEventListener('click', () => {
          slideTo(parseInt(dot.dataset.slide));
        });
      });

      // Auto rotation every 8 seconds
      setInterval(() => {
        let nextIdx = (currentIdx + 1) % dots.length;
        slideTo(nextIdx);
      }, 8000);
    }
  }

  function setupGalleryLightbox() {
    const grid = document.getElementById('gallery-grid');
    const filters = document.getElementById('gallery-filters');
    const lightbox = document.getElementById('lightbox');
    const closeBtn = document.getElementById('lightbox-close');
    const mediaContainer = document.getElementById('lightbox-media-container');
    const captionText = document.getElementById('lightbox-caption');

    if (!grid || !lightbox) return;

    // Filter Items Logic
    if (filters) {
      const filterBtns = filters.querySelectorAll('.gallery-filter-btn');
      filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          filterBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');

          const category = btn.dataset.filter;
          const items = grid.querySelectorAll('.gallery-item');
          
          items.forEach(item => {
            if (category === 'all' || item.dataset.category === category) {
              item.style.display = 'block';
              setTimeout(() => item.classList.add('active'), 50);
            } else {
              item.style.display = 'none';
              item.classList.remove('active');
            }
          });
        });
      });
    }

    // Open Lightbox
    grid.addEventListener('click', (e) => {
      const item = e.target.closest('.gallery-item');
      if (!item) return;

      const idx = parseInt(item.dataset.index);
      const mediaItem = clinicData.gallery[idx];
      if (!mediaItem) return;

      mediaContainer.innerHTML = '';
      
      const isVideo = mediaItem.type === 'video' || mediaItem.url.includes('.mp4');
      const localUrl = getLocalUrl(mediaItem.url);
      if (isVideo) {
        mediaContainer.innerHTML = `<video src="${localUrl}" class="lightbox-video" controls autoplay></video>`;
      } else {
        mediaContainer.innerHTML = `<img src="${localUrl}" alt="${mediaItem.title}" class="lightbox-img">`;
      }

      captionText.textContent = mediaItem.desc || mediaItem.title;
      lightbox.classList.add('active');
      document.body.style.overflow = 'hidden'; // Lock background scrolling
    });

    // Close Lightbox
    const closeLightbox = () => {
      lightbox.classList.remove('active');
      mediaContainer.innerHTML = '';
      document.body.style.overflow = '';
    };

    closeBtn.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) closeLightbox();
    });
  }

  function setupConditionsModal() {
    const modal = document.getElementById('conditions-modal');
    const closeBtn = document.getElementById('conditions-modal-close');

    if (!modal) return;

    // Document-level delegation to support dynamically rendered mobile button
    document.addEventListener('click', (e) => {
      const openBtn = e.target.closest('#btn-view-conditions, #btn-view-conditions-mobile');
      if (openBtn) {
        e.preventDefault();
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
    });

    const closeModal = () => {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    };

    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  function setupScrollReveals() {
    const revealElements = document.querySelectorAll('.reveal');
    
    if ('IntersectionObserver' in window && revealElements.length > 0) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('active');
            observer.unobserve(entry.target); // Trigger once
          }
        });
      }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
      });

      revealElements.forEach(el => observer.observe(el));
    } else {
      // Fallback if no observer support
      revealElements.forEach(el => el.classList.add('active'));
    }
  }

  function setupContactForm(info) {
    const form = document.getElementById('clinic-contact-form');
    if (!form || !info) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const name = document.getElementById('contact-name').value;
      const phone = document.getElementById('contact-phone').value;
      const service = document.getElementById('contact-service').value;
      const message = document.getElementById('contact-message').value;

      // Show success
      document.getElementById('contact-form-success').style.display = 'block';
      form.reset();

      // Trigger WhatsApp API direct dispatch
      const template = `Appointment Request:\n- Name: ${name}\n- Phone: ${phone}\n- Treatment: ${service}\n- Note: ${message}`;
      const url = `https://wa.me/91${info.phone}?text=${encodeURIComponent(template)}`;
      
      setTimeout(() => {
        window.open(url, '_blank');
      }, 800);
    });
  }
});
