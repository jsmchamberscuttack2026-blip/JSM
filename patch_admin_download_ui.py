import re

with open('admin-dashboard.html', 'r') as f:
    content = f.read()

old_html = """<div style="display: flex; gap: 10px;">
                                <a href="/api/appointments/download-today" target="_blank" class="btn btn-primary" style="background-color: #10b981; color: white; border: none; padding: 0.5rem 1rem; cursor: pointer; border-radius: 4px; text-decoration: none; font-size: 0.9rem;">📥 Download Today's PDF</a>
                                <button id="delete-all-appointments-btn" class="btn btn-error" style="background-color: #D32F2F; color: white; border: none; padding: 0.5rem 1rem; cursor: pointer; border-radius: 4px;" onclick="deleteAllAppointments()">Delete All</button>
                            </div>"""

new_html = """<div style="display: flex; gap: 10px; align-items: center;">
                                <input type="date" id="download-appt-date" class="form-control" style="padding: 0.4rem; border-radius: 4px; border: 1px solid #ccc;">
                                <button onclick="downloadPdfByDate()" class="btn btn-primary" style="background-color: #10b981; color: white; border: none; padding: 0.5rem 1rem; cursor: pointer; border-radius: 4px; text-decoration: none; font-size: 0.9rem;">📥 Download PDF</button>
                                <button id="delete-all-appointments-btn" class="btn btn-error" style="background-color: #D32F2F; color: white; border: none; padding: 0.5rem 1rem; cursor: pointer; border-radius: 4px;" onclick="deleteAllAppointments()">Delete All</button>
                            </div>
                            <script>
                                // Set today's date as default
                                document.getElementById('download-appt-date').valueAsDate = new Date();
                                
                                function downloadPdfByDate() {
                                    const date = document.getElementById('download-appt-date').value;
                                    if(date) {
                                        window.open(`/api/appointments/download?date=${date}`, '_blank');
                                    } else {
                                        alert('Please select a date first.');
                                    }
                                }
                            </script>"""

content = content.replace(old_html, new_html)

with open('admin-dashboard.html', 'w') as f:
    f.write(content)
