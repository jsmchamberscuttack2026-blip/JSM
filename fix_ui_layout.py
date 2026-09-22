import re

with open('admin-dashboard.html', 'r') as f:
    content = f.read()

# Replace the layout
old_layout = """<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-top: 1rem;">
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
                                    <div style="flex: 1;">"""

new_layout = """<div style="display: flex; flex-direction: column; gap: 1.5rem; margin-top: 1rem;">
                                <div>
                                    <label style="font-weight: bold; font-size: 0.9rem; display: block; margin-bottom: 0.5rem;">Available Days</label>
                                    <div style="display: flex; flex-wrap: wrap; gap: 15px;" id="available-days-container">
                                        <label style="cursor: pointer;"><input type="checkbox" value="Monday" class="day-checkbox"> Mon</label>
                                        <label style="cursor: pointer;"><input type="checkbox" value="Tuesday" class="day-checkbox"> Tue</label>
                                        <label style="cursor: pointer;"><input type="checkbox" value="Wednesday" class="day-checkbox"> Wed</label>
                                        <label style="cursor: pointer;"><input type="checkbox" value="Thursday" class="day-checkbox"> Thu</label>
                                        <label style="cursor: pointer;"><input type="checkbox" value="Friday" class="day-checkbox"> Fri</label>
                                        <label style="cursor: pointer;"><input type="checkbox" value="Saturday" class="day-checkbox"> Sat</label>
                                        <label style="cursor: pointer;"><input type="checkbox" value="Sunday" class="day-checkbox"> Sun</label>
                                    </div>
                                </div>
                                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 1rem;">
                                    <div>"""

content = content.replace(old_layout, new_layout)

# Also fix the inner divs which have `<div style="flex: 1;">`
old_flex1 = """<div style="flex: 1;">
                                        <label style="font-weight: bold; font-size: 0.9rem; display: block; margin-bottom: 0.5rem;">End Time</label>"""
new_flex1 = """<div>
                                        <label style="font-weight: bold; font-size: 0.9rem; display: block; margin-bottom: 0.5rem;">End Time</label>"""
content = content.replace(old_flex1, new_flex1)

old_flex2 = """<div style="flex: 1;">
                                        <label style="font-weight: bold; font-size: 0.9rem; display: block; margin-bottom: 0.5rem;">Max per Day</label>"""
new_flex2 = """<div>
                                        <label style="font-weight: bold; font-size: 0.9rem; display: block; margin-bottom: 0.5rem;">Max per Day</label>"""
content = content.replace(old_flex2, new_flex2)

old_flex3 = """<div style="flex: 1;">
                                        <label style="font-weight: bold; font-size: 0.9rem; display: block; margin-bottom: 0.5rem;">Slot Duration</label>"""
new_flex3 = """<div>
                                        <label style="font-weight: bold; font-size: 0.9rem; display: block; margin-bottom: 0.5rem;">Slot Duration</label>"""
content = content.replace(old_flex3, new_flex3)


with open('admin-dashboard.html', 'w') as f:
    f.write(content)
