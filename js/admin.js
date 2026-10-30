// Ensure admin_logged_in cookie is always set for API authorization
try {
    document.cookie = "admin_logged_in=true; path=/; max-age=86400; SameSite=Lax";
} catch(e) {}

// Automatic Interceptor: Guarantee all admin panel fetch requests send X-Admin-Request: true
(function() {
    const _origFetch = window.fetch;
    window.fetch = function(input, init) {
        init = init || {};
        init.headers = init.headers || {};
        if (init.headers instanceof Headers) {
            init.headers.set('X-Admin-Request', 'true');
        } else if (Array.isArray(init.headers)) {
            init.headers.push(['X-Admin-Request', 'true']);
        } else {
            init.headers['X-Admin-Request'] = 'true';
        }
        return _origFetch.call(this, input, init);
    };
})();

// Helper: compress an image File to a small base64 JPEG

// ==========================================
// TOAST NOTIFICATIONS
// ==========================================
window.showToast = function(message, type = 'success') {
    let toast = document.getElementById('admin-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'admin-toast';
        document.body.appendChild(toast);
        
        const style = document.createElement('style');
        style.innerHTML = `
            #admin-toast {
                position: fixed;
                bottom: 30px;
                right: 30px;
                padding: 16px 28px;
                border-radius: 8px;
                color: white;
                font-weight: 600;
                font-size: 15px;
                z-index: 999999;
                opacity: 0;
                transform: translateY(20px);
                transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                pointer-events: none;
                box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                display: flex;
                align-items: center;
                gap: 10px;
            }
            #admin-toast.show {
                opacity: 1;
                transform: translateY(0);
            }
        `;
        document.head.appendChild(style);
    }
    
    let icon = '✅';
    if (type === 'error') {
        toast.style.background = '#ef4444';
        icon = '❌';
    } else if (type === 'info') {
        toast.style.background = '#3b82f6';
        icon = 'ℹ️';
    } else {
        toast.style.background = '#10b981';
        icon = '✅';
    }
    
    toast.innerHTML = `<span>${icon}</span> <span>${message.replace(/\n/g, '<br>')}</span>`;
    toast.classList.add('show');
    
    if (window.toastTimeout) clearTimeout(window.toastTimeout);
    window.toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
};

window.compressImage = function(file, maxSize = 300) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                let w = img.width, h = img.height;
                if (w > h) { if (w > maxSize) { h = Math.round(h * maxSize / w); w = maxSize; } }
                else { if (h > maxSize) { w = Math.round(w * maxSize / h); h = maxSize; } }
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', 0.80));
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

// Admin Auth Check
if (sessionStorage.getItem('adminLoggedIn') !== 'true') {
    window.location.href = 'admin-login.html';
}

document.addEventListener('DOMContentLoaded', () => {
    // Navigation Logic
    const navLinks = document.querySelectorAll('.sidebar-nav-link, .sidebar ul li a');
    checkEmailPasswordButtons();
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            if (link.getAttribute('href') === 'index.html' || link.getAttribute('target') === '_blank') return;
            e.preventDefault();
            const sectionId = link.getAttribute('data-section') || link.id.replace('nav-', '');
            if (sectionId && typeof window.showSection === 'function') {
                window.showSection(sectionId);
            }
        });
    });

    // ==========================================
    // Appointments Management
    // ==========================================
        let apptCache = "";

    window.toggleDateFolder = function(dateId) {
        const content = document.getElementById('folder-content-' + dateId);
        const icon = document.getElementById('folder-icon-' + dateId);
        if (content.style.display === 'none') {
            content.style.display = 'block';
            icon.innerText = '📂';
        } else {
            content.style.display = 'none';
            icon.innerText = '📁';
        }
    };

    async function loadAppointments() {
        const container = document.getElementById('appointments-accordion-container');
        if (!container) return;
        try {
            const response = await fetch('/api/appointments', { cache: 'no-store' });
            const data = await response.json();
            
            const newDataString = JSON.stringify(data);
            if (newDataString === apptCache) return;
            apptCache = newDataString;
            
            // Update Stats
            const statAppts = document.getElementById('stat-appointments');
            if (statAppts) statAppts.innerText = data.length;

            if (data.length > 0) {
                container.innerHTML = '';
                
                // Group by date
                const grouped = {};
                data.forEach(appt => {
                    const date = appt.appointment_date || 'Unassigned/Pending';
                    if (!grouped[date]) grouped[date] = [];
                    grouped[date].push(appt);
                });
                
                // Sort dates (descending)
                const sortedDates = Object.keys(grouped).sort((a,b) => {
                    if(a === 'Unassigned/Pending') return -1;
                    if(b === 'Unassigned/Pending') return 1;
                    return new Date(b) - new Date(a);
                });
                
                sortedDates.forEach((date, idx) => {
                    const appts = grouped[date];
                    let dateDisplay = date;
                    if(date !== 'Unassigned/Pending') {
                        try {
                            const d = new Date(date);
                            dateDisplay = d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
                        } catch(e) {}
                    }
                    
                    const folderDiv = document.createElement('div');
                    folderDiv.style.border = '1px solid #e2e8f0';
                    folderDiv.style.borderRadius = '8px';
                    folderDiv.style.overflow = 'hidden';
                    folderDiv.style.background = '#f8fafc';
                    folderDiv.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
                    
                    const headerHtml = `
                        <div onclick="toggleDateFolder('${idx}')" style="padding: 15px 20px; background: #0A192F; color: white; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: background 0.2s;">
                            <div style="font-weight: bold; font-size: 1.1rem; display: flex; align-items: center; gap: 10px;">
                                <span id="folder-icon-${idx}" style="font-size: 1.4rem;">📁</span> ${dateDisplay}
                            </div>
                            <span style="background: #D4AF37; color: #0A192F; padding: 4px 12px; border-radius: 12px; font-weight: bold; font-size: 0.9rem;">${appts.length} Appointment(s)</span>
                        </div>
                    `;
                    
                    let tableRows = '';
                    appts.forEach(appt => {
                        const status = appt.status || 'Pending';
                        const isApproved = status === 'Approved';
                        const dateVal = appt.appointment_date || '';
                        const timeVal = appt.appointment_time || '';

                        const statusBadge = isApproved 
                            ? `<span style="background: #10b981; color: white; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: bold;">Approved</span>`
                            : `<span style="background: #F57C00; color: white; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: bold;">Pending</span>`;

                        const dateInput = isApproved ? `<div style="font-weight: bold; color: #334155;">${dateVal}</div>` : `<input type="date" id="date-${appt._id}" class="form-control" style="width:130px; display:inline-block; margin-bottom:5px;">`;
                        const timeInput = isApproved ? `<div style="color: #64748b;">${timeVal}</div>` : `<input type="time" id="time-${appt._id}" class="form-control" style="width:110px; display:inline-block;">`;
                        
                        const approveBtn = isApproved 
                            ? '' 
                            : `<button class="btn btn-primary" style="margin-right: 5px; padding: 0.4rem 0.8rem; font-size: 0.85rem; background: #D4AF37; color: #0A192F; border: none; font-weight: bold; cursor: pointer; border-radius: 4px;" onclick="approveAppt('${appt._id}')">Approve</button>`;

                        tableRows += `
                            <tr style="background: white; border-bottom: 1px solid #e2e8f0; transition: background 0.2s;">
                                <td style="padding: 15px; text-align: left; font-weight: 500;">${appt.name}</td>
                                <td style="padding: 15px; text-align: left; color: #64748b;">${appt.email}</td>
                                <td style="padding: 15px; text-align: left;">${statusBadge}</td>
                                <td style="padding: 15px; text-align: left;">
                                    ${dateInput}
                                    ${timeInput}
                                </td>
                                <td style="padding: 15px; text-align: left;">
                                    ${approveBtn}
                                    <button class="btn btn-error" style="background-color: #ef4444; color: white; border: none; padding: 0.4rem 0.8rem; border-radius: 4px; cursor: pointer; font-size: 0.85rem; font-weight: bold;" onclick="deleteAppointment('${appt._id}')">Delete</button>
                                </td>
                            </tr>
                        `;
                    });
                    
                    const contentHtml = `
                        <div id="folder-content-${idx}" style="display: none; padding: 0;">
                            <table style="width: 100%; border-collapse: collapse; margin: 0;">
                                <thead>
                                    <tr style="background: #f1f5f9; color: #475569; text-transform: uppercase; font-size: 0.8rem; letter-spacing: 1px;">
                                        <th style="padding: 12px 15px; text-align: left; font-weight: 700;">Name</th>
                                        <th style="padding: 12px 15px; text-align: left; font-weight: 700;">Email</th>
                                        <th style="padding: 12px 15px; text-align: left; font-weight: 700;">Status</th>
                                        <th style="padding: 12px 15px; text-align: left; font-weight: 700;">Set Date & Time</th>
                                        <th style="padding: 12px 15px; text-align: left; font-weight: 700;">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${tableRows}
                                </tbody>
                            </table>
                        </div>
                    `;
                    
                    folderDiv.innerHTML = headerHtml + contentHtml;
                    container.appendChild(folderDiv);
                });
            } else {
                container.innerHTML = '<div style="text-align: center; color: #94a3b8; font-size: 1.1rem; padding: 3rem; background: #f8fafc; border-radius: 8px; border: 1px dashed #cbd5e1;">No pending appointments found.</div>';
            }
        } catch (error) {
            console.error('Error loading appointments:', error);
        }
    }

    // Add approveAppt to window scope so onclick can reach it
    window.approveAppt = async function(id) {
        const date = document.getElementById(`date-${id}`).value;
        const time = document.getElementById(`time-${id}`).value;
        if (!date || !time) {
            showToast('Please select both Date and Time before approving.');
            return;
        }

        try {
            const response = await fetch('/api/appointments/approve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, date, time })
            });

            if (response.ok) {
                showToast('Approved & Email Sent');
                apptCache = ''; // force reload
                loadAppointments();
            } else {
                showToast('Failed to approve appointment.', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Server error.', 'error');
        }
    };

    if (document.getElementById("appointments-accordion-container")) {
        loadAppointments();
        setInterval(loadAppointments, 1000);
    }

    window.deleteAppointment = async function(id) {
        if (!confirm('Are you sure you want to delete this appointment?')) return;
        try {
            const response = await fetch(`/api/appointments/${id}`, { method: 'DELETE' });
            if (response.ok) {
                apptCache = "";
                loadAppointments();
            } else {
                showToast('Failed to delete appointment', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Error connecting to server', 'error');
        }
    };

    window.deleteAllAppointments = async function() {
        if (!confirm('WARNING: Are you sure you want to delete ALL appointments? This cannot be undone.')) return;
        try {
            const response = await fetch(`/api/appointments`, { method: 'DELETE' });
            if (response.ok) {
                apptCache = "";
                loadAppointments();
            } else {
                showToast('Failed to delete all appointments', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Error connecting to server', 'error');
        }
    };

    // ==========================================
    // Cases Management
    // ==========================================
    const addCaseForm = document.getElementById('add-case-form');
    const casesGrid = document.getElementById('cases-grid');
    const recentCasesTbody = document.getElementById('recent-cases-tbody');
    let casesCache = "";
    let globalCasesData = []; window.globalCasesData = globalCasesData;

    async function loadCases() {
        window.loadCases = loadCases;
        if (!casesGrid) return;
        try {
            const response = await fetch('/api/cases', { cache: 'no-store' });
            const cases = await response.json();
            const newDataString = JSON.stringify(cases);
            if (typeof window.casesCache !== 'undefined' && newDataString === window.casesCache) return;
            window.casesCache = newDataString;

            globalCasesData = cases; window.globalCasesData = cases;
            


            
            // Update Stats
            const statActive = document.getElementById('stat-active-cases');
            if (statActive) statActive.innerText = cases.length;
            
            if (cases.length > 0) {
                casesGrid.innerHTML = '';
            
            // Populate Payment Datalist
            try {
                const paymentDatalist = document.getElementById('payment-case-datalist');
                if (paymentDatalist) {
                    paymentDatalist.innerHTML = '';
                    cases.forEach(c => {
                        if(c.status !== "Closed") {
                            const searchStr = `Chamber: ${c.chamber_case_number || '-'} | Court: ${c.court_case_number || '-'} | ${c.client_name}`;
                            const opt = document.createElement('option');
                            opt.value = searchStr;
                            paymentDatalist.appendChild(opt);
                        }
                    });
                }
            } catch (e) {
                console.error("Error populating payment datalist:", e);
            }
                cases.forEach(c => {
                    const card = document.createElement('div');
                    card.className = 'admin-case-card-item';
                    card.setAttribute('data-chamber', (c.chamber_case_number || '').toLowerCase());
                    card.setAttribute('data-court', (c.court_case_number || '').toLowerCase());
                    card.setAttribute('data-name', (c.client_name || '').toLowerCase());
                    card.style.cssText = "background: #f8fafc; border: 1px solid #e7ebf0; border-radius: 12px; padding: 1.5rem; display: flex; flex-direction: column; justify-content: space-between;";
                    let statusColor = c.status === "Under Review" ? "#b7791f" : "#2e7d32";
                    card.innerHTML = `
                        <div>
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                                <h4 style="margin: 0; font-size: 1.1rem; color: #0b1f33;">${c.client_name}</h4>
                                <span style="background: ${statusColor}22; color: ${statusColor}; padding: 0.2rem 0.6rem; border-radius: 20px; font-size: 0.75rem; font-weight: bold;">${c.status}</span>
                            </div>
                            <p style="margin: 0 0 0.5rem 0; font-size: 0.85rem; color: #667085;">🏷️ Chamber: ${c.chamber_case_number || '-'} | Court: ${c.court_case_number || '-'}</p>
                            <p style="margin: 0 0 0.5rem 0; font-size: 0.85rem; color: #667085;">💼 ${c.case_type}</p>
                            
                            <p style="margin: 0 0 1rem 0; font-size: 0.85rem; color: #667085;">📅 ${c.next_hearing}</p>
                        </div>
                        <div style="display: flex; gap: 8px; margin-top: 10px;">
                            <button class="btn btn-outline" style="flex: 1; border-color: #0b1f33; color: #0b1f33; padding: 0.5rem;" onclick="openCaseModal('${c._id}')">✏️ Edit / Open File</button>
                            <button class="btn btn-primary" style="flex: 1; padding: 0.5rem; display: flex; align-items: center; justify-content: center; gap: 5px;" onclick="printCaseDetails('${c._id}')">
                                ⬇️ Report
                            </button>
                        </div>
                    `;
                    casesGrid.appendChild(card);
                });

                if (recentCasesTbody) {
                    recentCasesTbody.innerHTML = '';
                    const recentCases = [...cases].reverse().slice(0, 5);
                    recentCases.forEach((c, index) => {
                        const tr = document.createElement('tr');
                        const statusClass = c.status === "Under Review" ? "pending" : "active";
                        tr.innerHTML = `
                            <td>C: ${c.chamber_case_number || '-'} <br> Ct: ${c.court_case_number || '-'}</td>
                            <td style="font-weight: bold; color: #0A192F;">${c.client_name}</td>
                            <td>${c.case_type}</td>
                            
                            <td>${c.next_hearing || 'To Be Decided'}</td>
                            <td><span class="badge ${statusClass}">${c.status}</span></td>
                            <td>
                                <button class="btn btn-outline" style="padding: 0.2rem 0.5rem; font-size: 0.8rem;" onclick="openCaseModal('${c._id}')">✏️ Edit</button>
                                <button class="btn btn-primary" style="padding: 0.2rem 0.5rem; font-size: 0.8rem; margin-left: 5px;" onclick="printCaseDetails('${c._id}')">⬇️ Report</button>
                            </td>
                        `;
                        recentCasesTbody.appendChild(tr);
                    });
                }
            } else {
                casesGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: #999; padding: 2rem; background: #f8fafc; border-radius: 12px;">No active case files found.</div>';
                if (recentCasesTbody) {
                    recentCasesTbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #999; padding: 2rem;">No recent case updates found.</td></tr>';
                }
            }
        } catch (err) {
            console.error(err);
        }
    }

    if (addCaseForm) {
        loadCases();
        setInterval(loadCases, 1000);

        addCaseForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const client_name = document.getElementById('case-client-name').value;
            const email = document.getElementById('case-client-email').value;
            const case_type = document.getElementById('case-type').value;

            const btn = addCaseForm.querySelector('button[type="submit"]');
            btn.innerText = 'Creating & Sending...';
            btn.disabled = true;

            try {
                const chamber_case_number = document.getElementById('add-chamber-case-number') ? document.getElementById('add-chamber-case-number').value : '';
                const court_case_number = document.getElementById('add-court-case-number') ? document.getElementById('add-court-case-number').value : '';
                const response = await fetch('/api/cases', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ client_name, email, case_type, chamber_case_number, court_case_number })
                });
                const data = await response.json();
                if (response.ok) {
                    showToast(`Case Created!\\n\\nAuto-Generated Password: ${data.password}\\nEmail Sent: ${data.email_sent ? 'Yes' : 'No (Give them the password manually)'}`);
                    addCaseForm.reset();
                    casesCache = "";
                    loadCases();
                } else {
                    showToast('Error creating case.', 'error');
                }
            } catch (err) {
                console.error(err);
            }
            btn.innerText = 'Create Case & Send Credentials';
            btn.disabled = false;
        });
    }

    window.openCaseModal = function(id) {
        const c = globalCasesData.find(caseItem => caseItem._id === id);
        if(!c) return;
        document.getElementById('modal-case-id').value = c._id;
        document.getElementById('modal-client-name').innerText = c.client_name;
        document.getElementById('modal-case-type').innerText = c.case_type;
        document.getElementById('modal-email').innerText = c.email;
        if(document.getElementById('modal-password')) document.getElementById('modal-password').innerText = c.password || "N/A (Archived)";
        document.getElementById('modal-status').value = c.status;
        document.getElementById('modal-hearing').value = c.next_hearing;
        document.getElementById('modal-notes').value = c.notes || "";
        document.getElementById('modal-chamber-case-number').value = c.chamber_case_number || "";
        document.getElementById('modal-court-case-number').value = c.court_case_number || "";
        if(typeof populateStaffDropdown === 'function') populateStaffDropdown(c.assigned_staff_email || '');
        
        
        // Load Message History
        const histBox = document.getElementById('modal-admin-msg-history');
        if (histBox) {
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
        }
        
        document.getElementById('modal-unpaid-warning').style.display = 'none';
        document.getElementById('case-modal').style.display = 'flex';
    };

    window.closeCaseModal = function() {
        document.getElementById('case-modal').style.display = 'none';
    };

    window.saveCaseModal = async function() {
        const id = document.getElementById('modal-case-id').value;
        const status = document.getElementById('modal-status').value;
        const next_hearing = document.getElementById('modal-hearing').value;
        const notes = document.getElementById('modal-notes').value;
        const chamber_case_number = document.getElementById('modal-chamber-case-number').value;
        const court_case_number = document.getElementById('modal-court-case-number').value;
        const assigned_staff_email = document.getElementById('modal-assigned-staff').value;
        try {
            await fetch(`/api/cases/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status, next_hearing, notes, chamber_case_number, court_case_number, assigned_staff_email })
            });
            showToast('Saved');
            closeCaseModal();
            casesCache = "";
            loadCases();
        } catch (err) {
            console.error(err);
        }
    };

    window.deleteCaseFromModal = async function() {
        const id = document.getElementById('modal-case-id').value;
        if(!confirm('Are you absolutely sure you want to delete this case? This cannot be undone.')) return;
        try {
            await fetch(`/api/cases/${id}`, { method: 'DELETE' });
            closeCaseModal();
            casesCache = "";
            loadCases();
        } catch (err) {
            console.error(err);
        }
    };

    window.finishCaseModal = async function() {
        const id = document.getElementById('modal-case-id').value;
        if(!confirm('Are you sure you want to mark this case as finished?')) return;
        try {
            let response = await fetch(`/api/cases/${id}/finish`, { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ force: false })
            });
            let data = await response.json();
            if (data.unpaid) {
                const warning = document.getElementById('modal-unpaid-warning');
                if (warning) {
                    document.getElementById('unpaid-amt').innerText = data.unpaid;
                    warning.style.display = 'block';
                }
                const proceed = confirm(`Notice: Client has an unpaid balance of ₹${data.unpaid}.\n\nDo you still wish to finalize and permanently archive this case to Turso Clients Directory?`);
                if (!proceed) return;
                
                response = await fetch(`/api/cases/${id}/finish`, { 
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ force: true })
                });
                data = await response.json();
            }
            
            showToast(data.message || 'Case Finished and transferred to Clients Directory!');
            closeCaseModal();
            casesCache = "";
            loadCases();
            if (window.loadArchivedCases) window.loadArchivedCases();
        } catch (err) {
            console.error(err);
            showToast("Error finalizing case.", 'error');
        }
    };

    window.sendCaseEmail = async function() {
        const id = document.getElementById('modal-case-id').value;
        const subject = document.getElementById('modal-email-subject').value;
        const message = document.getElementById('modal-email-msg').value;
        if (!subject || !message) {
            showToast('Please enter a subject and message.');
            return;
        }
        const btn = document.getElementById('btn-send-email');
        btn.innerText = 'Sending...';
        btn.disabled = true;
        try {
            const response = await fetch(`/api/cases/${id}/email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subject, message })
            });
            const data = await response.json();
            if (response.ok) {
                showToast('Email Sent');
                document.getElementById('modal-email-subject').value = '';
                document.getElementById('modal-email-msg').value = '';
            } else {
                showToast(data.error || 'Failed to send email.', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast("Error sending email.", 'error');
        }
        btn.innerText = 'Send Email';
        btn.disabled = false;
    };

    // ==========================================
    // Clients Directory / History (Turso Database)
    // ==========================================
    const archivedCasesTbody = document.getElementById('archived-cases-tbody');
    let archivedCasesCache = "";
    window.allArchivedCasesList = [];

    window.loadArchivedCases = async function() {
        try {
            const response = await fetch('/api/archived-cases', { cache: 'no-store' });
            if (!response.ok) return;
            const cases = await response.json();
            window.allArchivedCasesList = Array.isArray(cases) ? cases : [];

            // Update Dashboard Stat Card
            const statClients = document.getElementById('stat-clients');
            if (statClients) {
                statClients.innerText = window.allArchivedCasesList.length;
            }

            const searchInput = document.getElementById('archived-cases-search');
            if (searchInput && searchInput.value.trim() !== '') {
                window.filterArchivedCasesTable();
                return;
            }

            const tbody = document.getElementById('archived-cases-tbody');
            if (tbody) {
                window.renderArchivedCasesTable(window.allArchivedCasesList);
            }
        } catch (err) {
            console.error(err);
        }
    };

    window.renderArchivedCasesTable = function(casesToRender) {
        if (!archivedCasesTbody) return;
        if (casesToRender && casesToRender.length > 0) {
            archivedCasesTbody.innerHTML = '';
            casesToRender.forEach(c => {
                const tr = document.createElement('tr');
                const imagesCount = Array.isArray(c.images) ? c.images.length : 0;
                const imagesBadge = imagesCount > 0 
                    ? `<span style="background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; font-size: 0.78rem; padding: 2px 8px; border-radius: 12px; font-weight: 700; cursor: pointer;" onclick="openArchivedFileModal('${c._id}')">🖼️ ${imagesCount} Document${imagesCount > 1 ? 's' : ''}</span>`
                    : `<span style="color: #94a3b8; font-size: 0.8rem;">No images</span>`;

                tr.innerHTML = `
                    <td>
                        <div style="font-weight: 700; color: #0A192F;">🏛️ ${c.chamber_case_number || 'Not Assigned'}</div>
                        <div style="font-size: 0.82rem; color: #64748b;">⚖️ ${c.court_case_number || 'N/A'}</div>
                    </td>
                    <td>
                        <a href="#" onclick="openArchivedFileModal('${c._id}'); return false;" style="color: #0A192F; font-weight: bold; text-decoration: underline; font-size: 1rem; cursor: pointer;">
                            ${c.client_name}
                        </a>
                        ${c.phone ? `<div style="font-size: 0.8rem; color: #64748b;">📞 ${c.phone}</div>` : ''}
                    </td>
                    <td><span style="font-weight: 600; color: #334155;">${c.case_type || 'General'}</span></td>
                    <td>${imagesBadge}</td>
                    <td><span class="badge" style="background: #e2e8f0; color: #334155; font-weight: 700;">${c.status || 'Finished & Archived'}</span></td>
                    <td style="text-align: right; white-space: nowrap;">
                        <button class="btn btn-outline" style="padding: 4px 10px; font-size: 0.82rem; margin-right: 6px;" onclick="openArchivedFileModal('${c._id}')">📂 Open File</button>
                        <button class="btn" style="background:#e74c3c; color:white; padding: 4px 10px; font-size: 0.82rem;" onclick="deleteArchivedCase('${c._id}')">Delete</button>
                    </td>
                `;
                archivedCasesTbody.appendChild(tr);
            });
        } else {
            archivedCasesTbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #999; padding: 2.5rem; font-size: 0.95rem;">No matching finished case files found in Clients Directory.</td></tr>';
        }
    };

    window.filterArchivedCasesTable = function() {
        const query = (document.getElementById('archived-cases-search')?.value || '').trim().toLowerCase();
        if (!query) {
            window.renderArchivedCasesTable(window.allArchivedCasesList);
            return;
        }
        const filtered = (window.allArchivedCasesList || []).filter(c => {
            const chamber = (c.chamber_case_number || '').toLowerCase();
            const court = (c.court_case_number || '').toLowerCase();
            const name = (c.client_name || '').toLowerCase();
            const type = (c.case_type || '').toLowerCase();
            return chamber.includes(query) || court.includes(query) || name.includes(query) || type.includes(query);
        });
        window.renderArchivedCasesTable(filtered);
    };

    window.clearArchivedSearch = function() {
        const input = document.getElementById('archived-cases-search');
        if (input) input.value = '';
        window.renderArchivedCasesTable(window.allArchivedCasesList);
    };

    if (archivedCasesTbody) {
        loadArchivedCases();
        setInterval(() => {
            const searchInput = document.getElementById('archived-cases-search');
            if (!searchInput || !searchInput.value.trim()) {
                loadArchivedCases();
            }
        }, 5000);
    }
    
    // Email Logs Auto-Refresh
    if (document.getElementById('section-emails')) {
        window.loadEmailLogs(); // Initial load
        setInterval(() => {
            if (document.getElementById('section-emails').classList.contains('active')) {
                window.loadEmailLogs();
            }
        }, 2000);
    }
});


