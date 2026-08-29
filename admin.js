// admin.js - Admin Dashboard UI interactions

document.addEventListener('DOMContentLoaded', () => {
    const navLinks = document.querySelectorAll('.sidebar ul li a');
    const sections = document.querySelectorAll('.admin-section');
    const headerTitle = document.querySelector('.header h2');
    
    navLinks.forEach(link => {
        if(link.id && link.id !== 'nav-logout') {
            link.addEventListener('click', (e) => {
                if (link.getAttribute('href') === 'index.html') return; // let logout happen natively
                
                e.preventDefault();
                
                // Remove active class from all links
                navLinks.forEach(l => l.classList.remove('active'));
                // Add active to clicked link
                link.classList.add('active');

                // Determine which section to show
                const targetId = link.id.replace('nav-', 'section-');
                
                // Hide all sections
                sections.forEach(sec => sec.classList.remove('active'));
                
                // Show target section
                const targetSection = document.getElementById(targetId);
                if (targetSection) {
                    targetSection.classList.add('active');
                    
                    // Update header title based on the link text
                    if (headerTitle) {
                        headerTitle.innerText = link.innerText;
                    }
                }
            });
        }
    });

    // Load consultations from API
    const consultationsTbody = document.getElementById('consultations-tbody');
    
    window.approveAppointment = async function(id) {
        const dateInput = document.getElementById(`date-${id}`).value;
        const timeInput = document.getElementById(`time-${id}`).value;
        if (!dateInput || !timeInput) {
            alert('Please select both Date and Time before approving.');
            return;
        }

        const btn = document.getElementById(`btn-${id}`);
        btn.innerText = 'Approving...';
        btn.disabled = true;

        try {
            const response = await fetch('/api/appointments/approve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: id, date: dateInput, time: timeInput })
            });
            const data = await response.json();
            if (response.ok) {
                alert('Appointment approved and email sent!');
                loadAppointments();
            } else {
                alert('Error: ' + data.error);
                btn.innerText = 'Approve & Email';
                btn.disabled = false;
            }
        } catch (err) {
            console.error(err);
            alert('Server error.');
            btn.innerText = 'Approve & Email';
            btn.disabled = false;
        }
    };

    async function loadAppointments() {
        if (!consultationsTbody) return;
        try {
            const response = await fetch('/api/appointments');
            const appointments = await response.json();
            
            if (appointments.length > 0) {
                consultationsTbody.innerHTML = '';
                appointments.forEach(c => {
                    const tr = document.createElement('tr');
                    
                    let actionHtml = '';
                    if (c.status === 'Pending') {
                        actionHtml = `
                            <input type="date" id="date-${c._id}" style="font-size: 0.8rem; padding: 0.2rem;">
                            <input type="time" id="time-${c._id}" style="font-size: 0.8rem; padding: 0.2rem;">
                            </td>
                            <td>
                            <button id="btn-${c._id}" class="btn btn-primary" style="padding: 0.3rem 0.8rem; font-size: 0.8rem;" onclick="approveAppointment('${c._id}')">Approve & Email</button>
                        `;
                    } else {
                        actionHtml = `
                            <span style="font-size: 0.85rem; color: #555;">${c.appointment_date} ${c.appointment_time}</span>
                            </td>
                            <td><span class="badge active">Approved</span>
                        `;
                    }

                    tr.innerHTML = `
                        <td>${c.name}</td>
                        <td>${c.email}</td>
                        <td>${c.service}</td>
                        <td><span class="badge ${c.status === 'Pending' ? 'pending' : 'active'}">${c.status}</span></td>
                        <td>${actionHtml}</td>
                    `;
                    consultationsTbody.appendChild(tr);
                });
            } else {
                consultationsTbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #999; padding: 2rem;">No incoming appointments found.</td></tr>';
            }
        } catch (err) {
            console.error(err);
            consultationsTbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #999; padding: 2rem;">Error loading appointments.</td></tr>';
        }
    }
    
    if (consultationsTbody) {
        loadAppointments();
    }

    // Load and Handle Office Info Settings
    const officeInfoForm = document.getElementById('office-info-form');
    if (officeInfoForm) {
        // Prefill form if data exists
        const info = JSON.parse(localStorage.getItem('officeInfo'));
        if (info) {
            document.getElementById('admin-address').value = info.address;
            document.getElementById('admin-phone').value = info.phone;
            document.getElementById('admin-email').value = info.email;
        }

        // Save settings on submit
        officeInfoForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const address = document.getElementById('admin-address').value;
            const phone = document.getElementById('admin-phone').value;
            const email = document.getElementById('admin-email').value;
            
            localStorage.setItem('officeInfo', JSON.stringify({ address, phone, email }));
            alert('Office Information settings saved successfully!');
        });
    }

    // Load and Handle Advocates Management API
    const addAdvocateForm = document.getElementById('add-advocate-form');
    const adminAdvocatesList = document.getElementById('admin-advocates-list');

    async function renderAdminAdvocates() {
        if (!adminAdvocatesList) return;
        try {
            const response = await fetch('/api/advocates');
            const advocates = await response.json();
            
            if (!advocates || advocates.length === 0) {
                adminAdvocatesList.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #999; padding: 2rem;">No advocates found.</td></tr>';
                return;
            }

            adminAdvocatesList.innerHTML = '';
            advocates.forEach(adv => {
                const tr = document.createElement('tr');
                const imgHtml = adv.imageUrl ? `<img src="${adv.imageUrl}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">` : `<div style="width: 40px; height: 40px; border-radius: 50%; background-color: #E0E0E0;"></div>`;
                tr.innerHTML = `
                    <td>${imgHtml}</td>
                    <td>${adv.name}</td>
                    <td>${adv.specialty}</td>
                    <td><button class="btn btn-error" style="padding: 0.3rem 0.8rem; font-size: 0.8rem; background-color: #D32F2F; color: white; border: none; border-radius: 4px; cursor: pointer;" onclick="deleteAdvocate('${adv._id}')">Remove</button></td>
                `;
                adminAdvocatesList.appendChild(tr);
            });
        } catch (err) {
            console.error(err);
        }
    }

    window.deleteAdvocate = async function(id) {
        if(!confirm('Delete this advocate?')) return;
        try {
            await fetch(`/api/advocates/${id}`, { method: 'DELETE' });
            renderAdminAdvocates();
        } catch (err) {
            console.error(err);
        }
    };

    if (addAdvocateForm) {
        renderAdminAdvocates();

        addAdvocateForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('adv-name').value;
            const specialty = document.getElementById('adv-specialty').value;
            const imageFile = document.getElementById('adv-image').files[0];
            
            const saveAdvocate = async (imageUrl) => {
                try {
                    await fetch('/api/advocates', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name, specialty, imageUrl })
                    });
                    addAdvocateForm.reset();
                    renderAdminAdvocates();
                    alert('Advocate added successfully!');
                } catch (err) {
                    console.error(err);
                    alert('Error saving advocate.');
                }
            }

            if (imageFile) {
                const reader = new FileReader();
                reader.onload = function(event) {
                    saveAdvocate(event.target.result);
                };
                reader.readAsDataURL(imageFile);
            } else {
                saveAdvocate('');
            }
        });
    }

    

});
