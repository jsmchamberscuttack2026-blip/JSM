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
                            <p style="margin: 0 0 0.5rem 0; font-size: 0.85rem; color: #667085;">👤 ${c.assigned_staff_email || 'Unassigned Staff'}</p>
                            <p style="margin: 0 0 1rem 0; font-size: 0.85rem; color: #667085;">📅 ${c.next_hearing}</p>
                        </div>
                        <button class="btn btn-outline" style="width: 100%; border-color: #0b1f33; color: #0b1f33;" onclick="openCaseModal('${c._id}')">Open File</button>
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
                            <td><a href="#" onclick="printCaseDetails('${c._id}'); return false;" style="color: #0A192F; font-weight: bold; text-decoration: underline;">${c.client_name} 📄</a></td>
                            <td>${c.case_type}</td>
                            <td>${c.assigned_staff_email || 'Unassigned'}</td>
                            <td>${c.next_hearing || 'To Be Decided'}</td>
                            <td><span class="badge ${statusClass}">${c.status}</span></td>
                            <td><button class="btn btn-outline" style="padding: 0.2rem 0.5rem; font-size: 0.8rem;" onclick="document.getElementById('nav-cases').click()">View</button></td>
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
        document.getElementById('modal-password').innerText = c.password || "N/A (Archived)";
        document.getElementById('modal-status').value = c.status;
        document.getElementById('modal-hearing').value = c.next_hearing;
        document.getElementById('modal-notes').value = c.notes || "";
        document.getElementById('modal-chamber-case-number').value = c.chamber_case_number || "";
        document.getElementById('modal-court-case-number').value = c.court_case_number || "";
        populateStaffDropdown(c.assigned_staff_email || "");
        
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
                        <td><a href="#" onclick="printCaseDetails('${c._id}'); return false;" style="color: #0A192F; font-weight: bold; text-decoration: underline;">${c.client_name} 📄</a></td>
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
    if (document.getElementById('nav-emails')) {
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
        advocates.forEach(adv => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${adv.imageUrl ? '<img src="'+adv.imageUrl+'" width="50" style="border-radius:4px">' : 'No Image'}</td>
                <td>${adv.name}</td>
                <td>${adv.email || 'N/A'}</td>
                <td>${adv.specialty}</td>
                <td>
                    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                        <label style="font-size: 0.8rem; display: flex; align-items: center; gap: 5px;">
                            <input type="checkbox" ${adv.access_appointments ? 'checked' : ''} onchange="updateAccess('${adv._id}', this.checked, ${adv.access_clients ? 'true' : 'false'}, ${adv.access_add_case ? 'true' : 'false'})">
                            Appointments Access
                        </label>
                        <label style="font-size: 0.8rem; display: flex; align-items: center; gap: 5px;">
                            <input type="checkbox" ${adv.access_clients ? 'checked' : ''} onchange="updateAccess('${adv._id}', ${adv.access_appointments ? 'true' : 'false'}, this.checked, ${adv.access_add_case ? 'true' : 'false'})">
                            Clients Directory Access
                        </label>
                        <label style="font-size: 0.8rem; display: flex; align-items: center; gap: 5px;">
                            <input type="checkbox" ${adv.access_add_case ? 'checked' : ''} onchange="updateAccess('${adv._id}', ${adv.access_appointments ? 'true' : 'false'}, ${adv.access_clients ? 'true' : 'false'}, this.checked)">
                            Add New Case Access
                        </label>
                    </div>
                </td>
                <td>
                    <button class="btn" style="background:var(--color-secondary); color:white; padding: 4px 8px; margin-right: 5px;" onclick="openEditAdvocateModal('${adv._id}')">Edit</button>
                    <button class="btn" style="background:#9b59b6; color:white; padding: 4px 8px; margin-right: 5px;" onclick="showIdCard('${adv._id}')">ID Card</button>
                    <button class="btn" style="background:#e74c3c; color:white; padding: 4px 8px;" onclick="deleteAdvocate('${adv._id}')">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
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
        const fileInput = document.getElementById('adv-image');
        
        const submitBtn = addAdvocateForm.querySelector('button');
        submitBtn.textContent = 'Adding...';
        
        let imageUrl = '';
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const reader = new FileReader();
            reader.readAsDataURL(file);
            await new Promise(resolve => reader.onload = resolve);
            imageUrl = reader.result;
        }
        
        try {
            const response = await fetch('/api/advocates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, specialty, role: 'Legal Professional', imageUrl })
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
            if (data.address) document.getElementById('admin-address').value = data.address;
            if (data.phone) document.getElementById('admin-phone').value = data.phone;
            if (data.email) document.getElementById('admin-email').value = data.email;
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
        const address = document.getElementById('admin-address').value;
        const phone = document.getElementById('admin-phone').value;
        const email = document.getElementById('admin-email').value;
        const btn = officeInfoForm.querySelector('button');
        btn.innerText = 'Saving...';
        
        try {
            await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address, phone, email, logoUrl: globalLogoUrl })
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

    // Add logic to populate the staff dropdown
    async function populateStaffDropdown(selectedEmail) {
        const select = document.getElementById('modal-assigned-staff');
        select.innerHTML = '<option value="">Unassigned</option>';
        try {
            const res = await fetch('/api/advocates');
            const data = await res.json();
            data.forEach(adv => {
                const opt = document.createElement('option');
                opt.value = adv.email;
                opt.innerText = `${adv.name} (${adv.specialty})`;
                if (adv.email === selectedEmail) opt.selected = true;
                select.appendChild(opt);
            });
        } catch(e) {
            console.error(e);
        }
    }

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

    window.updateAccess = async function(id, access_appointments, access_clients, access_add_case) {
        try {
            await fetch(`/api/advocates/${id}/access`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({access_appointments, access_clients, access_add_case})
            });
            advocatesCache = "";
            loadAdvocates();
        } catch (e) {
            console.error(e);
        }
    }

    window.printCaseDetails = async function(id) {
        // Open window synchronously to avoid popup blockers on mobile
        const printWindow = window.open('', '', 'width=800,height=900');
        if (!printWindow) {
            alert("Popup blocked! Please allow popups for this site.");
            return;
        }
        printWindow.document.write('<html><head><title>Loading...</title></head><body style="font-family:sans-serif; padding:40px;"><h2>Generating Report...</h2></body></html>');
        
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
                        body { 
                            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                            padding: 40px; 
                            line-height: 1.6; 
                            background-color: #f0f4f8; 
                            color: #2c3e50; 
                            -webkit-print-color-adjust: exact; 
                            print-color-adjust: exact; 
                        }
                        .report-container { 
                            background: #ffffff; 
                            padding: 40px; 
                            border-radius: 12px; 
                            box-shadow: 0 10px 30px rgba(0,0,0,0.1); 
                            border-top: 10px solid #2980b9; 
                        }
                        .header { 
                            text-align: center; 
                            margin-bottom: 30px; 
                            padding-bottom: 20px; 
                            border-bottom: 2px dashed #3498db; 
                        }
                        .header h1 { margin: 0; color: #2c3e50; font-family: 'Playfair Display', serif; font-size: 2.8rem; letter-spacing: 1px; }
                        .header p { margin: 5px 0 0; color: #7f8c8d; font-size: 1.1rem; }
                        .details { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
                        .details div { 
                            padding: 20px; 
                            background: #e8f4f8; 
                            border-left: 6px solid #3498db; 
                            border-radius: 0 8px 8px 0; 
                            box-shadow: 0 2px 5px rgba(0,0,0,0.05);
                        }
                        .details div:nth-child(2) { background: #fdf5e6; border-left-color: #f39c12; }
                        .details div:nth-child(3) { background: #eafaf1; border-left-color: #2ecc71; }
                        .details div:nth-child(4) { background: #f9ebea; border-left-color: #e74c3c; }
                        .section { 
                            margin-bottom: 30px; 
                            padding: 25px; 
                            background: #ffffff; 
                            border: 1px solid #e1e8ed; 
                            border-radius: 8px; 
                            box-shadow: 0 2px 10px rgba(0,0,0,0.02);
                        }
                        .section h3 { 
                            border-bottom: 3px solid #9b59b6; 
                            padding-bottom: 10px; 
                            color: #8e44ad; 
                            margin-top: 0; 
                            font-size: 1.4rem; 
                            text-transform: uppercase;
                            letter-spacing: 1px;
                        }
                        .section:nth-of-type(2) h3 { border-bottom-color: #e67e22; color: #d35400; }
                        .section:nth-of-type(3) h3 { border-bottom-color: #16a085; color: #117a65; }
                        @media print {
                            body { padding: 0; background: white; }
                            .report-container { box-shadow: none; padding: 0; border: none; }
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
                            <strong>Chamber Case Number:</strong><br> ${c.chamber_case_number || 'Not Assigned'}<br><strong>Court Case Number:</strong><br> ${c.court_case_number || 'Not Assigned'}
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

    window.loadEmailLogs = async function() {
        const clientTbody = document.getElementById('client-email-logs-tbody');
        const staffTbody = document.getElementById('staff-email-logs-tbody');
        if(!clientTbody || !staffTbody) return;
        
        try {
            const res = await fetch('/api/email-logs');
            const data = await res.json();
            
            clientTbody.innerHTML = '';
            if(data.client_logs.length === 0) {
                clientTbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #999; padding: 2rem;">No client emails sent yet.</td></tr>';
            } else {
                data.client_logs.forEach(log => {
                    clientTbody.innerHTML += `<tr>
                        <td>${log.timestamp || ''}</td>
                        <td>${log.recipient || ''}</td>
                        <td>${log.subject || ''}</td>
                        <td>${log.status || ''}</td>
                        <td>
                            <button class="btn btn-secondary" onclick="deleteEmailLog('${log._id}')" style="background: var(--color-error); color: white; padding: 0.3rem 0.6rem; font-size: 0.8rem;">Delete</button>
                        </td>
                    </tr>`;
                });
            }
            
            staffTbody.innerHTML = '';
            if(data.staff_logs.length === 0) {
                staffTbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #999; padding: 2rem;">No staff emails sent yet.</td></tr>';
            } else {
                data.staff_logs.forEach(log => {
                    staffTbody.innerHTML += `<tr>
                        <td>${log.timestamp || ''}</td>
                        <td>${log.recipient || ''}</td>
                        <td>${log.subject || ''}</td>
                        <td>${log.status || ''}</td>
                        <td>
                            <button class="btn btn-secondary" onclick="deleteEmailLog('${log._id}')" style="background: var(--color-error); color: white; padding: 0.3rem 0.6rem; font-size: 0.8rem;">Delete</button>
                        </td>
                    </tr>`;
                });
            }
        } catch(e) {
            console.error(e);
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
        document.getElementById('edit-adv-image').value = '';
        editAdvocateImageUrl = ""; // reset
        
        document.getElementById('edit-advocate-modal').style.display = 'flex';
    };

    window.closeEditAdvocateModal = function() {
        document.getElementById('edit-advocate-modal').style.display = 'none';
    };

    const editAdvImageInput = document.getElementById('edit-adv-image');
    if(editAdvImageInput) {
        editAdvImageInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(event) {
                    editAdvocateImageUrl = event.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    window.saveEditAdvocateModal = async function() {
        const id = document.getElementById('edit-adv-id').value;
        const name = document.getElementById('edit-adv-name').value;
        const email = document.getElementById('edit-adv-email').value;
        const specialty = document.getElementById('edit-adv-specialty').value;
        
        if(!name || !email || !specialty) {
            alert('Please fill out all required fields.');
            return;
        }

        try {
            const response = await fetch(`/api/advocates/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, specialty, imageUrl: editAdvocateImageUrl })
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

function showIdCard(id) {
    const adv = window.globalAdvocatesData.find(a => a._id === id);
    if (!adv) return;
    
    currentIdCardAdvocate = adv;
    
    document.getElementById('id-card-name').innerText = adv.name || 'N/A';
    document.getElementById('id-card-role').innerText = adv.specialty || 'Staff Member';
    
    // Generate a pseudo ID number using their Mongo ID or email
    const idPrefix = (adv.specialty && adv.specialty.toLowerCase().includes('advocate')) ? 'ADV' : 'STF';
    const idSuffix = adv._id.substring(adv._id.length - 4).toUpperCase();
    document.getElementById('id-card-id').innerText = `${idPrefix}-${idSuffix}`;
    
    const photo = document.getElementById('id-card-photo');
    const placeholder = document.getElementById('id-card-photo-placeholder');
    if (adv.image) {
        photo.src = adv.image;
        photo.style.display = 'block';
        placeholder.style.display = 'none';
    } else {
        photo.style.display = 'none';
        placeholder.style.display = 'block';
    }
    
    // Attempt to get office info from settings cache if available
    try {
        fetch('/api/settings').then(r => r.json()).then(data => {
            if (data.chamber_name) document.getElementById('id-card-office-name').innerText = data.chamber_name;
            if (data.chamber_address) document.getElementById('id-card-address').innerText = data.chamber_address;
        });
    } catch(e) {}
    
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