// ==========================================
// ADVOCATES MANAGEMENT
// ==========================================
window.globalAdvocatesData = [];
async function loadAdvocates() {
    try {
        const response = await fetch('/api/advocates');
        const advocates = await response.json();
        window.globalAdvocatesData = advocates;
        const tbody = document.getElementById('admin-advocates-list');
        if (!tbody) return;
        tbody.innerHTML = '';
        
        advocates.forEach((adv) => {
            const card = document.createElement('div');
            card.className = 'advocate-card';
            const isOwner = !!adv.is_owner;
            if (isOwner) {
                card.style.border = '2px solid #D4AF37';
                card.style.boxShadow = '0 6px 20px rgba(212,175,55,0.2)';
                card.style.background = '#fffdfa';
            }
            
            const initial = (adv.name || '⚖').trim().charAt(0).toUpperCase();
            const photoHtml = adv.imageUrl && adv.imageUrl.length > 20
                ? `<img src="${adv.imageUrl}" style="width: 70px; height: 70px; object-fit: cover; border-radius: 50%; box-shadow: 0 4px 10px rgba(0,0,0,0.12); border: 2px solid #D4AF37;">`
                : `<div style="width: 70px; height: 70px; border-radius: 50%; background: #0A1628; color: #D4AF37; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; box-shadow: 0 4px 10px rgba(0,0,0,0.12); font-weight: bold; border: 2px solid #D4AF37;">${initial}</div>`;
            
            card.innerHTML = `
                <div style="display: flex; align-items: center; gap: 1rem; border-bottom: 1px solid rgba(0,0,0,0.06); padding-bottom: 1rem;">
                    ${photoHtml}
                    <div style="overflow: hidden; flex: 1;">
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            <h4 style="margin: 0; font-size: 1.15rem; color: #0f172a; font-weight: 700;">${adv.name}</h4>
                            ${isOwner ? '<span style="background: #0A1628; color: #D4AF37; border: 1px solid #D4AF37; font-size: 0.68rem; padding: 2px 7px; border-radius: 4px; font-weight: 800; letter-spacing: 1px;">👑 OWNER</span>' : ''}
                        </div>
                        <div style="margin: 2px 0; font-size: 0.82rem; color: #b45309; font-weight: 600;">${adv.role || (isOwner ? 'Chamber Owner & Lead Counsel' : 'Legal Professional')}</div>
                        <p style="margin: 0; font-size: 0.85rem; color: #475569; font-weight: 500;">${adv.specialty || ''}</p>
                        <div style="margin-top: 4px; font-size: 0.8rem; color: #64748b;">📧 ${adv.email || 'N/A'}</div>
                        <div style="margin-top: 2px; font-size: 0.8rem; color: #64748b;">📞 ${adv.phone || 'N/A'}</div>
                    </div>
                </div>
                
                <div style="flex-grow: 1; margin-top: 1rem;">
                    <h5 style="margin: 0 0 0.8rem 0; font-size: 0.9rem; color: #334155;">Access Controls</h5>
                    <div style="display: flex; flex-direction: column; gap: 0.6rem; background: rgba(255,255,255,0.6); padding: 1rem; border-radius: 8px;">
                        <label style="font-size: 0.85rem; display: flex; align-items: center; gap: 8px; cursor: pointer; color: #1e293b; font-weight: 500;">
                            <input type="checkbox" style="width: 16px; height: 16px; accent-color: var(--accent);" ${adv.access_appointments ? 'checked' : ''} onchange="updateAccess('${adv._id}', this.checked, ${adv.access_clients ? 'true' : 'false'}, ${adv.access_add_case ? 'true' : 'false'}, ${adv.access_voice ? 'true' : 'false'})">
                            📅 Appointments Access
                        </label>
                        <label style="font-size: 0.85rem; display: flex; align-items: center; gap: 8px; cursor: pointer; color: #1e293b; font-weight: 500;">
                            <input type="checkbox" style="width: 16px; height: 16px; accent-color: var(--accent);" ${adv.access_clients ? 'checked' : ''} onchange="updateAccess('${adv._id}', ${adv.access_appointments ? 'true' : 'false'}, this.checked, ${adv.access_add_case ? 'true' : 'false'}, ${adv.access_voice ? 'true' : 'false'})">
                            👥 Clients Directory Access
                        </label>
                        <label style="font-size: 0.85rem; display: flex; align-items: center; gap: 8px; cursor: pointer; color: #1e293b; font-weight: 500;">
                            <input type="checkbox" style="width: 16px; height: 16px; accent-color: var(--accent);" ${adv.access_add_case ? 'checked' : ''} onchange="updateAccess('${adv._id}', ${adv.access_appointments ? 'true' : 'false'}, ${adv.access_clients ? 'true' : 'false'}, this.checked, ${adv.access_voice ? 'true' : 'false'})">
                            ➕ Add New Case Access
                        </label>
                        <label style="font-size: 0.85rem; display: flex; align-items: center; gap: 8px; cursor: pointer; color: #1e293b; font-weight: 500; border-top: 1px solid rgba(0,0,0,0.1); padding-top: 0.6rem;">
                            <input type="checkbox" style="width: 16px; height: 16px; accent-color: var(--accent);" ${adv.access_voice ? 'checked' : ''} onchange="updateAccess('${adv._id}', ${adv.access_appointments ? 'true' : 'false'}, ${adv.access_clients ? 'true' : 'false'}, ${adv.access_add_case ? 'true' : 'false'}, this.checked)">
                            🎙️ AI Voice Update
                        </label>
                    </div>
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: auto; padding-top: 1rem;">
                    <button class="btn" id="send-welcome-btn-${adv._id}" style="width: 100%; background: #0A1628; color: #D4AF37; border: 1.5px solid #D4AF37; font-weight: 700; padding: 0.55rem; display: flex; align-items: center; justify-content: center; gap: 8px; border-radius: 6px; cursor: pointer; transition: all 0.2s;" onclick="sendWelcomeMail('${adv._id}', '${adv.name ? adv.name.replace(/'/g, "\\'") : ''}', '${adv.email || ''}')">
                        ${adv.welcome_mail_sent ? '✉️ Resend Welcome Mail' : '✉️ Send Welcome Mail'}
                    </button>
                    ${adv.welcome_mail_sent ? '<div style="font-size: 0.76rem; color: #166534; font-weight: 600; text-align: center; margin-top: -2px;">✓ Welcome mail sent</div>' : ''}
                    <button class="btn" style="width: 100%; background: #D4AF37; color: #0A1628; font-weight: bold; border: none; padding: 0.5rem;" onclick="showIdCard('${adv._id}')">🪪 Show & Email ID Card</button>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn" style="flex: 1; background: var(--primary); color: white; border: none;" onclick="openEditAdvocateModal('${adv._id}')">✏️ Edit</button>
                        ${isOwner 
                            ? `<button class="btn" style="flex: 1; background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1; cursor: not-allowed; font-size: 0.85rem;" title="Chamber Owner is permanent and cannot be deleted" disabled>🛡️ Permanent</button>`
                            : `<button class="btn btn-error" style="flex: 1; border: none;" onclick="deleteAdvocate('${adv._id}')">🗑️ Delete</button>`
                        }
                    </div>
                </div>
            `;
            tbody.appendChild(card);
        });
    } catch(err) {
        console.error(err);
    }
}

window.sendWelcomeMail = async function(id, name, email) {
    const btn = document.getElementById(`send-welcome-btn-${id}`);
    const originalText = btn ? btn.innerHTML : '✉️ Send Welcome Mail';
    
    if (!confirm(`Are you sure you want to send the welcome email to ${name || 'this advocate'} (${email})?`)) {
        return;
    }
    
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '⏳ Sending Welcome Mail...';
    }
    
    try {
        const response = await fetch(`/api/advocates/${id}/send-welcome-mail`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        
        if (response.ok && data.success) {
            showToast(`Welcome email sent successfully to ${email}!`, 'success');
            loadAdvocates();
        } else {
            showToast(data.error || 'Failed to send welcome email', 'error');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        }
    } catch (err) {
        console.error('Error sending welcome email:', err);
        showToast('Network error while sending welcome email', 'error');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
};

async function deleteAdvocate(id) {
    if(!confirm("Are you sure you want to delete this advocate?")) return;
    try {
        await fetch(`/api/advocates/${id}`, { method: 'DELETE' });
        loadAdvocates();
    } catch(err) {
        showToast("Error deleting advocate", 'error');
    }
}

const addAdvocateForm = document.getElementById('add-advocate-form');
if (addAdvocateForm) {
    addAdvocateForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('adv-name').value;
        const email = document.getElementById('adv-email').value;
        const role = (document.getElementById('adv-role') ? document.getElementById('adv-role').value : '').trim() || 'Legal Professional';
        const specialty = document.getElementById('adv-specialty').value;
        const location = (document.getElementById('adv-location') ? document.getElementById('adv-location').value : '').trim() || 'High Court of Orissa, Cuttack';
        const phone = document.getElementById('adv-phone').value;
        const linkedin = (document.getElementById('adv-linkedin') ? document.getElementById('adv-linkedin').value : '').trim();
        const fileInput = document.getElementById('adv-image');
        
        const submitBtn = addAdvocateForm.querySelector('button');
        submitBtn.textContent = 'Adding...';
        
        let imageUrl = '';
        if (fileInput.files.length > 0) {
            imageUrl = await window.compressImage(fileInput.files[0]);
        }
        
        try {
            const response = await fetch('/api/advocates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, specialty, phone, role, location, linkedin, imageUrl })
            });
            const data = await response.json();
            
            if (response.ok) {
                showToast(`Advocate Added Successfully!\n\nEmail: ${email}\n\nYou can click "Send Welcome Mail" on their card whenever you wish to send their welcome credentials email.`, 'success');
                addAdvocateForm.reset();
                loadAdvocates();
            } else {
                showToast(data.error || 'Failed to add advocate', 'error');
            }
        } catch(err) {
            showToast('Failed to add advocate', 'error');
        } finally {
            submitBtn.textContent = 'Add Advocate';
        }
    });
}

// Load advocates on start
setTimeout(loadAdvocates, 500);

// ==========================================
// SETTINGS MANAGEMENT
// ==========================================
let globalLogoUrl = "";
let globalHeroBannerUrl = "";
let globalExpertiseBannerUrl = "";
let globalStaffBannerUrl = "";
let globalAboutImg1Url = "";
let globalAboutImg2Url = "";

window.removeHeroBanner = function() {
    globalHeroBannerUrl = "";
    const previewBg = document.getElementById('hero-banner-preview-bg');
    if (previewBg) previewBg.style.backgroundImage = "url('assets/images/default_chamber_banner.jpg')";
    const removeBtn = document.getElementById('admin-remove-banner-btn');
    if (removeBtn) removeBtn.style.display = 'none';
    const bannerInput = document.getElementById('admin-hero-banner');
    if (bannerInput) bannerInput.value = '';
    showToast('Reset to default chamber banner. Click "Save Settings" to publish.', 'info');
};

window.removeExpertiseBanner = function() {
    globalExpertiseBannerUrl = "";
    const previewBg = document.getElementById('expertise-banner-preview-bg');
    if (previewBg) previewBg.style.backgroundImage = "url('assets/images/default_chamber_banner.jpg')";
    const removeBtn = document.getElementById('admin-remove-expertise-banner-btn');
    if (removeBtn) removeBtn.style.display = 'none';
    const bannerInput = document.getElementById('admin-expertise-banner');
    if (bannerInput) bannerInput.value = '';
    showToast('Reset to default expertise banner. Click "Save Settings" to publish.', 'info');
};

window.removeStaffBanner = function() {
    globalStaffBannerUrl = "";
    const previewBg = document.getElementById('staff-banner-preview-bg');
    if (previewBg) previewBg.style.backgroundImage = "url('assets/images/default_chamber_banner.jpg')";
    const removeBtn = document.getElementById('admin-remove-staff-banner-btn');
    if (removeBtn) removeBtn.style.display = 'none';
    const bannerInput = document.getElementById('admin-staff-banner');
    if (bannerInput) bannerInput.value = '';
    showToast('Reset to default staff banner. Click "Save Settings" to publish.', 'info');
};

window.removeAboutOwnerImage = window.removeAboutImage1 = function() {
    globalAboutImg1Url = "";
    const preview = document.getElementById('admin-about-owner-preview') || document.getElementById('admin-about-img1-preview');
    const placeholder = document.getElementById('admin-about-owner-placeholder') || document.getElementById('admin-about-img1-placeholder');
    const removeBtn = document.getElementById('admin-remove-about-owner-btn') || document.getElementById('admin-remove-about-img1-btn');
    const input = document.getElementById('admin-about-owner-img') || document.getElementById('admin-about-img1');
    if (preview) { preview.src = ''; preview.style.display = 'none'; }
    if (placeholder) placeholder.style.display = 'block';
    if (removeBtn) removeBtn.style.display = 'none';
    if (input) input.value = '';
    showToast('Removed Owner Photograph. Click "Save Settings" to publish.', 'info');
};

