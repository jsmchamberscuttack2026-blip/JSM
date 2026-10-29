// main.js - Global Interactions for JSM. Chambers

window.toggleMobileMenu = function() {
  const navLinks = document.getElementById('navLinks');
  const menuBtn = document.getElementById('mobileMenuBtn');
  if (!navLinks) return;
  const isOpen = navLinks.classList.toggle('open');
  if (menuBtn) {
    menuBtn.classList.toggle('active', isOpen);
    menuBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  }
};

window.closeMobileMenu = function() {
  const navLinks = document.getElementById('navLinks');
  const menuBtn = document.getElementById('mobileMenuBtn');
  if (navLinks) {
    navLinks.classList.remove('open');
  }
  if (menuBtn) {
    menuBtn.classList.remove('active');
    menuBtn.setAttribute('aria-expanded', 'false');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  // Smooth Scrolling for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href && href !== '#' && href.startsWith('#')) {
        const target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({
            behavior: 'smooth'
          });
        }
      }
      // Always close mobile menu on click
      window.closeMobileMenu();
    });
  });

  // Case Status Search Logic
  const caseSearchForm = document.getElementById('case-search-form');
  const caseSearchResult = document.getElementById('case-search-result');

  if(caseSearchForm) {
    caseSearchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const caseNumber = document.getElementById('case-number').value.trim();
      const year = document.getElementById('case-year').value.trim();

      if(caseNumber && year) {
        // Show loading state simulation
        caseSearchForm.querySelector('button').textContent = "Searching...";
        
        setTimeout(() => {
          caseSearchForm.querySelector('button').textContent = "Check Status";
          caseSearchResult.className = 'search-result success';
          caseSearchResult.innerHTML = `
            <strong>Case Details:</strong><br>
            Case: ${caseNumber}/${year}<br>
            Status: <strong>Pending Hearing</strong><br>
            Next Date: 25-09-2026<br>
            <em></em>
          `;
        }, 800);
      }
    });
  }

  // CNR Search Logic
  const cnrSearchForm = document.getElementById('cnr-search-form');
  const cnrSearchResult = document.getElementById('cnr-search-result');

  if(cnrSearchForm) {
    cnrSearchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const cnrNumber = document.getElementById('cnr-number').value.trim();

      if(cnrNumber.length >= 10) {
        cnrSearchForm.querySelector('button').textContent = "Searching...";
        
        setTimeout(() => {
          cnrSearchForm.querySelector('button').textContent = "Search CNR";
          cnrSearchResult.className = 'search-result success';
          cnrSearchResult.innerHTML = `
            <strong>Case Details:</strong><br>
            CNR: ${cnrNumber}<br>
            Petitioner: Rahul S. (Sample)<br>
            Respondent: State (Sample)<br>
            <em></em>
          `;
        }, 800);
      } else {
        cnrSearchResult.className = 'search-result error';
        cnrSearchResult.innerHTML = 'Please enter a valid 16-digit CNR Number.';
      }
    });
  }

  // Handle Appointment Form Submission using API
  const appForm = document.getElementById('appointment-form');
  if(appForm) {
    appForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const name = document.getElementById('app-name').value;
      const email = document.getElementById('app-email').value;
      const service = document.getElementById('app-service').value;
      
      const button = document.getElementById("appointmentBtn");
      const processing = document.getElementById("processing");
      const success = document.getElementById("success");
      
      if (button) button.style.display = "none";
      if (processing) processing.style.display = "block";
      
      try {
          const response = await fetch('/api/appointments', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name, email, service })
          });
          
          if (response.ok) {
              if (processing) processing.style.display = "none";
              if (success) success.style.display = "block";
              
              const nameParent = document.getElementById('app-name').parentElement;
              const emailParent = document.getElementById('app-email').parentElement;
              const serviceParent = document.getElementById('app-service').parentElement;
              
              if(nameParent) nameParent.style.display = 'none';
              if(emailParent) emailParent.style.display = 'none';
              if(serviceParent) serviceParent.style.display = 'none';
          } else {
              alert('Failed to submit request.');
              if (button) button.style.display = "block";
              if (processing) processing.style.display = "none";
          }
      } catch (err) {
          console.error(err);
          alert('Server error. Please try again.');
          if (button) button.style.display = "block";
          if (processing) processing.style.display = "none";
      }
    });
  }

  // Load Dynamic Office Information & Settings
  fetch('/api/settings').then(res => {
      if (res.status === 503) {
          window.location.reload();
          return null;
      }
      return res.json();
  }).then(info => {
      if (!info) return;
      if (info.under_maintenance || info.public_page_status === 'off' || info.public_website_enabled === false) {
          window.location.reload();
          return;
      }
      window.siteSettingsData = info;
      
      // Dynamic Homepage Hero Banner Image
      const bannerBg = document.getElementById('hero-banner-bg');
      if (bannerBg) {
          if (info.hero_banner_image) {
              bannerBg.style.backgroundImage = `url('${info.hero_banner_image}')`;
          } else {
              bannerBg.style.backgroundImage = `url('assets/images/default_chamber_banner.jpg')`;
          }
      }

      // Dynamic Legal Expertise Banner Image
      const expBannerBg = document.getElementById('expertise-banner-bg');
      if (expBannerBg) {
          if (info.expertise_banner_image) {
              expBannerBg.style.backgroundImage = `url('${info.expertise_banner_image}')`;
          } else {
              expBannerBg.style.backgroundImage = `url('assets/images/default_chamber_banner.jpg')`;
          }
      }

      // Dynamic Staffs Banner Image
      const staffBannerBg = document.getElementById('staff-banner-bg');
      if (staffBannerBg) {
          if (info.staff_banner_image) {
              staffBannerBg.style.backgroundImage = `url('${info.staff_banner_image}')`;
          } else {
              staffBannerBg.style.backgroundImage = `url('assets/images/default_chamber_banner.jpg')`;
          }
      }

      // Dynamic Google Search Console Verification Meta Tag
      if (info.google_site_verification && info.google_site_verification.trim()) {
          const raw = info.google_site_verification.trim();
          let cleanToken = raw;
          const match = raw.match(/content=["']([^"']+)["']/);
          if (match) {
              cleanToken = match[1];
          } else if (raw.includes('google-site-verification=')) {
              cleanToken = raw.split('google-site-verification=')[1].trim();
          }
          let meta = document.getElementById('google-site-verification-meta');
          if (!meta) {
              meta = document.createElement('meta');
              meta.name = 'google-site-verification';
              meta.id = 'google-site-verification-meta';
              document.head.appendChild(meta);
          }
          meta.content = cleanToken;
      }

      // Dynamic About This Chamber Document Content
      const ownerImgUrl = info.about_chamber_owner_image || info.about_chamber_image1;
      if (ownerImgUrl) {
          const ownerImg = document.getElementById('about-doc-owner-img');
          if (ownerImg) ownerImg.src = ownerImgUrl;
      }

      if (info.about_chamber_owner_name && info.about_chamber_owner_name.trim()) {
          const ownerNameEl = document.getElementById('about-doc-owner-name');
          if (ownerNameEl) ownerNameEl.innerText = info.about_chamber_owner_name.trim();
      }
      if (info.about_chamber_vision && info.about_chamber_vision.trim()) {
          const visionEl = document.getElementById('about-doc-vision');
          if (visionEl) visionEl.innerText = info.about_chamber_vision.trim();
      }
      if (info.about_chamber_text && info.about_chamber_text.trim()) {
          const textEl = document.getElementById('about-doc-text');
          if (textEl) textEl.innerText = info.about_chamber_text.trim();
          const bannerDesc = document.getElementById('about-banner-short-desc');
          if (bannerDesc) bannerDesc.innerText = info.about_chamber_text.trim();
      }
      if (ownerImgUrl) {
          const bannerBg = document.getElementById('about-banner-bg');
          if (bannerBg) bannerBg.style.backgroundImage = `url('${ownerImgUrl}')`;
      }
      
      // Dynamic Quick Links
      if (info.quick_links) {
          let links = [];
          if (typeof info.quick_links === 'string') {
              // Legacy fallback
              const lines = info.quick_links.split('\n');
              lines.forEach(line => {
                  let parts = line.split('|');
                  if (parts.length < 2) parts = line.split('-');
                  if (parts.length >= 2) {
                      links.push({ title: parts[0].trim(), url: parts.slice(1).join('|').replace(/^-/,'').trim() });
                  }
              });
          } else if (Array.isArray(info.quick_links)) {
              links = info.quick_links;
          }
          
          const linksHtml = links.map(l => {
              let finalUrl = l.url;
              if (!finalUrl.startsWith('http') && !finalUrl.startsWith('#') && !finalUrl.startsWith('/')) finalUrl = 'https://' + finalUrl;
              return `<a href="${finalUrl}" target="_blank" style="display:flex; align-items:center; gap:5px;"><span>→</span> ${l.title}</a>`;
          }).join('');
          
          const qlContainer = document.getElementById('dynamic-quick-links');
          if (qlContainer) qlContainer.innerHTML = linksHtml;
      }
      
      // Privacy & Terms logic
      window.siteLegalData = { privacy: info.privacy_policy || '', terms: info.terms_conditions || '' };
      if (info.privacy_policy && info.privacy_policy.trim().length > 0) {
          const pBtn = document.getElementById('footer-privacy-btn');
          if(pBtn) pBtn.style.display = 'block';
      }
      if (info.terms_conditions && info.terms_conditions.trim().length > 0) {
          const tBtn = document.getElementById('footer-terms-btn');
          if(tBtn) tBtn.style.display = 'block';
      }

      // 1. Appointments Open/Closed logic
      if (info.appointments_open === false) {
          const appForm = document.getElementById('appointmentForm') || document.getElementById('appointment-form');
          if (appForm) {
              appForm.innerHTML = '<div style="text-align:center; padding: 2rem;"><div style="font-size:3rem; margin-bottom:1rem;">🔒</div><h3 style="color:var(--color-primary);">Appointments Closed</h3><p style="color:#666;">We are currently not accepting new appointments. Please check back later or contact us directly.</p></div>';
          }
          document.querySelectorAll('button, a').forEach(btn => {
              if (btn.innerText && btn.innerText.includes('Book Appointment')) {
                  btn.style.opacity = '0.5';
                  btn.style.cursor = 'not-allowed';
                  btn.onclick = (e) => { e.preventDefault(); alert('Appointments are currently closed.'); return false; };
              }
          });
      }

      // 2. Load Office Info
      const publicOfficeInfo = document.getElementById('public-office-info');
      if(publicOfficeInfo) {
          if (info.logoUrl) {
              const marks = document.querySelectorAll('.logo-mark');
              marks.forEach(mark => {
                  mark.innerHTML = `<img src="${info.logoUrl}" style="width:100%; height:100%; object-fit:contain; border-radius:12px;">`;
                  mark.style.background = 'transparent';
              });
              const logo3d = document.getElementById('chamberLogo3D');
              if(logo3d) {
                  logo3d.src = info.logoUrl;
              }
              
              const loadLogo = document.getElementById('public-loading-logo');
              const loadText = document.getElementById('public-loading-text');
              if(loadLogo) { 
                  loadLogo.src = info.logoUrl; 
                  loadLogo.style.display = 'block'; 
                  if(loadText) loadText.style.display = 'none';
              }
          }
          if(info.address || info.phone || info.email) {
              publicOfficeInfo.innerHTML = `
                ${(info.address || '').replace(/\n/g, '<br>')}<br>
                Phone: ${info.phone || ''}<br>
                Email: ${info.email || ''}
              `;
          }
      }
  }).catch(err => console.error("Error loading settings:", err));

  // Load and Render Advocates from API
  const advocatesGrid = document.getElementById('advocates-grid');
  if (advocatesGrid) {
      let advocatesCache = "";
      async function loadAdvocates() {
          try {
              const response = await fetch('/api/advocates?t=' + Date.now(), { cache: 'no-store' });
              const advocates = await response.json();
              const newDataString = JSON.stringify(advocates);
              if (newDataString === advocatesCache) return;
              advocatesCache = newDataString;
              advocatesGrid.innerHTML = '';
              if (advocates && advocates.length > 0) {
                  const peopleSection = document.getElementById('people') || document.getElementById('advocates');
                  if (peopleSection) peopleSection.style.display = 'block';

                  advocates.forEach(adv => {
                      const div = document.createElement('div');
                      div.className = 'advocate';
                      const isOwner = !!adv.is_owner;
                      if (isOwner) {
                          div.style.border = '2px solid #D4AF37';
                          div.style.boxShadow = '0 12px 30px rgba(212,175,55,0.18)';
                          div.style.borderRadius = '12px';
                          div.style.background = '#ffffff';
                      }
                      const role = adv.role || (isOwner ? 'Chamber Owner & Lead Counsel' : 'Partner - Legal Practice');
                      const location = adv.location || 'High Court of Orissa, Cuttack';
                      const specialty = adv.specialty || (isOwner ? '35 years of advocacy; specialized in Constitutional Law, Civil Law, Insurance and Banking Law, Education and Technical Education Law, Service and Industrial Law, Land.' : 'Litigation & Legal Advisory');
                      
                      let imageHtml = '';
                      let photoSrc = adv.imageUrl;
                      if ((!photoSrc || photoSrc.length < 20) && isOwner) {
                          photoSrc = 'assets/images/advocate_logo.jpg';
                      }

                      if (photoSrc && photoSrc.length > 20) {
                          imageHtml = `<img src="${photoSrc}" alt="${adv.name} - Chamber Member" class="advocate-image" loading="eager" width="400" height="300">`;
                      } else {
                          const initial = (adv.name || '⚖').trim().charAt(0).toUpperCase();
                          imageHtml = `
                              <div class="advocate-image" style="display: flex; flex-direction: column; align-items: center; justify-content: center; background: linear-gradient(135deg, #0A1628 0%, #1E293B 100%); color: #D4AF37;">
                                  <span style="font-size: 3.8rem; font-family: 'Playfair Display', Georgia, serif; font-weight: bold; line-height: 1;">${initial}</span>
                                  <span style="font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: #94a3b8; margin-top: 8px;">JSM Chambers</span>
                              </div>
                          `;
                      }
                      
                      let contactIcons = '';
                      if (adv.email) {
                          contactIcons += `<a href="mailto:${adv.email}" class="advocate-contact-btn" title="Email ${adv.name}">✉</a>`;
                      }
                      if (adv.linkedin) {
                          contactIcons += `<a href="${adv.linkedin}" target="_blank" rel="noopener noreferrer" class="advocate-contact-btn" title="LinkedIn Profile" style="font-weight: 800; font-family: sans-serif; font-size: 13px;">in</a>`;
                      } else if (!isOwner) {
                          contactIcons += `<a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" class="advocate-contact-btn" title="Professional Profile" style="font-weight: 800; font-family: sans-serif; font-size: 13px;">in</a>`;
                      }
                      if (adv.phone) {
                          contactIcons += `<a href="tel:${adv.phone}" class="advocate-contact-btn" title="Call ${adv.phone}">📞</a>`;
                      }

                      div.innerHTML = `
                          ${imageHtml}
                          <div class="advocate-info">
                              ${isOwner ? '<div style="margin-bottom: 6px;"><span style="background: linear-gradient(135deg, #071322 0%, #0A1628 100%); color: #D4AF37; border: 1px solid #D4AF37; padding: 3px 10px; border-radius: 4px; font-size: 10px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; display: inline-flex; align-items: center; gap: 5px;">👑 CHAMBER OWNER</span></div>' : ''}
                              <h3 style="margin: 0 0 4px 0; font-family: 'Playfair Display', Georgia, serif; font-size: 20px; font-weight: 700; color: #0A1628; line-height: 1.3;">${adv.name}</h3>
                              <div class="advocate-role" style="${isOwner ? 'color: #b45309; font-weight: 700;' : ''}">${role}</div>
                              <div class="advocate-specialty">${specialty}</div>
                              <div class="advocate-location">
                                  <svg style="width: 13px; height: 13px; fill: #64748b; flex-shrink: 0;" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                                  <span>${location}</span>
                              </div>
                              <div class="advocate-actions">
                                  <div style="display: flex; gap: 8px;">
                                      ${contactIcons}
                                  </div>
                                  <button onclick="openModal('appointmentModal')" style="background: ${isOwner ? '#0A1628' : 'transparent'}; border: 1px solid #D4AF37; color: ${isOwner ? '#D4AF37' : '#0A1628'}; padding: 6px 14px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; transition: 0.2s;" onmouseover="this.style.background='#D4AF37';this.style.color='#0A1628';" onmouseout="this.style.background='${isOwner ? '#0A1628' : 'transparent'}';this.style.color='${isOwner ? '#D4AF37' : '#0A1628'}';">
                                      Consult →
                                  </button>
                              </div>
                          </div>
                      `;
                      advocatesGrid.appendChild(div);
                  });
              } else {
                  advocatesGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #9daeb9; padding: 2rem;">No advocates listed at the moment.</p>';
              }
          } catch (err) {
              console.error('Error loading advocates:', err);
              advocatesGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #999;">Error loading advocates.</p>';
          }
      }
      loadAdvocates();
      
      // Real-time Sync (30 seconds)
      setInterval(loadAdvocates, 30000);
  }

    // Instant Loading Screen Dismiss (Prevent Page Hang)
    const screen = document.getElementById('public-loading-screen');
    if (screen) {
        screen.style.opacity = '0';
        screen.style.pointerEvents = 'none';
        setTimeout(() => { screen.style.display = 'none'; }, 100);
    }
});



