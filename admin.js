// Helper: compress an image File to a small base64 JPEG
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
    const navLinks = document.querySelectorAll('.sidebar ul li a');
    const sections = document.querySelectorAll('.admin-section');

    checkEmailPasswordButtons();
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            if (link.getAttribute('href') === 'index.html') return;
            
            e.preventDefault();
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            const targetId = link.id.replace('nav-', 'section-');
            sections.forEach(sec => sec.classList.remove('active'));
            
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.classList.add('active');
            }
        });
    });

    // ==========================================
    // Appointments Management
    // ==========================================
    const consultationsTbody = document.getElementById('consultations-tbody');
    let apptCache = "";

    async function loadAppointments() {
        if (!consultationsTbody) return;
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
                consultationsTbody.innerHTML = '';
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
                        : `<button class="btn btn-primary" style="margin-right: 5px; padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="approveAppt('${appt._id}')">Approve</button>`;

                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${appt.name}</td>
                        <td>${appt.email}</td>
                        <td>${statusBadge}</td>
                        <td>
                            ${dateInput}
                            <br>
                            ${timeInput}
                        </td>
                        <td>
                            ${approveBtn}
                            <button class="btn btn-error" style="background-color: #D32F2F; color: white; border: none; padding: 0.3rem 0.6rem; border-radius: 4px; cursor: pointer; font-size: 0.8rem;" onclick="deleteAppointment('${appt._id}')">Delete</button>
                        </td>
                    `;
                    consultationsTbody.appendChild(tr);
                });
            } else {
                consultationsTbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #999; padding: 2rem;">No pending appointments found.</td></tr>';
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
            alert('Please select both Date and Time before approving.');
            return;
        }

        try {
            const response = await fetch('/api/appointments/approve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, date, time })
            });

            if (response.ok) {
                alert('Appointment approved! Confirmation email sent.');
                apptCache = ''; // force reload
                loadAppointments();
            } else {
                alert('Failed to approve appointment.');
            }
        } catch (err) {
            console.error(err);
            alert('Server error.');
        }
    };

    if (consultationsTbody) {
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
                alert('Failed to delete appointment');
            }
        } catch (err) {
            console.error(err);
            alert('Error connecting to server');
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
                alert('Failed to delete all appointments');
            }
        } catch (err) {
            console.error(err);
            alert('Error connecting to server');
        }
    };

    // ==========================================
    // Cases Management
    // ==========================================
    const addCaseForm = document.getElementById('add-case-form');
    const casesGrid = document.getElementById('cases-grid');
    const recentCasesTbody = document.getElementById('recent-cases-tbody');
    let casesCache = "";
    let globalCasesData = [];

    async function loadCases() {
        if (!casesGrid) return;
        try {
            const response = await fetch('/api/cases', { cache: 'no-store' });
            const cases = await response.json();
            const newDataString = JSON.stringify(cases);
            if (newDataString === casesCache) return;
            casesCache = newDataString;
            globalCasesData = cases;

            
            // Update Stats
            const statActive = document.getElementById('stat-active-cases');
            const statClients = document.getElementById('stat-clients');
            if (statActive) statActive.innerText = cases.length;
            if (statClients) {
                const uniqueEmails = new Set(cases.map(c => c.email));
                statClients.innerText = uniqueEmails.size;
            }
            
            if (cases.length > 0) {
                casesGrid.innerHTML = '';
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
                            <button class="btn btn-outline" style="flex: 1; border-color: #0b1f33; color: #0b1f33; padding: 0.5rem;" onclick="openCaseModal('${c._id}')">Open File</button>
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
                                <button class="btn btn-outline" style="padding: 0.2rem 0.5rem; font-size: 0.8rem;" onclick="showSection('cases-manage')">View</button>
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
                    alert(`Case Created!\\n\\nAuto-Generated Password: ${data.password}\\nEmail Sent: ${data.email_sent ? 'Yes' : 'No (Give them the password manually)'}`);
                    addCaseForm.reset();
                    casesCache = "";
                    loadCases();
                } else {
                    alert('Error creating case.');
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
            alert('Case details saved successfully!');
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
            const response = await fetch(`/api/cases/${id}/finish`, { method: 'POST' });
            const data = await response.json();
            if (data.unpaid) {
                const warning = document.getElementById('modal-unpaid-warning');
                document.getElementById('unpaid-amt').innerText = data.unpaid;
                warning.style.display = 'block';
                casesCache = "";
                loadCases();
            } else {
                alert(data.message);
                closeCaseModal();
                casesCache = "";
                loadCases();
                if (window.loadArchivedCases) loadArchivedCases();
            }
        } catch (err) {
            console.error(err);
            alert("Error finalizing case.");
        }
    };

    window.sendCaseEmail = async function() {
        const id = document.getElementById('modal-case-id').value;
        const subject = document.getElementById('modal-email-subject').value;
        const message = document.getElementById('modal-email-msg').value;
        if (!subject || !message) {
            alert('Please enter a subject and message.');
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
                alert('Email sent successfully!');
                document.getElementById('modal-email-subject').value = '';
                document.getElementById('modal-email-msg').value = '';
            } else {
                alert(data.error || 'Failed to send email.');
            }
        } catch (err) {
            console.error(err);
            alert("Error sending email.");
        }
        btn.innerText = 'Send Email';
        btn.disabled = false;
    };

    // ==========================================
    // Clients Directory / History
    // ==========================================
    const archivedCasesTbody = document.getElementById('archived-cases-tbody');
    let archivedCasesCache = "";

    window.loadArchivedCases = async function() {
        if (!archivedCasesTbody) return;
        try {
            const response = await fetch('/api/archived-cases', { cache: 'no-store' });
            const cases = await response.json();
            const newDataString = JSON.stringify(cases);
            if (newDataString === archivedCasesCache) return;
            archivedCasesCache = newDataString;

            if (cases.length > 0) {
                archivedCasesTbody.innerHTML = '';
                cases.forEach(c => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><a href="#" onclick="printCaseDetails('${c._id}'); return false;" style="color: #0A192F; font-weight: bold; text-decoration: underline; cursor: pointer;">${c.client_name}</a></td>
                        <td>${c.email}</td>
                        <td>${c.case_type}</td>
                        <td><span class="badge" style="background: #e0e0e0; color: #555;">${c.status}</span></td>
                        <td><button class="btn" style="background:#e74c3c; color:white; padding: 4px 8px;" onclick="deleteArchivedCase('${c._id}')">Delete</button></td>
                    `;
                    archivedCasesTbody.appendChild(tr);
                });
            } else {
                archivedCasesTbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #999; padding: 2rem;">No finished cases found.</td></tr>';
            }
        } catch (err) {
            console.error(err);
        }
    };

    if (archivedCasesTbody) {
        loadArchivedCases();
        setInterval(loadArchivedCases, 1000);
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
        
        const gradients = ['color-gradient-1', 'color-gradient-2', 'color-gradient-3', 'color-gradient-4'];
        
        advocates.forEach((adv, index) => {
            const card = document.createElement('div');
            const colorClass = gradients[index % gradients.length];
            card.className = `advocate-card ${colorClass}`;
            
            card.innerHTML = `
                <div style="display: flex; align-items: center; gap: 1rem; border-bottom: 1px solid rgba(0,0,0,0.05); padding-bottom: 1rem;">
                    ${adv.imageUrl ? '<img src="'+adv.imageUrl+'" style="width: 70px; height: 70px; object-fit: cover; border-radius: 50%; box-shadow: 0 4px 8px rgba(0,0,0,0.1); border: 2px solid white;">' : '<div style="width: 70px; height: 70px; border-radius: 50%; background: white; display: flex; align-items: center; justify-content: center; font-size: 2rem; box-shadow: 0 4px 8px rgba(0,0,0,0.1); font-weight: bold; color: var(--primary);">' + adv.name.charAt(0) + '</div>'}
                    <div>
                        <h4 style="margin: 0; font-size: 1.2rem; color: #1e293b;">${adv.name}</h4>
                        <p style="margin: 0; font-size: 0.9rem; color: #475569; font-weight: 500;">${adv.specialty}</p>
                        <p style="margin: 0; font-size: 0.8rem; color: #64748b;">📧 ${adv.email || 'N/A'}</p>
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
                    <button class="btn" style="width: 100%; background: #D4AF37; color: #0A1628; font-weight: bold; border: none; padding: 0.5rem;" onclick="showIdCard('${adv._id}')">🪪 Show & Email ID Card</button>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn" style="flex: 1; background: var(--primary); color: white; border: none;" onclick="openEditAdvocateModal('${adv._id}')">✏️ Edit</button>
                        <button class="btn btn-error" style="flex: 1; border: none;" onclick="deleteAdvocate('${adv._id}')">🗑️ Delete</button>
                    </div>
                </div>
            `;
            tbody.appendChild(card);
        });
    } catch(err) {
        console.error(err);
    }
}