const officeInfoForm = document.getElementById('office-info-form');
if (officeInfoForm) {
    const logoInput = document.getElementById('admin-logo');
    const logoPreview = document.getElementById('logo-preview');
    
    if(logoInput) {
        logoInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(event) {
                    globalLogoUrl = event.target.result;
                    logoPreview.src = globalLogoUrl;
                    logoPreview.style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
        });
    }

    const heroBannerInput = document.getElementById('admin-hero-banner');
    const heroBannerPreviewBg = document.getElementById('hero-banner-preview-bg');
    const heroBannerRemoveBtn = document.getElementById('admin-remove-banner-btn');

    if (heroBannerInput) {
        heroBannerInput.addEventListener('change', async function(e) {
            const file = e.target.files[0];
            if (file) {
                try {
                    const compressed = await compressImage(file, 1600);
                    globalHeroBannerUrl = compressed;
                    if (heroBannerPreviewBg) heroBannerPreviewBg.style.backgroundImage = `url('${globalHeroBannerUrl}')`;
                    if (heroBannerRemoveBtn) heroBannerRemoveBtn.style.display = 'inline-block';
                    showToast('Hero banner selected! Click "Save Settings" below to apply.', 'info');
                } catch(err) {
                    console.error('Error compressing banner image:', err);
                    const reader = new FileReader();
                    reader.onload = function(event) {
                        globalHeroBannerUrl = event.target.result;
                        if (heroBannerPreviewBg) heroBannerPreviewBg.style.backgroundImage = `url('${globalHeroBannerUrl}')`;
                        if (heroBannerRemoveBtn) heroBannerRemoveBtn.style.display = 'inline-block';
                    };
                    reader.readAsDataURL(file);
                }
            }
        });
    }

    const expertiseBannerInput = document.getElementById('admin-expertise-banner');
    const expertiseBannerPreviewBg = document.getElementById('expertise-banner-preview-bg');
    const expertiseBannerRemoveBtn = document.getElementById('admin-remove-expertise-banner-btn');

    if (expertiseBannerInput) {
        expertiseBannerInput.addEventListener('change', async function(e) {
            const file = e.target.files[0];
            if (file) {
                try {
                    const compressed = await compressImage(file, 1600);
                    globalExpertiseBannerUrl = compressed;
                    if (expertiseBannerPreviewBg) expertiseBannerPreviewBg.style.backgroundImage = `url('${globalExpertiseBannerUrl}')`;
                    if (expertiseBannerRemoveBtn) expertiseBannerRemoveBtn.style.display = 'inline-block';
                    showToast('Expertise banner selected! Click "Save Settings" below to apply.', 'info');
                } catch(err) {
                    console.error('Error compressing expertise banner:', err);
                    const reader = new FileReader();
                    reader.onload = function(event) {
                        globalExpertiseBannerUrl = event.target.result;
                        if (expertiseBannerPreviewBg) expertiseBannerPreviewBg.style.backgroundImage = `url('${globalExpertiseBannerUrl}')`;
                        if (expertiseBannerRemoveBtn) expertiseBannerRemoveBtn.style.display = 'inline-block';
                    };
                    reader.readAsDataURL(file);
                }
            }
        });
    }

    const staffBannerInput = document.getElementById('admin-staff-banner');
    const staffBannerPreviewBg = document.getElementById('staff-banner-preview-bg');
    const staffBannerRemoveBtn = document.getElementById('admin-remove-staff-banner-btn');

    if (staffBannerInput) {
        staffBannerInput.addEventListener('change', async function(e) {
            const file = e.target.files[0];
            if (file) {
                try {
                    const compressed = await compressImage(file, 1600);
                    globalStaffBannerUrl = compressed;
                    if (staffBannerPreviewBg) staffBannerPreviewBg.style.backgroundImage = `url('${globalStaffBannerUrl}')`;
                    if (staffBannerRemoveBtn) staffBannerRemoveBtn.style.display = 'inline-block';
                    showToast('Staffs banner selected! Click "Save Settings" below to apply.', 'info');
                } catch(err) {
                    console.error('Error compressing staff banner:', err);
                    const reader = new FileReader();
                    reader.onload = function(event) {
                        globalStaffBannerUrl = event.target.result;
                        if (staffBannerPreviewBg) staffBannerPreviewBg.style.backgroundImage = `url('${globalStaffBannerUrl}')`;
                        if (staffBannerRemoveBtn) staffBannerRemoveBtn.style.display = 'inline-block';
                    };
                    reader.readAsDataURL(file);
                }
            }
        });
    }

    const aboutOwnerInput = document.getElementById('admin-about-owner-img') || document.getElementById('admin-about-img1');
    const aboutOwnerPreview = document.getElementById('admin-about-owner-preview') || document.getElementById('admin-about-img1-preview');
    const aboutOwnerPlaceholder = document.getElementById('admin-about-owner-placeholder') || document.getElementById('admin-about-img1-placeholder');
    const aboutOwnerRemoveBtn = document.getElementById('admin-remove-about-owner-btn') || document.getElementById('admin-remove-about-img1-btn');

    if (aboutOwnerInput) {
        aboutOwnerInput.addEventListener('change', async function(e) {
            const file = e.target.files[0];
            if (file) {
                try {
                    const compressed = await compressImage(file, 1600);
                    globalAboutImg1Url = compressed;
                    if (aboutOwnerPreview) {
                        aboutOwnerPreview.src = globalAboutImg1Url;
                        aboutOwnerPreview.style.display = 'block';
                    }
                    if (aboutOwnerPlaceholder) aboutOwnerPlaceholder.style.display = 'none';
                    if (aboutOwnerRemoveBtn) aboutOwnerRemoveBtn.style.display = 'inline-block';
                    showToast('Chamber Owner photo selected! Click "Save Settings" below to apply.', 'info');
                } catch(err) {
                    console.error('Error compressing owner photo:', err);
                    const reader = new FileReader();
                    reader.onload = function(event) {
                        globalAboutImg1Url = event.target.result;
                        if (aboutOwnerPreview) {
                            aboutOwnerPreview.src = globalAboutImg1Url;
                            aboutOwnerPreview.style.display = 'block';
                        }
                        if (aboutOwnerPlaceholder) aboutOwnerPlaceholder.style.display = 'none';
                        if (aboutOwnerRemoveBtn) aboutOwnerRemoveBtn.style.display = 'inline-block';
                    };
                    reader.readAsDataURL(file);
                }
            }
        });
    }

    async function loadSettings() {
        try {
            const response = await fetch('/api/settings');
            const data = await response.json();
            if (data.appointments_open !== undefined) {
                document.getElementById('admin-appointments-open').checked = data.appointments_open;
            }
    const toggleAppts = document.getElementById('admin-appointments-open');
    
    const toggleCommonPwd = document.getElementById('admin-allow-common-pwd');
    if (toggleCommonPwd) {
        toggleCommonPwd.addEventListener('change', async (e) => {
            const allow_common_password = e.target.checked;
            try {
                await fetch('/api/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ allow_common_password })
                });
            } catch(err) {
                console.error('Error saving common password setting', err);
            }
        });
    }

    if (toggleAppts) {
        toggleAppts.addEventListener('change', async (e) => {
            const appointments_open = e.target.checked;
            try {
                await fetch('/api/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ appointments_open })
                });
                // Optional: show a quick toast or alert, but silent is fine for a modern toggle
            } catch(err) {
                console.error('Error saving appointment setting', err);
            }
        });
    }
            if (data.allow_common_password !== undefined) document.getElementById('admin-allow-common-pwd').checked = data.allow_common_password;
            
            // Public website status (ON / OFF)
            const isPublicLive = (data.public_page_status === 'on' || (data.public_page_status === undefined && data.public_website_enabled !== false));
            const rOn = document.getElementById('public-status-on');
            const rOff = document.getElementById('public-status-off');
            if (rOn && rOff) {
                rOn.checked = isPublicLive;
                rOff.checked = !isPublicLive;
            }
            if (typeof window.updatePublicStatusUI === 'function') {
                window.updatePublicStatusUI(isPublicLive ? 'on' : 'off');
            }

            if (data.security_officer_email) {
                const secEl = document.getElementById('admin-security-officer-email');
                if (secEl) secEl.value = data.security_officer_email;
            }
            if (data.chamber_name) document.getElementById('admin-chamber-name').value = data.chamber_name;
            if (data.address) document.getElementById('admin-address').value = data.address;
            if (data.phone) document.getElementById('admin-phone').value = data.phone;
            if (data.email) document.getElementById('admin-email').value = data.email;
            if (data.footer_alert) document.getElementById('admin-footer-alert').value = data.footer_alert;
            if (data.quick_links) {
                renderQuickLinks(data.quick_links);
            } else {
                renderQuickLinks([]);
            }
            if (data.privacy_policy) document.getElementById('admin-privacy-policy').value = data.privacy_policy;
            if (data.terms_conditions) document.getElementById('admin-terms').value = data.terms_conditions;
            if (data.logoUrl) {
                globalLogoUrl = data.logoUrl;
                logoPreview.src = globalLogoUrl;
                logoPreview.style.display = 'block';
            }
            if (data.hero_banner_image) {
                globalHeroBannerUrl = data.hero_banner_image;
                if (heroBannerPreviewBg) heroBannerPreviewBg.style.backgroundImage = `url('${globalHeroBannerUrl}')`;
                if (heroBannerRemoveBtn) heroBannerRemoveBtn.style.display = 'inline-block';
            } else {
                if (heroBannerPreviewBg) heroBannerPreviewBg.style.backgroundImage = "url('assets/images/default_chamber_banner.jpg')";
                if (heroBannerRemoveBtn) heroBannerRemoveBtn.style.display = 'none';
            }
            if (data.expertise_banner_image) {
                globalExpertiseBannerUrl = data.expertise_banner_image;
                if (expertiseBannerPreviewBg) expertiseBannerPreviewBg.style.backgroundImage = `url('${globalExpertiseBannerUrl}')`;
                if (expertiseBannerRemoveBtn) expertiseBannerRemoveBtn.style.display = 'inline-block';
            } else {
                if (expertiseBannerPreviewBg) expertiseBannerPreviewBg.style.backgroundImage = "url('assets/images/default_chamber_banner.jpg')";
                if (expertiseBannerRemoveBtn) expertiseBannerRemoveBtn.style.display = 'none';
            }
            if (data.staff_banner_image) {
                globalStaffBannerUrl = data.staff_banner_image;
                if (staffBannerPreviewBg) staffBannerPreviewBg.style.backgroundImage = `url('${globalStaffBannerUrl}')`;
                if (staffBannerRemoveBtn) staffBannerRemoveBtn.style.display = 'inline-block';
            } else {
                if (staffBannerPreviewBg) staffBannerPreviewBg.style.backgroundImage = "url('assets/images/default_chamber_banner.jpg')";
                if (staffBannerRemoveBtn) staffBannerRemoveBtn.style.display = 'none';
            }

            if (data.about_chamber_owner_name !== undefined) {
                const el = document.getElementById('admin-about-owner-name');
                if (el) el.value = data.about_chamber_owner_name;
            }
            if (data.about_chamber_founder !== undefined) {
                const el = document.getElementById('admin-about-founder');
                if (el) el.value = data.about_chamber_founder;
            }
            if (data.about_chamber_vision !== undefined) {
                const el = document.getElementById('admin-about-vision');
                if (el) el.value = data.about_chamber_vision;
            }
            if (data.about_chamber_text !== undefined) {
                const aboutTextEl = document.getElementById('admin-about-text');
                if (aboutTextEl) aboutTextEl.value = data.about_chamber_text;
            }
            if (data.google_site_verification !== undefined) {
                const gvEl = document.getElementById('admin-google-verification');
                if (gvEl) gvEl.value = data.google_site_verification;
            }
            if (data.about_chamber_owner_image || data.about_chamber_image1) {
                globalAboutImg1Url = data.about_chamber_owner_image || data.about_chamber_image1;
                const preview1 = document.getElementById('admin-about-owner-preview') || document.getElementById('admin-about-img1-preview');
                const placeholder1 = document.getElementById('admin-about-owner-placeholder') || document.getElementById('admin-about-img1-placeholder');
                const removeBtn1 = document.getElementById('admin-remove-about-owner-btn') || document.getElementById('admin-remove-about-img1-btn');
                if (preview1) { preview1.src = globalAboutImg1Url; preview1.style.display = 'block'; }
                if (placeholder1) placeholder1.style.display = 'none';
                if (removeBtn1) removeBtn1.style.display = 'inline-block';
            } else {
                globalAboutImg1Url = "";
                const preview1 = document.getElementById('admin-about-owner-preview') || document.getElementById('admin-about-img1-preview');
                const placeholder1 = document.getElementById('admin-about-owner-placeholder') || document.getElementById('admin-about-img1-placeholder');
                const removeBtn1 = document.getElementById('admin-remove-about-owner-btn') || document.getElementById('admin-remove-about-img1-btn');
                if (preview1) { preview1.src = ''; preview1.style.display = 'none'; }
                if (placeholder1) placeholder1.style.display = 'block';
                if (removeBtn1) removeBtn1.style.display = 'none';
            }
        } catch(err) {
            console.error(err);
        }
    }
    
    officeInfoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const allow_common_password = document.getElementById('admin-allow-common-pwd').checked;
        const security_officer_email = document.getElementById('admin-security-officer-email') ? document.getElementById('admin-security-officer-email').value.trim() : '';
        const chamber_name = document.getElementById('admin-chamber-name').value;
        const address = document.getElementById('admin-address').value;
        const phone = document.getElementById('admin-phone').value;
        const email = document.getElementById('admin-email').value;
        const footer_alert = document.getElementById('admin-footer-alert').value;
        const quick_links = getQuickLinksData();
        const privacy_policy = document.getElementById('admin-privacy-policy').value;
        const terms_conditions = document.getElementById('admin-terms').value;
        const google_site_verification = document.getElementById('admin-google-verification') ? document.getElementById('admin-google-verification').value.trim() : '';
        const about_chamber_owner_name = document.getElementById('admin-about-owner-name') ? document.getElementById('admin-about-owner-name').value.trim() : '';
        const about_chamber_founder = document.getElementById('admin-about-founder') ? document.getElementById('admin-about-founder').value : '';
        const about_chamber_vision = document.getElementById('admin-about-vision') ? document.getElementById('admin-about-vision').value : '';
        const about_chamber_text = document.getElementById('admin-about-text') ? document.getElementById('admin-about-text').value : '';
        const btn = officeInfoForm.querySelector('button');
        btn.innerText = 'Saving...';
        
        const isPublicOff = document.getElementById('public-status-off')?.checked;
        const public_page_status = isPublicOff ? 'off' : 'on';
        const public_website_enabled = !isPublicOff;

        try {
            await fetch('/api/settings', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-Admin-Request': 'true'
                },
                body: JSON.stringify({ 
                    public_page_status,
                    public_website_enabled,
                    allow_common_password, 
                    security_officer_email,
                    chamber_name, 
                    address, 
                    phone, 
                    email, 
                    footer_alert, 
                    quick_links, 
                    privacy_policy, 
                    terms_conditions, 
                    google_site_verification,
                    about_chamber_owner_name,
                    about_chamber_founder,
                    about_chamber_vision,
                    about_chamber_text,
                    about_chamber_owner_image: globalAboutImg1Url,
                    about_chamber_image1: globalAboutImg1Url,
                    logoUrl: globalLogoUrl,
                    hero_banner_image: globalHeroBannerUrl,
                    expertise_banner_image: globalExpertiseBannerUrl,
                    staff_banner_image: globalStaffBannerUrl
                })
            });
            showToast('Settings saved successfully!');
        } catch(err) {
            showToast('Error saving settings', 'error');
        } finally {
            btn.innerText = 'Save Settings';
        }
    });
    
    setTimeout(loadSettings, 500);
}





    // Add logic to populate the staff dropdown
    async function populateStaffDropdown(selectedEmail) {
        const select = document.getElementById('modal-assigned-staff');
        const selectAdd = document.getElementById('case-assigned-staff');
        if(select) select.innerHTML = '<option value="">Unassigned</option>';
        if(selectAdd) selectAdd.innerHTML = '<option value="">Unassigned</option>';
        
        try {
            const res = await fetch('/api/advocates');
            const data = await res.json();
            data.forEach(adv => {
                if(select) {
                    const opt = document.createElement('option');
                    opt.value = adv.email;
                    opt.innerText = `${adv.name} (${adv.specialty})`;
                    if (adv.email === selectedEmail) opt.selected = true;
                    select.appendChild(opt);
                }
                if(selectAdd) {
                    const opt = document.createElement('option');
                    opt.value = adv.email;
                    opt.innerText = `${adv.name} (${adv.specialty})`;
                    selectAdd.appendChild(opt);
                }
            });
        } catch(e) {
            console.error(e);
        }
    }
    
    // Call it immediately once to populate the Add Case form
    populateStaffDropdown();


    window.deleteArchivedCase = async function(id) {
        if (!confirm('Are you sure you want to permanently delete this archived case?')) return;
        try {
            const response = await fetch(`/api/cases/${id}`, { method: 'DELETE' });
            if (response.ok) {
                showToast('Deleted');
                loadArchivedCases();
            } else {
                showToast('Failed to delete case.', 'error');
            }
        } catch(e) {
            console.error(e);
            showToast('Error deleting case.', 'error');
        }
    }

    // ==========================================
    // ADD & EDIT FINISHED CASE IN TURSO (CLIENTS DIRECTORY)
    // ==========================================
    window.currentArchivedImages = [];
    window.activeViewedArchivedCase = null;

    window.openAddArchivedCaseModal = function(editCase = null) {
        const modal = document.getElementById('add-archived-case-modal');
        const form = document.getElementById('archived-case-form');
        if (!modal || !form) return;

        form.reset();
        window.currentArchivedImages = [];
        window.updateArchivedImagesPreview();

        if (editCase) {
            document.getElementById('archived-modal-title').innerText = '✏️ Edit Finished Case File';
            document.getElementById('archived-form-id').value = editCase._id || editCase.id;
            document.getElementById('archived-form-client-name').value = editCase.client_name || '';
            document.getElementById('archived-form-chamber-number').value = editCase.chamber_case_number || '';
            document.getElementById('archived-form-court-number').value = editCase.court_case_number || '';
            document.getElementById('archived-form-case-type').value = editCase.case_type || '';
            document.getElementById('archived-form-phone').value = editCase.phone || '';
            document.getElementById('archived-form-email').value = editCase.email || '';
            document.getElementById('archived-form-notes').value = editCase.notes || '';
            
            if (Array.isArray(editCase.images)) {
                window.currentArchivedImages = [...editCase.images].slice(0, 3);
            }
            window.updateArchivedImagesPreview();
        } else {
            document.getElementById('archived-modal-title').innerText = '📁 Add Finished Case File (Clients Directory)';
            document.getElementById('archived-form-id').value = '';
        }

        modal.style.display = 'flex';
    };

    window.closeAddArchivedCaseModal = function() {
        const modal = document.getElementById('add-archived-case-modal');
        if (modal) modal.style.display = 'none';
    };

    window.handleArchivedImageSelection = function(event) {
        const files = Array.from(event.target.files || []);
        if (!files.length) return;

        const remainingSlots = 3 - window.currentArchivedImages.length;
        if (remainingSlots <= 0) {
            showToast('Maximum 3 images allowed per case file.', 'error');
            return;
        }

        const filesToProcess = files.slice(0, remainingSlots);
        filesToProcess.forEach(file => {
            if (!file.type.startsWith('image/')) return;
            const reader = new FileReader();
            reader.onload = function(e) {
                if (window.currentArchivedImages.length < 3) {
                    window.currentArchivedImages.push(e.target.result);
                    window.updateArchivedImagesPreview();
                }
            };
            reader.readAsDataURL(file);
        });

        // Reset file input
        event.target.value = '';
    };

    window.updateArchivedImagesPreview = function() {
        const grid = document.getElementById('archived-images-preview-grid');
        const counter = document.getElementById('archived-images-counter');
        if (!grid) return;

        grid.innerHTML = '';
        if (counter) counter.innerText = `${window.currentArchivedImages.length} / 3 Added`;

        window.currentArchivedImages.forEach((imgSrc, index) => {
            const div = document.createElement('div');
            div.style.cssText = 'position: relative; border-radius: 8px; overflow: hidden; border: 1px solid #cbd5e1; height: 95px; background: #000;';
            div.innerHTML = `
                <img src="${imgSrc}" style="width: 100%; height: 100%; object-fit: cover; cursor: pointer;" onclick="openImageLightbox('${imgSrc}')">
                <button type="button" onclick="removeArchivedImage(${index})" style="position: absolute; top: 4px; right: 4px; background: rgba(239, 68, 68, 0.9); color: white; border: none; border-radius: 50%; width: 22px; height: 22px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: bold; line-height: 1;">&times;</button>
            `;
            grid.appendChild(div);
        });
    };

    window.removeArchivedImage = function(index) {
        window.currentArchivedImages.splice(index, 1);
        window.updateArchivedImagesPreview();
    };

    window.saveArchivedCaseForm = async function(e) {
        e.preventDefault();
        const submitBtn = document.getElementById('archived-form-submit-btn');
        const origText = submitBtn ? submitBtn.innerText : 'Save';
        if (submitBtn) {
            submitBtn.innerText = 'Saving to Turso...';
            submitBtn.disabled = true;
        }

        const id = document.getElementById('archived-form-id').value;
        const payload = {
            client_name: document.getElementById('archived-form-client-name').value.trim(),
            chamber_case_number: document.getElementById('archived-form-chamber-number').value.trim(),
            court_case_number: document.getElementById('archived-form-court-number').value.trim(),
            case_type: document.getElementById('archived-form-case-type').value.trim(),
            phone: document.getElementById('archived-form-phone').value.trim(),
            email: document.getElementById('archived-form-email').value.trim(),
            notes: document.getElementById('archived-form-notes').value.trim(),
            images: window.currentArchivedImages
        };

        try {
            const url = id ? `/api/archived-cases/${id}` : '/api/archived-cases';
            const method = id ? 'PUT' : 'POST';
            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                showToast(id ? 'Finished case updated successfully!' : 'Finished case file saved to Turso Directory!');
                window.closeAddArchivedCaseModal();
                archivedCasesCache = "";
                await window.loadArchivedCases();
                if (window.activeViewedArchivedCase && window.activeViewedArchivedCase._id === id) {
                    window.openArchivedFileModal(id);
                }
            } else {
                const errData = await res.json().catch(() => ({}));
                showToast(errData.error || 'Failed to save case file', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Server error saving case to Turso.', 'error');
        } finally {
            if (submitBtn) {
                submitBtn.innerText = origText;
                submitBtn.disabled = false;
            }
        }
    };

    // ==========================================
    // DETAILED ARCHIVED CASE FILE MODAL (VIEW / ZOOM)
    // ==========================================
    window.openArchivedFileModal = async function(id) {
        try {
            const res = await fetch(`/api/cases/${id}`);
            if (!res.ok) {
                showToast('Case file not found', 'error');
                return;
            }
            const c = await res.json();
            window.activeViewedArchivedCase = c;

            document.getElementById('view-file-client-name').innerText = c.client_name || 'Client Details';
            document.getElementById('view-file-chamber-no').innerText = c.chamber_case_number || 'Not Assigned';
            document.getElementById('view-file-court-no').innerText = c.court_case_number || 'N/A';
            document.getElementById('view-file-case-type').innerText = c.case_type || 'General Legal File';
            document.getElementById('view-file-email').innerText = c.email || 'N/A';
            document.getElementById('view-file-phone').innerText = c.phone || 'N/A';
            document.getElementById('view-file-completion-date').innerText = c.completion_date || c.created_at || 'Archived';
            document.getElementById('view-file-notes-display').innerText = c.notes && c.notes.trim() ? c.notes : 'No extra notes recorded for this closed file.';

            // Render Document Images
            const imagesGrid = document.getElementById('view-file-images-grid');
            const imagesCount = document.getElementById('view-file-images-count');
            imagesGrid.innerHTML = '';
            const images = Array.isArray(c.images) ? c.images : [];
            imagesCount.innerText = `${images.length} Image${images.length !== 1 ? 's' : ''}`;

            if (images.length > 0) {
                images.forEach((imgSrc, idx) => {
                    const card = document.createElement('div');
                    card.style.cssText = 'position: relative; border-radius: 10px; overflow: hidden; border: 1.5px solid #e2e8f0; background: #000; box-shadow: 0 4px 12px rgba(0,0,0,0.08);';
                    card.innerHTML = `
                        <img src="${imgSrc}" style="width: 100%; height: 160px; object-fit: cover; cursor: pointer; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.03)'" onmouseout="this.style.transform='scale(1)'" onclick="openImageLightbox('${imgSrc}')">
                        <div style="padding: 6px 10px; background: white; font-size: 0.78rem; font-weight: 700; color: #475569; display: flex; justify-content: space-between; align-items: center;">
                            <span>Document #${idx + 1}</span>
                            <span style="color: #2563eb; cursor: pointer;" onclick="openImageLightbox('${imgSrc}')">🔍 Zoom</span>
                        </div>
                    `;
                    imagesGrid.appendChild(card);
                });
            } else {
                imagesGrid.innerHTML = '<div style="grid-column: 1 / -1; padding: 1.5rem; background: #f8fafc; border-radius: 8px; text-align: center; color: #94a3b8; font-size: 0.9rem;">No document images attached to this case. Click "Edit Details / Images" to upload up to 3 images.</div>';
            }

            document.getElementById('view-archived-file-modal').style.display = 'flex';
        } catch (err) {
            console.error(err);
            showToast('Failed to load case file details.', 'error');
        }
    };

    window.closeViewArchivedFileModal = function() {
        const modal = document.getElementById('view-archived-file-modal');
        if (modal) modal.style.display = 'none';
        window.activeViewedArchivedCase = null;
    };

    window.editCurrentArchivedFile = function() {
        if (!window.activeViewedArchivedCase) return;
        const caseToEdit = window.activeViewedArchivedCase;
        window.closeViewArchivedFileModal();
        window.openAddArchivedCaseModal(caseToEdit);
    };

    window.deleteCurrentArchivedFile = async function() {
        if (!window.activeViewedArchivedCase) return;
        const id = window.activeViewedArchivedCase._id || window.activeViewedArchivedCase.id;
        window.closeViewArchivedFileModal();
        await window.deleteArchivedCase(id);
    };

    window.printCurrentArchivedFile = function() {
        if (!window.activeViewedArchivedCase) return;
        const id = window.activeViewedArchivedCase._id || window.activeViewedArchivedCase.id;
        window.printCaseDetails(id);
    };

    window.openImageLightbox = function(src) {
        const modal = document.getElementById('image-lightbox-modal');
        const img = document.getElementById('lightbox-img');
        if (!modal || !img) return;
        img.src = src;
        modal.style.display = 'flex';
    };

    window.closeImageLightbox = function() {
        const modal = document.getElementById('image-lightbox-modal');
        if (modal) modal.style.display = 'none';
    };

    async function loadSystemConfig() {
        try {
            const res = await fetch('/api/system-config');
            if (res.ok) {
                const config = await res.json();
                document.getElementById('pwd-appts').innerText = config.appointments_password || '------';
                document.getElementById('pwd-clients').innerText = config.clients_password || '------';
                if(document.getElementById('pwd-addcase')) document.getElementById('pwd-addcase').innerText = config.addcase_password || '------';
            }
        } catch (e) {
            console.error(e);
        }
    }
    loadSystemConfig();

    window.updateAccess = async function(id, access_appointments, access_clients, access_add_case, access_voice) {
        try {
            await fetch(`/api/advocates/${id}/access`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({access_appointments, access_clients, access_add_case, access_voice})
            });
            // Don't reload Advocates automatically here, it breaks the UI focus for checkboxes
        } catch (e) {
            console.error(e);
        }
    };

    
    window.emailLogsDataHash = "";
    
    window.loadEmailLogs = async function() {
        const staffContainer = document.getElementById('staff-email-logs-container');
        if(!staffContainer) return;
        
        try {
            const [logsRes, advRes] = await Promise.all([
                fetch('/api/email-logs'),
                fetch('/api/advocates')
            ]);
            
            const data = await logsRes.json();
            const advocates = await advRes.json();
            
            const newDataHash = JSON.stringify(data);
            if (window.emailLogsDataHash === newDataHash) return; // Skip redraw if data unchanged
            window.emailLogsDataHash = newDataHash;
            
            // Remember currently open folders
            const openFolders = new Set();
            document.querySelectorAll('div[id^="folder-"]').forEach(f => {
                if (f.style.display === 'block') openFolders.add(f.id.replace('folder-', ''));
            });
            
            // Map email to name
            const emailToName = {};
            advocates.forEach(adv => emailToName[adv.email] = adv.name);
            
            // Group staff_logs by recipient
            const staffGroups = {};
            data.staff_logs.forEach(log => {
                const email = log.recipient;
                if (!staffGroups[email]) staffGroups[email] = [];
                staffGroups[email].push(log);
            });
            
            staffContainer.innerHTML = '';
            
            if(Object.keys(staffGroups).length === 0) {
                staffContainer.innerHTML = '<p style="text-align: center; color: #999; padding: 2rem;">No staff emails sent yet.</p>';
            } else {
                for (const email in staffGroups) {
                    const name = emailToName[email] || email;
                    const logs = staffGroups[email];
                    const folderId = email.replace(/[^a-zA-Z0-9]/g, ''); // safe ID
                    
                    const isOpen = openFolders.has(folderId);
                    const displayStyle = isOpen ? 'block' : 'none';
                    const iconArrow = isOpen ? '▲' : '▼';
                    
                    let html = `
                        <div style="margin-bottom: 1rem; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                            <div onclick="toggleFolder('${folderId}')" style="background: var(--color-primary); color: white; padding: 1rem 1.5rem; font-weight: bold; font-size: 1.1rem; display: flex; align-items: center; justify-content: space-between; cursor: pointer; transition: background 0.2s;">
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    📁 ${name} <span style="font-size: 0.9rem; font-weight: normal; opacity: 0.8;">(${email})</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 15px;">
                                    <button onclick="event.stopPropagation(); deleteStaffFolderLogs('${email}')" style="background: var(--color-error); color: white; padding: 0.3rem 0.6rem; font-size: 0.85rem; border-radius: 4px; border: none; cursor: pointer; display: flex; align-items: center; gap: 5px;">🗑️ Delete All</button>
                                    <span id="icon-${folderId}">${iconArrow}</span>
                                </div>
                            </div>
                            <div id="folder-${folderId}" style="display: ${displayStyle}; overflow-x: auto; background: white;">
                                <table class="data-table" style="width: 100%; border: none; margin: 0;">
                                    <thead style="background: #f8f9fa;">
                                        <tr>
                                            <th>Date & Time</th>
                                            <th>Subject</th>
                                            <th>Status</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                    `;
                    
                    logs.forEach(log => {
                        html += `<tr>
                            <td>${log.timestamp || ''}</td>
                            <td>${log.subject || ''}</td>
                            <td>
                                <span style="background: ${log.status === 'Sent' ? '#e6f4ea' : '#fce8e8'}; color: ${log.status === 'Sent' ? '#1e8e3e' : '#d93025'}; padding: 0.2rem 0.6rem; border-radius: 12px; font-size: 0.8rem; font-weight: bold;">
                                    ${log.status || ''}
                                </span>
                            </td>
                            <td>
                                <button class="btn btn-secondary" onclick="deleteEmailLog('${log._id}')" style="background: var(--color-error); color: white; padding: 0.3rem 0.6rem; font-size: 0.8rem;">Delete</button>
                            </td>
                        </tr>`;
                    });
                    
                    html += `</tbody></table></div></div>`;
                    staffContainer.innerHTML += html;
                }
            }
        } catch(e) {
            console.error(e);
        }
    };

    window.toggleFolder = function(id) {
        const folder = document.getElementById('folder-' + id);
        const icon = document.getElementById('icon-' + id);
        if (folder.style.display === 'none') {
            folder.style.display = 'block';
            icon.innerText = '▲';
        } else {
            folder.style.display = 'none';
            icon.innerText = '▼';
        }
    };

    
    window.deleteStaffFolderLogs = async function(email) {
        if (!confirm(`Are you sure you want to delete ALL email logs for ${email}? This cannot be undone.`)) return;
        try {
            const response = await fetch(`/api/email-logs/staff/${encodeURIComponent(email)}`, { method: 'DELETE' });
            if (response.ok) {
                showToast('Deleted');
                loadEmailLogs(); // reload UI
            } else {
                showToast('Failed to delete logs.', 'error');
            }
        } catch (e) {
            console.error(e);
            showToast('Error deleting logs.', 'error');
        }
    };

    window.deleteEmailLog = async function(id) {
        if (!confirm('Are you sure you want to delete this email log?')) return;
        try {
            const response = await fetch(`/api/email-logs/${id}`, { method: 'DELETE' });
            if (response.ok) {
                window.loadEmailLogs();
            } else {
                showToast('Failed to delete email log.', 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('Error deleting email log.', 'error');
        }
    };

    // Initialize Email Password Buttons on Load
    function checkEmailPasswordButtons() {
        // Disabled cooldown to allow multiple emails to be sent
    }

    window.emailSectionPassword = async function(section) {
        const btn = document.getElementById('btn-email-pwd-' + section);
        if(!btn) return;
        
        btn.innerText = 'Sending...';
        btn.disabled = true;
        
        try {
            const response = await fetch('/api/email-section-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ section })
            });
            
            if (response.ok) {
                btn.innerText = 'Email Sent!';
                setTimeout(() => {
                    btn.innerText = 'Email Password';
                    btn.disabled = false;
                    btn.style.opacity = '1';
                    btn.style.cursor = 'pointer';
                }, 2000);
            } else {
                showToast('Failed to send email.', 'error');
                btn.innerText = 'Email Password';
                btn.disabled = false;
            }
        } catch (error) {
            console.error(error);
            showToast('Error sending email.', 'error');
            btn.innerText = 'Email Password';
            btn.disabled = false;
        }
    };

    // Edit Advocate Modal Logic
    let editAdvocateImageUrl = "";
    
    window.openEditAdvocateModal = function(id) {
        const adv = window.globalAdvocatesData.find(a => a._id === id || a.id === id);
        if(!adv) return;
        
        document.getElementById('edit-adv-id').value = adv._id;
        document.getElementById('edit-adv-name').value = adv.name || '';
        document.getElementById('edit-adv-email').value = adv.email || '';
        if (document.getElementById('edit-adv-role')) document.getElementById('edit-adv-role').value = adv.role || '';
        document.getElementById('edit-adv-specialty').value = adv.specialty || '';
        if (document.getElementById('edit-adv-location')) document.getElementById('edit-adv-location').value = adv.location || '';
        document.getElementById('edit-adv-phone').value = adv.phone || '';
        if (document.getElementById('edit-adv-linkedin')) document.getElementById('edit-adv-linkedin').value = adv.linkedin || '';
        document.getElementById('edit-adv-image').value = '';
        editAdvocateImageUrl = adv.imageUrl || ''; // keep existing photo unless replaced
        
        const preview = document.getElementById('edit-adv-image-preview');
        const placeholder = document.getElementById('edit-adv-image-placeholder');
        if (editAdvocateImageUrl) {
            preview.src = editAdvocateImageUrl;
            preview.style.display = 'block';
            placeholder.style.display = 'none';
        } else {
            preview.style.display = 'none';
            placeholder.style.display = 'flex';
        }

        document.getElementById('edit-advocate-modal').style.display = 'flex';
    };

    window.closeEditAdvocateModal = function() {
        document.getElementById('edit-advocate-modal').style.display = 'none';
    };

    document.addEventListener('change', async function(e) {
        if (e.target && e.target.id === 'edit-adv-image') {
            const file = e.target.files[0];
            if (file) {
                editAdvocateImageUrl = await window.compressImage(file);
                document.getElementById('edit-adv-image-preview').src = editAdvocateImageUrl;
                document.getElementById('edit-adv-image-preview').style.display = 'block';
                document.getElementById('edit-adv-image-placeholder').style.display = 'none';
            }
        }
    });

    window.removeAdvImage = function() {
        editAdvocateImageUrl = '';
        const fileInput = document.getElementById('edit-adv-image');
        if (fileInput) fileInput.value = '';
        document.getElementById('edit-adv-image-preview').style.display = 'none';
        document.getElementById('edit-adv-image-placeholder').style.display = 'flex';
    };

    window.saveEditAdvocateModal = async function() {
        const id = document.getElementById('edit-adv-id').value;
        const name = document.getElementById('edit-adv-name').value;
        const email = document.getElementById('edit-adv-email').value;
        const role = (document.getElementById('edit-adv-role') ? document.getElementById('edit-adv-role').value : '').trim() || 'Legal Professional';
        const specialty = document.getElementById('edit-adv-specialty').value;
        const location = (document.getElementById('edit-adv-location') ? document.getElementById('edit-adv-location').value : '').trim() || 'High Court of Orissa, Cuttack';
        const phone = document.getElementById('edit-adv-phone').value;
        const linkedin = (document.getElementById('edit-adv-linkedin') ? document.getElementById('edit-adv-linkedin').value : '').trim();
        const fileInput = document.getElementById('edit-adv-image');
        
        if(!name || !email || !specialty) {
            showToast('Please fill out all required fields.');
            return;
        }

        let finalImageUrl = editAdvocateImageUrl; // use existing if no new file
        if (fileInput && fileInput.files.length > 0) {
            finalImageUrl = await window.compressImage(fileInput.files[0]);
        }

        try {
            const response = await fetch(`/api/advocates/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, specialty, phone, role, location, linkedin, imageUrl: finalImageUrl })
            });


            if (response.ok) {
                closeEditAdvocateModal();
                loadAdvocates();
                showToast('Changed');
            } else {
                const data = await response.json();
                showToast(data.error || 'Failed to update advocate.', 'error');
            }
        } catch(error) {
            console.error(error);
            showToast('Error updating advocate.', 'error');
        }
    };


let currentIdCardAdvocate = null;

window.showIdCard = function(id) {
    const adv = window.globalAdvocatesData.find(a => a._id === id);
    if (!adv) return;

    currentIdCardAdvocate = adv;

    document.getElementById('id-card-name').innerText = adv.name || 'N/A';
    document.getElementById('id-card-role').innerText = adv.specialty || 'Staff Member';
    document.getElementById('id-card-phone').innerText = adv.phone || 'N/A';
    document.getElementById('id-card-email').innerText = adv.email || 'N/A';

    // Generate employee ID
    const idPrefix = (adv.specialty && adv.specialty.toLowerCase().includes('advocate')) ? 'ADV' : 'STF';
    const idSuffix = adv._id.substring(adv._id.length - 4).toUpperCase();
    document.getElementById('id-card-id').innerText = `${idPrefix}-${idSuffix}`;

    // Handle staff photo
    const photo = document.getElementById('id-card-photo');
    const placeholder = document.getElementById('id-card-photo-placeholder');
    if (adv.imageUrl) {
        photo.onload = null;
        photo.src = adv.imageUrl;
        photo.style.display = 'block';
        placeholder.style.display = 'none';
    } else {
        photo.src = '';
        photo.style.display = 'none';
        placeholder.style.display = 'block';
    }

    // Fetch settings: address, chamber name, logo
    fetch('/api/settings').then(r => r.json()).then(data => {
        // Chamber name
        if (data.chamber_name) {
            document.getElementById('id-card-office-name').innerText = data.chamber_name;
        }
        // Address
        if (data.address) {
            const addressEl = document.getElementById('id-card-address');
            if (addressEl) addressEl.innerText = data.address;
        }
        // Logo
        const logoEl = document.getElementById('id-card-logo');
        const logoFallback = document.getElementById('id-card-logo-fallback');
        if (logoEl && data.logoUrl) {
            logoEl.onload = function() {
                logoEl.style.display = 'block';
                if (logoFallback) logoFallback.style.display = 'none';
            };
            logoEl.onerror = function() {
                logoEl.style.display = 'none';
                if (logoFallback) logoFallback.style.display = 'block';
            };
            logoEl.src = data.logoUrl;
        } else {
            if (logoEl) logoEl.style.display = 'none';
            if (logoFallback) logoFallback.style.display = 'block';
        }
    }).catch(() => {});

    document.getElementById('id-card-modal').style.display = 'flex';
}

window.sendIdCardEmail = async function() {
    if (!currentIdCardAdvocate || !currentIdCardAdvocate.email) {
        showToast("This staff member does not have a registered email address.");
        return;
    }
    
    const btn = document.getElementById('btn-email-id-card');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span>⏳</span> Generating & Sending...';
    btn.disabled = true;
    
    try {
        const canvas = await html2canvas(document.getElementById('id-card-canvas'), {
            scale: 2, // High resolution
            useCORS: true,
            backgroundColor: null
        });
        
        const base64Image = canvas.toDataURL('image/png');
        
        const res = await fetch('/api/staff/email-id-card', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: currentIdCardAdvocate.email,
                name: currentIdCardAdvocate.name,
                image_data: base64Image
            })
        });
        
        const result = await res.json();
        if (res.ok) {
            showToast("ID Card emailed successfully!");
            document.getElementById('id-card-modal').style.display = 'none';
        } else {
            showToast(result.error || "Failed to send email", 'error');
        }
    } catch (e) {
        console.error(e);
        showToast("An error occurred while generating or sending the ID card: " + e.message, 'error');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
};



// ==========================================
// AI VOICE ASSISTANT MODULE
// ==========================================

let aiRecognition = null;
let aiConfirmationRecognition = null;
let currentAiPayload = null;
let isAiListening = false;
let isAiConfirming = false;

function initSpeechRecognition() {
    window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!window.SpeechRecognition) {
        showToast("Your browser does not support Speech Recognition. Please use Google Chrome or Microsoft Edge.");
        return null;
    }
    const recognition = new window.SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    return recognition;
}

window.cancelAiListening = function() {
    if (aiRecognition) {
        aiRecognition.abort();
    }
    document.getElementById('ai-listening-overlay').style.display = 'none';
    isAiListening = false;
    showToast("Voice command cancelled.");
};

window.stopAiListening = function() {
    if (aiRecognition) {
        aiRecognition.stop(); // This triggers onend which processes the transcript
    }
};

window.startAiVoice = function() {
    if (isAiListening) return;
    
    aiRecognition = initSpeechRecognition();
    if (!aiRecognition) return;
    
    const overlay = document.getElementById('ai-listening-overlay');
    const preview = document.getElementById('ai-transcript-preview');
    
    overlay.style.display = 'flex';
    preview.innerText = "Speak now...";
    isAiListening = true;
    
    let finalTranscript = '';
    
    aiRecognition.onresult = function(event) {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }
        preview.innerText = finalTranscript + interimTranscript;
    };
    
    aiRecognition.onerror = function(event) {
        console.error("Speech Recognition Error", event.error);
        if (event.error !== 'no-speech') {
            showToast("Microphone error: " + event.error, 'error');
            overlay.style.display = 'none';
            isAiListening = false;
        }
    };
    
    aiRecognition.onend = function() {
        isAiListening = false;
        if (finalTranscript.trim().length > 0) {
            preview.innerText = "Processing command...";
            processAiTranscript(finalTranscript.trim());
        } else {
            overlay.style.display = 'none';
        }
    };
    
    aiRecognition.start();
};

async function processAiTranscript(transcript) {
    try {
        const res = await fetch('/api/ai/parse-command', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ transcript })
        });
        const data = await res.json();
        
        const overlay = document.getElementById('ai-listening-overlay');
        if(overlay) overlay.style.display = 'none';
        
        if (data.status === 'confirm') {
            showAiConfirmModal(data.case, data.proposed_changes, transcript, data.email_draft);
        } else if (data.status === 'multiple_matches') {
            showToast("Found multiple cases matching your voice request. Please be more specific with the Case Number.");
        } else if (data.status === 'general_query') {
            showToast(data.message, 'success');
            // If they asked for a count, we can pop an alert or just show the toast
            alert("AI Response: " + data.message);
        } else {
            showToast(data.message || "Command not recognized. Please mention a case number and action.");
        }
        
    } catch (err) {
        console.error(err);
        const overlay = document.getElementById('ai-listening-overlay');
        if(overlay) overlay.style.display = 'none';
        showToast("Server error processing voice command.", 'error');
    }
}

function showAiConfirmModal(targetCase, changes, originalTranscript, emailDraft = null) {
    const modal = document.getElementById('ai-confirm-modal');
    document.getElementById('ai-confirm-case-title').innerText = `${targetCase.client_name} (Case: ${targetCase.chamber_case_number || '-'})`;
    document.getElementById('ai-confirm-case-subtitle').innerText = `Court No: ${targetCase.court_case_number || '-'} | Type: ${targetCase.case_type || '-'}`;
    
    const list = document.getElementById('ai-confirm-changes-list');
    list.innerHTML = '';
    
    for (const [key, value] of Object.entries(changes)) {
        list.innerHTML += `<li><strong>${key.replace('_', ' ').toUpperCase()}:</strong> ${value}</li>`;
    }
    
    if (emailDraft && emailDraft.subject) {
        list.innerHTML += `<li style="background: #eef2ff; border-left: 3px solid #6366f1; padding: 10px; margin-top: 10px;">
            <strong style="color: #4f46e5;">✉️ AUTOMATED EMAIL TO CLIENT</strong><br>
            <strong>Subject:</strong> ${emailDraft.subject}<br>
            <div style="font-size: 0.9em; margin-top: 5px; color: #333;">${emailDraft.body}</div>
        </li>`;
    }
    
    currentAiPayload = {
        case_id: targetCase._id,
        changes: changes,
        transcript: originalTranscript,
        admin_id: window.globalAdminId || 'Admin',
        email_draft: emailDraft
    };
    
    modal.style.display = 'flex';
    
    // Start listening for verbal Confirm/Cancel
    startAiConfirmationListening();
}

function startAiConfirmationListening() {
    if (isAiConfirming) return;
    
    aiConfirmationRecognition = initSpeechRecognition();
    if (!aiConfirmationRecognition) return;
    
    aiConfirmationRecognition.continuous = true;
    aiConfirmationRecognition.interimResults = false;
    isAiConfirming = true;
    
    document.getElementById('ai-voice-prompt').style.display = 'flex';
    
    aiConfirmationRecognition.onresult = function(event) {
        const last = event.results.length - 1;
        const text = event.results[last][0].transcript.trim().toLowerCase();
        
        console.log("Confirmation heard:", text);
        
        if (text.includes('confirm') || text.includes('yes') || text.includes('proceed') || text.includes('apply')) {
            aiConfirmationRecognition.stop();
            confirmAiAction();
        } else if (text.includes('cancel') || text.includes('no') || text.includes('stop') || text.includes('abort')) {
            aiConfirmationRecognition.stop();
            cancelAiAction();
        }
    };
    
    aiConfirmationRecognition.onend = function() {
        isAiConfirming = false;
        // Optionally restart if modal is still open, but for now we let it end after a while.
        document.getElementById('ai-voice-prompt').style.display = 'none';
    };
    
    aiConfirmationRecognition.start();
}

window.cancelAiAction = function() {
    if (aiConfirmationRecognition && isAiConfirming) {
        aiConfirmationRecognition.stop();
    }
    document.getElementById('ai-confirm-modal').style.display = 'none';
    currentAiPayload = null;
};

window.confirmAiAction = async function() {
    if (aiConfirmationRecognition && isAiConfirming) {
        aiConfirmationRecognition.stop();
    }
    
    const btn = document.querySelector('#ai-confirm-modal .btn-primary');
    btn.innerText = 'Updating...';
    btn.disabled = true;
    
    try {
        const res = await fetch('/api/ai/execute-command', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(currentAiPayload)
        });
        
        if (res.ok) {
            showToast("Case updated successfully via AI!");
            document.getElementById('ai-confirm-modal').style.display = 'none';
            // Reload cases UI
            if (typeof loadCases === 'function') casesCache=""; loadCases();
            if (typeof loadRecentCases === 'function') loadRecentCases();
        } else {
            const data = await res.json();
            showToast("Failed to update: " + data.error, 'error');
        }
    } catch(err) {
        console.error(err);
        showToast("Server error applying changes.", 'error');
    }
    
    btn.innerText = 'Confirm Update';
    btn.disabled = false;
    currentAiPayload = null;
};



// ==========================================
// APPOINTMENT AVAILABILITY SETTINGS
// ==========================================
async function loadAppointmentSettings() {
    try {
        const res = await fetch('/api/system-config');
        const config = await res.json();
        if (config && config.appointment_settings) {
            const s = config.appointment_settings;
            document.getElementById('appt-start-time').value = s.start_time || '10:00';
            document.getElementById('appt-end-time').value = s.end_time || '17:00';
            if (document.getElementById('appt-booking-start')) document.getElementById('appt-booking-start').value = s.booking_start || '09:00';
            if (document.getElementById('appt-booking-end')) document.getElementById('appt-booking-end').value = s.booking_end || '12:00';
            document.getElementById('appt-max-day').value = s.max_per_day || 5;
            document.getElementById('appt-slot-duration').value = s.slot_duration || 30;
            
            const checkboxes = document.querySelectorAll('.day-checkbox');
            checkboxes.forEach(cb => {
                cb.checked = s.available_days && s.available_days.includes(cb.value);
            });
        }
    } catch(e) {
        console.error("Error loading appt settings", e);
    }
}

window.saveAppointmentSettings = async function() {
    const start_time = document.getElementById('appt-start-time').value;
    const end_time = document.getElementById('appt-end-time').value;
    const booking_start = document.getElementById('appt-booking-start') ? document.getElementById('appt-booking-start').value : '09:00';
    const booking_end = document.getElementById('appt-booking-end') ? document.getElementById('appt-booking-end').value : '12:00';
    const max_per_day = parseInt(document.getElementById('appt-max-day').value);
    const slot_duration = parseInt(document.getElementById('appt-slot-duration').value);
    
    const available_days = [];
    document.querySelectorAll('.day-checkbox:checked').forEach(cb => {
        available_days.push(cb.value);
    });
    
    const btn = document.querySelector('button[onclick="saveAppointmentSettings()"]');
    btn.innerText = 'Saving...';
    
    try {
        const res = await fetch('/api/system-config/appointments', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ start_time, end_time, booking_start, booking_end, max_per_day, slot_duration, available_days })
        });
        if(res.ok) {
            showToast('Saved');
        } else {
            showToast('Failed to save settings.', 'error');
        }
    } catch(e) {
        showToast('Error saving settings.', 'error');
    }
    btn.innerText = 'Save Settings';
};

// Call loadAppointmentSettings on initial load
document.addEventListener('DOMContentLoaded', () => {
    loadAppointmentSettings();
});

// ==========================================
// ADMIN NAVIGATION & SIDEBAR CONTROLS
// ==========================================
const ADMIN_SECTION_META = {
    'dashboard': { title: 'Admin Dashboard', desc: 'Chamber Operations & Analytics Overview' },
    'consultations': { title: 'Appointments Gateway', desc: 'Incoming consultation bookings & emergency calendar shifts' },
    'clients': { title: 'Clients Directory', desc: 'Historical directory of concluded and active clients' },
    'advocates': { title: 'Advocates & Staff Members', desc: 'Chamber legal associates, access credentials, and welcome mail' },
    'cases-manage': { title: 'Active Chamber Cases', desc: 'Hearing calendar tracking, updates, and client alerts' },
    'cases-add': { title: 'Add New Case File', desc: 'Register a client case file and email client security credentials' },
    'case-payments': { title: 'Fee Payments Audit', desc: 'Fee structures, consultation charges, and client invoices' },
    'news': { title: 'News & Insights Manager', desc: 'Articles, statutory updates, and chamber publications' },
    'opinions': { title: "Today's Legal Opinion", desc: 'Day-by-day chamber opinions with calendar archive' },
    'services': { title: 'Legal Expertise & 3D Books', desc: 'Practice areas and interactive 3D turn-page monographs' },
    'settings': { title: 'Chamber Settings & Banner', desc: 'Chamber identity, credentials, banner images, and logo' },
    'special-otp': { title: 'Special OTP Section', desc: 'Emergency Client Login Quota & Bonus Tracking (48h Auto-Audit)' },
    'emails': { title: 'Staff Email Audit Logs', desc: 'Login codes, dispatches, and system transaction logs' }
};

window.toggleAdminSidebar = function(open) {
    const sidebar = document.getElementById('admin-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (!sidebar) return;
    if (open === undefined) {
        open = !sidebar.classList.contains('open');
    }
    if (open) {
        sidebar.classList.add('open');
        if (overlay) overlay.classList.add('active');
    } else {
        sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('active');
    }
};

window.showSection = function(sectionId) {
    // Hide all sections
    document.querySelectorAll('.admin-section').forEach(sec => sec.classList.remove('active'));
    
    // Show target section
    const targetSection = document.getElementById('section-' + sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
    }

    // Sync active highlight on Left Sidebar navigation links
    document.querySelectorAll('.sidebar-nav-link, .sidebar a').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('data-section') === sectionId || link.id === 'nav-' + sectionId) {
            link.classList.add('active');
        }
    });

    // Update Header title & subtitle
    const meta = ADMIN_SECTION_META[sectionId] || { title: 'Admin Dashboard', desc: 'System Overview' };
    const titleEl = document.getElementById('current-section-title');
    const descEl = document.getElementById('current-section-desc');
    if (titleEl) titleEl.innerText = meta.title;
    if (descEl) descEl.innerText = meta.desc;
    
    // Toggle AI Voice button visibility (only for active cases)
    const aiBtn = document.getElementById('ai-voice-btn');
    if (aiBtn) {
        aiBtn.style.display = (sectionId === 'cases-manage') ? 'flex' : 'none';
    }

    // Auto-close mobile drawer if open
    window.toggleAdminSidebar(false);

    // Scroll right content pane smoothly to top
    const mainPane = document.getElementById('main-content-pane');
    if (mainPane) {
        mainPane.scrollTop = 0;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Trigger section-specific reloads
    if (sectionId === 'special-otp' && typeof window.loadSpecialOtpData === 'function') {
        window.loadSpecialOtpData();
    }
    if (sectionId === 'services' && typeof window.loadAdminServices === 'function') {
        window.loadAdminServices();
    }
    if (sectionId === 'news' && typeof window.loadAdminNews === 'function') {
        window.loadAdminNews();
    }
    if (sectionId === 'opinions' && typeof window.loadAdminOpinions === 'function') {
        window.loadAdminOpinions();
    }
    if (sectionId === 'advocates' && typeof window.loadAdvocates === 'function') {
        window.loadAdvocates();
    }
    if (sectionId === 'consultations' && typeof window.loadAppointments === 'function') {
        window.loadAppointments();
    }
    if (sectionId === 'cases-manage' && typeof window.loadCases === 'function') {
        window.loadCases();
    }
    if (sectionId === 'clients' && typeof window.loadArchivedCases === 'function') {
        window.loadArchivedCases();
    }
    if (sectionId === 'dashboard' && typeof window.loadArchivedCases === 'function') {
        window.loadArchivedCases();
    }
};

window.executeEmergencyShift = async function() {
    const old_date = document.getElementById('shift-old-date').value;
    const new_date = document.getElementById('shift-new-date').value;
    const start_time = document.getElementById('shift-start-time').value;
    const end_time = document.getElementById('shift-end-time').value;
    const password = document.getElementById('shift-admin-pwd').value;
    
    if (!old_date || !new_date || !start_time || !end_time || !password) {
        showToast("Please fill in all fields.");
        return;
    }
    
    if(!confirm(`Are you sure you want to shift ALL appointments from ${old_date} to ${new_date}? This will block ${old_date} and send emails to all affected clients.`)) return;
    
    try {
        const btn = document.querySelector('#emergency-shift-modal .btn-primary');
        const origText = btn.innerText;
        btn.innerText = 'Processing...';
        btn.disabled = true;
        
        const response = await fetch('/api/appointments/shift', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ old_date, new_date, start_time, end_time, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast(data.message);
            document.getElementById('emergency-shift-modal').style.display = 'none';
            document.getElementById('shift-admin-pwd').value = '';
            if (window.loadAdminConsultations) loadAdminConsultations();
        } else {
            showToast(data.error || 'Failed to shift appointments.', 'error');
        }
        
        btn.innerText = origText;
        btn.disabled = false;
    } catch(err) {
        console.error(err);
        showToast('Server error while shifting appointments.', 'error');
    }
};

window.printCaseDetails = async function(id) {
    const printWindow = window.open('', '', 'width=800,height=900');
    if (!printWindow) {
        showToast("Popup blocked! Please allow popups for this site.");
        return;
    }
    printWindow.document.write(`<html><head><title>Loading...</title></head><body style="font-family:sans-serif; padding:40px;"><h2>Generating Report...</h2></body></html>`);
    
    try {
        const res = await fetch(`/api/cases/${id}`);
        const c = await res.json();
        
        let chamberName = 'JSM. Chambers';
        let chamberAddress = 'Cuttack, Odisha';
        let chamberPhone = '';
        let chamberEmail = '';
        try {
            const setRes = await fetch('/api/settings');
            const settings = await setRes.json();
            if (settings.chamber_name) chamberName = settings.chamber_name;
            if (settings.address) chamberAddress = settings.address;
            if (settings.phone) chamberPhone = settings.phone;
            if (settings.email) chamberEmail = settings.email;
        } catch(e) {}
        
        let statusHistoryHtml = '<ul>';
        if(c.status_history && c.status_history.length > 0) {
            c.status_history.forEach(hist => { 
                statusHistoryHtml += `<li><strong>${hist.date}:</strong> ${hist.status}</li>`;
            });
        } else if (c.status_updated_at) {
            statusHistoryHtml += `<li><strong>${c.status_updated_at}:</strong> ${c.status} (Latest Update)</li>`;
        } else {
            statusHistoryHtml += `<li>No status history recorded.</li>`;
        }
        statusHistoryHtml += '</ul>';

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
                </style>
            </head>
            <body>
                <div class="report-container">
                    <div class="header">
                    ${globalLogoUrl ? `<img src="${globalLogoUrl}" style="max-height: 80px; width: auto; object-fit: contain; margin-bottom: 15px;" alt="Chamber Logo">` : ''}
                    <h1>${chamberName}</h1>
                    <p style="font-size: 0.95rem; color: #444; margin-bottom: 4px;"><strong>Address:</strong> ${chamberAddress}</p>
                    ${chamberPhone ? `<p style="font-size: 0.95rem; color: #444; margin-bottom: 4px;"><strong>Phone:</strong> ${chamberPhone}</p>` : ''}
                    ${chamberEmail ? `<p style="font-size: 0.95rem; color: #444; margin-bottom: 4px;"><strong>Email:</strong> ${chamberEmail}</p>` : ''}
                    <div style="margin-top: 20px; border-top: 1px dashed #ccc; padding-top: 15px;">
                        <h2 style="margin: 0; font-size: 1.3rem; color: #0A192F;">CASE INFORMATION REPORT</h2>
                    </div>
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
                </div>

                <div class="section">
                    <h3>Status History</h3>
                    ${statusHistoryHtml}
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
                    <p>${c.notes ? c.notes.replace(/\n/g, '<br>') : 'No notes recorded.'}</p>
                </div>
                
                <div style="text-align: center; margin-top: 50px;">
                    <button onclick="window.print()" style="padding: 10px 20px; font-size: 16px; cursor: pointer; background: #0A192F; color: white; border: none; border-radius: 4px;">Print Report</button>
                </div>
            </body>
            </html>
        `);
        printWindow.document.close();
    } catch(err) {
        console.error(err);
        printWindow.document.body.innerHTML = `<h2>Error loading case details.</h2>`;
    }
};

    window.filterActiveCases = function() {
        const type = document.getElementById('case-search-type').value;
        const query = document.getElementById('case-search-input').value.toLowerCase().trim();
        const cards = document.querySelectorAll('#cases-grid .admin-case-card-item');
        
        cards.forEach(card => {
            if (!query) {
                card.style.display = 'flex';
                return;
            }
            const matchVal = card.getAttribute('data-' + type) || '';
            if (matchVal.includes(query)) {
                card.style.display = 'flex';
            } else {
                card.style.display = 'none';
            }
        });
    };



// ==========================================
// QUICK LINKS BUILDER
// ==========================================
window.addQuickLinkRow = function(title = '', url = '') {
    const container = document.getElementById('quick-links-container');
    if (!container) return;
    
    const row = document.createElement('div');
    row.className = 'ql-row';
    row.style.cssText = 'display: flex; gap: 10px; align-items: center; background: #fff; padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1;';
    
    row.innerHTML = `
        <input type="text" class="form-control ql-title" placeholder="Link Title (e.g. Home)" value="${title.replace(/"/g, '&quot;')}" style="flex: 1; margin: 0;">
        <input type="text" class="form-control ql-url" placeholder="URL (e.g. https://...)" value="${url.replace(/"/g, '&quot;')}" style="flex: 2; margin: 0;">
        <button type="button" class="btn" onclick="this.parentElement.remove()" style="background: #ef4444; color: white; border: none; border-radius: 6px; padding: 8px 12px; cursor: pointer;">Delete</button>
    `;
    container.appendChild(row);
};

window.renderQuickLinks = function(linksData) {
    const container = document.getElementById('quick-links-container');
    if (!container) return;
    container.innerHTML = '';
    
    let links = [];
    if (typeof linksData === 'string') {
        // Legacy text format parser
        const lines = linksData.split('\n');
        lines.forEach(line => {
            let parts = line.split('|');
            if (parts.length < 2) parts = line.split('-');
            if (parts.length >= 2) {
                links.push({ title: parts[0].trim(), url: parts.slice(1).join('|').replace(/^-/,'').trim() });
            }
        });
    } else if (Array.isArray(linksData)) {
        links = linksData;
    }
    
    if (links.length === 0) {
        addQuickLinkRow(); // Add an empty row by default
    } else {
        links.forEach(l => addQuickLinkRow(l.title, l.url));
    }
};

window.getQuickLinksData = function() {
    const container = document.getElementById('quick-links-container');
    if (!container) return [];
    const rows = container.querySelectorAll('.ql-row');
    const links = [];
    rows.forEach(row => {
        const title = row.querySelector('.ql-title').value.trim();
        const url = row.querySelector('.ql-url').value.trim();
        if (title && url) {
            links.push({ title, url });
        }
    });
    return links;
};


// ==========================================
// BILLING & PAYMENT LOGIC
// ==========================================

let currentBillingCaseId = null;

window.executePaymentSearch = function() {
    const searchType = document.getElementById('payment-search-type').value;
    const input = document.getElementById('payment-search-input');
    const searchVal = input.value.trim().toLowerCase();
    
    if (!searchVal) {
        showToast('Please enter a case number to search', 'error');
        return;
    }

    const c = window.globalCasesData.find(caseObj => {
        if (searchType === 'chamber') {
            return (caseObj.chamber_case_number || '').toLowerCase() === searchVal;
        } else {
            return (caseObj.court_case_number || '').toLowerCase() === searchVal;
        }
    });
    
    if (c) {
        input.value = ''; // clear input after finding
        loadCaseBills(c._id);
        showToast('Case found!', 'success');
        lucide.createIcons();
    } else {
        const area = document.getElementById('billing-area');
        if (area) area.style.display = 'none';
        currentBillingCaseId = null;
        showToast('No case found with that number.', 'error');
    }
};

window.loadCaseBills = function(caseId) {
    currentBillingCaseId = caseId;
    const area = document.getElementById('billing-area');
    if (!caseId) {
        area.style.display = 'none';
        return;
    }
    
    // Populate the case header
    const c = window.globalCasesData.find(x => x._id === caseId);
    if (c) {
        document.getElementById('billing-client-name').innerText = c.client_name || 'Unknown Client';
        document.getElementById('billing-chamber-no').innerText = c.chamber_case_number || 'N/A';
        document.getElementById('billing-court-no').innerText = c.court_case_number || 'N/A';
    }
    
    area.style.display = 'block';
    renderBillsTable();
};

function renderBillsTable() {
    if (!currentBillingCaseId) return;
    const c = window.globalCasesData.find(x => x._id === currentBillingCaseId);
    if (!c) return;
    
    const tbody = document.getElementById('billing-history-tbody');
    tbody.innerHTML = '';
    
    if (!c.bills || c.bills.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#666;">No bills generated yet.</td></tr>';
        return;
    }
    
    c.bills.forEach(b => {
        let amt = parseFloat(b.amount) || 0;
        let paid = parseFloat(b.paid_amount);
        if (isNaN(paid)) paid = (b.status === 'verified') ? amt : 0;
        
        let statusHtml = '';
        let actionHtml = '';
        
        if (b.status === 'verified') {
            statusHtml = `<span style="color: #10b981; font-weight:bold; background: #ecfdf5; padding: 4px 8px; border-radius: 4px; font-size: 0.85rem;">✅ Paid (${b.verified_date})</span>`;
            actionHtml = `<div style="display:flex; gap:5px;"><button class="btn btn-outline" style="padding: 0.2rem 0.5rem; font-size: 0.8rem;" onclick="printReceipt('${c._id}', '${b.id}')">🖨️ Print</button>
                          <button class="btn btn-outline" style="padding: 0.2rem 0.5rem; font-size: 0.8rem; border-color:#ef4444; color:#ef4444;" onclick="deleteBill('${c._id}', '${b.id}')">🗑️ Delete</button></div>`;
        } else if (b.status === 'partial') {
            statusHtml = `<span style="color: #f59e0b; font-weight:bold; background: #fffbeb; padding: 4px 8px; border-radius: 4px; font-size: 0.85rem;">Partial</span>`;
            actionHtml = `<div style="display:flex; gap:5px;"><button class="btn btn-primary" style="padding: 0.2rem 0.5rem; font-size: 0.8rem; background: #f59e0b; border:none;" onclick="verifyBill('${c._id}', '${b.id}')">Record Pay 💸</button>
                          <button class="btn btn-outline" style="padding: 0.2rem 0.5rem; font-size: 0.8rem; border-color:#ef4444; color:#ef4444;" onclick="deleteBill('${c._id}', '${b.id}')">🗑️</button></div>`;
        } else {
            statusHtml = `<span style="color: #ef4444; font-weight:bold; background: #fef2f2; padding: 4px 8px; border-radius: 4px; font-size: 0.85rem;">Pending</span>`;
            actionHtml = `<div style="display:flex; gap:5px;"><button class="btn btn-primary" style="padding: 0.2rem 0.5rem; font-size: 0.8rem; background: var(--success);" onclick="verifyBill('${c._id}', '${b.id}')">Record Pay 💸</button>
                          <button class="btn btn-outline" style="padding: 0.2rem 0.5rem; font-size: 0.8rem; border-color:#ef4444; color:#ef4444;" onclick="deleteBill('${c._id}', '${b.id}')">🗑️</button></div>`;
        }
        
        const phaseDisplay = b.phase || 'Phase-1';
        tbody.innerHTML += `
            <tr>
                <td><strong style="color:#051426;">${phaseDisplay}</strong><br><span style="font-size:0.75rem; color:#667085;">${b.date_added}</span></td>
                <td style="font-weight:bold; color:var(--primary);">Rs. ${amt} <br><span style="font-size:0.75rem; color:#666;">(Paid: Rs. ${paid})</span></td>
                <td>${statusHtml}</td>
                <td>${actionHtml}</td>
            </tr>
        `;
    });
}

window.addNewBill = async function() {
    if (!currentBillingCaseId) return;
    const amountInput = document.getElementById('new-bill-amount');
    const amount = amountInput.value.trim();
    if (!amount) {
        showToast('Please enter an amount', 'error');
        return;
    }
    
    try {
        const res = await fetch(`/api/cases/${currentBillingCaseId}/bills`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ amount: amount })
        });
        
        if (res.ok) {
            showToast('Bill saved. Email sent to client.');
            amountInput.value = '';
            if (window.loadCases) await window.loadCases();
            renderBillsTable();
        } else {
            showToast('Failed to save bill', 'error');
        }
    } catch(e) {
        console.error(e);
        showToast('Network error', 'error');
    }
};

