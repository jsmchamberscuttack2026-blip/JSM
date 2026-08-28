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
      
      try {
          const response = await fetch('/api/appointments', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name, email, service })
          });
          
          if (response.ok) {
              alert('Appointment request submitted successfully!');
              appForm.reset();
          } else {
              alert('Failed to submit request.');
          }
      } catch (err) {
          console.error(err);
          alert('Error connecting to server.');
      }
    });
  }

  // Load Dynamic Office Information
  const publicOfficeInfo = document.getElementById('public-office-info');
  if(publicOfficeInfo) {
      const info = JSON.parse(localStorage.getItem('officeInfo'));
      if(info) {
          publicOfficeInfo.innerHTML = `
            ${info.address.replace(/\n/g, '<br>')}<br>
            Phone: ${info.phone}<br>
            Email: ${info.email}
          `;
      }
  }

  // Load and Render Advocates from API
  const advocatesGrid = document.getElementById('advocates-grid');
  if (advocatesGrid) {
      async function loadAdvocates() {
          try {
              const response = await fetch('/api/advocates');
              const parsedAdvocates = await response.json();
              
              if (parsedAdvocates.length === 0) {
                  advocatesGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #999;">No advocates listed at the moment.</p>';
              } else {
                  advocatesGrid.innerHTML = '';
                  parsedAdvocates.forEach(adv => {
                      const imgHtml = adv.imageUrl 
                        ? `<img src="${adv.imageUrl}" style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; margin: 0 auto 1rem; display: block; border: 2px solid var(--color-secondary);">` 
                        : `<div style="width: 100px; height: 100px; border-radius: 50%; background-color: #E0E0E0; margin: 0 auto 1rem;"></div>`;
                      
                      advocatesGrid.innerHTML += `
                        <div class="card text-center">
                            ${imgHtml}
                            <h3>${adv.name}</h3>
                            <p>${adv.specialty}</p>
                        </div>
                      `;
                  });
              }
          } catch (err) {
              console.error(err);
              advocatesGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #999;">Error loading advocates.</p>';
          }
      }
      loadAdvocates();
      
      // Listen for real-time updates
      if (typeof io !== 'undefined') {
          const socket = io();
          socket.on('advocates_updated', () => {
              loadAdvocates();
          });
      }
  }

});
