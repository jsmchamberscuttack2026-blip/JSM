import re

with open('app.py', 'r') as f:
    content = f.read()

# 1. Add fpdf import
import_patch = """from email.utils import formatdate, make_msgid
from datetime import datetime, timedelta
from fpdf import FPDF
import io
import math"""
content = content.replace("from email.utils import formatdate, make_msgid\nfrom datetime import datetime", import_patch)

# 2. Add GET/POST system-config/appointments route
new_routes = """
@app.route('/api/system-config/appointments', methods=['POST'])
def save_appointment_settings():
    data = request.json
    config_col.update_one(
        {"_id": "global_config"},
        {"$set": {"appointment_settings": data}},
        upsert=True
    )
    return jsonify({"message": "Settings saved"}), 200
"""
content = content.replace("@app.route('/api/system-config', methods=['GET'])", new_routes + "\n@app.route('/api/system-config', methods=['GET'])")

# 3. Rewrite create_appointment() completely
old_create_fn_pattern = r"@app\.route\('/api/appointments', methods=\['POST'\]\).*?return jsonify\(\{\"message\": \"Appointment created successfully\", \"id\": str\(result\.inserted_id\)\}\), 201"

new_create_fn = """@app.route('/api/appointments', methods=['POST'])
def create_appointment():
    data = request.get_json(force=True, silent=True) or {}
    name = data.get('name')
    email = data.get('email')
    subject = data.get('subject', 'General Consultation')
    
    # Auto-assign logic
    config = config_col.find_one({"_id": "global_config"}) or {}
    settings = config.get("appointment_settings", {})
    available_days = settings.get("available_days", ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"])
    start_time_str = settings.get("start_time", "10:00")
    end_time_str = settings.get("end_time", "17:00")
    max_per_day = int(settings.get("max_per_day", 5))
    
    assigned_date = None
    assigned_time = None
    
    # Find next available day
    current_date = datetime.now() + timedelta(days=1) # start checking from tomorrow
    
    for _ in range(30): # check up to 30 days ahead
        day_name = current_date.strftime("%A")
        if day_name in available_days:
            date_str = current_date.strftime("%Y-%m-%d")
            # count existing appointments on this date
            count = appointments_col.count_documents({"appointment_date": date_str})
            if count < max_per_day:
                assigned_date = date_str
                # calculate time slot
                sh, sm = map(int, start_time_str.split(':'))
                eh, em = map(int, end_time_str.split(':'))
                total_mins = (eh*60 + em) - (sh*60 + sm)
                slot_size = total_mins / max_per_day
                
                start_mins = (sh*60 + sm) + (count * slot_size)
                ah = int(start_mins // 60)
                am = int(start_mins % 60)
                assigned_time = f"{ah:02d}:{am:02d}"
                break
        current_date += timedelta(days=1)
        
    if not assigned_date:
        return jsonify({"error": "No appointment slots available in the next 30 days."}), 400
        
    appointment = {
        "name": name,
        "email": email,
        "subject": subject,
        "request_date": datetime.now().strftime("%Y-%m-%d"),
        "status": "Approved",
        "appointment_date": assigned_date,
        "appointment_time": assigned_time
    }
    result = appointments_col.insert_one(appointment)
    
    # Generate PDF
    pdf = FPDF()
    pdf.add_page()
    
    # Add Logo
    try:
        pdf.image('assets/images/advocate_logo.jpg', x=85, y=10, w=40)
    except:
        pass
        
    pdf.set_font("Arial", 'B', 16)
    pdf.ln(40)
    pdf.cell(200, 10, txt="JSM Chambers - Official Appointment Confirmation", ln=1, align='C')
    
    pdf.set_font("Arial", size=12)
    pdf.ln(10)
    
    details = [
        f"Client Name: {name}",
        f"Email Address: {email}",
        f"Subject / Reason: {subject}",
        f"Assigned Date: {assigned_date}",
        f"Assigned Time: {assigned_time}",
        f"Appointment ID: {str(result.inserted_id)}"
    ]
    
    for d in details:
        pdf.cell(200, 10, txt=d, ln=1, align='L')
        
    pdf.ln(10)
    pdf.set_font("Arial", 'I', 10)
    pdf.cell(200, 10, txt="Please arrive 10 minutes prior to your assigned time.", ln=1, align='L')
    
    pdf_bytes = pdf.output(dest='S').encode('latin1')
    
    # Send Email with Attachment
    try:
        msg = MIMEMultipart()
        msg['From'] = SMTP_USER
        msg['To'] = email
        msg['Subject'] = "Appointment Confirmed - JSM Chambers"
        
        body = f"Dear {name},\\n\\nYour appointment has been successfully scheduled.\\n\\nDate: {assigned_date}\\nTime: {assigned_time}\\nSubject: {subject}\\n\\nPlease find your official appointment slip attached.\\n\\nRegards,\\nJSM Chambers"
        msg.attach(MIMEText(body, 'plain'))
        
        part = MIMEBase('application', 'pdf')
        part.set_payload(pdf_bytes)
        encoders.encode_base64(part)
        part.add_header('Content-Disposition', f'attachment; filename="Appointment_{assigned_date}.pdf"')
        msg.attach(part)
        
        server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()
        log_email(email, "Appointment Confirmed - JSM Chambers", "Sent", "250 OK")
    except Exception as e:
        log_email(email, "Appointment Confirmed - JSM Chambers", "Failed", str(e))
        logging.error(f"Error sending email: {e}")

    return jsonify({"message": "Appointment created and assigned successfully", "id": str(result.inserted_id), "date": assigned_date, "time": assigned_time}), 201"""

content = re.sub(old_create_fn_pattern, new_create_fn, content, flags=re.DOTALL)

with open('app.py', 'w') as f:
    f.write(content)