window.verifyBill = function(caseId, billId) {
    const c = window.globalCasesData.find(x => x._id === caseId);
    if (!c) return;
    const b = c.bills.find(x => x.id === billId);
    if (!b) return;
    
    const amt = parseFloat(b.amount) || 0;
    let paid = parseFloat(b.paid_amount);
    if (isNaN(paid)) paid = (b.status === 'verified') ? amt : 0;
    const remaining = amt - paid;

    showPaymentInputModal("Record Payment", remaining, async function(paidAmt) {
        try {
            const res = await fetch(`/api/cases/${caseId}/bills/${billId}/verify`, { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: paidAmt })
            });
            if (res.ok) {
                showToast('Payment recorded! Email sent.');
                if (window.loadCases) await window.loadCases();
                renderBillsTable();
            } else {
                showToast('Failed to record payment', 'error');
            }
        } catch (e) {
            console.error(e);
        }
    });
};

window.printReceipt = function(caseId, billId) {
    const c = window.globalCasesData.find(x => x._id === caseId);
    if (!c) return;
    const b = c.bills.find(x => x.id === billId);
    if (!b) return;
    
    const printWindow = window.open('', '', 'width=800,height=900');
    if (!printWindow) { showToast("Popup blocked"); return; }
    
    printWindow.document.write(`
        <html>
        <head>
            <title>Invoice Receipt - ${c.client_name}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
                .header { text-align: center; border-bottom: 2px solid #0A192F; padding-bottom: 20px; margin-bottom: 30px; }
                .header h1 { margin: 0; color: #0A192F; font-family: 'Playfair Display', serif; }
                .details { display: flex; justify-content: space-between; margin-bottom: 40px; }
                .box { border: 1px solid #ddd; padding: 15px; border-radius: 8px; width: 45%; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
                th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                th { background: #f8fafc; color: #0A192F; }
                .total-row { font-weight: bold; font-size: 1.2rem; }
                .stamp { position: absolute; right: 50px; top: 150px; font-size: 4rem; color: rgba(16, 185, 129, 0.2); border: 8px solid rgba(16, 185, 129, 0.2); padding: 10px 20px; transform: rotate(-15deg); text-transform: uppercase; border-radius: 12px; pointer-events: none; font-weight: 900;}
                @media print { body { padding: 0; } .print-btn { display: none; } }
            </style>
        </head>
        <body>
            <div class="header">
                ${globalLogoUrl ? `<img src="${globalLogoUrl}" style="max-height: 80px; width: auto; object-fit: contain; margin-bottom: 15px;">` : ''}
                <h1>JSM. Chambers</h1>
                <p>Invoice Receipt</p>
            </div>
            
            <div class="stamp">PAID</div>
            
            <div class="details">
                <div class="box">
                    <strong>Billed To:</strong><br>
                    ${c.client_name}<br>
                    Email: ${c.email}
                </div>
                <div class="box" style="text-align: right;">
                    <strong>Receipt No:</strong> RCPT-${b.id.substring(0, 8).toUpperCase()}<br>
                    <strong>Date Paid:</strong> ${b.verified_date || b.date_added}<br>
                    <strong>Case Ref:</strong> ${c.chamber_case_number || c.court_case_number || 'N/A'}
                </div>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th>Description</th>
                        <th style="text-align: right;">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Legal Fees / Phase Payment</td>
                        <td style="text-align: right;">Rs. ${b.amount}</td>
                    </tr>
                    <tr class="total-row">
                        <td style="text-align: right;">Total Paid</td>
                        <td style="text-align: right;">Rs. ${b.amount}</td>
                    </tr>
                </tbody>
            </table>
            
            <p style="text-align: center; color: #666; font-size: 0.9rem;">This is a computer-generated receipt and requires no physical signature.</p>
            
            <div style="text-align: center; margin-top: 50px;" class="print-btn">
                <button onclick="window.print()" style="padding: 10px 20px; background: #0A192F; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px;">🖨️ Print Receipt</button>
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
};



window.deleteBill = function(caseId, billId) {
    showConfirmModal(
        "Delete Bill",
        "Are you sure you want to delete this bill? This cannot be undone and it will be removed from the client dashboard.",
        async function() {
            try {
                const res = await fetch(`/api/cases/${caseId}/bills/${billId}`, { method: 'DELETE' });
                if (res.ok) {
                    showToast('Bill deleted successfully');
                    if (window.loadCases) await window.loadCases();
                    renderBillsTable();
                } else {
                    showToast('Failed to delete bill', 'error');
                }
            } catch (e) {
                console.error(e);
                showToast('Network error', 'error');
            }
        }
    );
};


window.showPaymentInputModal = function(title, maxAmount, callback) {
    let existing = document.getElementById('custom-payment-modal');
    if (existing) existing.remove();
    
    const modalHtml = `
    <div id="custom-payment-modal" class="modal" style="display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.5); z-index: 9999; position: fixed; top: 0; left: 0; width: 100%; height: 100%;">
        <div class="modal-content" style="background: white; padding: 2rem; border-radius: 8px; max-width: 400px; width: 100%; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
            <h3 style="margin-top: 0; color: #051426; font-family: 'Playfair Display', serif;">${title}</h3>
            <p style="color: #667085; margin: 15px 0 10px 0; font-family: 'Plus Jakarta Sans', sans-serif;">Enter the custom amount received from the client. <br><b>(Remaining: Rs. ${maxAmount})</b></p>
            <input type="number" id="custom-payment-amount" class="form-control" value="${maxAmount}" max="${maxAmount}" style="width: 100%; box-sizing: border-box; text-align: center; font-size: 1.2rem; margin-bottom: 20px; padding: 10px;">
            <div style="display: flex; gap: 10px; justify-content: center;">
                <button class="btn btn-outline" onclick="document.getElementById('custom-payment-modal').remove()" style="padding: 0.5rem 1.5rem;">Cancel</button>
                <button class="btn btn-primary" id="custom-payment-btn" style="padding: 0.5rem 1.5rem; background: #10b981; border: none;">Record Payment</button>
            </div>
        </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    document.getElementById('custom-payment-btn').onclick = function() {
        let amt = parseFloat(document.getElementById('custom-payment-amount').value);
        if (isNaN(amt) || amt <= 0 || amt > maxAmount) {
            showToast('Invalid amount', 'error');
            return;
        }
        document.getElementById('custom-payment-modal').remove();
        callback(amt);
    };
};

window.showConfirmModal = function(title, message, confirmCallback) {
    let existing = document.getElementById('custom-confirm-modal');
    if (existing) existing.remove();
    
    const modalHtml = `
    <div id="custom-confirm-modal" class="modal" style="display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.5); z-index: 9999; position: fixed; top: 0; left: 0; width: 100%; height: 100%;">
        <div class="modal-content" style="background: white; padding: 2rem; border-radius: 8px; max-width: 400px; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
            <h3 style="margin-top: 0; color: #051426; font-family: 'Playfair Display', serif;">${title}</h3>
            <p style="color: #667085; margin: 15px 0 25px 0; font-family: 'Plus Jakarta Sans', sans-serif;">${message}</p>
            <div style="display: flex; gap: 10px; justify-content: center;">
                <button class="btn btn-outline" onclick="document.getElementById('custom-confirm-modal').remove()" style="padding: 0.5rem 1.5rem;">Cancel</button>
                <button class="btn btn-primary" id="custom-confirm-btn" style="padding: 0.5rem 1.5rem;">Confirm</button>
            </div>
        </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    document.getElementById('custom-confirm-btn').onclick = function() {
        document.getElementById('custom-confirm-modal').remove();
        confirmCallback();
    };
};

// ==========================================
// LEGAL EXPERTISE & 3D BOOK MANAGEMENT
// ==========================================
window.globalServicesData = [];

window.loadAdminServices = async function() {
    const list = document.getElementById('admin-services-list');
    if (!list) return;
    try {
        const res = await fetch('/api/services?t=' + Date.now(), { cache: 'no-store' });
        const services = await res.json();
        window.globalServicesData = services;
        list.innerHTML = '';

        if (!services || services.length === 0) {
            list.innerHTML = '<p style="grid-column: 1/-1; color: #64748b; font-style: italic;">No legal expertise services found. Click "Add New Expertise Service" above.</p>';
            return;
        }

        services.forEach((s) => {
            const pagesCount = s.book_pages ? s.book_pages.length : 0;
            const card = document.createElement('div');
            card.style.background = '#ffffff';
            card.style.border = '1px solid #e2e8f0';
            card.style.borderRadius = '12px';
            card.style.padding = '1.5rem';
            card.style.boxShadow = '0 4px 15px rgba(0,0,0,0.04)';
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            const isImageIcon = s.icon && (s.icon.startsWith('data:') || s.icon.startsWith('http') || s.icon.startsWith('/'));
            const iconHtml = isImageIcon
                ? `<img src="${s.icon}" style="width: 28px; height: 28px; object-fit: contain; border-radius: 4px;">`
                : s.icon || '⚖';

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 44px; height: 44px; border-radius: 10px; background: #0A1628; color: #D4AF37; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; font-weight: bold; box-shadow: 0 4px 10px rgba(10,22,40,0.15); overflow: hidden;">
                            ${iconHtml}
                        </div>
                        <div>
                            <h4 style="margin: 0; color: #0f172a; font-size: 1.15rem;">${s.title}</h4>
                            <span style="display: inline-block; background: #fef3c7; color: #92400e; font-size: 0.75rem; font-weight: 700; padding: 2px 8px; border-radius: 9999px; margin-top: 4px;">
                                📖 ${pagesCount} 3D Book ${pagesCount === 1 ? 'Page' : 'Pages'}
                            </span>
                        </div>
                    </div>
                </div>

                <p style="margin: 0; font-size: 0.9rem; color: #475569; line-height: 1.5; flex-grow: 1;">
                    ${s.short_desc || 'No summary provided.'}
                </p>

                <div style="display: flex; gap: 8px; margin-top: 0.5rem; padding-top: 1rem; border-top: 1px solid #f1f5f9;">
                    <button class="btn btn-outline" onclick="openEditServiceModal('${s._id}')" style="flex: 1; padding: 0.5rem; font-size: 0.85rem; border-color: var(--primary); color: var(--primary);">
                        ✏️ Edit & Pages
                    </button>
                    <button class="btn btn-error" onclick="deleteService('${s._id}')" style="padding: 0.5rem 1rem; font-size: 0.85rem;">
                        🗑️ Delete
                    </button>
                </div>
            `;
            list.appendChild(card);
        });
    } catch (err) {
        console.error('Error loading admin services:', err);
    }
};

