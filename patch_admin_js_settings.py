import re

with open('js/admin.js', 'r') as f:
    content = f.read()

# Add the load/save functions for appointment settings
new_js = """
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
            document.getElementById('appt-max-day').value = s.max_per_day || 5;
            
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
    const max_per_day = parseInt(document.getElementById('appt-max-day').value);
    
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
            body: JSON.stringify({ start_time, end_time, max_per_day, available_days })
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
"""

content = content + "\n\n" + new_js

with open('js/admin.js', 'w') as f:
    f.write(content)
