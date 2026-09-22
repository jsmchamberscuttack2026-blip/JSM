import re

with open('admin-dashboard.html', 'r') as f:
    content = f.read()

# Find where to inject in section-consultations
old_html = """                        <table class="data-table" style="margin-top: 2rem;">"""

new_html = """                        
                        <!-- Availability Settings -->
                        <div style="background: #f8fafc; padding: 1.5rem; border-radius: 8px; border: 1px solid #e2e8f0; margin-top: 1.5rem;">
                            <h4 style="margin-top:0; color: var(--color-primary); display:flex; align-items:center; justify-content:space-between;">
                                <span>📅 Auto-Assignment Availability Settings</span>
                                <button onclick="saveAppointmentSettings()" class="btn btn-primary" style="padding: 0.4rem 1rem; font-size: 0.9rem;">Save Settings</button>
                            </h4>
                            <p style="font-size: 0.9rem; color: #64748b;">The system will automatically assign dates and times to new client requests based on these limits.</p>
                            
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-top: 1rem;">
                                <div>
                                    <label style="font-weight: bold; font-size: 0.9rem; display: block; margin-bottom: 0.5rem;">Available Days</label>
                                    <div style="display: flex; flex-wrap: wrap; gap: 10px;" id="available-days-container">
                                        <label><input type="checkbox" value="Monday" class="day-checkbox"> Mon</label>
                                        <label><input type="checkbox" value="Tuesday" class="day-checkbox"> Tue</label>
                                        <label><input type="checkbox" value="Wednesday" class="day-checkbox"> Wed</label>
                                        <label><input type="checkbox" value="Thursday" class="day-checkbox"> Thu</label>
                                        <label><input type="checkbox" value="Friday" class="day-checkbox"> Fri</label>
                                        <label><input type="checkbox" value="Saturday" class="day-checkbox"> Sat</label>
                                        <label><input type="checkbox" value="Sunday" class="day-checkbox"> Sun</label>
                                    </div>
                                </div>
                                <div style="display: flex; gap: 1rem;">
                                    <div style="flex: 1;">
                                        <label style="font-weight: bold; font-size: 0.9rem; display: block; margin-bottom: 0.5rem;">Start Time</label>
                                        <input type="time" id="appt-start-time" class="form-control" value="10:00">
                                    </div>
                                    <div style="flex: 1;">
                                        <label style="font-weight: bold; font-size: 0.9rem; display: block; margin-bottom: 0.5rem;">End Time</label>
                                        <input type="time" id="appt-end-time" class="form-control" value="17:00">
                                    </div>
                                    <div style="flex: 1;">
                                        <label style="font-weight: bold; font-size: 0.9rem; display: block; margin-bottom: 0.5rem;">Max per Day</label>
                                        <input type="number" id="appt-max-day" class="form-control" value="5" min="1" max="50">
                                    </div>
                                </div>
                            </div>
                        </div>

                        <table class="data-table" style="margin-top: 2rem;">"""

content = content.replace(old_html, new_html)

with open('admin-dashboard.html', 'w') as f:
    f.write(content)
