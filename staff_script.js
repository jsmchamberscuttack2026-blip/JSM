
    document.addEventListener('DOMContentLoaded', async () => {
        let advocateLogoUrl = null;
        try {
            const res = await fetch('/api/settings');
            const settings = await res.json();
            if (settings.logoUrl) {
                advocateLogoUrl = settings.logoUrl;
                const topLogo = document.getElementById('portal-logo');
                const loadLogo = document.getElementById('loading-logo');
                
                
                if(topLogo) { topLogo.src = advocateLogoUrl; topLogo.style.display = 'block'; }
                if(loadLogo) { loadLogo.src = advocateLogoUrl; loadLogo.style.display = 'block'; }
                
            }
        } catch(e) {}

        if (!sessionStorage.getItem('loadingScreenShown')) {
            setTimeout(() => {
                const screen = document.getElementById('login-loading-screen');
                if(screen) {
                    screen.style.opacity = '0';
                    setTimeout(() => {
                        screen.style.display = 'none';
                        
                        // Show Big Logo Popup if logo exists
                        const popup = document.getElementById('logo-popup-screen');
                        const bigLogo = document.getElementById('big-popup-logo');
                        if(popup && bigLogo) {
                            popup.style.display = 'flex';
                            popup.style.opacity = '0'; // start hidden
                            
                            // Trigger reflow for transition
                            void popup.offsetWidth;
                            
                            popup.style.opacity = '1';
                            bigLogo.style.transform = 'scale(1)';
                            
                            // Hide after 3 seconds
                            setTimeout(() => {
                                popup.style.opacity = '0';
                                bigLogo.style.transform = 'scale(1.1)'; // slight outward fade
                                setTimeout(() => popup.style.display = 'none', 500);
                            }, 3000);
                        }
                    }, 500);
                }
                sessionStorage.setItem('loadingScreenShown', 'true');
            }, 4000); // 4 seconds initial loading animation
        } else {
            const screen = document.getElementById('login-loading-screen');
            if(screen) screen.style.display = 'none';
        }
    });
        if (sessionStorage.getItem('staffLoggedIn') !== 'true') {
            window.location.href = 'staff-login.html';
        }

        const staffData = JSON.parse(sessionStorage.getItem('staffData') || '{}');
        if (staffData.name) {
            // Auto-sync permissions
            fetch('/api/advocates')
                .then(res => res.json())
                .then(data => {
                    const myAdv = data.find(a => a.email === staffData.email);
                    if (myAdv) {
                        staffData.access_appointments = myAdv.access_appointments || false;
                        staffData.access_clients = myAdv.access_clients || false;
                        staffData.access_add_case = myAdv.access_add_case || false;
                        sessionStorage.setItem('staffData', JSON.stringify(staffData));
                        
                        // Populate About Me
                        document.getElementById('about-name').innerText = myAdv.name || 'N/A';
                        document.getElementById('about-email').innerText = myAdv.email || 'N/A';
                        document.getElementById('about-specialty').innerText = myAdv.specialty || 'Staff Member';
                        if (myAdv.imageUrl) {
                            document.getElementById('about-img').src = myAdv.imageUrl;
                            document.getElementById('about-img').style.display = 'block';
                            document.getElementById('about-img-placeholder').style.display = 'none';
                        } else {
                            document.getElementById('about-img-placeholder').innerText = myAdv.name ? myAdv.name.charAt(0) : '?';
                        }
                        const badgeAppt = document.getElementById('about-access-appointments');
                        const badgeClient = document.getElementById('about-access-clients');
                        badgeAppt.className = 'badge active';
                        badgeAppt.innerText = 'Appointments';
                        badgeAppt.style.display = myAdv.access_appointments ? 'inline-block' : 'none';
                        
                        badgeClient.className = 'badge active';
                        badgeClient.innerText = 'Clients Directory';
                        badgeClient.style.display = myAdv.access_clients ? 'inline-block' : 'none';
                        
                        const badgeAddCase = document.getElementById('about-access-addcase');
                        badgeAddCase.className = 'badge active';
                        badgeAddCase.innerText = 'Add New Case';
                        badgeAddCase.style.display = myAdv.access_add_case ? 'inline-block' : 'none';
                        
                        // If no permissions at all, maybe show a message
                        if (!myAdv.access_appointments && !myAdv.access_clients && !myAdv.access_add_case) {
                            if (!document.getElementById('no-access-msg')) {
                                const msg = document.createElement('span');
                                msg.id = 'no-access-msg';
                                msg.style.color = '#80919d';
                                msg.style.fontSize = '0.9rem';
                                msg.innerText = 'No extra sections assigned.';
                                badgeAppt.parentElement.appendChild(msg);
                            }
                        } else {
                            const msg = document.getElementById('no-access-msg');
                            if (msg) msg.remove();
                        }

                        
                        const staffNav = document.getElementById('staff-nav');
                        const logoutBtn = document.getElementById('staff-logout');
                        
                        if (staffData.access_appointments && !document.getElementById('nav-appointments')) {
                            const a = document.createElement('a');
                            a.className = 'nav-btn';
                            a.id = 'nav-appointments';
                            a.innerHTML = '📅 Appts 🔒';
                            a.onclick = () => showSection('appointments');
                            staffNav.insertBefore(a, logoutBtn);
                        } else if (!staffData.access_appointments && document.getElementById('nav-appointments')) {
                            document.getElementById('nav-appointments').remove();
                        }
                        
                        if (staffData.access_add_case && !document.getElementById('nav-addcase')) {
                            const a = document.createElement('a');
                            a.className = 'nav-btn';
                            a.id = 'nav-addcase';
                            a.innerHTML = '➕ Case 🔒';
                            a.onclick = () => showSection('addcase');
                            staffNav.insertBefore(a, logoutBtn);
                        } else if (!staffData.access_add_case && document.getElementById('nav-addcase')) {
                            document.getElementById('nav-addcase').remove();
                        }

                        if (staffData.access_clients && !document.getElementById('nav-clients')) {
                            const a = document.createElement('a');
                            a.className = 'nav-btn';
                            a.id = 'nav-clients';
                            a.innerHTML = '👥 Clients 🔒';
                            a.onclick = () => showSection('clients');
                            staffNav.insertBefore(a, logoutBtn);
                        } else if (!staffData.access_clients && document.getElementById('nav-clients')) {
                            document.getElementById('nav-clients').remove();
                        }
                    }
                }).catch(e => console.error(e));

            document.getElementById('staff-name-display').innerText = staffData.name;
            const staffNav = document.getElementById('staff-nav');
            const logoutBtn = document.getElementById('staff-logout');
            
            if (staffData.access_appointments) {
                const a = document.createElement('a');
                a.className = 'nav-btn';
                a.id = 'nav-appointments';
                a.innerHTML = '📅 Appts 🔒';
                a.onclick = () => showSection('appointments');
                staffNav.insertBefore(a, logoutBtn);
            }
            if (staffData.access_clients) {
                const a = document.createElement('a');
                a.className = 'nav-btn';
                a.id = 'nav-clients';
                a.innerHTML = '👥 Clients 🔒';
                a.onclick = () => showSection('clients');
                staffNav.insertBefore(a, logoutBtn);
            }
            
            document.getElementById('nav-dashboard').addEventListener('click', () => showSection('dashboard'));

        }

        document.getElementById('staff-logout').addEventListener('click', (e) => {
            e.preventDefault();
            sessionStorage.removeItem('staffLoggedIn');
            sessionStorage.removeItem('staffData');
            window.location.href = 'staff-login.html';
        });

        // Case Management
        let myCases = [];
        const grid = document.getElementById('staff-cases-grid');

                async function loadMyCases() {
            try {
                grid.innerHTML = '<p style="color: #667085; font-style: italic;">Loading cases for ' + (staffData.email || 'unknown') + '...</p>';
                if (!staffData || !staffData.email) {
                    grid.innerHTML = '<p style="color: red;">Error: Staff email missing. Please Logout and Login again.</p>';
                    return;
                }
                const res = await fetch(`/api/staff-cases/${encodeURIComponent(staffData.email)}`);
                if (!res.ok) {
                    throw new Error(`Server returned ${res.status}`);
                }
                myCases = await res.json();
                
                if (!Array.isArray(myCases)) {
                    throw new Error("Invalid response from server. Expected array.");
                }
                
                if (myCases.length === 0) {
                    grid.innerHTML = '<p style="color: #0b1f33; font-weight: 500;">No cases assigned to you yet.</p>';
                    return;
                }

                grid.innerHTML = '';
                myCases.forEach(c => {

                    const card = document.createElement('div');
                    card.style.cssText = "background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1.5rem; box-shadow: 0 2px 4px rgba(0,0,0,0.02); display: flex; flex-direction: column; justify-content: space-between;";
                    let statusColor = c.status === "Under Review" ? "#b7791f" : "#2e7d32";
                    card.innerHTML = `
                        <div>
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                                <h4 style="margin: 0; font-size: 1.1rem; color: #0b1f33;">${c.client_name}</h4>
                                <span style="background: ${statusColor}22; color: ${statusColor}; padding: 0.2rem 0.6rem; border-radius: 20px; font-size: 0.75rem; font-weight: bold;">${c.status}</span>
                            </div>
                            <p style="margin: 0 0 0.5rem 0; font-size: 0.85rem; color: #667085;">🏷️ Ch: ${c.chamber_case_number || '-'} | Ct: ${c.court_case_number || '-'}</p>
                            <p style="margin: 0 0 0.5rem 0; font-size: 0.85rem; color: #667085;">💼 ${c.case_type}</p>
                            <p style="margin: 0 0 1rem 0; font-size: 0.85rem; color: #667085;">📅 ${c.next_hearing}</p>
                        </div>
                        <button class="btn btn-outline" style="width: 100%; padding: 0.4rem; font-size: 0.85rem;" onclick="openCaseModal('${c._id}')">Update Case</button>
                    `;
                    grid.appendChild(card);
                });
            } catch (err) {
                grid.innerHTML = '<p style="color: red;">Error loading cases.</p>';
                console.error(err);
            }
        }

        function openCaseModal(id) {
            const c = myCases.find(caseItem => caseItem._id === id);
            if (!c) return;
            
            document.getElementById('modal-case-id').value = c._id;
            document.getElementById('modal-chamber-case-number').value = c.chamber_case_number || "";
            document.getElementById('modal-court-case-number').value = c.court_case_number || "";
            document.getElementById('modal-status').value = c.status;
            document.getElementById('modal-hearing').value = c.next_hearing;
            document.getElementById('modal-notes').value = c.notes || "";
            
            // Load Message History
            const histBox = document.getElementById('modal-msg-history');
            if (c.notifications && c.notifications.length > 0) {
                histBox.innerHTML = '';
                c.notifications.forEach(n => {
                    histBox.innerHTML += `
                        <div style="margin-bottom: 0.8rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem;">
                            <strong style="color: var(--color-primary);">${n.date}</strong><br>
                            <span style="color: var(--color-text-light);">${n.message}</span>
                        </div>
                    `;
                });
            } else {
                histBox.innerHTML = '<span style="color: #999;">No messages sent yet.</span>';
            }
            
            document.getElementById('edit-case-modal').style.display = 'flex';
        }

        function closeCaseModal() {
            document.getElementById('edit-case-modal').style.display = 'none';
        }

        document.getElementById('staff-add-case-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button');
            const originalText = btn.innerText;
            btn.innerText = 'Creating & Emailing...';
            btn.disabled = true;

            const payload = {
                client_name: document.getElementById('case-client-name').value,
                email: document.getElementById('case-email').value,
                case_type: document.getElementById('case-type').value,
                chamber_case_number: document.getElementById('case-chamber-number').value,
                court_case_number: document.getElementById('case-court-number').value,
                // Assign to the staff member who creates it!
                assigned_staff_email: staffData.email || ""
            };

            try {
                const res = await fetch('/api/cases', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                if (res.ok) {
                    alert('Case created and email sent successfully!');
                    e.target.reset();
                    // Reload my cases to show the new one
                    myCasesCache = "";
                    loadStaffDashboard();
                } else {
                    alert('Failed to create case.');
                }
            } catch (err) {
                console.error(err);
                alert('Error creating case.');
            } finally {
                btn.innerText = originalText;
                btn.disabled = false;
            }
        });

        async function saveCaseModal() {
            const id = document.getElementById('modal-case-id').value;
            const chamber_case_number = document.getElementById('modal-chamber-case-number').value;
            const court_case_number = document.getElementById('modal-court-case-number').value;
            const status = document.getElementById('modal-status').value;
            const next_hearing = document.getElementById('modal-hearing').value;
            const notes = document.getElementById('modal-notes').value;
            
            try {
                await fetch(`/api/cases/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status, next_hearing, notes, chamber_case_number, court_case_number })
                });
                alert('Case details updated successfully!');
                closeCaseModal();
                loadMyCases();
            } catch(e) {
                alert('Error updating case');
            }
        }
                
        async function sendMessageToClient() {
            const id = document.getElementById('modal-case-id').value;
            const subject = document.getElementById('modal-msg-subject').value;
            const message = document.getElementById('modal-msg-body').value;
            const fileInput = document.getElementById('modal-msg-file');
            
            if (!subject || !message) {
                alert('Please enter a subject and a message.');
                return;
            }
            
            const btn = document.getElementById('btn-send-msg');
            btn.innerText = 'Sending...';
            btn.disabled = true;
            
            const formData = new FormData();
            formData.append('subject', subject);
            formData.append('message', message);
            if (fileInput.files.length > 0) {
                formData.append('file', fileInput.files[0]);
            }
            
            try {
                const res = await fetch(`/api/cases/${id}/email`, {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();
                if (res.ok) {
                    alert('Message sent successfully!');
                    document.getElementById('modal-msg-subject').value = '';
                    document.getElementById('modal-msg-body').value = '';
                    if (fileInput) fileInput.value = '';
                } else {
                    alert(data.error || 'Failed to send message.');
                }
            } catch (err) {
                alert('Server error.');
            }
            
            btn.innerText = 'Send Message to Client';
            btn.disabled = false;
        }

        let unlockedSections = {
            'appointments': false,
            'clients': false,
            'addcase': false
        };

        function showSection(sectionId) {
            document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
            document.getElementById('section-' + sectionId).classList.add('active');
            
            document.querySelectorAll('#staff-nav .nav-btn').forEach(a => a.classList.remove('active'));
            const activeNav = document.getElementById('nav-' + sectionId);
            if(activeNav) activeNav.classList.add('active');

            if ((sectionId === 'appointments' || sectionId === 'clients' || sectionId === 'addcase') && !unlockedSections[sectionId]) {
                document.getElementById(`lock-gate-${sectionId}`).style.display = 'block';
                document.getElementById(`content-${sectionId}`).style.display = 'none';
            } else if (sectionId === 'appointments') {
                loadStaffAppointments();
            } else if (sectionId === 'clients') {
                loadStaffClients();
            }
        }

        // Initialize
        loadMyCases();
        
        let isCodeMode = { 'appointments': false, 'clients': false, 'addcase': false };

        async function verifySection(section) {
            if (isCodeMode[section]) {
                // Verify Email Code
                const code = document.getElementById(`code-input-${section}`).value;
                if (!code) return alert("Enter code");
                
                try {
                    const res = await fetch('/api/staff/verify-section-code', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ email: staffData.email, code })
                    });
                    const result = await res.json();
                    if (result.valid) {
                        unlockedSections[section] = true;
                        document.getElementById(`lock-gate-${section}`).style.display = 'none';
                        document.getElementById(`content-${section}`).style.display = 'block';
                        const navLink = document.getElementById(`nav-${section}`);
                        navLink.innerHTML = navLink.innerHTML.replace('🔒', '🔓');
                        if (section === 'appointments') loadStaffAppointments();
                        if (section === 'clients') loadStaffClients();
                        // No specific load function for addcase needed since it's just a form
                    } else {
                        alert(result.error);
                    }
                } catch(e) { console.error(e); }
                
            } else {
                // Verify Daily Password
                const pwd = document.getElementById(`pwd-input-${section}`).value;
                if (!pwd) return alert("Enter password");
                
                try {
                    const res = await fetch('/api/staff/verify-section', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ section, password: pwd })
                    });
                    const result = await res.json();
                    if (result.valid) {
                        unlockedSections[section] = true;
                        document.getElementById(`lock-gate-${section}`).style.display = 'none';
                        document.getElementById(`content-${section}`).style.display = 'block';
                        const navLink = document.getElementById(`nav-${section}`);
                        navLink.innerHTML = navLink.innerHTML.replace('🔒', '🔓');
                        if (section === 'appointments') loadStaffAppointments();
                        if (section === 'clients') loadStaffClients();
                        // No specific load function for addcase needed since it's just a form
                    } else {
                        alert(result.error);
                    }
                } catch (e) { console.error(e); }
            }
        }

        async function forgotSectionPassword(section) {
            isCodeMode[section] = true;
            document.getElementById(`pwd-input-${section}`).style.display = 'none';
            document.getElementById(`pwd-verify-${section}`).style.display = 'block';
            
            try {
                const res = await fetch('/api/staff/send-section-code', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ email: staffData.email })
                });
                if (res.ok) alert("Verification code sent to your email. You have 30 seconds to enter it.");
                else alert("Failed to send code.");
            } catch (e) { console.error(e); }
        }
        
        let staffApptCache = "";
        async function loadStaffAppointments() {
            try {
                const res = await fetch('/api/appointments');
                const data = await res.json();
                
                const newDataString = JSON.stringify(data);
                if (newDataString === staffApptCache) return;
                staffApptCache = newDataString;
                
                const tbody = document.getElementById('staff-appts-tbody');
                tbody.innerHTML = '';
                data.forEach(appt => {
                    const status = appt.status || 'Pending';
                    const isApproved = status === 'Approved';
                    const dateVal = appt.appointment_date || '';
                    const timeVal = appt.appointment_time || '';

                    const statusBadge = isApproved 
                        ? `<span style="background: #388E3C; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">Approved</span>`
                        : `<span style="background: #F57C00; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">Pending</span>`;

                    const dateInput = isApproved ? dateVal : `<input type="date" id="date-${appt._id}" class="form-control" style="width:130px; display:inline-block; margin-bottom:5px;">`;
                    const timeInput = isApproved ? timeVal : `<input type="time" id="time-${appt._id}" class="form-control" style="width:110px; display:inline-block;">`;
                    
                    const approveBtn = isApproved 
                        ? '' 
                        : `<button class="btn btn-primary" style="padding:4px 8px; font-size:0.8rem; margin-right:5px;" onclick="approveStaffAppointment('${appt._id}')">Approve</button>`;
                        
                    const deleteBtn = `<button class="btn btn-outline" style="padding:4px 8px; font-size:0.8rem;" onclick="deleteStaffAppointment('${appt._id}')">Delete</button>`;

                    const tr = document.createElement('tr');
                    tr.style.borderBottom = '1px solid #eee';
                    tr.innerHTML = `
                        <td style="padding:10px;">${appt.name}</td>
                        <td style="padding:10px;">${appt.email}</td>
                        <td style="padding:10px;">${statusBadge}</td>
                        <td style="padding:10px;">${dateInput}<br>${timeInput}</td>
                        <td style="padding:10px;">
                            ${approveBtn}
                            ${deleteBtn}
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            } catch(e) { console.error(e); }
        }
        
        window.approveStaffAppointment = async function(id) {
            const date = document.getElementById(`date-${id}`).value;
            const time = document.getElementById(`time-${id}`).value;
            if(!date || !time) return alert('Please select a date and time.');
            try {
                const response = await fetch('/api/appointments/approve', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ id, date, time })
                });
                if(response.ok) {
                    alert('Appointment approved!');
                    staffApptCache = "";
                    loadStaffAppointments();
                } else alert('Failed to approve');
            } catch(err) { console.error(err); }
        }

        window.deleteStaffAppointment = async function(id) {
            if(!confirm('Are you sure you want to delete this appointment?')) return;
            try {
                const response = await fetch(`/api/appointments/${id}`, { method: 'DELETE' });
                if(response.ok) {
                    staffApptCache = "";
                    loadStaffAppointments();
                }
            } catch(err) { console.error(err); }
        }

        
        let staffClientsCache = "";
        async function loadStaffClients() {
            try {
                const res = await fetch('/api/archived-cases');
                const clients = await res.json();
                
                const newDataString = JSON.stringify(clients);
                if (newDataString === staffClientsCache) return;
                staffClientsCache = newDataString;
                
                const tbody = document.getElementById('staff-clients-tbody');
                tbody.innerHTML = '';
                clients.forEach(c => {
                    tbody.innerHTML += `<tr><td style="padding:10px; border-bottom:1px solid #eee;"><a href="#" onclick="printCaseDetails('${c._id}'); return false;" style="color: #0A192F; font-weight: bold; text-decoration: underline;">${c.client_name} 📄</a></td><td style="padding:10px; border-bottom:1px solid #eee;">${c.email}</td><td style="padding:10px; border-bottom:1px solid #eee;">${c.case_type}</td><td style="padding:10px; border-bottom:1px solid #eee;">${c.status}</td></tr>`;
                });
            } catch(e) { console.error(e); }
        }



        window.printCaseDetails = async function(id) {
        // Open window synchronously to avoid popup blockers on mobile
        const printWindow = window.open('', '', 'width=800,height=900');
        if (!printWindow) {
            alert("Popup blocked! Please allow popups for this site.");
            return;
        }
        printWindow.document.write('<html><head><title>Loading...</title>    <meta name="google-site-verification" content="Cb6ak0wetmxY9fGq95lyGFJI2XIfWpdpoZRLJ_e-4RY" />
</head><body style="font-family:sans-serif; padding:40px;"><h2>Generating Report...</h2></body></html>');
        
        try {
            const res = await fetch(`/api/cases/${id}`);
            const c = await res.json();
            
            let chamberAddress = 'Cuttack, Odisha';
            try {
                const setRes = await fetch('/api/settings');
                const settings = await setRes.json();
                if (settings.address) chamberAddress = settings.address;
            } catch(e) {}
            
            let hearingHtml = `
            <style>
            .timeline { display: flex; align-items: flex-start; overflow-x: auto; padding: 20px 0; margin-bottom: 20px; font-family: sans-serif; }
            .timeline-item { position: relative; text-align: center; min-width: 120px; flex: 1; }
            .timeline { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .timeline-item::after { content: ''; position: absolute; top: 12px; left: 50%; width: 100%; border-top: 3px solid #e2e8f0; z-index: 1; }
            .timeline-item:last-child::after { display: none; }
            .timeline-dot { width: 14px; height: 14px; background: #173650; border-radius: 50%; margin: 0 auto 10px auto; position: relative; z-index: 2; border: 4px solid #173650; }
            .timeline-date { font-size: 0.85rem; color: #333; font-weight: bold; padding: 0 10px; }
            .timeline-finished .timeline-dot { background: #2e7d32; border-color: #2e7d32; }
            .timeline-finished .timeline-date { color: #2e7d32; }
            </style>
            <div class="timeline">
            `;
            
            let dates = [];
            if(c.hearing_history && c.hearing_history.length > 0) {
                dates = [...c.hearing_history];
            } else if (c.next_hearing && c.next_hearing !== 'To Be Decided') {
                dates.push(c.next_hearing);
            }
            
            if (dates.length === 0) {
                hearingHtml += `<div style="color: #666; font-style: italic; padding: 10px;">No hearings recorded</div>`;
            } else {
                dates.forEach(date => { 
                    hearingHtml += `<div class="timeline-item"><div class="timeline-dot"></div><div class="timeline-date">${date}</div></div>`; 
                });
                
                if (c.status && c.status.toLowerCase().includes('finished')) {
                    hearingHtml += `<div class="timeline-item timeline-finished"><div class="timeline-dot"></div><div class="timeline-date">Finished</div></div>`;
                }
            }
            hearingHtml += '</div>';

            let emailsHtml = '<ul>';
            if(c.email_logs && c.email_logs.length > 0) {
                c.email_logs.forEach(log => { 
                    emailsHtml += `<li><strong>${log.timestamp || 'Unknown Date'}:</strong> ${log.subject} <em>(${log.status})</em></li>` 
                });
            } else {
                emailsHtml += `<li>No emails sent to this client.</li>`;
            }
            emailsHtml += '</ul>';
            
            const totalEmails = c.email_logs ? c.email_logs.length : 0;

            printWindow.document.open();
            printWindow.document.write(`
                <html>
                <head>
                    <title>Case Details - ${c.client_name}</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 40px; line-height: 1.6; }
                        .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #0A192F; padding-bottom: 20px; }
                        .header h1 { margin: 0; color: #0A192F; font-family: 'Playfair Display', serif; }
                        .header p { margin: 5px 0 0; color: #666; }
                        .details { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
                        .details div { padding: 15px; border: 1px solid #eee; background: #fafafa; border-radius: 8px; }
                        .section { margin-bottom: 30px; }
                        .section h3 { border-bottom: 1px solid #ccc; padding-bottom: 10px; color: #333; }
                        @media print {
                            body { padding: 0; }
                        }
                    
        .data-table {
            width: 100%;
            border-collapse: collapse;
            background: #ffffff;
            box-shadow: 0 4px 6px rgba(0,0,0,0.05);
            border-radius: 8px;
            overflow: hidden;
        }
        .data-table th, .data-table td {
            padding: 1rem;
            text-align: left;
            border-bottom: 1px solid #e7ebf0;
        }
        .data-table th {
            background-color: #f4f6f8;
            color: #173650;
            font-weight: 600;
        }
        .badge {
            padding: 0.3rem 0.6rem;
            border-radius: 12px;
            font-size: 0.8rem;
            font-weight: 600;
        }
        .badge.pending { background-color: #FFF3E0; color: #E65100; }
        .badge.active { background-color: #E8F5E9; color: #2E7D32; }

</style>
                    <meta name="google-site-verification" content="Cb6ak0wetmxY9fGq95lyGFJI2XIfWpdpoZRLJ_e-4RY" />
</head>
                <body>
                    <div class="report-container">
                        <div class="header">
                        <h1>JSM. Chambers</h1>
                        <p style="font-size: 0.9rem; color: #444;">${chamberAddress}</p>
                        <p style="margin-top: 15px; font-weight: bold;">Case Information Report</p>
                    </div>
                    
                    <div class="details">
                        <div>
                            <strong>Client Name:</strong><br> ${c.client_name}
                        </div>
                        <div>
                            <strong>Email Address:</strong><br> ${c.email}
                        </div>
                        <div>
                            <strong>Chamber Case No:</strong><br> ${c.chamber_case_number || 'Not Assigned'}<br><strong>Court Case No:</strong><br> ${c.court_case_number || 'Not Assigned'}
                        </div>
                        <div>
                            <strong>Case Type / Subject:</strong><br> ${c.case_type}
                        </div>
                        <div>
                            <strong>Status:</strong><br> ${c.status}
                        </div>
                        <div>
                            <strong>Assigned Advocate:</strong><br> ${c.assigned_staff_email || 'Unassigned'}
                        </div>
                    </div>

                    <div class="section">
                        <h3>Hearing History</h3>
                        ${hearingHtml}
                    </div>

                    <div class="section">
                        <h3>Email Communication History (Total Sent: ${totalEmails})</h3>
                        ${emailsHtml}
                    </div>

                    <div class="section">
                        <h3>Administrative Notes</h3>
                        <p>${c.notes ? c.notes.replace(/\\n/g, '<br>') : 'No notes recorded.'}</p>
                    </div>
                    
                    <div style="text-align: center; margin-top: 50px; font-size: 0.8em; color: #888;">
                        Generated on ${new Date().toLocaleString()} by JSM. Chambers Case Management System
                    </div>
                    </div>
                </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
            }, 500);
        } catch(e) {
            console.error(e);
            printWindow.document.write('<h2>Error generating report.</h2>');
            alert('Failed to fetch case details for printing.');
        }
    };

        setInterval(() => {
            if (unlockedSections['appointments']) loadStaffAppointments();
            if (unlockedSections['clients']) loadStaffClients();
        }, 1000);
