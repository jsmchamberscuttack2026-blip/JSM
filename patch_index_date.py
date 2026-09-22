import re

with open('index.html', 'r') as f:
    content = f.read()

old_form = """<div class="form-group">
<label>Subject / Reason to meet</label>
<input id="app-subject" type="text" placeholder="e.g. Legal Consultation, Property Dispute" required>
</div>"""

new_form = """<div class="form-group">
<label>Subject / Reason to meet</label>
<input id="app-subject" type="text" placeholder="e.g. Legal Consultation, Property Dispute" required>
</div>

<div class="form-group">
<label>Preferred Date</label>
<input id="app-date" type="date" required min="" style="width: 100%; padding: 12px; border: 1px solid rgba(0,0,0,0.1); border-radius: 8px; font-family: inherit;">
<script>
    // Set min date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('app-date').min = tomorrow.toISOString().split('T')[0];
</script>
</div>"""

content = content.replace(old_form, new_form)


old_js = """        const name = document.getElementById("app-name").value;
        const email = document.getElementById("app-email").value;
        const subject = document.getElementById("app-subject").value;

        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 2000));

        try {
            const response = await fetch('/api/appointments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, subject })
            });"""

new_js = """        const name = document.getElementById("app-name").value;
        const email = document.getElementById("app-email").value;
        const subject = document.getElementById("app-subject").value;
        const date = document.getElementById("app-date").value;

        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 2000));

        try {
            const response = await fetch('/api/appointments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, subject, date })
            });"""

content = content.replace(old_js, new_js)

# I also want to make sure the error handling displays nicely in index.html instead of just console.error
# Let's search for how errors are handled in submitAppointment
