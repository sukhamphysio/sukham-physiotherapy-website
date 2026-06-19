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
      renderContactInfo(clinicData.clinicInfo);
      
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
    renderContactInfo(clinicData.clinicInfo);

    // 4. Setup Interactive Handlers
    setupNavigation();
    setupThemeToggle();
    setupCarousels();
    setupGalleryLightbox();
    setupBlogModal(clinicData.blogs);
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
        <a href="#contact" class="service-link">Book Rehab <i class="fa-solid fa-arrow-right"></i></a>
      `;
      grid.appendChild(card);
    });
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
    if (!grid || !doctors) return;
    grid.innerHTML = '';

    doctors.forEach((doctor, index) => {
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
          <div class="social-links" style="margin-top: 20px;">
            ${doctor.facebook ? `<a href="${doctor.facebook}" class="social-icon"><i class="fa-brands fa-facebook-f"></i></a>` : ''}
            ${doctor.instagram ? `<a href="${doctor.instagram}" class="social-icon"><i class="fa-brands fa-instagram"></i></a>` : ''}
            ${doctor.linkedin ? `<a href="${doctor.linkedin}" class="social-icon"><i class="fa-brands fa-linkedin-in"></i></a>` : ''}
          </div>
        </div>
      `;
      grid.appendChild(card);
    });
  }

  function renderTestimonials(testimonies) {
    const track = document.getElementById('testimony-track');
    const dotsContainer = document.getElementById('testimony-dots');
    if (!track || !testimonies) return;
    track.innerHTML = '';
    dotsContainer.innerHTML = '';

    testimonies.forEach((test, idx) => {
      // Create slide
      const slide = document.createElement('div');
      slide.className = 'testimony-slide';
      
      let stars = '';
      for (let i = 0; i < 5; i++) {
        stars += `<i class="${i < test.rating ? 'fa-solid' : 'fa-regular'} fa-star"></i>`;
      }

      slide.innerHTML = `
        <p class="testimony-quote">${test.text}</p>
        <div class="patient-info">
          <div class="patient-rating">${stars}</div>
          <span class="patient-name">${test.name}</span>
          <span class="patient-condition">${test.condition}</span>
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
          <button class="blog-read-btn" data-id="${blog.id}">Read Post <i class="fa-solid fa-angle-right"></i></button>
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

    // Close Menu on Link Click
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('active');
        menuToggle.querySelector('i').className = 'fa-solid fa-bars';
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

  function setupBlogModal(blogs) {
    const modal = document.getElementById('blog-modal');
    const closeBtn = document.getElementById('blog-modal-close');
    const blogsContainer = document.getElementById('blogs-grid');

    if (!modal || !blogsContainer || !blogs) return;

    // Open Blog post
    blogsContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.blog-read-btn');
      if (!btn) return;

      const blogId = btn.dataset.id;
      const blog = blogs.find(b => b.id === blogId);
      if (!blog) return;

      document.getElementById('blog-modal-header').style.backgroundImage = `url('${getLocalUrl(blog.image || 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=800&q=80')}')`;
      document.getElementById('blog-modal-title').textContent = blog.title;
      document.getElementById('blog-modal-meta').innerHTML = `<i class="fa-regular fa-calendar"></i> ${blog.date} | <i class="fa-regular fa-user"></i> ${blog.author || 'Dr. Disha'}`;
      document.getElementById('blog-modal-body').innerHTML = blog.content;

      modal.classList.add('active');
      document.body.style.overflow = 'hidden'; // Lock background scrolling
    });

    // Close Blog post
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