// Footer Alert Polling
document.addEventListener('DOMContentLoaded', () => {
    const footerAlertBar = document.getElementById('footer-alert-bar');
    const footerAlertText = document.getElementById('footer-alert-text');
    if (!footerAlertBar || !footerAlertText) return;

    let alertCache = null;

    async function loadFooterAlert() {
        try {
            const res = await fetch('/api/settings', { cache: 'no-store' });
            const data = await res.json();
            
            const alertMsg = data.footer_alert || "";
            if (alertMsg !== alertCache) {
                alertCache = alertMsg;
                if (alertMsg.trim() !== "") {
                    footerAlertText.innerText = "⚠ " + alertMsg.trim() + " ⚠";
                    footerAlertBar.style.display = 'block';
                } else {
                    footerAlertBar.style.display = 'none';
                    footerAlertText.innerText = "";
                }
            }
        } catch (e) {
            console.error("Error loading settings:", e);
        }
    }
    
    loadFooterAlert();
    // Poll every 5 seconds
    setInterval(loadFooterAlert, 5000);
});

window.openLegalModal = function(type) {
    const modal = document.getElementById('legalModal');
    const title = document.getElementById('legal-modal-title');
    const content = document.getElementById('legal-modal-content');
    
    if (!modal || !title || !content) return;
    
    if (type === 'privacy') {
        title.innerText = 'Privacy Policy';
        content.innerText = window.siteLegalData?.privacy || 'No Privacy Policy available.';
    } else if (type === 'terms') {
        title.innerText = 'Terms & Conditions';
        content.innerText = window.siteLegalData?.terms || 'No Terms & Conditions available.';
    }
    
    modal.classList.add("active");
    document.body.style.overflow = "hidden";
};