window.updateServiceIconPreview = function(val) {
    const previewText = document.getElementById('service-icon-preview-text');
    const previewImg = document.getElementById('service-icon-preview-img');
    const clearBtn = document.getElementById('service-icon-clear-btn');
    if (!previewText || !previewImg) return;
    
    val = (val || '').trim();
    if (val.startsWith('data:image/') || val.startsWith('http://') || val.startsWith('https://') || val.startsWith('/')) {
        previewImg.src = val;
        previewImg.style.display = 'block';
        previewText.style.display = 'none';
        if (clearBtn) clearBtn.style.display = 'inline-block';
    } else {
        previewImg.src = '';
        previewImg.style.display = 'none';
        previewText.style.display = 'block';
        previewText.innerText = val || '⚖';
        if (clearBtn) clearBtn.style.display = 'none';
    }
};

window.handleServiceIconUpload = async function(input) {
    if (input.files && input.files[0]) {
        try {
            const dataUrl = await window.compressImage(input.files[0], 250);
            document.getElementById('service-form-icon').value = dataUrl;
            window.updateServiceIconPreview(dataUrl);
            input.value = '';
        } catch (e) {
            console.error(e);
            showToast('Failed to process icon image', 'error');
        }
    }
};

window.clearServiceIcon = function() {
    document.getElementById('service-form-icon').value = '⚖';
    window.updateServiceIconPreview('⚖');
    const fileInput = document.getElementById('service-icon-file-input');
    if (fileInput) fileInput.value = '';
};

