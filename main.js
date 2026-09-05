// main.js - Global Interactions for JSM. Chambers

document.addEventListener('DOMContentLoaded', () => {
  
  // Mobile Navigation Toggle
  const mobileBtn = document.querySelector('.mobile-menu-btn');
  const navLinks = document.querySelector('.nav-links');
  const navActions = document.querySelector('.nav-actions');

  if(mobileBtn) {
    mobileBtn.addEventListener('click', () => {
      navLinks.classList.toggle('active');
      navActions.classList.toggle('active');
    });
  }

  // Smooth Scrolling for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      if(this.getAttribute('href') !== '#') {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if(target) {
          target.scrollIntoView({
            behavior: 'smooth'
          });
          // Close mobile menu if open
          if(navLinks && navLinks.classList.contains('active')) {
            navLinks.classList.remove('active');
            navActions.classList.remove('active');
          }
        }
      }
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
  fetch('/api/settings').then(res => res.json()).then(info => {
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
              const response = await fetch('/api/advocates', { cache: 'no-store' });
              const advocates = await response.json();
              const newDataString = JSON.stringify(advocates);
              if (newDataString === advocatesCache) return;
              advocatesCache = newDataString;
              advocatesGrid.innerHTML = '';
              if (advocates.length > 0) {
                  advocates.forEach(adv => {
                      const div = document.createElement('div');
                      div.className = 'advocate';
                      const role = adv.role || 'Legal Professional';
                      let imageHtml = '';
                      if (adv.imageUrl) {
                          imageHtml = `<img class="adv-profile-photo" src="${adv.imageUrl}" style="width: 100%; height: 310px; object-fit: cover; display: block;" alt="${adv.name}">`;
                      }
                      div.innerHTML = `
                          ${imageHtml}
                          <div class="advocate-info">
                              <div class="advocate-role">${role}</div>
                              <h3>${adv.name}</h3>
                              <p>${adv.specialty}</p>
                          </div>
                      `;
                      advocatesGrid.appendChild(div);
                  });
              }
          } catch (err) {
              console.error(err);
              advocatesGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #999;">Error loading advocates.</p>';
          }
      }
      loadAdvocates();
      
      // Short Polling for Real-time Sync (Serverless Compatible)
      setInterval(loadAdvocates, 1000);
  }

    // Public Loading Screen Logic (3 Seconds)
    if (!sessionStorage.getItem('publicLoadingScreenShown')) {
        setTimeout(() => {
            const screen = document.getElementById('public-loading-screen');
            if(screen) {
                screen.style.opacity = '0';
                setTimeout(() => screen.style.display = 'none', 500);
            }
            sessionStorage.setItem('publicLoadingScreenShown', 'true');
        }, 3000);
    } else {
        const screen = document.getElementById('public-loading-screen');
        if(screen) screen.style.display = 'none';
    }
});

// Gallery Slideshow with Polling
document.addEventListener('DOMContentLoaded', () => {
    const gallerySection = document.getElementById('public-gallery');
    const container = document.getElementById('gallery-container');
    if (!gallerySection || !container) return;

    let galleryCache = "";
    let slideInterval = null;

    async function loadGallery() {
        try {
            const res = await fetch('/api/gallery', { cache: 'no-store' });
            const items = await res.json();
            const dataString = JSON.stringify(items);
            
            // Only rebuild if the data actually changed
            if (dataString === galleryCache) return;
            galleryCache = dataString;

            if (items.length > 0) {
                gallerySection.style.display = 'block';
                let html = '';
                items.forEach((item, index) => {
                    const activeClass = index === 0 ? 'active' : '';
                    const descHtml = item.description ? `<div class="desc">${item.description}</div>` : '';
                    html += `
                        <div class="gallery-slide ${activeClass}">
                            <img src="${item.imageUrl}" alt="Gallery Image">
                            ${descHtml}
                        </div>
                    `;
                });
                container.innerHTML = html;

                if (slideInterval) clearInterval(slideInterval);
                
                if (items.length > 1) {
                    let currentIndex = 0;
                    slideInterval = setInterval(() => {
                        const slides = container.querySelectorAll('.gallery-slide');
                        if(slides.length === 0) return;
                        slides[currentIndex].classList.remove('active');
                        currentIndex = (currentIndex + 1) % slides.length;
                        slides[currentIndex].classList.add('active');
                    }, 3000);
                }
            } else {
                gallerySection.style.display = 'none';
                container.innerHTML = '';
                if (slideInterval) clearInterval(slideInterval);
            }
        } catch (err) {
            console.error('Error loading gallery:', err);
        }
    }

    loadGallery();
    // Poll every 3 seconds for new gallery images
    setInterval(loadGallery, 3000);
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