async function deleteAdvocate(id) {
    if(!confirm("Are you sure you want to delete this advocate?")) return;
    try {
        await fetch(`/api/advocates/${id}`, { method: 'DELETE' });
        loadAdvocates();
    } catch(err) {
        alert("Error deleting advocate");
    }
}

const addAdvocateForm = document.getElementById('add-advocate-form');
if (addAdvocateForm) {
    addAdvocateForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('adv-name').value;
        const email = document.getElementById('adv-email').value;
        const specialty = document.getElementById('adv-specialty').value;
        const phone = document.getElementById('adv-phone').value;
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
                body: JSON.stringify({ name, email, specialty, phone, role: 'Legal Professional', imageUrl })
            });
            const data = await response.json();
            
            if (response.ok) {
                alert(`Advocate Added!\n\nEmail (Login ID): ${email}\nPassword: ${data.password}\n\nAn email has been sent to them with these credentials.`);
                addAdvocateForm.reset();
                loadAdvocates();
            } else {
                alert(data.error || 'Failed to add advocate');
            }
        } catch(err) {
            alert('Failed to add advocate');
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
            if (data.chamber_name) document.getElementById('admin-chamber-name').value = data.chamber_name;
            if (data.address) document.getElementById('admin-address').value = data.address;
            if (data.phone) document.getElementById('admin-phone').value = data.phone;
            if (data.email) document.getElementById('admin-email').value = data.email;
            if (data.footer_alert) document.getElementById('admin-footer-alert').value = data.footer_alert;
            if (data.logoUrl) {
                globalLogoUrl = data.logoUrl;
                logoPreview.src = globalLogoUrl;
                logoPreview.style.display = 'block';
            }
        } catch(err) {
            console.error(err);
        }
    }
    
    officeInfoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const allow_common_password = document.getElementById('admin-allow-common-pwd').checked;
        const chamber_name = document.getElementById('admin-chamber-name').value;
        const address = document.getElementById('admin-address').value;
        const phone = document.getElementById('admin-phone').value;
        const email = document.getElementById('admin-email').value;
        const footer_alert = document.getElementById('admin-footer-alert').value;
        const btn = officeInfoForm.querySelector('button');
        btn.innerText = 'Saving...';
        
        try {
            await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ allow_common_password, chamber_name, address, phone, email, footer_alert, logoUrl: globalLogoUrl })
            });
            alert('Settings Saved Successfully');
        } catch(err) {
            alert('Error saving settings');
        } finally {
            btn.innerText = 'Save Settings';
        }
    });
    
    setTimeout(loadSettings, 500);
}

    // ==========================================
    // Gallery Management
    // ==========================================
    const addGalleryForm = document.getElementById('add-gallery-form');
    const galleryList = document.getElementById('gallery-list');
    
    window.loadGallery = async function() {
        if (!galleryList) return;
        try {
            const res = await fetch('/api/gallery', { cache: 'no-store' });
            const items = await res.json();
            
            galleryList.innerHTML = '';
            if (items.length === 0) {
                galleryList.innerHTML = '<p style="color: #666; font-style: italic;">No images in gallery.</p>';
                return;
            }
            
            items.forEach(item => {
                const div = document.createElement('div');
                div.style.border = '1px solid #ddd';
                div.style.borderRadius = '8px';
                div.style.overflow = 'hidden';
                div.style.background = '#fff';
                div.style.position = 'relative';
                
                div.innerHTML = `
                    <img src="${item.imageUrl}" style="width: 100%; height: 140px; object-fit: cover;">
                    <div style="padding: 10px;">
                        <p style="margin: 0; font-size: 0.9rem; color: #333; min-height: 20px;">${item.description || '<i>No description</i>'}</p>
                        <button onclick="window.deleteGalleryItem('${item._id}')" class="btn" style="margin-top: 10px; width: 100%; padding: 5px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">Delete</button>
                    </div>
                `;
                galleryList.appendChild(div);
            });
        } catch (err) {
            console.error(err);
        }
    };
    
    if (addGalleryForm) {
        addGalleryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fileInput = document.getElementById('gallery-image');
            const descInput = document.getElementById('gallery-desc');
            const btn = addGalleryForm.querySelector('button');
            
            if (fileInput.files.length === 0) return;
            
            btn.innerText = 'Uploading...';
            btn.disabled = true;
            
            try {
                const imageUrl = await window.compressImage(fileInput.files[0]);
                const description = descInput.value;
                
                await fetch('/api/gallery', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ imageUrl, description })
                });
                
                fileInput.value = '';
                descInput.value = '';
                await window.loadGallery();
            } catch (err) {
                console.error(err);
                alert("Error uploading image");
            }
            
            btn.innerText = 'Upload Image';
            btn.disabled = false;
        });
    }
    
    window.deleteGalleryItem = async function(id) {
        if (!confirm("Are you sure you want to delete this gallery image?")) return;
        try {
            await fetch('/api/gallery/' + id, { method: 'DELETE' });
            await window.loadGallery();
        } catch (err) {
            console.error(err);
            alert("Error deleting image");
        }
    };
    
    setTimeout(() => {
        if (typeof window.loadGallery === 'function') window.loadGallery();
    }, 600);



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
                alert('Case deleted successfully.');
                loadArchivedCases();
            } else {
                alert('Failed to delete case.');
            }
        } catch(e) {
            console.error(e);
            alert('Error deleting case.');
        }
    }

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
                alert('All logs for this staff member have been deleted.');
                loadEmailLogs(); // reload UI
            } else {
                alert('Failed to delete logs.');
            }
        } catch (e) {
            console.error(e);
            alert('Error deleting logs.');
        }
    };

    window.deleteEmailLog = async function(id) {
        if (!confirm('Are you sure you want to delete this email log?')) return;
        try {
            const response = await fetch(`/api/email-logs/${id}`, { method: 'DELETE' });
            if (response.ok) {
                window.loadEmailLogs();
            } else {
                alert('Failed to delete email log.');
            }
        } catch (error) {
            console.error(error);
            alert('Error deleting email log.');
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
                alert('Failed to send email.');
                btn.innerText = 'Email Password';
                btn.disabled = false;
            }
        } catch (error) {
            console.error(error);
            alert('Error sending email.');
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
        document.getElementById('edit-adv-specialty').value = adv.specialty || '';
        document.getElementById('edit-adv-phone').value = adv.phone || '';
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
        const specialty = document.getElementById('edit-adv-specialty').value;
        const phone = document.getElementById('edit-adv-phone').value;
        const fileInput = document.getElementById('edit-adv-image');
        
        if(!name || !email || !specialty) {
            alert('Please fill out all required fields.');
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
                body: JSON.stringify({ name, email, specialty, phone, imageUrl: finalImageUrl })
            });


            if (response.ok) {
                closeEditAdvocateModal();
                loadAdvocates();
                alert('Advocate details updated successfully.');
            } else {
                const data = await response.json();
                alert(data.error || 'Failed to update advocate.');
            }
        } catch(error) {
            console.error(error);
            alert('Error updating advocate.');
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
        alert("This staff member does not have a registered email address.");
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
            alert("ID Card emailed successfully!");
            document.getElementById('id-card-modal').style.display = 'none';
        } else {
            alert(result.error || "Failed to send email");
        }
    } catch (e) {
        console.error(e);
        alert("An error occurred while generating or sending the ID card: " + e.message);
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
        alert("Your browser does not support Speech Recognition. Please use Google Chrome or Microsoft Edge.");
        return null;
    }
    const recognition = new window.SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    return recognition;
}

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
            alert("Microphone error: " + event.error);
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
        
        document.getElementById('ai-listening-overlay').style.display = 'none';
        
        if (data.status === 'confirm') {
            showAiConfirmModal(data.case, data.proposed_changes, transcript, data.email_draft);
        } else if (data.status === 'multiple_matches') {
            // Future enhancement: show disambiguation UI
            alert("Found multiple cases matching your voice request. Please be more specific with the Case Number.");
        } else {
            alert(data.message || "Could not process your request.");
        }
        
    } catch (err) {
        console.error(err);
        document.getElementById('ai-listening-overlay').style.display = 'none';
        alert("Server error processing voice command.");
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
            alert("Case updated successfully via AI!");
            document.getElementById('ai-confirm-modal').style.display = 'none';
            // Reload cases UI
            if (typeof loadAllCases === 'function') loadAllCases();
            if (typeof loadRecentCases === 'function') loadRecentCases();
        } else {
            const data = await res.json();
            alert("Failed to update: " + data.error);
        }
    } catch(err) {
        console.error(err);
        alert("Server error applying changes.");
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
            alert('Availability Settings Saved!');
        } else {
            alert('Failed to save settings.');
        }
    } catch(e) {
        alert('Error saving settings.');
    }
    btn.innerText = 'Save Settings';
};