window.openAddServiceModal = function() {
    document.getElementById('service-form-id').value = '';
    document.getElementById('service-form-title').value = '';
    document.getElementById('service-form-icon').value = '⚖';
    window.updateServiceIconPreview('⚖');
    document.getElementById('service-form-desc').value = '';
    document.getElementById('service-modal-title').innerText = 'Add New Legal Expertise & 3D Book';
    document.getElementById('service-save-btn').innerText = '💾 Save Service & Book Content';
    
    const container = document.getElementById('service-pages-container');
    container.innerHTML = '';
    addPageToServiceForm('Overview & Legal Scope', '', []);
    addPageToServiceForm('Our Strategic Approach', '', []);
    
    document.getElementById('service-modal').style.display = 'flex';
};

window.openEditServiceModal = function(id) {
    const s = window.globalServicesData.find(x => x._id === id);
    if (!s) return;

    document.getElementById('service-form-id').value = s._id;
    document.getElementById('service-form-title').value = s.title || '';
    document.getElementById('service-form-icon').value = s.icon || '⚖';
    window.updateServiceIconPreview(s.icon || '⚖');
    document.getElementById('service-form-desc').value = s.short_desc || '';
    document.getElementById('service-modal-title').innerText = 'Edit ' + s.title + ' (3D Book)';
    document.getElementById('service-save-btn').innerText = '💾 Update Service & Book Content';

    const container = document.getElementById('service-pages-container');
    container.innerHTML = '';
    if (s.book_pages && s.book_pages.length > 0) {
        s.book_pages.forEach(p => {
            addPageToServiceForm(p.chapter || '', p.content || '', p.images || []);
        });
    } else {
        addPageToServiceForm('Overview & Legal Scope', '', []);
    }

    document.getElementById('service-modal').style.display = 'flex';
};

window.closeServiceModal = function() {
    document.getElementById('service-modal').style.display = 'none';
};

window.handlePageImageSlotUpload = async function(input) {
    if (input.files && input.files[0]) {
        const slotEl = input.closest('.page-img-slot');
        if (!slotEl) return;
        try {
            const dataUrl = await window.compressImage(input.files[0], 650);
            const previewImg = slotEl.querySelector('.slot-preview-img');
            const emptyText = slotEl.querySelector('.slot-empty-text');
            const removeBtn = slotEl.querySelector('.slot-remove-btn');
            const hiddenInput = slotEl.querySelector('.page-img-data');
            
            if (previewImg) { previewImg.src = dataUrl; previewImg.style.display = 'block'; }
            if (emptyText) emptyText.style.display = 'none';
            if (removeBtn) removeBtn.style.display = 'block';
            if (hiddenInput) hiddenInput.value = dataUrl;
            
            input.value = '';
        } catch (e) {
            console.error(e);
            showToast('Failed to process chapter image', 'error');
        }
    }
};

window.removePageSlotImage = function(btn) {
    const slotEl = btn.closest('.page-img-slot');
    if (!slotEl) return;
    const previewImg = slotEl.querySelector('.slot-preview-img');
    const emptyText = slotEl.querySelector('.slot-empty-text');
    const hiddenInput = slotEl.querySelector('.page-img-data');
    
    if (previewImg) { previewImg.src = ''; previewImg.style.display = 'none'; }
    if (emptyText) emptyText.style.display = 'block';
    if (hiddenInput) hiddenInput.value = '';
    btn.style.display = 'none';
};

window.addPageToServiceForm = function(chapter = '', content = '', images = []) {
    const container = document.getElementById('service-pages-container');
    const pageIndex = container.children.length + 1;
    
    const pageCard = document.createElement('div');
    pageCard.className = 'service-page-item';
    pageCard.style.background = '#f8fafc';
    pageCard.style.border = '1px solid #cbd5e1';
    pageCard.style.borderRadius = '10px';
    pageCard.style.padding = '1rem';
    pageCard.style.display = 'flex';
    pageCard.style.flexDirection = 'column';
    pageCard.style.gap = '8px';

    const img1 = (Array.isArray(images) && images[0]) ? images[0] : '';
    const img2 = (Array.isArray(images) && images[1]) ? images[1] : '';

    pageCard.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <strong style="color: var(--primary); font-size: 0.9rem;">📄 Page ${pageIndex} Chapter Title:</strong>
            <button type="button" onclick="this.closest('.service-page-item').remove(); renumberServicePages();" class="btn" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 2px 6px; font-size: 0.85rem;">
                ✕ Remove
            </button>
        </div>
        <input type="text" class="form-control page-chapter-input" value="${chapter.replace(/"/g, '&quot;')}" placeholder="e.g. Chapter 1: Pre-trial Procedures & Injunctions" required>
        
        <div style="background: #ffffff; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 10px; margin-top: 4px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 0.82rem; font-weight: 700; color: #334155;">🖼️ Page Illustrations / Documents (Optional - Max 2):</span>
                <span style="font-size: 0.74rem; color: #64748b;">Displays inside the 3D book</span>
            </div>
            <div class="page-images-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <!-- Slot 1 -->
                <div class="page-img-slot" data-slot="0" style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; background: #f8fafc; text-align: center;">
                    <div class="img-preview-container" style="height: 80px; display: flex; align-items: center; justify-content: center; background: #edf2f7; border-radius: 4px; overflow: hidden; margin-bottom: 6px; position: relative;">
                        <img class="slot-preview-img" src="${img1}" style="max-width: 100%; max-height: 100%; object-fit: contain; ${img1 ? 'display: block;' : 'display: none;'}">
                        <span class="slot-empty-text" style="font-size: 0.75rem; color: #94a3b8; ${img1 ? 'display: none;' : 'display: block;'}">Image 1 (Optional)</span>
                        <button type="button" class="slot-remove-btn" onclick="removePageSlotImage(this)" style="${img1 ? 'display: block;' : 'display: none;'} position: absolute; top: 4px; right: 4px; background: rgba(239, 68, 68, 0.9); color: white; border: none; border-radius: 50%; width: 22px; height: 22px; cursor: pointer; font-size: 11px; line-height: 1;" title="Remove image">✕</button>
                    </div>
                    <label class="btn btn-outline" style="padding: 3px 8px; font-size: 0.75rem; cursor: pointer; width: 100%; box-sizing: border-box; display: inline-block;">
                        📷 Upload Image 1
                        <input type="file" accept="image/*" style="display: none;" onchange="handlePageImageSlotUpload(this)">
                    </label>
                    <input type="hidden" class="page-img-data" value="${img1.replace(/"/g, '&quot;')}">
                </div>
                <!-- Slot 2 -->
                <div class="page-img-slot" data-slot="1" style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; background: #f8fafc; text-align: center;">
                    <div class="img-preview-container" style="height: 80px; display: flex; align-items: center; justify-content: center; background: #edf2f7; border-radius: 4px; overflow: hidden; margin-bottom: 6px; position: relative;">
                        <img class="slot-preview-img" src="${img2}" style="max-width: 100%; max-height: 100%; object-fit: contain; ${img2 ? 'display: block;' : 'display: none;'}">
                        <span class="slot-empty-text" style="font-size: 0.75rem; color: #94a3b8; ${img2 ? 'display: none;' : 'display: block;'}">Image 2 (Optional)</span>
                        <button type="button" class="slot-remove-btn" onclick="removePageSlotImage(this)" style="${img2 ? 'display: block;' : 'display: none;'} position: absolute; top: 4px; right: 4px; background: rgba(239, 68, 68, 0.9); color: white; border: none; border-radius: 50%; width: 22px; height: 22px; cursor: pointer; font-size: 11px; line-height: 1;" title="Remove image">✕</button>
                    </div>
                    <label class="btn btn-outline" style="padding: 3px 8px; font-size: 0.75rem; cursor: pointer; width: 100%; box-sizing: border-box; display: inline-block;">
                        📷 Upload Image 2
                        <input type="file" accept="image/*" style="display: none;" onchange="handlePageImageSlotUpload(this)">
                    </label>
                    <input type="hidden" class="page-img-data" value="${img2.replace(/"/g, '&quot;')}">
                </div>
            </div>
        </div>

        <label style="font-size: 0.8rem; font-weight: 600; color: #475569; margin-top: 4px;">Book Page Text Content:</label>
        <textarea class="form-control page-content-input" rows="4" placeholder="Enter in-depth legal expertise text that clients will read in the 3D book..." required>${content}</textarea>
    `;
    container.appendChild(pageCard);
};

window.renumberServicePages = function() {
    const container = document.getElementById('service-pages-container');
    const items = container.querySelectorAll('.service-page-item');
    items.forEach((item, index) => {
        const strong = item.querySelector('strong');
        if (strong) strong.innerText = `📄 Page ${index + 1} Chapter Title:`;
    });
};

window.saveServiceForm = async function(e) {
    e.preventDefault();
    const id = document.getElementById('service-form-id').value;
    const title = document.getElementById('service-form-title').value.trim();
    const icon = document.getElementById('service-form-icon').value.trim() || '⚖';
    const short_desc = document.getElementById('service-form-desc').value.trim();

    const pageItems = document.querySelectorAll('.service-page-item');
    const book_pages = [];
    pageItems.forEach(item => {
        const chapter = item.querySelector('.page-chapter-input').value.trim();
        const content = item.querySelector('.page-content-input').value.trim();
        const imgInputs = item.querySelectorAll('.page-img-data');
        const images = [];
        imgInputs.forEach(inp => {
            if (inp.value && inp.value.trim()) {
                images.push(inp.value.trim());
            }
        });
        if (chapter || content || images.length > 0) {
            book_pages.push({ chapter, content, images });
        }
    });

    if (book_pages.length === 0) {
        showToast('Please add at least 1 book page for clients to read.', 'error');
        return;
    }

    const saveBtn = document.getElementById('service-save-btn');
    saveBtn.innerText = 'Saving...';
    saveBtn.disabled = true;

    try {
        const url = id ? `/api/services/${id}` : '/api/services';
        const method = id ? 'PUT' : 'POST';
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, icon, short_desc, book_pages })
        });
        const data = await res.json();
        if (res.ok) {
            showToast(id ? 'Service & 3D book updated successfully!' : 'Service created successfully!', 'success');
            closeServiceModal();
            loadAdminServices();
        } else {
            showToast(data.error || 'Failed to save service', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Error saving service', 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = '💾 Save Service & Book Content';
    }
};

window.deleteService = async function(id) {
    if (!confirm('Are you sure you want to delete this expertise service and its 3D book?')) return;
    try {
        const res = await fetch(`/api/services/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('Service deleted.', 'success');
            loadAdminServices();
        } else {
            showToast('Failed to delete service', 'error');
        }
    } catch (err) {
        showToast('Error deleting service', 'error');
    }
};

