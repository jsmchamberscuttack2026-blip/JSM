document.addEventListener('DOMContentLoaded', () => {
    // Navigation Logic
    const navLinks = document.querySelectorAll('.sidebar ul li a');
    const sections = document.querySelectorAll('.admin-section');

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
                        <td>${appt.service}</td>
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
                consultationsTbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #999; padding: 2rem;">No pending appointments found.</td></tr>';
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
                            <p style="margin: 0 0 0.5rem 0; font-size: 0.85rem; color: #667085;">💼 ${c.case_type}</p>
                            <p style="margin: 0 0 0.5rem 0; font-size: 0.85rem; color: #667085;">📅 ${c.next_hearing}</p>
                            <p style="margin: 0 0 1rem 0; font-size: 0.85rem; color: #667085;">💰 ₹${c.fee_paid} / ₹${c.total_fee}</p>
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
                            <td>#${cases.length - index}</td>
                            <td>${c.client_name}</td>
                            <td>${c.case_type}</td>
                            <td>Admin</td>
                            <td><span class="badge ${statusClass}">${c.status}</span></td>
                            <td><button class="btn btn-outline" style="padding: 0.2rem 0.5rem; font-size: 0.8rem;" onclick="document.getElementById('nav-cases').click()">View</button></td>
                        `;
                        recentCasesTbody.appendChild(tr);
                    });
                }
            } else {
                casesGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: #999; padding: 2rem; background: #f8fafc; border-radius: 12px;">No active case files found.</div>';
                if (recentCasesTbody) {
                    recentCasesTbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #999; padding: 2rem;">No recent case updates found.</td></tr>';
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
                const response = await fetch('/api/cases', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ client_name, email, case_type })
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
        document.getElementById('modal-total').value = c.total_fee;
        document.getElementById('modal-paid').value = c.fee_paid;
        document.getElementById('modal-notes').value = c.notes || "";
        
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
        const total_fee = document.getElementById('modal-total').value;
        const fee_paid = document.getElementById('modal-paid').value;
        const notes = document.getElementById('modal-notes').value;
        try {
            await fetch(`/api/cases/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status, next_hearing, total_fee, fee_paid, notes })
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
                        <td>${c.client_name}</td>
                        <td>${c.email}</td>
                        <td>${c.case_type}</td>
                        <td><span class="badge" style="background: #e0e0e0; color: #555;">${c.status}</span></td>
                    `;
                    archivedCasesTbody.appendChild(tr);
                });
            } else {
                archivedCasesTbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #999; padding: 2rem;">No finished cases found.</td></tr>';
            }
        } catch (err) {
            console.error(err);
        }
    };

    if (archivedCasesTbody) {
        loadArchivedCases();
        setInterval(loadArchivedCases, 1000);
    }
});
