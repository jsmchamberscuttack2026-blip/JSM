import re

with open('app.py', 'r') as f:
    content = f.read()

# 1. Add send_file to imports
content = content.replace("from flask import Flask, request, jsonify, send_from_directory", "from flask import Flask, request, jsonify, send_from_directory, send_file")

# 2. Add the route for downloading today's appointments
new_route = """
@app.route('/api/appointments/download-today', methods=['GET'])
def download_today_appointments():
    today_str = datetime.now().strftime("%Y-%m-%d")
    appointments = list(appointments_col.find({"appointment_date": today_str}).sort("appointment_time", 1))
    
    pdf = FPDF()
    pdf.add_page()
    
    try:
        pdf.image('assets/images/advocate_logo.jpg', x=85, y=10, w=40)
    except:
        pass
        
    pdf.set_font("Arial", 'B', 16)
    pdf.ln(40)
    pdf.cell(200, 10, txt=f"JSM Chambers - Appointments for {today_str}", ln=1, align='C')
    pdf.ln(10)
    
    if not appointments:
        pdf.set_font("Arial", size=12)
        pdf.cell(200, 10, txt="No appointments scheduled for today.", ln=1, align='C')
    else:
        # Table Header
        pdf.set_font("Arial", 'B', 10)
        pdf.cell(45, 10, "Time", border=1)
        pdf.cell(50, 10, "Client Name", border=1)
        pdf.cell(55, 10, "Email", border=1)
        pdf.cell(40, 10, "Reason", border=1)
        pdf.ln()
        
        # Table Body
        pdf.set_font("Arial", size=9)
        for appt in appointments:
            time = str(appt.get('appointment_time', 'N/A'))
            name = str(appt.get('name', 'N/A'))[:28]
            email = str(appt.get('email', 'N/A'))[:32]
            subject = str(appt.get('subject', 'N/A'))[:22]
            
            pdf.cell(45, 10, time, border=1)
            pdf.cell(50, 10, name, border=1)
            pdf.cell(55, 10, email, border=1)
            pdf.cell(40, 10, subject, border=1)
            pdf.ln()
            
    pdf_bytes = pdf.output(dest='S').encode('latin1')
    
    return send_file(
        io.BytesIO(pdf_bytes),
        mimetype='application/pdf',
        as_attachment=True,
        download_name=f'Appointments_{today_str}.pdf'
    )
"""

content = content.replace("@app.route('/api/appointments', methods=['POST'])", new_route + "\n@app.route('/api/appointments', methods=['POST'])")

with open('app.py', 'w') as f:
    f.write(content)
