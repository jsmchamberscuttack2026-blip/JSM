import re

with open('index.html', 'r') as f:
    content = f.read()

old_form = """<div class="form-group">
<label>Email</label>
<input id="app-email" type="email" placeholder="you@example.com" required>
</div>"""

new_form = """<div class="form-group">
<label>Email</label>
<input id="app-email" type="email" placeholder="you@example.com" required>
</div>

<div class="form-group">
<label>Subject / Reason to meet</label>
<input id="app-subject" type="text" placeholder="e.g. Legal Consultation, Property Dispute" required>
</div>"""

content = content.replace(old_form, new_form)

# Also update the submitAppointment JS inside index.html to include subject
old_js = """        const name = document.getElementById("app-name").value;
        const email = document.getElementById("app-email").value;

        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 2000));

        try {
            const response = await fetch('/api/appointments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email })
            });"""

new_js = """        const name = document.getElementById("app-name").value;
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

content = content.replace(old_js, new_js)

with open('index.html', 'w') as f:
    f.write(content)
