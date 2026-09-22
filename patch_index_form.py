import re

with open('index.html', 'r') as f:
    content = f.read()

# 1. Insert the date input after the subject input
old_subject = """<div class="form-group">
<label>Subject / Reason to meet</label>
<input id="app-subject" type="text" placeholder="e.g. Legal Consultation, Property Dispute" required>
</div>"""

new_date = """<div class="form-group">
<label>Subject / Reason to meet</label>
<input id="app-subject" type="text" placeholder="e.g. Legal Consultation, Property Dispute" required>
</div>

<div class="form-group">
<label>Preferred Date</label>
<input id="app-date" type="date" required style="width: 100%; padding: 12px; border: 1px solid rgba(0,0,0,0.1); border-radius: 8px; font-family: inherit;" onchange="checkVacancy()">
<div id="vacancy-status" style="margin-top: 8px; font-size: 0.9rem; font-weight: bold;"></div>
</div>
<script>
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('app-date').min = tomorrow.toISOString().split('T')[0];
    
    async function checkVacancy() {
        const dateVal = document.getElementById('app-date').value;
        const statusEl = document.getElementById('vacancy-status');
        const btn = document.getElementById('appointmentBtn');
        if(!dateVal) {
            statusEl.innerText = '';
            return;
        }
        
        statusEl.style.color = '#64748b';
        statusEl.innerText = 'Checking availability...';
        btn.disabled = true;
        
        try {
            const res = await fetch(`/api/appointments/vacancy?date=${dateVal}`);
            const data = await res.json();
            
            if(data.available) {
                statusEl.style.color = '#10b981';
                statusEl.innerText = `✅ Available (${data.remaining} slots left)`;
                btn.disabled = false;
            } else {
                statusEl.style.color = '#ef4444';
                statusEl.innerText = `❌ ${data.message || 'Fully booked'}`;
                btn.disabled = true;
            }
        } catch(e) {
            statusEl.innerText = '';
            btn.disabled = false;
        }
    }
</script>"""

if old_subject in content:
    content = content.replace(old_subject, new_date)
else:
    print("WARNING: Could not find old_subject in index.html")

with open('index.html', 'w') as f:
    f.write(content)