// Initial load of services in admin
setTimeout(() => {
    if (typeof loadAdminServices === 'function') loadAdminServices();
    if (typeof loadAdminNews === 'function') loadAdminNews();
}, 700);

/* =========================================================
   NEWS AND INSIGHTS MANAGEMENT CONTROLLER
========================================================= */
window.globalNewsData = [];

window.loadAdminNews = async function() {
    try {
        const res = await fetch('/api/news', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        window.globalNewsData = data;

        const list = document.getElementById('admin-news-list');
        if (!list) return;

        list.innerHTML = '';

        if (!data || data.length === 0) {
            list.innerHTML = '<p style="grid-column: 1/-1; color: #64748b; font-style: italic;">No news articles published yet. Click "Publish New Article / News" above to add one.</p>';
            return;
        }

        data.forEach((item) => {
            const card = document.createElement('div');
            card.style.background = '#ffffff';
            card.style.border = '1px solid #e2e8f0';
            card.style.borderRadius = '12px';
            card.style.overflow = 'hidden';
            card.style.boxShadow = '0 4px 15px rgba(0,0,0,0.04)';
            card.style.display = 'flex';
            card.style.flexDirection = 'column';

            const iconRender = item.icon && (item.icon.startsWith('data:') || item.icon.startsWith('http') || item.icon.startsWith('/'))
                ? `<img src="${item.icon}" style="width: 16px; height: 16px; object-fit: contain; vertical-align: middle; margin-right: 4px;">`
                : `<span style="margin-right: 4px;">${item.icon || '⚖️'}</span>`;

            const imgHtml = (item.image || item.image_url)
                ? `<img src="${item.image || item.image_url}" style="width: 100%; height: 160px; object-fit: cover;" alt="Article">`
                : `<div style="width: 100%; height: 160px; background: linear-gradient(135deg, #0A1628 0%, #1e293b 100%); display: flex; align-items: center; justify-content: center; font-size: 2.5rem; color: #D4AF37;">${item.icon || '⚖️'}</div>`;

            card.innerHTML = `
                <div style="position: relative;">
                    ${imgHtml}
                    <span style="position: absolute; top: 10px; left: 10px; background: rgba(10,22,40,0.92); color: #D4AF37; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; padding: 4px 10px; border-radius: 9999px; border: 1px solid rgba(212,175,55,0.4); display: inline-flex; align-items: center;">
                        ${iconRender} ${item.category || 'Legal Insight'}
                    </span>
                </div>
                <div style="padding: 1.2rem; display: flex; flex-direction: column; flex-grow: 1;">
                    <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 6px;">
                        📅 ${item.date || 'Recent'} • ✍️ ${item.author || 'JSM Chambers'}
                    </div>
                    <h4 style="margin: 0 0 8px 0; color: #0f172a; font-size: 1.1rem; line-height: 1.35; font-family: 'Playfair Display', Georgia, serif;">
                        ${item.title}
                    </h4>
                    <p style="margin: 0 0 1rem 0; font-size: 0.88rem; color: #475569; line-height: 1.5; flex-grow: 1;">
                        ${item.summary || ''}
                    </p>
                    <div style="display: flex; gap: 8px; border-top: 1px solid #f1f5f9; padding-top: 0.8rem; margin-top: auto;">
                        <button class="btn btn-outline" onclick="openEditNewsModal('${item._id}')" style="flex: 1; padding: 0.45rem; font-size: 0.82rem; border-color: var(--primary); color: var(--primary);">
                            ✏️ Edit
                        </button>
                        <button class="btn btn-error" onclick="deleteNews('${item._id}')" style="padding: 0.45rem 0.9rem; font-size: 0.82rem;">
                            🗑️ Delete
                        </button>
                    </div>
                </div>
            `;
            list.appendChild(card);
        });
    } catch (err) {
        console.error('Error loading admin news:', err);
    }
};

window.updateNewsIconPreview = function(val) {
    const previewChar = document.getElementById('news-icon-preview-char');
    const previewImg = document.getElementById('news-icon-preview-img');
    if (!previewChar) return;

    val = (val || '').trim();
    if (!val) val = '⚖️';

    const isImage = val.startsWith('data:image/') || val.startsWith('http://') || val.startsWith('https://') || val.startsWith('/');
    if (isImage) {
        if (previewImg) {
            previewImg.src = val;
            previewImg.style.display = 'block';
        }
        previewChar.style.display = 'none';
    } else {
        previewChar.innerText = val;
        previewChar.style.display = 'block';
        if (previewImg) previewImg.style.display = 'none';
    }
};

window.setNewsPresetIcon = function(icon) {
    const input = document.getElementById('news-form-icon');
    if (input) input.value = icon;
    window.updateNewsIconPreview(icon);
};

window.handleNewsIconUpload = async function(input) {
    if (input.files && input.files[0]) {
        try {
            const dataUrl = await window.compressImage(input.files[0], 250);
            document.getElementById('news-form-icon').value = dataUrl;
            window.updateNewsIconPreview(dataUrl);
            input.value = '';
        } catch (e) {
            console.error(e);
            showToast('Failed to process icon image', 'error');
        }
    }
};

window.updateNewsImagePreview = function(val) {
    const previewImg = document.getElementById('news-image-preview-img');
    const placeholder = document.getElementById('news-image-preview-placeholder');
    const clearBtn = document.getElementById('news-image-clear-btn');
    if (!previewImg) return;

    val = (val || '').trim();
    if (val.startsWith('data:image/') || val.startsWith('http://') || val.startsWith('https://') || val.startsWith('/')) {
        previewImg.src = val;
        previewImg.style.display = 'block';
        if (placeholder) placeholder.style.display = 'none';
        if (clearBtn) clearBtn.style.display = 'inline-block';
    } else {
        previewImg.src = '';
        previewImg.style.display = 'none';
        if (placeholder) placeholder.style.display = 'block';
        if (clearBtn) clearBtn.style.display = 'none';
    }
};

window.handleNewsImageUpload = async function(input) {
    if (input.files && input.files[0]) {
        try {
            const dataUrl = await window.compressImage(input.files[0], 800);
            document.getElementById('news-form-image').value = dataUrl;
            window.updateNewsImagePreview(dataUrl);
            input.value = '';
        } catch (e) {
            console.error(e);
            showToast('Failed to process image', 'error');
        }
    }
};

window.clearNewsImage = function() {
    document.getElementById('news-form-image').value = '';
    window.updateNewsImagePreview('');
    const fileInput = document.getElementById('news-image-file-input');
    if (fileInput) fileInput.value = '';
};

window.openAddNewsModal = function() {
    document.getElementById('news-form-id').value = '';
    document.getElementById('news-form-title').value = '';
    document.getElementById('news-form-category').value = 'Supreme Court Update';
    document.getElementById('news-form-icon').value = '⚖️';
    window.updateNewsIconPreview('⚖️');
    document.getElementById('news-form-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('news-form-author').value = 'JSM Chambers Editorial';
    document.getElementById('news-form-image').value = '';
    window.updateNewsImagePreview('');
    document.getElementById('news-form-summary').value = '';
    document.getElementById('news-form-content').value = '';
    document.getElementById('news-modal-title').innerText = 'Publish News & Legal Insight';
    document.getElementById('news-save-btn').innerText = '💾 Publish Article';
    document.getElementById('news-modal').style.display = 'flex';
};

window.openEditNewsModal = function(id) {
    const item = window.globalNewsData.find(x => x._id === id);
    if (!item) return;

    document.getElementById('news-form-id').value = item._id;
    document.getElementById('news-form-title').value = item.title || '';
    document.getElementById('news-form-category').value = item.category || 'Supreme Court Update';
    const icon = item.icon || '⚖️';
    document.getElementById('news-form-icon').value = icon;
    window.updateNewsIconPreview(icon);
    document.getElementById('news-form-date').value = item.date || new Date().toISOString().split('T')[0];
    document.getElementById('news-form-author').value = item.author || 'JSM Chambers';
    document.getElementById('news-form-image').value = item.image || item.image_url || '';
    window.updateNewsImagePreview(item.image || item.image_url || '');
    document.getElementById('news-form-summary').value = item.summary || '';
    document.getElementById('news-form-content').value = item.content || '';
    document.getElementById('news-modal-title').innerText = 'Edit News Article';
    document.getElementById('news-save-btn').innerText = '💾 Update Article';
    document.getElementById('news-modal').style.display = 'flex';
};

window.closeNewsModal = function() {
    document.getElementById('news-modal').style.display = 'none';
};

window.saveNewsForm = async function(e) {
    e.preventDefault();
    const id = document.getElementById('news-form-id').value;
    const title = document.getElementById('news-form-title').value.trim();
    const category = document.getElementById('news-form-category').value.trim() || 'Judicial Update';
    const icon = (document.getElementById('news-form-icon') ? document.getElementById('news-form-icon').value.trim() : '') || '⚖️';
    const date = document.getElementById('news-form-date').value || new Date().toISOString().split('T')[0];
    const author = document.getElementById('news-form-author').value.trim() || 'JSM Chambers';
    const image = document.getElementById('news-form-image').value.trim();
    const summary = document.getElementById('news-form-summary').value.trim();
    const content = document.getElementById('news-form-content').value.trim();

    if (!title || !summary || !content) {
        showToast('Please fill in the title, summary, and article content.', 'error');
        return;
    }

    const saveBtn = document.getElementById('news-save-btn');
    saveBtn.innerText = 'Saving...';
    saveBtn.disabled = true;

    try {
        const url = id ? `/api/news/${id}` : '/api/news';
        const method = id ? 'PUT' : 'POST';
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, category, icon, date, author, image, summary, content })
        });
        const data = await res.json();
        if (res.ok) {
            showToast(id ? 'Article updated successfully!' : 'Article published successfully!', 'success');
            closeNewsModal();
            loadAdminNews();
        } else {
            showToast(data.error || 'Failed to save article', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Error saving article', 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = '💾 Publish Article';
    }
};

window.deleteNews = async function(id) {
    if (!confirm('Are you sure you want to delete this news article from the main page?')) return;
    try {
        const res = await fetch(`/api/news/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('Article deleted.', 'success');
            loadAdminNews();
        } else {
            showToast('Failed to delete article', 'error');
        }
    } catch (err) {
        showToast('Error deleting article', 'error');
    }
};

// ==========================================
// TODAY'S OPINION ADMIN MANAGEMENT
// ==========================================
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

window.adminOpinionsCache = [];

window.loadAdminOpinions = async function() {
    const listEl = document.getElementById('admin-opinions-list');
    if (!listEl) return;
    listEl.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: #64748b;">Loading opinions...</div>';

    try {
        const res = await fetch('/api/opinions?t=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) {
            throw new Error('HTTP ' + res.status);
        }
        let opinions = await res.json();
        if (!Array.isArray(opinions)) {
            opinions = [];
        }
        window.adminOpinionsCache = opinions;

        if (opinions.length === 0) {
            listEl.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: #64748b;">No opinions published yet. Click "Add Today\'s Opinion" to publish.</div>';
            return;
        }

        listEl.innerHTML = opinions.map(op => `
            <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-top: 4px solid #D4AF37; border-radius: 10px; padding: 1.25rem; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 4px 12px rgba(0,0,0,0.04);">
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem; flex-wrap: wrap; gap: 6px;">
                        <span style="background: #0A1628; color: #D4AF37; font-size: 0.72rem; font-weight: 700; padding: 3px 8px; border-radius: 4px; text-transform: uppercase;">
                            ${escapeHtml(op.category || 'Editorial')}
                        </span>
                        <span style="color: #64748b; font-size: 0.78rem; font-weight: 600;">
                            📅 ${escapeHtml(op.date || '')}
                        </span>
                    </div>
                    <h4 style="margin: 0 0 0.5rem 0; color: #0A1628; font-family: 'Playfair Display', Georgia, serif; font-size: 1.1rem; line-height: 1.35;">
                        ${escapeHtml(op.title || '')}
                    </h4>
                    <div style="color: #475569; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.6rem;">
                        ✍️ ${escapeHtml(op.author || 'Chamber Counsel')}
                    </div>
                    <p style="color: #475569; font-size: 0.84rem; line-height: 1.5; margin: 0 0 1rem 0; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">
                        ${escapeHtml(op.message || '')}
                    </p>
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 8px; border-top: 1px solid #e2e8f0; padding-top: 0.8rem;">
                    <button class="btn btn-outline" style="padding: 0.35rem 0.75rem; font-size: 0.8rem;" onclick="editOpinion('${op._id}')">
                        ✏️ Edit
                    </button>
                    <button class="btn btn-outline" style="padding: 0.35rem 0.75rem; font-size: 0.8rem; color: #dc2626; border-color: #fca5a5;" onclick="deleteOpinion('${op._id}')">
                        🗑️ Delete
                    </button>
                </div>
            </div>
        `).join('');
    } catch(err) {
        console.error(err);
        listEl.innerHTML = '<div style="grid-column: 1/-1; color: #dc2626; text-align: center; padding: 2rem;">Error loading opinions.</div>';
    }
};

window.openAddOpinionModal = function() {
    document.getElementById('opinion-form-id').value = '';
    document.getElementById('opinion-form-title').value = '';
    document.getElementById('opinion-form-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('opinion-form-author').value = 'Managing Counsel';
    document.getElementById('opinion-form-category').value = 'Constitutional Law';
    document.getElementById('opinion-form-message').value = '';
    document.getElementById('opinion-modal-title').innerText = "Publish Today's Opinion";
    document.getElementById('opinion-submit-btn').innerText = "💾 Save & Publish Opinion";
    document.getElementById('opinion-modal-admin').style.display = 'flex';
};

window.closeOpinionModal = function() {
    document.getElementById('opinion-modal-admin').style.display = 'none';
};

window.editOpinion = function(id) {
    const op = window.adminOpinionsCache.find(o => o._id === id);
    if (!op) return;
    document.getElementById('opinion-form-id').value = op._id;
    document.getElementById('opinion-form-title').value = op.title || '';
    document.getElementById('opinion-form-date').value = op.date || new Date().toISOString().split('T')[0];
    document.getElementById('opinion-form-author').value = op.author || '';
    document.getElementById('opinion-form-category').value = op.category || '';
    document.getElementById('opinion-form-message').value = op.message || '';
    document.getElementById('opinion-modal-title').innerText = "Edit Today's Opinion";
    document.getElementById('opinion-submit-btn').innerText = "💾 Update Opinion";
    document.getElementById('opinion-modal-admin').style.display = 'flex';
};

window.saveOpinionForm = async function(e) {
    e.preventDefault();
    const id = document.getElementById('opinion-form-id').value;
    const title = document.getElementById('opinion-form-title').value.trim();
    const date = document.getElementById('opinion-form-date').value || new Date().toISOString().split('T')[0];
    const author = document.getElementById('opinion-form-author').value.trim() || 'Chamber Counsel';
    const category = document.getElementById('opinion-form-category').value.trim() || 'Legal Editorial';
    const message = document.getElementById('opinion-form-message').value.trim();

    if (!title || !message) {
        showToast('Please fill in both the opinion title and message content.', 'error');
        return;
    }

    const submitBtn = document.getElementById('opinion-submit-btn');
    submitBtn.innerText = 'Saving...';
    submitBtn.disabled = true;

    try {
        const url = id ? `/api/opinions/${id}` : '/api/opinions';
        const method = id ? 'PUT' : 'POST';
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, date, author, category, message })
        });
        const data = await res.json();
        if (res.ok) {
            showToast(id ? 'Opinion updated successfully!' : "Today's opinion published successfully!", 'success');
            closeOpinionModal();
            loadAdminOpinions();
        } else {
            showToast(data.error || 'Failed to save opinion', 'error');
        }
    } catch(err) {
        console.error(err);
        showToast('Error saving opinion', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = '💾 Save & Publish Opinion';
    }
};

window.deleteOpinion = async function(id) {
    if (!confirm('Are you sure you want to delete this opinion?')) return;
    try {
        const res = await fetch(`/api/opinions/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('Opinion deleted.', 'success');
            loadAdminOpinions();
        } else {
            showToast('Failed to delete opinion', 'error');
        }
    } catch(err) {
        showToast('Error deleting opinion', 'error');
    }
};

// ==========================================
// SPECIAL OTP MANAGEMENT & 48H AUDIT SYSTEM
// ==========================================
let specialOtpClientsCache = [];
let currentSpecialOtpClient = null;

window.loadSpecialOtpData = async function() {
    const tbody = document.getElementById('special-otp-clients-tbody');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 2rem; color: #94a3b8;"><div style="font-size: 1.5rem; margin-bottom: 8px;">⏳</div>Loading client daily OTP tracking data...</td></tr>`;
    }

    try {
        const res = await fetch('/api/admin/special-otp/clients');
        const data = await res.json();
        if (!res.ok) {
            if (tbody) tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: #ef4444; padding: 2rem;">Error loading client tracking data: ${data.error || 'Server error'}</td></tr>`;
            return;
        }

        specialOtpClientsCache = data.clients || [];
        
        // Update Stats
        const stats = data.stats || {};
        const totalEl = document.getElementById('stat-special-total');
        const activeEl = document.getElementById('stat-special-active');
        const exhaustedEl = document.getElementById('stat-special-exhausted');
        const bonusEl = document.getElementById('stat-special-bonus');
        const bonusSubEl = document.getElementById('stat-special-bonus-sub');
        const todayLabel = document.getElementById('special-otp-today-label');

        if (totalEl) totalEl.innerText = stats.total_registered || 0;
        if (activeEl) activeEl.innerText = stats.active_today || 0;
        if (exhaustedEl) exhaustedEl.innerText = stats.exhausted || 0;
        if (bonusEl) bonusEl.innerText = stats.bonus_clients || 0;
        if (bonusSubEl) bonusSubEl.innerText = `${stats.total_bonus_otps || 0} extra OTP attempts granted today`;
        if (todayLabel) todayLabel.innerText = data.today || new Date().toISOString().slice(0, 10);

        window.renderSpecialOtpClientsTable(specialOtpClientsCache);
    } catch (err) {
        console.error("Error loading special OTP clients:", err);
        if (tbody) tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: #ef4444; padding: 2rem;">Failed to connect to server.</td></tr>`;
    }
};

