import re

with open('app.py', 'r') as f:
    content = f.read()

old_route = """@app.route('/api/appointments/download-today', methods=['GET'])
def download_today_appointments():
    today_str = datetime.now().strftime("%Y-%m-%d")
    appointments = list(appointments_col.find({"appointment_date": today_str}).sort("appointment_time", 1))"""

new_route = """@app.route('/api/appointments/download', methods=['GET'])
def download_appointments_by_date():
    target_date = request.args.get('date')
    if not target_date:
        target_date = datetime.now().strftime("%Y-%m-%d")
        
    appointments = list(appointments_col.find({"appointment_date": target_date}).sort("appointment_time", 1))"""

content = content.replace(old_route, new_route)

old_pdf_title = """pdf.cell(200, 10, txt=f"JSM Chambers - Appointments for {today_str}", ln=1, align='C')"""
new_pdf_title = """pdf.cell(200, 10, txt=f"JSM Chambers - Appointments for {target_date}", ln=1, align='C')"""
content = content.replace(old_pdf_title, new_pdf_title)

old_pdf_empty = """pdf.cell(200, 10, txt="No appointments scheduled for today.", ln=1, align='C')"""
new_pdf_empty = """pdf.cell(200, 10, txt=f"No appointments scheduled for {target_date}.", ln=1, align='C')"""
content = content.replace(old_pdf_empty, new_pdf_empty)

old_pdf_dl = """download_name=f'Appointments_{today_str}.pdf'"""
new_pdf_dl = """download_name=f'Appointments_{target_date}.pdf'"""
content = content.replace(old_pdf_dl, new_pdf_dl)

with open('app.py', 'w') as f:
    f.write(content)
