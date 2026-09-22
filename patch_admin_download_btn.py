import re

with open('admin-dashboard.html', 'r') as f:
    content = f.read()

old_html = """<button id="delete-all-appointments-btn" class="btn btn-error" style="background-color: #D32F2F; color: white; border: none; padding: 0.5rem 1rem; cursor: pointer; border-radius: 4px;" onclick="deleteAllAppointments()">Delete All</button>"""

new_html = """<div style="display: flex; gap: 10px;">
                                <a href="/api/appointments/download-today" target="_blank" class="btn btn-primary" style="background-color: #10b981; color: white; border: none; padding: 0.5rem 1rem; cursor: pointer; border-radius: 4px; text-decoration: none; font-size: 0.9rem;">📥 Download Today's PDF</a>
                                <button id="delete-all-appointments-btn" class="btn btn-error" style="background-color: #D32F2F; color: white; border: none; padding: 0.5rem 1rem; cursor: pointer; border-radius: 4px;" onclick="deleteAllAppointments()">Delete All</button>
                            </div>"""

content = content.replace(old_html, new_html)

with open('admin-dashboard.html', 'w') as f:
    f.write(content)