/* =========================================================
   3D REALISTIC LEGAL BOOK CONTROLLER
========================================================= */
let currentServiceBook = null;
let bookPagesList = [];
let currentBookPageIndex = 0;
let isFlipping = false;
let bookAudioCtx = null;
let bookSoundEnabled = true;

window.allServicesData = [];

// Initialize Web Audio API Paper Rustle
function playPaperTurnSound() {
    if (!bookSoundEnabled) return;
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        if (!bookAudioCtx) bookAudioCtx = new AudioContext();
        if (bookAudioCtx.state === 'suspended') bookAudioCtx.resume();
        
        const duration = 0.28;
        const bufferSize = Math.floor(bookAudioCtx.sampleRate * duration);
        const buffer = bookAudioCtx.createBuffer(1, bufferSize, bookAudioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        }
        
        const noise = bookAudioCtx.createBufferSource();
        noise.buffer = buffer;
        
        const filter = bookAudioCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1100, bookAudioCtx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(350, bookAudioCtx.currentTime + duration);
        filter.Q.value = 2.2;
        
        const gainNode = bookAudioCtx.createGain();
        gainNode.gain.setValueAtTime(0.01, bookAudioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.4, bookAudioCtx.currentTime + 0.04);
        gainNode.gain.exponentialRampToValueAtTime(0.001, bookAudioCtx.currentTime + duration);
        
        noise.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(bookAudioCtx.destination);
        
        noise.start();
        noise.stop(bookAudioCtx.currentTime + duration + 0.02);
    } catch (e) {
        // Fallback silently if audio context unavailable
    }
}

window.toggleBookSound = function() {
    bookSoundEnabled = !bookSoundEnabled;
    const btn = document.getElementById('sound-toggle-btn');
    if (btn) {
        btn.innerHTML = bookSoundEnabled ? '🔊 Sound ON' : '🔇 Sound OFF';
        btn.style.borderColor = bookSoundEnabled ? 'rgba(212, 175, 55, 0.45)' : 'rgba(255, 255, 255, 0.2)';
    }
};