window.renderSpecialOtpClientsTable = function(clients) {
    const tbody = document.getElementById('special-otp-clients-tbody');
    if (!tbody) return;

    if (!clients || clients.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 2.5rem; color: #64748b;">
            <div style="font-size: 1.6rem; margin-bottom: 6px;">🔍</div>
            No registered clients found matching the search criteria.
        </td></tr>`;
        return;
    }

    let html = '';
    clients.forEach(c => {
        const isBlocked = (c.remaining === 0 && c.used_today >= 3);
        const hasBonus = (c.bonus_otps > 0);
        
        // Format last activity time
        let timeFormatted = 'No requests today';
        if (c.last_activity) {
            try {
                const dt = new Date(c.last_activity);
                timeFormatted = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
            } catch(e) {
                timeFormatted = c.last_activity;
            }
        }

        // Status badge styling
        let badgeHtml = '';
        if (hasBonus && c.remaining > 0) {
            badgeHtml = `<span style="background: #fef3c7; color: #92400e; border: 1px solid #fde68a; padding: 4px 10px; border-radius: 999px; font-size: 0.76rem; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">🎁 Bonus Active (+${c.bonus_otps})</span>`;
        } else if (isBlocked && hasBonus) {
            badgeHtml = `<span style="background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; padding: 4px 10px; border-radius: 999px; font-size: 0.76rem; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">🚫 Bonus Limit Reached (${c.used_today}/${c.max_allowed})</span>`;
        } else if (isBlocked) {
            badgeHtml = `<span style="background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; padding: 4px 10px; border-radius: 999px; font-size: 0.76rem; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">⚠️ Limit Reached (3/3)</span>`;
        } else if (c.used_today > 0) {
            badgeHtml = `<span style="background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; padding: 4px 10px; border-radius: 999px; font-size: 0.76rem; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">⚡ Active Today (${c.used_today}/3)</span>`;
        } else {
            badgeHtml = `<span style="background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; padding: 4px 10px; border-radius: 999px; font-size: 0.76rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">🟢 Normal (3 left)</span>`;
        }

        // Remaining pill
        const remainingPill = c.remaining > 0
            ? `<strong style="color: #15803d; font-size: 0.95rem;">${c.remaining} left</strong>`
            : `<strong style="color: #b91c1c; font-size: 0.95rem;">0 left</strong>`;

        const rowBg = isBlocked ? 'background-color: #fffaf0;' : '';

        // Safe JSON for button onclick
        const clientJson = JSON.stringify({
            case_id: c.case_id,
            name: c.name,
            email: c.email,
            case_number: c.case_number,
            used_today: c.used_today,
            bonus_otps: c.bonus_otps,
            max_allowed: c.max_allowed,
            remaining: c.remaining
        }).replace(/"/g, '&quot;');

        html += `
        <tr style="${rowBg}">
            <td>
                <div style="font-weight: 700; color: #0A1628; font-size: 0.95rem;">${escapeHtml(c.name)}</div>
                <div style="font-size: 0.82rem; color: #64748b; margin-top: 2px;">📧 ${escapeHtml(c.email)}</div>
                ${c.phone ? `<div style="font-size: 0.78rem; color: #94a3b8;">📞 ${escapeHtml(c.phone)}</div>` : ''}
            </td>
            <td>
                <div style="font-weight: 600; color: #334155; font-size: 0.88rem;">${escapeHtml(c.case_number)}</div>
                <div style="font-size: 0.78rem; color: #64748b;">${escapeHtml(c.case_type)}</div>
                ${c.court_case_number ? `<div style="font-size: 0.75rem; color: #94a3b8;">🏛️ ${escapeHtml(c.court_case_number)}</div>` : ''}
            </td>
            <td style="text-align: center; color: #64748b; font-weight: 600;">
                3 / day
            </td>
            <td style="text-align: center;">
                <span style="font-weight: 800; font-size: 1.05rem; color: ${c.used_today >= c.max_allowed ? '#dc2626' : (c.used_today > 0 ? '#0284c7' : '#64748b')};">
                    ${c.used_today}
                </span>
                <span style="color: #94a3b8; font-size: 0.8rem;"> / ${c.max_allowed}</span>
            </td>
            <td style="text-align: center;">
                ${hasBonus 
                    ? `<span style="background: #fef3c7; color: #b45309; padding: 2px 8px; border-radius: 6px; font-weight: 800; font-size: 0.88rem; border: 1px solid #fde68a;">+${c.bonus_otps}</span>`
                    : `<span style="color: #94a3b8; font-size: 0.85rem;">0</span>`
                }
            </td>
            <td style="text-align: center;">
                ${remainingPill}
            </td>
            <td>
                <div style="font-size: 0.85rem; color: #334155; font-weight: 600;">${timeFormatted}</div>
                <div style="font-size: 0.74rem; color: #94a3b8;">${c.today_date}</div>
            </td>
            <td>
                ${badgeHtml}
            </td>
            <td style="text-align: center;">
                <button type="button" class="btn" onclick="openSpecialOtpModalFromData(${clientJson})" style="background: #0A1628; color: #D4AF37; border: 1px solid #D4AF37; padding: 6px 14px; border-radius: 8px; font-size: 0.82rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s ease; box-shadow: 0 2px 6px rgba(0,0,0,0.08);">
                    <span>⭐</span> Allow Special Case
                </button>
            </td>
        </tr>`;
    });

    tbody.innerHTML = html;
};

window.filterSpecialOtpClients = function() {
    const query = (document.getElementById('special-otp-search-input')?.value || '').trim().toLowerCase();
    const filterStatus = document.getElementById('special-otp-filter-status')?.value || 'all';

    let filtered = specialOtpClientsCache.filter(c => {
        // Query match
        const matchQuery = !query || 
            (c.name && c.name.toLowerCase().includes(query)) ||
            (c.email && c.email.toLowerCase().includes(query)) ||
            (c.case_number && c.case_number.toLowerCase().includes(query)) ||
            (c.court_case_number && c.court_case_number.toLowerCase().includes(query));

        if (!matchQuery) return false;

        // Status filter
        if (filterStatus === 'all') return true;
        if (filterStatus === 'exhausted') return (c.remaining === 0 && c.used_today >= 3);
        if (filterStatus === 'bonus_active') return (c.bonus_otps > 0);
        if (filterStatus === 'active') return (c.used_today > 0);
        if (filterStatus === 'unused') return (c.used_today === 0);
        return true;
    });

    window.renderSpecialOtpClientsTable(filtered);
};

window.resetSpecialOtpFilters = function() {
    const searchInput = document.getElementById('special-otp-search-input');
    const filterSelect = document.getElementById('special-otp-filter-status');
    if (searchInput) searchInput.value = '';
    if (filterSelect) filterSelect.value = 'all';
    window.renderSpecialOtpClientsTable(specialOtpClientsCache);
};

window.switchSpecialOtpTab = function(tab) {
    const clientsPanel = document.getElementById('special-tab-panel-clients');
    const logsPanel = document.getElementById('special-tab-panel-logs');
    const clientsBtn = document.getElementById('tab-btn-special-clients');
    const logsBtn = document.getElementById('tab-btn-special-logs');

    if (tab === 'clients') {
        if (clientsPanel) clientsPanel.style.display = 'block';
        if (logsPanel) logsPanel.style.display = 'none';
        if (clientsBtn) {
            clientsBtn.className = 'btn';
            clientsBtn.style.background = '#0A1628';
            clientsBtn.style.color = '#D4AF37';
            clientsBtn.style.border = '1px solid #D4AF37';
        }
        if (logsBtn) {
            logsBtn.className = 'btn btn-outline';
            logsBtn.style.background = 'transparent';
            logsBtn.style.color = '#475569';
            logsBtn.style.border = '1px solid #cbd5e1';
        }
    } else {
        if (clientsPanel) clientsPanel.style.display = 'none';
        if (logsPanel) logsPanel.style.display = 'block';
        if (logsBtn) {
            logsBtn.className = 'btn';
            logsBtn.style.background = '#0A1628';
            logsBtn.style.color = '#D4AF37';
            logsBtn.style.border = '1px solid #D4AF37';
        }
        if (clientsBtn) {
            clientsBtn.className = 'btn btn-outline';
            clientsBtn.style.background = 'transparent';
            clientsBtn.style.color = '#475569';
            clientsBtn.style.border = '1px solid #cbd5e1';
        }
        window.loadSpecialOtpLogs();
    }
};

window.loadSpecialOtpLogs = async function() {
    const tbody = document.getElementById('special-otp-logs-tbody');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 2rem; color: #94a3b8;"><div style="font-size: 1.5rem; margin-bottom: 8px;">⏳</div>Loading 48-hour emergency audit logs...</td></tr>`;
    }

    try {
        const res = await fetch('/api/admin/special-otp/logs');
        const data = await res.json();
        if (!res.ok) {
            if (tbody) tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: #ef4444; padding: 2rem;">Error: ${data.error || 'Server error'}</td></tr>`;
            return;
        }

        const logs = data.logs || [];
        if (logs.length === 0) {
            if (tbody) tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 2.5rem; color: #64748b;"><div style="font-size: 1.5rem; margin-bottom: 6px;">📂</div>No emergency OTP grants found within the 48-hour window. Tracking data auto-cleans every 48 hours.</td></tr>`;
            return;
        }

        let html = '';
        logs.forEach(l => {
            html += `
            <tr>
                <td>
                    <div style="font-weight: 600; color: #0A1628; font-size: 0.85rem;">${escapeHtml(l.created_at)}</div>
                </td>
                <td>
                    <div style="font-weight: 700; color: #0A1628; font-size: 0.9rem;">${escapeHtml(l.name)}</div>
                </td>
                <td style="color: #64748b; font-size: 0.85rem;">
                    ${escapeHtml(l.email)}
                </td>
                <td style="color: #475569; font-weight: 600; font-size: 0.85rem;">
                    ${escapeHtml(l.case_number)}
                </td>
                <td style="text-align: center;">
                    <span style="background: #fef3c7; color: #b45309; border: 1px solid #fde68a; padding: 2px 8px; border-radius: 6px; font-weight: 800; font-size: 0.85rem;">+${l.bonus_granted} OTPs</span>
                </td>
                <td style="text-align: center; font-size: 0.85rem; color: #334155;">
                    ${l.used_today} / ${l.total_allowed_today} (${l.remaining_today} left)
                </td>
                <td style="font-size: 0.85rem; color: #334155; max-width: 220px;">
                    ${escapeHtml(l.reason)}
                </td>
                <td style="font-size: 0.82rem; color: #64748b;">
                    🏛️ ${escapeHtml(l.granted_by)}
                </td>
                <td style="text-align: center;">
                    <span style="background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; padding: 3px 8px; border-radius: 999px; font-size: 0.75rem; font-weight: 700;">
                        ⏱️ ${escapeHtml(l.expires_in_label)}
                    </span>
                </td>
            </tr>`;
        });

        if (tbody) tbody.innerHTML = html;
    } catch(err) {
        console.error("Error loading special OTP logs:", err);
        if (tbody) tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: #ef4444; padding: 2rem;">Failed to fetch emergency logs.</td></tr>`;
    }
};

window.openSpecialOtpModalFromData = function(client) {
    currentSpecialOtpClient = client;
    const modal = document.getElementById('modal-special-otp');
    if (!modal) return;

    document.getElementById('special-modal-case-id').value = client.case_id || '';
    document.getElementById('special-modal-client-name').innerText = client.name || 'Client';
    document.getElementById('special-modal-client-email').innerText = client.email || '';
    document.getElementById('special-modal-case-no').innerText = client.case_number || 'N/A';
    
    const quotaSummary = document.getElementById('special-modal-quota-summary');
    if (quotaSummary) {
        const bonusStr = client.bonus_otps > 0 ? ` (Includes ${client.bonus_otps} bonus granted earlier)` : '';
        quotaSummary.innerHTML = `<strong>Today's Status:</strong> ${client.used_today} / ${client.max_allowed} Used · <strong>${client.remaining} attempts remaining</strong>${bonusStr}`;
    }

    // Default to +1 OTP
    const countInput = document.getElementById('special-modal-bonus-count');
    if (countInput) countInput.value = 1;

    // Reset chips
    document.querySelectorAll('#modal-special-otp .btn-otp-chip').forEach(btn => {
        btn.classList.remove('active');
        btn.style.background = 'white';
        btn.style.color = '#334155';
        btn.style.border = '1.5px solid #cbd5e1';
    });
    const chip1 = document.getElementById('chip-bonus-1');
    if (chip1) {
        chip1.classList.add('active');
        chip1.style.background = '#0A1628';
        chip1.style.color = '#D4AF37';
        chip1.style.border = '1.5px solid #D4AF37';
    }

    // Reset reasons
    const reasonPreset = document.getElementById('special-modal-reason-preset');
    const reasonCustom = document.getElementById('special-modal-reason-custom');
    if (reasonPreset) reasonPreset.value = "Urgent High Court / Trial Court Hearing today";
    if (reasonCustom) {
        reasonCustom.value = '';
        reasonCustom.style.display = 'none';
    }

    window.updateBonusLivePreview();
    modal.style.display = 'flex';
};

window.closeSpecialOtpModal = function() {
    const modal = document.getElementById('modal-special-otp');
    if (modal) modal.style.display = 'none';
    currentSpecialOtpClient = null;
};

window.selectBonusOtpPreset = function(count, btnEl) {
    const countInput = document.getElementById('special-modal-bonus-count');
    if (countInput) countInput.value = count;

    document.querySelectorAll('#modal-special-otp .btn-otp-chip').forEach(btn => {
        btn.classList.remove('active');
        btn.style.background = 'white';
        btn.style.color = '#334155';
        btn.style.border = '1.5px solid #cbd5e1';
    });

    if (btnEl) {
        btnEl.classList.add('active');
        btnEl.style.background = '#0A1628';
        btnEl.style.color = '#D4AF37';
        btnEl.style.border = '1.5px solid #D4AF37';
    }

    window.updateBonusLivePreview();
};

window.handleSpecialReasonPresetChange = function(val) {
    const customInput = document.getElementById('special-modal-reason-custom');
    if (!customInput) return;
    if (val === 'custom') {
        customInput.style.display = 'block';
        customInput.focus();
    } else {
        customInput.style.display = 'none';
    }
};

window.updateBonusLivePreview = function() {
    const countInput = document.getElementById('special-modal-bonus-count');
    const previewBox = document.getElementById('special-modal-preview-box');
    if (!countInput || !previewBox || !currentSpecialOtpClient) return;

    let bonusToAdd = parseInt(countInput.value, 10);
    if (isNaN(bonusToAdd) || bonusToAdd < 1) bonusToAdd = 1;

    const currentBonus = currentSpecialOtpClient.bonus_otps || 0;
    const currentUsed = currentSpecialOtpClient.used_today || 0;
    const newTotalBonus = currentBonus + bonusToAdd;
    const newMaxAllowed = 3 + newTotalBonus;
    const newRemaining = Math.max(0, newMaxAllowed - currentUsed);

    previewBox.innerHTML = `<strong>✨ Live Effect for Today:</strong> Client's daily limit will instantly expand to <strong>${newMaxAllowed} logins</strong> (3 standard + ${newTotalBonus} bonus). The client will immediately have <strong>${newRemaining} login attempt(s) remaining</strong> for today.`;
};

window.submitSpecialOtpGrant = async function() {
    const submitBtn = document.getElementById('btn-submit-special-otp');
    const caseId = document.getElementById('special-modal-case-id')?.value;
    const bonusCount = parseInt(document.getElementById('special-modal-bonus-count')?.value, 10);
    
    let reason = document.getElementById('special-modal-reason-preset')?.value || '';
    if (reason === 'custom') {
        reason = (document.getElementById('special-modal-reason-custom')?.value || '').trim();
        if (!reason) {
            showToast('Please specify the emergency reason for granting bonus OTPs.', 'error');
            return;
        }
    }

    if (!caseId) {
        showToast('Client case file missing.', 'error');
        return;
    }
    if (isNaN(bonusCount) || bonusCount < 1 || bonusCount > 50) {
        showToast('Please specify a valid bonus OTP count between 1 and 50.', 'error');
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = 'Granting Emergency Access...';
    }

    try {
        const res = await fetch('/api/admin/special-otp/grant', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                case_id: caseId,
                bonus_count: bonusCount,
                reason: reason
            })
        });
        const data = await res.json();

        if (res.ok) {
            showToast(data.message || 'Special emergency OTP quota granted successfully!', 'success');
            window.closeSpecialOtpModal();
            window.loadSpecialOtpData();
        } else {
            showToast(data.error || 'Failed to grant special OTP.', 'error');
        }
    } catch(err) {
        console.error("Error submitting special OTP grant:", err);
        showToast('Error communicating with server.', 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = '⭐ Submit & Grant Bonus OTPs';
        }
    }
};

// ==========================================
// PUBLIC WEBSITE STATUS & REPAIR CONTROLLER
// ==========================================
window.handlePublicStatusRadioChange = function(status) {
    window.updatePublicStatusUI(status);
};

window.updatePublicStatusUI = function(status) {
    const isLive = (status === 'on' || status === true);
    
    // 1. Settings section badge
    const badge = document.getElementById('public-website-status-badge');
    if (badge) {
        if (isLive) {
            badge.style.background = '#10b981';
            badge.style.boxShadow = '0 2px 8px rgba(16,185,129,0.3)';
            badge.innerText = '🟢 Public Website: LIVE (ON)';
        } else {
            badge.style.background = '#ef4444';
            badge.style.boxShadow = '0 2px 8px rgba(239,68,68,0.4)';
            badge.innerText = '🔴 Public Website: UNDER REPAIR (OFF)';
        }
    }

    // 2. Top Header Status Pill
    const topPill = document.getElementById('top-public-status-pill');
    const topDot = document.getElementById('top-public-status-dot');
    const topLabel = document.getElementById('top-public-status-label');
    if (topPill && topDot && topLabel) {
        if (isLive) {
            topPill.style.background = 'rgba(16, 185, 129, 0.15)';
            topPill.style.borderColor = '#10b981';
            topPill.style.color = '#10b981';
            topDot.innerText = '🟢';
            topLabel.innerText = 'Public Website: LIVE (ON)';
        } else {
            topPill.style.background = 'rgba(239, 68, 68, 0.2)';
            topPill.style.borderColor = '#ef4444';
            topPill.style.color = '#ef4444';
            topDot.innerText = '🔴';
            topLabel.innerText = 'Public Website: UNDER REPAIR (OFF)';
        }
    }

    // 3. Dashboard Warning Banner
    const dashBanner = document.getElementById('dashboard-lockdown-banner');
    if (dashBanner) {
        dashBanner.style.display = isLive ? 'none' : 'flex';
    }

    // 4. Radio Buttons
    const rOn = document.getElementById('public-status-on');
    const rOff = document.getElementById('public-status-off');
    if (rOn && rOff) {
        rOn.checked = isLive;
        rOff.checked = !isLive;
    }

    // 5. Radio button stylized labels
    const labelOn = document.getElementById('label-status-on');
    const labelOff = document.getElementById('label-status-off');
    if (labelOn) {
        if (isLive) {
            labelOn.style.background = 'rgba(16, 185, 129, 0.2)';
            labelOn.style.border = '2px solid #10b981';
            labelOn.style.color = '#ffffff';
        } else {
            labelOn.style.background = 'rgba(255, 255, 255, 0.05)';
            labelOn.style.border = '1.5px solid #64748b';
            labelOn.style.color = '#cbd5e1';
        }
    }

    if (labelOff) {
        if (!isLive) {
            labelOff.style.background = 'rgba(239, 68, 68, 0.2)';
            labelOff.style.border = '2px solid #ef4444';
            labelOff.style.color = '#ffffff';
        } else {
            labelOff.style.background = 'rgba(255, 255, 255, 0.05)';
            labelOff.style.border = '1.5px solid #64748b';
            labelOff.style.color = '#cbd5e1';
        }
    }
};

window.savePublicWebsiteStatus = async function(statusVal) {
    let status = statusVal;
    if (!status) {
        const isOff = document.getElementById('public-status-off')?.checked;
        status = isOff ? 'off' : 'on';
    }
    const enabled = (status === 'on');
    const btn = document.getElementById('btn-save-public-status');
    if (btn) {
        btn.disabled = true;
        btn.innerText = 'Applying State...';
    }

    try {
        const res = await fetch('/api/settings', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-Admin-Request': 'true'
            },
            body: JSON.stringify({
                public_page_status: status,
                public_website_enabled: enabled
            })
        });
        if (res.ok) {
            window.updatePublicStatusUI(status);
            if (enabled) {
                showToast('Public Website is now LIVE (ON)! Visitors can view chamber information.', 'success');
            } else {
                showToast('Website is now UNDER REPAIR (OFF)! Public data is completely hidden, and only Admin Login is operational.', 'warning');
            }
        } else {
            showToast('Failed to update website state.', 'error');
        }
    } catch(err) {
        console.error('Error saving public website status:', err);
        showToast('Network error while updating website status.', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = '💾 Apply Website State';
        }
    }
};

window.togglePublicWebsiteStatusQuick = async function() {
    const isCurrentlyOff = document.getElementById('public-status-off')?.checked || 
                           (document.getElementById('top-public-status-label')?.innerText.includes('UNDER REPAIR'));
    const nextStatus = isCurrentlyOff ? 'on' : 'off';
    const confirmMsg = nextStatus === 'off' 
        ? "Switch Public Website to UNDER REPAIR (OFF)?\n\nAll public pages and APIs will immediately hide chamber data and show the repair notice. Only Admin Login and Dashboard will remain active."
        : "Switch Public Website back to LIVE (ON)?\n\nPublic visitors will immediately be able to view chamber data, advocates, cases, and services.";
        
    if (!confirm(confirmMsg)) return;
    await window.savePublicWebsiteStatus(nextStatus);
};




