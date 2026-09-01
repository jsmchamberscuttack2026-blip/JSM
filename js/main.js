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

  // Load Dynamic Office Information
  const publicOfficeInfo = document.getElementById('public-office-info');
  if(publicOfficeInfo) {
      fetch('/api/settings').then(res => res.json()).then(info => {
          if(info.address || info.phone || info.email) {
              publicOfficeInfo.innerHTML = `
                ${(info.address || '').replace(/\n/g, '<br>')}<br>
                Phone: ${info.phone || ''}<br>
                Email: ${info.email || ''}
              `;
          }
      }).catch(err => console.error("Error loading settings:", err));
  }

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
                      const bgStyle = adv.imageUrl ? `background-image: url('${adv.imageUrl}');` : `background-color: #0c1b2a;`;
                      const role = adv.role || 'Legal Professional';
                      div.innerHTML = `
                          <div class="advocate-image" style="${bgStyle} background-size: cover; background-position: center;"></div>
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

});