window.closeServiceBook = function() {
    const modal = document.getElementById('service-book-modal');
    if (modal) {
        modal.classList.remove('open');
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
    const sheet = document.getElementById('flipping-sheet');
    if (sheet) {
        sheet.style.transition = 'none';
        sheet.classList.remove('flipped', 'flipping');
        sheet.style.display = 'none';
    }
    isFlipping = false;
};

function getChamberEndsheetHtml() {
    return `
        <div style="text-align: center; display: flex; flex-direction: column; justify-content: center; height: 100%; padding: 25px 15px;">
            <div style="font-size: 34px; color: #D4AF37; margin-bottom: 12px;">⚖️</div>
            <div style="font-size: 10px; letter-spacing: 3px; text-transform: uppercase; color: #8c7b64; font-weight: 700; margin-bottom: 8px;">JSM Chambers & Associates</div>
            <div style="width: 45px; height: 1.5px; background: #D4AF37; margin: 0 auto 15px auto;"></div>
            <h3 style="font-family: 'Playfair Display', Georgia, serif; font-size: 20px; color: #0A1628; margin: 0 0 10px 0;">Advocacy & Strategic Litigation</h3>
            <p style="font-family: Georgia, serif; font-size: 13.5px; color: #64748b; line-height: 1.6; font-style: italic; margin-bottom: 24px;">
                "Fiat justitia ruat caelum — Let justice be done though the heavens fall."
            </p>
            <div style="margin-top: auto; padding-top: 15px; border-top: 1px dashed #dfd8cb; font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: #a39580;">
                High Court of Orissa • Supreme Court Practice
            </div>
        </div>
    `;
}

// Render contents of a given spread (desktop: left & right; mobile: single page)
function renderBookSpread() {
    const isMobile = window.innerWidth <= 990;
    const totalPages = bookPagesList.length;
    
    if (isMobile) {
        const pageIdx = currentBookPageIndex;
        const pageData = bookPagesList[pageIdx];
        
        const rightContent = document.getElementById('page-right-content');
        const rightFooter = document.getElementById('page-right-footer');
        if (rightContent) rightContent.innerHTML = pageData ? pageData.html : getChamberEndsheetHtml();
        if (rightFooter) rightFooter.innerText = `- ${pageIdx + 1} of ${totalPages} -`;
        
        const indicator = document.getElementById('book-page-indicator');
        if (indicator) indicator.innerText = `📖 Page ${pageIdx + 1} of ${totalPages}`;
        
        const prevBtn = document.getElementById('book-prev-btn');
        const nextBtn = document.getElementById('book-next-btn');
        if (prevBtn) prevBtn.disabled = (pageIdx === 0);
        if (nextBtn) nextBtn.disabled = (pageIdx >= totalPages - 1);
    } else {
        const leftIdx = currentBookPageIndex;
        const rightIdx = currentBookPageIndex + 1;
        
        const leftData = bookPagesList[leftIdx];
        const rightData = bookPagesList[rightIdx];
        
        const leftContent = document.getElementById('page-left-content');
        const leftFooter = document.getElementById('page-left-footer');
        if (leftContent) leftContent.innerHTML = leftData ? leftData.html : '';
        if (leftFooter) leftFooter.innerText = leftData ? `- ${leftIdx + 1} -` : '';
        
        const rightContent = document.getElementById('page-right-content');
        const rightFooter = document.getElementById('page-right-footer');
        if (rightContent) {
            rightContent.innerHTML = rightData ? rightData.html : getChamberEndsheetHtml();
        }
        if (rightFooter) rightFooter.innerText = rightData ? `- ${rightIdx + 1} -` : '';
        
        const indicator = document.getElementById('book-page-indicator');
        if (indicator) {
            const endDisp = Math.min(rightIdx + 1, totalPages);
            indicator.innerText = `📖 Pages ${leftIdx + 1}${rightData ? '-' + endDisp : ''} of ${totalPages}`;
        }
        
        const prevBtn = document.getElementById('book-prev-btn');
        const nextBtn = document.getElementById('book-next-btn');
        if (prevBtn) prevBtn.disabled = (leftIdx === 0);
        if (nextBtn) nextBtn.disabled = (leftIdx + 1 >= totalPages - 1);
    }
}

// Turn Book Page Right (Advance Forward)
window.turnBookPageRight = function() {
    if (isFlipping) return;
    const isMobile = window.innerWidth <= 990;
    const totalPages = bookPagesList.length;
    
    if (isMobile) {
        if (currentBookPageIndex >= totalPages - 1) return;
        currentBookPageIndex++;
        playPaperTurnSound();
        renderBookSpread();
        return;
    }
    
    if (currentBookPageIndex + 1 >= totalPages - 1) return;
    
    isFlipping = true;
    const sheet = document.getElementById('flipping-sheet');
    const sheetFront = document.getElementById('sheet-front-content');
    const sheetFrontFooter = document.getElementById('sheet-front-footer');
    const sheetBack = document.getElementById('sheet-back-content');
    const sheetBackFooter = document.getElementById('sheet-back-footer');
    const rightContent = document.getElementById('page-right-content');
    const rightFooter = document.getElementById('page-right-footer');
    
    // Front face has current right page
    const curRightIdx = currentBookPageIndex + 1;
    const nextLeftIdx = currentBookPageIndex + 2;
    const nextRightIdx = currentBookPageIndex + 3;
    
    if (sheetFront) sheetFront.innerHTML = bookPagesList[curRightIdx] ? bookPagesList[curRightIdx].html : '';
    if (sheetFrontFooter) sheetFrontFooter.innerText = `- ${curRightIdx + 1} -`;
    
    // Back face has next left page
    if (sheetBack) sheetBack.innerHTML = bookPagesList[nextLeftIdx] ? bookPagesList[nextLeftIdx].html : '';
    if (sheetBackFooter) sheetBackFooter.innerText = `- ${nextLeftIdx + 1} -`;
    
    // Reveal next right page under the turn
    if (rightContent) {
        if (bookPagesList[nextRightIdx]) {
            rightContent.innerHTML = bookPagesList[nextRightIdx].html;
        } else {
            rightContent.innerHTML = getChamberEndsheetHtml();
        }
    }
    if (rightFooter) rightFooter.innerText = bookPagesList[nextRightIdx] ? `- ${nextRightIdx + 1} -` : '';
    
    // Prepare 3D turn & make sheet visible
    if (sheet) {
        sheet.style.display = 'block';
        sheet.style.transition = 'none';
        sheet.classList.remove('flipped');
        void sheet.offsetWidth; // Force reflow
        sheet.style.transition = 'transform 0.82s cubic-bezier(0.25, 1, 0.45, 1)';
        sheet.classList.add('flipped', 'flipping');
    }
    playPaperTurnSound();
    
    setTimeout(() => {
        currentBookPageIndex += 2;
        renderBookSpread();
        if (sheet) {
            sheet.style.transition = 'none';
            sheet.classList.remove('flipped', 'flipping');
            sheet.style.display = 'none';
        }
        isFlipping = false;
    }, 830);
};

// Turn Book Page Left (Go Backward)
window.turnBookPageLeft = function() {
    if (isFlipping) return;
    const isMobile = window.innerWidth <= 990;
    
    if (isMobile) {
        if (currentBookPageIndex <= 0) return;
        currentBookPageIndex--;
        playPaperTurnSound();
        renderBookSpread();
        return;
    }
    
    if (currentBookPageIndex <= 0) return;
    
    isFlipping = true;
    const sheet = document.getElementById('flipping-sheet');
    const sheetFront = document.getElementById('sheet-front-content');
    const sheetFrontFooter = document.getElementById('sheet-front-footer');
    const sheetBack = document.getElementById('sheet-back-content');
    const sheetBackFooter = document.getElementById('sheet-back-footer');
    const leftContent = document.getElementById('page-left-content');
    const leftFooter = document.getElementById('page-left-footer');
    
    const curLeftIdx = currentBookPageIndex;
    const prevRightIdx = currentBookPageIndex - 1;
    const prevLeftIdx = currentBookPageIndex - 2;
    
    // Back face has current left page
    if (sheetBack) sheetBack.innerHTML = bookPagesList[curLeftIdx] ? bookPagesList[curLeftIdx].html : '';
    if (sheetBackFooter) sheetBackFooter.innerText = `- ${curLeftIdx + 1} -`;
    
    // Front face has previous right page
    if (sheetFront) sheetFront.innerHTML = bookPagesList[prevRightIdx] ? bookPagesList[prevRightIdx].html : '';
    if (sheetFrontFooter) sheetFrontFooter.innerText = `- ${prevRightIdx + 1} -`;
    
    // Reveal previous left page under the turn
    if (leftContent) leftContent.innerHTML = bookPagesList[prevLeftIdx] ? bookPagesList[prevLeftIdx].html : '';
    if (leftFooter) leftFooter.innerText = bookPagesList[prevLeftIdx] ? `- ${prevLeftIdx + 1} -` : '';
    
    // Position flipped at left, animate back to right & make sheet visible
    if (sheet) {
        sheet.style.display = 'block';
        sheet.style.transition = 'none';
        sheet.classList.add('flipped');
        void sheet.offsetWidth; // Force reflow
        sheet.style.transition = 'transform 0.82s cubic-bezier(0.25, 1, 0.45, 1)';
        sheet.classList.remove('flipped');
        sheet.classList.add('flipping');
    }
    playPaperTurnSound();
    
    setTimeout(() => {
        currentBookPageIndex -= 2;
        renderBookSpread();
        if (sheet) {
            sheet.style.transition = 'none';
            sheet.classList.remove('flipping');
            sheet.style.display = 'none';
        }
        isFlipping = false;
    }, 830);
};

// Build Pages List and Open Modal
function doOpenServiceBook(service) {
    if (!service) return;
    currentServiceBook = service;
    
    // Update toolbar
    const iconEl = document.getElementById('book-service-icon');
    const titleEl = document.getElementById('book-service-title');
    const isImageIcon = service.icon && (service.icon.startsWith('data:') || service.icon.startsWith('http') || service.icon.startsWith('/'));
    
    if (iconEl) {
        iconEl.innerHTML = isImageIcon 
            ? `<img src="${service.icon}" style="width: 22px; height: 22px; object-fit: contain; vertical-align: middle; border-radius: 4px;">`
            : (service.icon || '⚖');
    }
    if (titleEl) titleEl.innerText = service.title || 'Legal Practice';
    
    // Construct pages
    bookPagesList = [];
    
    const frontIconHtml = isImageIcon
        ? `<img src="${service.icon}" style="max-width: 65px; max-height: 65px; object-fit: contain; margin: 0 auto 10px auto; display: block; border-radius: 6px; box-shadow: 0 4px 10px rgba(0,0,0,0.12);">`
        : `<div style="font-size: 34px; margin-bottom: 8px;">${service.icon || '⚖'}</div>`;
    
    // Page 0: Frontispiece
    bookPagesList.push({
        html: `
            <div style="text-align: center; display: flex; flex-direction: column; justify-content: center; height: 100%; padding: 15px 5px;">
                ${frontIconHtml}
                <div style="font-size: 10px; letter-spacing: 3px; text-transform: uppercase; color: #8c7b64; font-weight: 700; margin-bottom: 6px;">JSM Chambers & Associates</div>
                <div style="width: 50px; height: 2px; background: #D4AF37; margin: 0 auto 14px auto;"></div>
                <h2 style="font-family: 'Playfair Display', Georgia, serif; font-size: 24px; color: #0A1628; margin: 0 0 10px 0; line-height: 1.3;">${service.title}</h2>
                <div style="font-size: 13px; font-style: italic; color: #555; line-height: 1.6; margin-bottom: 18px; padding: 0 10px;">
                    "${service.short_desc || service.summary || 'Excellence in legal advocacy, advisory, and dispute resolution.'}"
                </div>
                <div style="margin-top: auto; padding-top: 15px; border-top: 1px dashed #dfd8cb;">
                    <div style="font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: #a39580; font-weight: 700;">Practice Monograph • 3D Edition</div>
                    <div style="font-size: 11px; color: #8c7b64; margin-top: 4px;">Turn page right to explore practice areas & procedural overview →</div>
                </div>
            </div>
        `
    });
    
    // User / Admin Pages (supports book_pages or pages)
    const rawPages = (Array.isArray(service.book_pages) && service.book_pages.length > 0)
        ? service.book_pages
        : ((Array.isArray(service.pages) && service.pages.length > 0)
            ? service.pages
            : [{ chapter: service.title + ' Overview', content: service.short_desc || service.summary || 'Details coming soon.', images: [] }]);
        
    rawPages.forEach((p, idx) => {
        const paragraphs = (p.content || '').split(/\n+/).filter(Boolean);
        const formattedParas = paragraphs.length > 0 
            ? paragraphs.map(para => `<p style="margin-bottom: 12px;">${para.trim()}</p>`).join('')
            : `<p>${p.content || ''}</p>`;
            
        const images = Array.isArray(p.images) ? p.images.filter(Boolean) : [];
        let imagesHtml = '';
        if (images.length === 1) {
            imagesHtml = `
                <div style="margin: 8px 0 10px 0; text-align: center;">
                    <img src="${images[0]}" onclick="window.openBookImageLightbox(this.src)" title="Click to enlarge" style="max-width: 100%; max-height: 135px; object-fit: cover; border-radius: 6px; border: 1px solid #dfd8cb; box-shadow: 0 4px 10px rgba(0,0,0,0.08); cursor: zoom-in; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='none'">
                </div>
            `;
        } else if (images.length >= 2) {
            imagesHtml = `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 8px 0 10px 0;">
                    <img src="${images[0]}" onclick="window.openBookImageLightbox(this.src)" title="Click to enlarge" style="width: 100%; height: 105px; object-fit: cover; border-radius: 6px; border: 1px solid #dfd8cb; box-shadow: 0 4px 8px rgba(0,0,0,0.08); cursor: zoom-in; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='none'">
                    <img src="${images[1]}" onclick="window.openBookImageLightbox(this.src)" title="Click to enlarge" style="width: 100%; height: 105px; object-fit: cover; border-radius: 6px; border: 1px solid #dfd8cb; box-shadow: 0 4px 8px rgba(0,0,0,0.08); cursor: zoom-in; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='none'">
                </div>
            `;
        }

        const textMaxHeight = images.length > 0 ? '225px' : '380px';
            
        bookPagesList.push({
            html: `
                <div class="page-header-title">
                    <span>${service.title}</span>
                    <span>Chapter ${idx + 1}</span>
                </div>
                <h3 class="page-chapter-heading">${p.chapter || p.title || 'Practice Note'}</h3>
                ${imagesHtml}
                <div class="page-body-text has-dropcap" style="max-height: ${textMaxHeight}; overflow-y: auto; padding-right: 6px;">
                    ${formattedParas}
                </div>
            `
        });
    });
    
    // Final Closing Page
    bookPagesList.push({
        html: `
            <div style="text-align: center; display: flex; flex-direction: column; justify-content: center; height: 100%; padding: 15px 5px;">
                <div style="font-size: 32px; color: #D4AF37; margin-bottom: 8px;">📜</div>
                <div style="font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #8c7b64; font-weight: 700; margin-bottom: 6px;">Client Engagement & Case Retainer</div>
                <h3 style="font-family: 'Playfair Display', Georgia, serif; font-size: 21px; color: #0A1628; margin: 0 0 10px 0;">Consult With Our Senior Advocates</h3>
                <p style="font-family: Georgia, serif; font-size: 13px; color: #555; line-height: 1.6; margin-bottom: 20px;">
                    Every legal case requires meticulous preparation and sharp strategy. Reach out to schedule a confidential conference with our litigation team.
                </p>
                <div style="margin-top: 8px;">
                    <a href="#contact" onclick="closeServiceBook();" style="display: inline-block; background: #0A1628; color: #D4AF37; padding: 11px 22px; border-radius: 6px; font-weight: 700; font-size: 13px; text-decoration: none; border: 1px solid #D4AF37; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                        📅 Book Consultation Now
                    </a>
                </div>
                <div style="font-size: 9px; letter-spacing: 1.5px; text-transform: uppercase; color: #a39580; margin-top: auto; padding-top: 10px;">
                    Cuttack & Supreme Court Practice
                </div>
            </div>
        `
    });
    
    currentBookPageIndex = 0;
    renderBookSpread();
    
    const sheet = document.getElementById('flipping-sheet');
    if (sheet) {
        sheet.style.transition = 'none';
        sheet.classList.remove('flipped', 'flipping');
        sheet.style.display = 'none';
    }
    isFlipping = false;
    
    const modal = document.getElementById('service-book-modal');
    if (modal) {
        modal.style.display = 'flex';
        void modal.offsetWidth; // Force layout reflow
        modal.classList.add('open');
        document.body.style.overflow = 'hidden';
    }
}

window.openServiceBook = function(idOrTitle) {
    if (!window.allServicesData || window.allServicesData.length === 0) {
        fetch('/api/services')
            .then(res => res.json())
            .then(data => {
                window.allServicesData = data;
                findAndOpen(idOrTitle);
            })
            .catch(err => {
                console.error("Error loading services:", err);
            });
    } else {
        findAndOpen(idOrTitle);
    }
    
    function findAndOpen(target) {
        if (!window.allServicesData || window.allServicesData.length === 0) return;
        if (target === undefined || target === null || target === '') {
            doOpenServiceBook(window.allServicesData[0]);
            return;
        }
        
        // 1. Check numeric index (e.g. 0, 1, 2, 3 or string '0', '1', '2', '3')
        if (typeof target === 'number' || (/^\d+$/.test(target.toString().trim()))) {
            const idx = parseInt(target.toString().trim(), 10);
            if (idx >= 0 && idx < window.allServicesData.length) {
                doOpenServiceBook(window.allServicesData[idx]);
                return;
            }
        }
        
        // 2. Check ordinal keywords (1st, 2nd, 3rd, 3d, 4th)
        const tStr = target.toString().trim().toLowerCase();
        if (tStr === '1st' && window.allServicesData[0]) return doOpenServiceBook(window.allServicesData[0]);
        if (tStr === '2nd' && window.allServicesData[1]) return doOpenServiceBook(window.allServicesData[1]);
        if ((tStr === '3rd' || tStr === '3d') && window.allServicesData[2]) return doOpenServiceBook(window.allServicesData[2]);
        if (tStr === '4th' && window.allServicesData[3]) return doOpenServiceBook(window.allServicesData[3]);
        
        // 3. Match by exact _id
        let matched = window.allServicesData.find(s => s._id === target || s._id === tStr);
        
        // 4. Match by exact title
        if (!matched) {
            matched = window.allServicesData.find(s => s.title && s.title.toLowerCase() === tStr);
        }
        
        // 5. Match by partial title / keyword
        if (!matched) {
            matched = window.allServicesData.find(s => {
                if (!s.title) return false;
                const st = s.title.toLowerCase();
                return st.includes(tStr) || tStr.includes(st);
            });
        }
        
        // Fallback to first available service
        doOpenServiceBook(matched || window.allServicesData[0]);
    }
};

window.openServiceBookByTitle = window.openServiceBook;

// Load and render public services dynamically into #services-grid
async function loadPublicServices() {
    try {
        const res = await fetch('/api/services', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
            window.allServicesData = data;
            const grid = document.getElementById('services-grid');
            if (grid) {
                grid.innerHTML = data.map((srv, idx) => {
                    const isImageIcon = srv.icon && (srv.icon.startsWith('data:') || srv.icon.startsWith('http') || srv.icon.startsWith('/'));
                    const iconRender = isImageIcon
                        ? `<img src="${srv.icon}" style="width: 38px; height: 38px; object-fit: contain; border-radius: 6px;">`
                        : (srv.icon || '⚖');

                    return `
                        <div class="service-card" onclick="openServiceBook('${srv._id}')" style="cursor: pointer;">
                            <div class="service-number">${String(idx + 1).padStart(2, '0')}</div>
                            <div class="service-icon" style="display: flex; align-items: center; justify-content: center; overflow: hidden;">${iconRender}</div>
                            <h3>${srv.title}</h3>
                            <p>${srv.short_desc || srv.summary || ''}</p>
                            <div class="service-link" role="button" tabindex="0" onclick="event.stopPropagation(); openServiceBook('${srv._id}')" style="cursor: pointer;">
                                Explore Service →
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }
    } catch (e) {
        console.error('Error fetching public services:', e);
    }
}

// Lightbox modal for viewing high-res illustrations from the 3D book
window.openBookImageLightbox = function(src) {
    if (!src) return;
    let lb = document.getElementById('book-image-lightbox');
    if (!lb) {
        lb = document.createElement('div');
        lb.id = 'book-image-lightbox';
        lb.style.cssText = 'display: none; position: fixed; inset: 0; z-index: 1000000; background: rgba(0,0,0,0.88); align-items: center; justify-content: center; padding: 20px; cursor: pointer; backdrop-filter: blur(8px);';
        lb.onclick = function() { lb.style.display = 'none'; };
        lb.innerHTML = '<img id="book-lightbox-img" style="max-width: 90vw; max-height: 85vh; object-fit: contain; border-radius: 8px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); border: 2px solid #D4AF37;">';
        document.body.appendChild(lb);
    }
    document.getElementById('book-lightbox-img').src = src;
    lb.style.display = 'flex';
};

// Keyboard arrow listeners for realistic turning
document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('service-book-modal');
    if (!modal || modal.style.display === 'none') return;
    
    if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        window.turnBookPageRight();
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        window.turnBookPageLeft();
    } else if (e.key === 'Escape') {
        window.closeServiceBook();
    }
});

// Close modal when clicking backdrop outside stage
document.addEventListener('click', (e) => {
    const modal = document.getElementById('service-book-modal');
    if (modal && modal.style.display !== 'none' && e.target === modal) {
        window.closeServiceBook();
    }
});

// Mobile touch swipe listener for 3D Book
let bookTouchStartX = 0;
let bookTouchEndX = 0;
document.addEventListener('DOMContentLoaded', () => {
    const serviceBookModal = document.getElementById('service-book-modal');
    if (serviceBookModal) {
        serviceBookModal.addEventListener('touchstart', (e) => {
            if (e.changedTouches && e.changedTouches.length > 0) {
                bookTouchStartX = e.changedTouches[0].screenX;
            }
        }, { passive: true });
        serviceBookModal.addEventListener('touchend', (e) => {
            if (e.changedTouches && e.changedTouches.length > 0) {
                bookTouchEndX = e.changedTouches[0].screenX;
                const diff = bookTouchStartX - bookTouchEndX;
                if (Math.abs(diff) > 40) {
                    if (diff > 0) {
                        window.turnBookPageRight();
                    } else {
                        window.turnBookPageLeft();
                    }
                }
            }
        }, { passive: true });
    }
});

// Auto-load services on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadPublicServices);
} else {
    loadPublicServices();
}

// ==========================================
// NEWS & INSIGHTS PUBLIC CONTROLLER
// ==========================================
window.allNewsData = [];

window.openAboutFullscreen = function() {
    window.closeExpertiseFullscreen(true);
    window.closeStaffsFullscreen(true);
    window.closeContactFullscreen(true);
    const el = document.getElementById('about-fullscreen-view');
    if (el) {
        el.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
};

window.closeAboutFullscreen = function(skipScroll) {
    const el = document.getElementById('about-fullscreen-view');
    if (el) {
        el.style.display = 'none';
        document.body.style.overflow = '';
        if (!skipScroll) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }
};

window.openExpertiseFullscreen = function() {
    window.closeAboutFullscreen(true);
    window.closeStaffsFullscreen(true);
    window.closeContactFullscreen(true);
    const el = document.getElementById('expertise-fullscreen-view');
    if (el) {
        el.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
};

window.closeExpertiseFullscreen = function(skipScroll) {
    const el = document.getElementById('expertise-fullscreen-view');
    if (el) {
        el.style.display = 'none';
        document.body.style.overflow = '';
        if (!skipScroll) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }
};

window.openStaffsFullscreen = function() {
    window.closeAboutFullscreen(true);
    window.closeExpertiseFullscreen(true);
    window.closeContactFullscreen(true);
    const el = document.getElementById('staffs-fullscreen-view');
    if (el) {
        el.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
};

window.closeStaffsFullscreen = function(skipScroll) {
    const el = document.getElementById('staffs-fullscreen-view');
    if (el) {
        el.style.display = 'none';
        document.body.style.overflow = '';
        if (!skipScroll) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }
};

window.openContactFullscreen = function() {
    window.closeAboutFullscreen(true);
    window.closeExpertiseFullscreen(true);
    window.closeStaffsFullscreen(true);
    const el = document.getElementById('contact-fullscreen-view');
    if (el) {
        el.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
};

window.closeContactFullscreen = function(skipScroll) {
    const el = document.getElementById('contact-fullscreen-view');
    if (el) {
        el.style.display = 'none';
        document.body.style.overflow = '';
        if (!skipScroll) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }
};

window.navToPage = function(page) {
    if (typeof window.closeMobileMenu === 'function') {
        window.closeMobileMenu();
    }

    const appModal = document.getElementById('appointmentModal');
    if (appModal) appModal.style.display = 'none';

    if (page === 'home') {
        window.closeAboutFullscreen(true);
        window.closeExpertiseFullscreen(true);
        window.closeStaffsFullscreen(true);
        window.closeContactFullscreen(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (page === 'about') {
        window.openAboutFullscreen();
    } else if (page === 'expertise') {
        window.openExpertiseFullscreen();
    } else if (page === 'staffs' || page === 'members') {
        window.openStaffsFullscreen();
    } else if (page === 'contact') {
        window.openContactFullscreen();
    }
};

window.openMembersFullscreen = window.openStaffsFullscreen;
window.closeMembersFullscreen = window.closeStaffsFullscreen;
window.toggleAboutSection = window.openAboutFullscreen;
window.toggleExpertiseSection = window.openExpertiseFullscreen;
window.toggleStaffsSection = window.openStaffsFullscreen;
window.toggleMembersSection = window.openStaffsFullscreen;
window.toggleContactSection = window.openContactFullscreen;

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        window.closeAboutFullscreen();
        window.closeExpertiseFullscreen();
        window.closeStaffsFullscreen();
        window.closeContactFullscreen();
    }
});

window.loadPublicNews = async function() {
    try {
        const res = await fetch('/api/news', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
            window.allNewsData = data;
            const track = document.getElementById('news-train-track') || document.getElementById('news-grid');
            if (track) {
                const singleSet = data.map(item => {
                    const iconHtml = item.icon && (item.icon.startsWith('data:') || item.icon.startsWith('http') || item.icon.startsWith('/'))
                        ? `<img src="${item.icon}" alt="icon" style="width: 17px; height: 17px; object-fit: contain; vertical-align: middle; margin-right: 6px; display: inline-block;">`
                        : `<span style="margin-right: 6px;">${item.icon || '⚖️'}</span>`;

                    const imgHtml = item.image_url
                        ? `<div class="news-card-img"><img src="${item.image_url}" alt="${item.title}" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.4s ease;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='none'"></div>`
                        : `<div class="news-card-img" style="background: linear-gradient(135deg, #071322, #102138); display: flex; align-items: center; justify-content: center; color: #D4AF37; font-size: 2rem; border-bottom: 1px solid rgba(212,175,55,0.2);">${item.icon && !item.icon.startsWith('data:') && !item.icon.startsWith('http') ? item.icon : '📰'}</div>`;

                    return `
                        <article class="news-card news-train-card" onclick="openNewsArticleModal('${item._id}')" onmouseover="this.style.transform='translateY(-6px)';this.style.borderColor='#D4AF37';this.style.boxShadow='0 15px 35px rgba(212,175,55,0.2)';" onmouseout="this.style.transform='none';this.style.borderColor='rgba(212, 175, 55, 0.25)';this.style.boxShadow='0 10px 25px rgba(0,0,0,0.35)';">
                            ${imgHtml}
                            <div class="news-card-content" style="padding: 18px; display: flex; flex-direction: column; flex: 1;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
                                    <span class="news-badge" style="background: rgba(212, 175, 55, 0.15); color: #D4AF37; border: 1px solid rgba(212, 175, 55, 0.3); padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; display: inline-flex; align-items: center;">${iconHtml} ${item.category || 'Legal Update'}</span>
                                    <span style="color: #94a3b8; font-size: 11.5px;">📅 ${item.date || ''}</span>
                                </div>
                                <h3 style="font-family: 'Playfair Display', Georgia, serif; font-size: 17px; color: #ffffff; margin: 0 0 8px 0; line-height: 1.35; white-space: normal;">${item.title}</h3>
                                <p style="color: #cbd5e1; font-size: 12.8px; line-height: 1.55; margin: 0 0 12px 0; flex: 1; white-space: normal; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">${item.summary || ''}</p>
                                <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px; margin-top: auto;">
                                    <span style="color: #94a3b8; font-size: 11.5px; font-style: italic;">By ${item.author || 'Chamber Editorial'}</span>
                                    <span style="color: #D4AF37; font-weight: 700; font-size: 11.5px;">Read Article →</span>
                                </div>
                            </div>
                        </article>
                    `;
                }).join('');

                // Repeat enough times to create an infinite, seamless continuous train track
                const repeatCount = data.length <= 2 ? 6 : (data.length <= 4 ? 4 : 2);
                let fullConveyor = '';
                for (let i = 0; i < repeatCount * 2; i++) {
                    fullConveyor += singleSet;
                }
                track.innerHTML = fullConveyor;
            }
        }
    } catch (e) {
        console.error('Error fetching public news:', e);
    }
};

window.openNewsArticleModal = function(id) {
    const article = (window.allNewsData || []).find(n => n._id === id);
    if (!article) return;

    const modal = document.getElementById('news-article-modal');
    if (!modal) return;

    const badge = document.getElementById('news-reader-badge');
    const date = document.getElementById('news-reader-date');
    const author = document.getElementById('news-reader-author');
    const imgWrap = document.getElementById('news-reader-img-wrap');
    const img = document.getElementById('news-reader-img');
    const title = document.getElementById('news-reader-title');
    const summary = document.getElementById('news-reader-summary');
    const content = document.getElementById('news-reader-content');

    if (badge) {
        const iconHtml = article.icon && (article.icon.startsWith('data:') || article.icon.startsWith('http') || article.icon.startsWith('/'))
            ? `<img src="${article.icon}" alt="icon" style="width: 18px; height: 18px; object-fit: contain; vertical-align: middle; margin-right: 6px; display: inline-block;">`
            : `<span style="margin-right: 6px;">${article.icon || '⚖️'}</span>`;
        badge.innerHTML = `${iconHtml} ${article.category || 'Legal Update'}`;
    }
    if (date) date.innerText = article.date ? `📅 ${article.date}` : '';
    if (author) author.innerText = article.author ? `✍️ ${article.author}` : '';
    if (title) title.innerText = article.title || '';
    if (summary) summary.innerText = article.summary || '';
    if (content) content.innerText = article.content || '';

    if (article.image_url && img && imgWrap) {
        img.src = article.image_url;
        imgWrap.style.display = 'block';
    } else if (imgWrap) {
        imgWrap.style.display = 'none';
    }

    modal.style.display = 'flex';
    void modal.offsetWidth;
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
};

window.closeNewsArticleModal = function() {
    const modal = document.getElementById('news-article-modal');
    if (modal) {
        modal.classList.remove('open');
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
};

// ==========================================
// TODAY'S OPINION (Day-wise Conveyor Right-to-Left)
// ==========================================
window.loadPublicOpinions = async function() {
    try {
        const res = await fetch('/api/opinions', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
            window.allOpinionsData = data;
            const track = document.getElementById('opinion-train-track');
            if (track) {
                const singleSet = data.map(item => {
                    return `
                        <article class="opinion-train-card" onclick="openOpinionArticleModal('${item._id}')">
                            <div>
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 6px;">
                                    <span style="background: rgba(212, 175, 55, 0.15); color: #D4AF37; border: 1px solid rgba(212, 175, 55, 0.35); padding: 3px 8px; border-radius: 6px; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; display: inline-flex; align-items: center; gap: 4px;">
                                        ⚖️ ${item.category || 'Editorial Opinion'}
                                    </span>
                                    <span style="color: #94a3b8; font-size: 11px; font-weight: 600;">📅 ${item.date || ''}</span>
                                </div>
                                <div style="color: #D4AF37; font-size: 26px; line-height: 1; font-family: Georgia, serif; margin: 2px 0 -4px 0; opacity: 0.85;">“</div>
                                <h3 style="font-family: 'Playfair Display', Georgia, serif; font-size: 16.5px; color: #ffffff; margin: 0 0 6px 0; line-height: 1.35; font-weight: 700; white-space: normal;">
                                    ${item.title || ''}
                                </h3>
                                <div style="color: #94a3b8; font-size: 11.5px; margin-bottom: 8px; font-weight: 500;">
                                    ✍️ By <span style="color: #D4AF37; font-weight: 600;">${item.author || 'Chamber Counsel'}</span>
                                </div>
                                <p style="color: #cbd5e1; font-size: 12.8px; line-height: 1.55; margin: 0 0 12px 0; font-family: 'Georgia', serif; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; opacity: 0.92; white-space: normal;">
                                    "${item.message || ''}"
                                </p>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px; margin-top: auto;">
                                <span style="color: #94a3b8; font-size: 11px; font-style: italic;">JSM Perspective</span>
                                <span style="color: #D4AF37; font-weight: 700; font-size: 11.5px; display: inline-flex; align-items: center; gap: 4px;">Read Full Opinion →</span>
                            </div>
                        </article>
                    `;
                }).join('');

                const repeatCount = data.length <= 2 ? 6 : (data.length <= 4 ? 4 : 2);
                let fullConveyor = '';
                for (let i = 0; i < repeatCount * 2; i++) {
                    fullConveyor += singleSet;
                }
                track.innerHTML = fullConveyor;
            }
        }
    } catch(e) {
        console.error('Error fetching public opinions:', e);
    }
};

window.openOpinionArticleModal = function(id) {
    const opinion = (window.allOpinionsData || []).find(o => o._id === id);
    if (!opinion) return;

    const modal = document.getElementById('opinion-article-modal');
    if (!modal) return;

    const badge = document.getElementById('opinion-reader-badge');
    const date = document.getElementById('opinion-reader-date');
    const author = document.getElementById('opinion-reader-author');
    const title = document.getElementById('opinion-reader-title');
    const content = document.getElementById('opinion-reader-content');

    if (badge) badge.innerText = opinion.category || 'Legal Editorial';
    if (date) date.innerText = opinion.date ? `📅 ${opinion.date}` : '';
    if (author) author.innerText = opinion.author ? `✍️ ${opinion.author}` : '';
    if (title) title.innerText = opinion.title || '';
    if (content) content.innerText = opinion.message || '';

    modal.style.display = 'flex';
    void modal.offsetWidth;
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
};

window.closeOpinionArticleModal = function() {
    const modal = document.getElementById('opinion-article-modal');
    if (modal) {
        modal.classList.remove('open');
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
};

// Modal Backdrop Click & Escape Listener
document.addEventListener('click', (e) => {
    const newsModal = document.getElementById('news-article-modal');
    if (newsModal && newsModal.style.display !== 'none' && e.target === newsModal) {
        window.closeNewsArticleModal();
    }
    const opModal = document.getElementById('opinion-article-modal');
    if (opModal && opModal.style.display !== 'none' && e.target === opModal) {
        window.closeOpinionArticleModal();
    }
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        window.closeNewsArticleModal();
        window.closeOpinionArticleModal();
    }
});

// Auto-load News & Opinions on startup
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.loadPublicNews();
        window.loadPublicOpinions();
    });
} else {
    window.loadPublicNews();
    window.loadPublicOpinions();
}

// On-Scroll Intersection Observer for one-by-one section reveals
function initScrollReveal() {
    const revealElements = document.querySelectorAll('.scroll-reveal');
    if (!revealElements.length) return;

    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in-view');
                    obs.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.10,
            rootMargin: '0px 0px -40px 0px'
        });

        revealElements.forEach(el => observer.observe(el));
    } else {
        revealElements.forEach(el => el.classList.add('in-view'));
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initScrollReveal);
} else {
    initScrollReveal();
}
