import re

with open('index.html', 'r') as f:
    content = f.read()

# Replace the variables gathering
old_vars = """    const button = document.getElementById("appointmentBtn");
    const processing = document.getElementById("processing");"""

new_vars = """    const name = document.getElementById("app-name").value;
    const email = document.getElementById("app-email").value;
    const subject = document.getElementById("app-subject").value;
    const date = document.getElementById("app-date").value;

    const button = document.getElementById("appointmentBtn");
    const processing = document.getElementById("processing");"""
content = content.replace(old_vars, new_vars)

# Replace the fetch body and error handling
old_fetch = """    try {
        const response = await fetch('/api/appointments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email })
        });
        
        if (response.ok) {
            processing.style.display = "none";
            success.style.display = "block";
        } else {
            alert('Failed to submit request.');
            form.style.display = "block";
            processing.style.display = "none";
        }
    } catch (err) {
        console.error(err);
        alert('Server error. Please try again.');
        form.style.display = "block";
        processing.style.display = "none";
    }"""

new_fetch = """    try {
        const response = await fetch('/api/appointments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, subject, date })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            processing.style.display = "none";
            success.style.display = "block";
        } else {
            alert(data.error || 'Failed to submit request.');
            form.style.display = "block";
            processing.style.display = "none";
        }
    } catch (err) {
        console.error(err);
        alert('Server error. Please try again.');
        form.style.display = "block";
        processing.style.display = "none";
    }"""
content = content.replace(old_fetch, new_fetch)

with open('index.html', 'w') as f:
    f.write(content)