// Call loadAppointmentSettings on initial load
document.addEventListener('DOMContentLoaded', () => {
    loadAppointmentSettings();
});

// Added for grid menu navigation
window.showSection = function(sectionId) {
    // Hide all sections
    document.querySelectorAll('.admin-section').forEach(sec => sec.classList.remove('active'));
    
    // Show target section
    const targetSection = document.getElementById('section-' + sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    // Toggle back button visibility
    const backBtn = document.getElementById('back-home-btn');
    if (backBtn) {
        if (sectionId === 'dashboard') {
            backBtn.style.display = 'none';
        } else {
            backBtn.style.display = 'flex';
        }
    }
};

window.executeEmergencyShift = async function() {
    const old_date = document.getElementById('shift-old-date').value;
    const new_date = document.getElementById('shift-new-date').value;
    const start_time = document.getElementById('shift-start-time').value;
    const end_time = document.getElementById('shift-end-time').value;
    const password = document.getElementById('shift-admin-pwd').value;
    
    if (!old_date || !new_date || !start_time || !end_time || !password) {
        alert("Please fill in all fields.");
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
            alert(data.message);
            document.getElementById('emergency-shift-modal').style.display = 'none';
            document.getElementById('shift-admin-pwd').value = '';
            if (window.loadAdminConsultations) loadAdminConsultations();
        } else {
            alert(data.error || 'Failed to shift appointments.');
        }
        
        btn.innerText = origText;
        btn.disabled = false;
    } catch(err) {
        console.error(err);
        alert('Server error while shifting appointments.');
    }
};

window.printCaseDetails = async function(id) {
    const printWindow = window.open('', '', 'width=800,height=900');
    if (!printWindow) {
        alert("Popup blocked! Please allow popups for this site.");
        return;
    }
    printWindow.document.write(`<html><head><title>Loading...</title></head><body style="font-family:sans-serif; padding:40px;"><h2>Generating Report...</h2></body></html>`);
    
    try {
        const res = await fetch(`/api/cases/${id}`);
        const c = await res.json();
        
        let chamberAddress = 'Cuttack, Odisha';
        try {
            const setRes = await fetch('/api/settings');
            const settings = await setRes.json();
            if (settings.address) chamberAddress = settings.address;
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
