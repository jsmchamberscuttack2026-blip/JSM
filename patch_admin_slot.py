import re

with open('admin-dashboard.html', 'r') as f:
    content = f.read()

# Add Slot Duration UI to admin-dashboard.html
old_html = """<div style="flex: 1;">
                                        <label style="font-weight: bold; font-size: 0.9rem; display: block; margin-bottom: 0.5rem;">Max per Day</label>
                                        <input type="number" id="appt-max-day" class="form-control" value="5" min="1" max="50">
                                    </div>"""

new_html = """<div style="flex: 1;">
                                        <label style="font-weight: bold; font-size: 0.9rem; display: block; margin-bottom: 0.5rem;">Max per Day</label>
                                        <input type="number" id="appt-max-day" class="form-control" value="5" min="1" max="50">
                                    </div>
                                    <div style="flex: 1;">
                                        <label style="font-weight: bold; font-size: 0.9rem; display: block; margin-bottom: 0.5rem;">Slot Duration</label>
                                        <select id="appt-slot-duration" class="form-control">
                                            <option value="15">15 mins</option>
                                            <option value="30" selected>30 mins</option>
                                            <option value="45">45 mins</option>
                                            <option value="60">1 Hour</option>
                                        </select>
                                    </div>"""

content = content.replace(old_html, new_html)

with open('admin-dashboard.html', 'w') as f:
    f.write(content)
