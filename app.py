from datetime import timedelta
import concurrent.futures
import os
from flask import Flask, request, jsonify, send_from_directory
from pymongo import MongoClient
from bson import ObjectId
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from email.utils import formatdate, make_msgid
from datetime import datetime
import random
import certifi
import logging
import socket
import random
import string

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

app = Flask(__name__, static_folder='.', static_url_path='')
app.config['SECRET_KEY'] = 'secret!'
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024  # 10 MB

MONGO_URI = os.environ.get("MONGO_URI")
DB_NAME = os.environ.get("DB_NAME", "jsmchambers_db")
SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", 587))
SMTP_USER = os.environ.get("SMTP_USER")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD")

try:
    if not MONGO_URI:
        logging.error("MONGO_URI environment variable is missing.")
    client = MongoClient(MONGO_URI, tlsCAFile=certifi.where())
    db = client[DB_NAME]
    appointments_col = db['appointments']
    advocates_col = db['advocates']
    config_col = db['system_config']
    settings_col = db['settings']
    cases_col = db['cases']
    email_logs_col = db['email_logs']
    logging.info("Successfully connected to MongoDB")
except Exception as e:
    logging.error(f"Error connecting to MongoDB: {e}")

def log_email(recipient, subject, status, smtp_response):
    try:
        log_entry = {
            "recipient": recipient,
            "subject": subject,
            "status": status,
            "smtp_response": smtp_response,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        email_logs_col.insert_one(log_entry)
    except Exception as e:
        logging.error(f"Failed to log email: {e}")

class IPv4SMTP(smtplib.SMTP):

    def _get_socket(self, host, port, timeout):
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        if timeout is not None and timeout is not socket._GLOBAL_DEFAULT_TIMEOUT:
            sock.settimeout(timeout)
        sock.connect((host, port))
        return sock

def send_email_core(recipient_email, msg_obj, subject_for_log):
    if not recipient_email or "@" not in recipient_email:
        log_email(recipient_email, subject_for_log, "Rejected", "Invalid email address format.")
        return {"success": False, "smtp_response": "Invalid email address format."}
    if not SMTP_USER or not SMTP_PASSWORD:
        log_email(recipient_email, subject_for_log, "Failed", "SMTP Credentials missing.")
        return {"success": False, "smtp_response": "SMTP Credentials missing."}
    
    try:
        with IPv4SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(SMTP_USER, SMTP_PASSWORD)
            
            # sendmail returns an empty dict if successful, or a dict of failed recipients
            result = server.sendmail(SMTP_USER, recipient_email, msg_obj.as_string())
            
            if not result:
                log_email(recipient_email, subject_for_log, "SMTP Accepted", "250 OK - Message accepted for delivery")
                return {"success": True, "smtp_response": "250 OK - Message accepted for delivery"}
            else:
                resp = str(result)
                log_email(recipient_email, subject_for_log, "Rejected", resp)
                return {"success": False, "smtp_response": resp}
                
    except smtplib.SMTPResponseException as e:
        resp = f"SMTP Error {e.smtp_code}: {e.smtp_error.decode('utf-8') if isinstance(e.smtp_error, bytes) else e.smtp_error}"
        log_email(recipient_email, subject_for_log, "Rejected", resp)
        return {"success": False, "smtp_response": resp}
    except smtplib.SMTPException as e:
        resp = f"SMTP Exception: {str(e)}"
        log_email(recipient_email, subject_for_log, "Failed", resp)
        return {"success": False, "smtp_response": resp}
    except Exception as e:
        resp = f"Connection/System Error: {str(e)}"
        log_email(recipient_email, subject_for_log, "Failed", resp)
        return {"success": False, "smtp_response": resp}


def send_credentials_email(recipient_email, name, password):
    msg = MIMEMultipart('alternative')
    msg['Date'] = formatdate(localtime=True)
    msg['Message-ID'] = make_msgid()
    msg['From'] = f"JSM Chambers <{SMTP_USER}>"
    msg['To'] = recipient_email
    subject = "JSM. Chambers - Your Client Portal Login Details"
    msg['Subject'] = subject
    
    text = f"""Dear {name},

A case file has been successfully opened for you.
You can now track your case status, hearing dates, and fees via our Client Portal.

Login Link: https://jsmchambers.vercel.app/client-login.html
Email: {recipient_email}
Password: {password}

Thank you,
JSM Chambers"""
    html = f"""
    <html><body style="font-family: Arial, sans-serif; color: #333;">
    <h2 style="color: #0A192F;">JSM. Chambers Client Portal</h2>
    <p>Dear {name},</p>
    <p>A case file has been successfully opened for you.</p>
    <p>You can now track your case status, hearing dates, and fees securely via our Client Portal.</p>
    <p><strong>Email:</strong> {recipient_email}<br>
    <strong>Password:</strong> {password}</p>
    <p><em>Please keep your password secure.</em></p>
    <p>Thank you,<br><strong>JSM Chambers</strong></p>
    </body></html>
    """
    msg.attach(MIMEText(text, 'plain', 'utf-8'))
    msg.attach(MIMEText(html, 'html', 'utf-8'))
    
    return send_email_core(recipient_email, msg, subject)

def send_verification_email(recipient_email, code):
    msg = MIMEMultipart('alternative')
    msg['Date'] = formatdate(localtime=True)
    msg['Message-ID'] = make_msgid()
    msg['From'] = f"JSM Chambers <{SMTP_USER}>"
    msg['To'] = recipient_email
    subject = "JSM. Chambers - Login Verification Code"
    msg['Subject'] = subject
    
    text = f"""You requested a verification code to access your case file.

Your Verification Code is: {code}

If you did not request this, please ignore this email."""
    html = f"""
    <html><body style="font-family: Arial, sans-serif; color: #333;">
    <h2 style="color: #0A192F;">Login Verification</h2>
    <p>You requested a verification code to securely access your case file.</p>
    <h1 style="letter-spacing: 5px; color: #D4AF37;">{code}</h1>
    <p style="font-size: 0.9rem; color: #666;">If you did not request this code, please ignore this email.</p>
    <p>Thank you,<br><strong>JSM Chambers</strong></p>
    </body></html>
    """
    msg.attach(MIMEText(text, 'plain', 'utf-8'))
    msg.attach(MIMEText(html, 'html', 'utf-8'))
    
    return send_email_core(recipient_email, msg, subject)

def send_appointment_received_email(recipient_email, name):
    msg = MIMEMultipart('alternative')
    msg['Date'] = formatdate(localtime=True)
    msg['Message-ID'] = make_msgid()
    msg['From'] = f"JSM Chambers <{SMTP_USER}>"
    msg['To'] = recipient_email
    subject = "JSM. Chambers - Appointment Request Received"
    msg['Subject'] = subject
    
    text = f"""Dear {name},

We have successfully received your appointment request.

Our administrative team will review your request and set a Date and Time for your consultation. You will receive another email once your appointment is confirmed.

Thank you,
JSM Chambers"""
    html = f"""
    <html><body style="font-family: Arial, sans-serif; color: #333;">
    <h2 style="color: #0A192F;">JSM. Chambers - Legal Services</h2>
    <p>Dear {name},</p>
    <p>We have successfully received your appointment request.</p>
    <p>Our administrative team will review your request and set a Date and Time for your consultation. You will receive another email once your appointment is confirmed.</p>
    <p>Thank you,<br><strong>JSM Chambers</strong></p>
    </body></html>
    """
    msg.attach(MIMEText(text, 'plain', 'utf-8'))
    msg.attach(MIMEText(html, 'html', 'utf-8'))
    
    # Send client confirmation
    # client_result = send_email_core(recipient_email, msg, subject)
    
    # Send admin notification separately
    admin_msg = MIMEMultipart('alternative')
    admin_msg['Date'] = formatdate(localtime=True)
    admin_msg['Message-ID'] = make_msgid()
    admin_msg['From'] = f"JSM Chambers <{SMTP_USER}>"
    admin_msg['To'] = SMTP_USER
    admin_subject = f"New Appointment Request: {name}"
    admin_msg['Subject'] = admin_subject
    
    admin_text = f"""You have a new appointment request.

Client Name: {name}
Email: {recipient_email}

Please log into the Admin Dashboard to approve and set a date/time."""
    admin_html = f"""
    <html><body style="font-family: Arial, sans-serif; color: #333;">
    <h2 style="color: #0A192F;">New Appointment Request</h2>
    <p><strong>Client Name:</strong> {name}</p>
    <p><strong>Email:</strong> {recipient_email}</p>
    <p>Please log into the Admin Dashboard to approve and schedule this appointment.</p>
    </body></html>
    """
    admin_msg.attach(MIMEText(admin_text, 'plain', 'utf-8'))
    admin_msg.attach(MIMEText(admin_html, 'html', 'utf-8'))
    
    # Send both emails in parallel
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(send_email_core, recipient_email, msg, subject)
        f2 = executor.submit(send_email_core, SMTP_USER, admin_msg, admin_subject)
        client_result = f1.result()
        admin_result = f2.result()
        
    return client_result

@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')



@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

@app.route('/api/appointments', methods=['POST'])
def create_appointment():
    data = request.get_json(force=True, silent=True) or {}
    name = data.get('name')
    email = data.get('email')
    service = data.get('service')
    
    appointment = {
        "name": name,
        "email": email,
        "service": service,
        "request_date": datetime.now().strftime("%d %b %Y"),
        "status": "Pending",
        "appointment_date": "",
        "appointment_time": ""
    }
    result = appointments_col.insert_one(appointment)
    send_appointment_received_email(email, name)
    return jsonify({"message": "Appointment created successfully", "id": str(result.inserted_id)}), 201

@app.route('/api/appointments', methods=['GET'])
def get_appointments():
    appointments = []
    for appt in appointments_col.find():
        appt['_id'] = str(appt['_id'])
        appointments.append(appt)
    return jsonify(appointments), 200

@app.route('/api/appointments/approve', methods=['POST'])
def approve_appointment():
    data = request.json
    appt_id = data.get('id')
    date = data.get('date')
    time = data.get('time')
    if not appt_id or not date or not time:
        return jsonify({"error": "Missing required fields"}), 400
    appt = appointments_col.find_one({"_id": ObjectId(appt_id)})
    if not appt:
        return jsonify({"error": "Appointment not found"}), 404
    try:
        appointments_col.update_one(
            {"_id": ObjectId(appt_id)},
            {"$set": {
                "status": "Approved",
                "appointment_date": date,
                "appointment_time": time
            }}
        )
        if appt.get('email'):
            msg = MIMEMultipart('alternative')
            msg['Date'] = formatdate(localtime=True)
            msg['Message-ID'] = make_msgid()
            msg['From'] = f"JSM Chambers <{SMTP_USER}>"
            msg['To'] = appt['email']
            subject = "JSM. Chambers - Appointment Approved"
            msg['Subject'] = subject
            
            text = f"""Dear {appt['name']},

Your appointment has been APPROVED.
Date: {date}
Time: {time}

Thank you,
JSM Chambers"""
            html = f"""
            <html><body style="font-family: Arial, sans-serif; color: #333;">
            <h2 style="color: #0A192F;">Appointment Confirmed</h2>
            <p>Dear {appt['name']},</p>
            <p>Your appointment has been successfully approved.</p>
            <p><strong>Date:</strong> {date}<br><strong>Time:</strong> {time}</p>
            <p><strong>Date:</strong> {date}<br>
            <strong>Time:</strong> {time}</p>
            <p>Thank you,<br><strong>JSM Chambers</strong></p>
            </body></html>
            """
            msg.attach(MIMEText(text, 'plain', 'utf-8'))
            msg.attach(MIMEText(html, 'html', 'utf-8'))
            send_email_core(appt['email'], msg, subject)
        return jsonify({"message": "Approved"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/appointments/<id>', methods=['DELETE'])
def delete_appointment(id):
    appointments_col.delete_one({"_id": ObjectId(id)})
    return jsonify({"message": "Deleted"}), 200

@app.route('/api/appointments/all', methods=['DELETE'])
def delete_all_appointments():
    appointments_col.delete_many({})
    return jsonify({"message": "All deleted"}), 200

@app.route('/api/email-logs', methods=['GET'])
def get_email_logs():
    logs = list(email_logs_col.find().sort('_id', -1).limit(300))
    
    staff_emails = [adv.get('email', '') for adv in advocates_col.find({}, {"email": 1})]
    
    client_logs = []
    staff_logs = []
    
    for log in logs:
        log['_id'] = str(log['_id'])
        if 'timestamp' in log and log['timestamp']:
            if not isinstance(log['timestamp'], str):
                try: log['timestamp'] = log['timestamp'].strftime('%Y-%m-%d %H:%M:%S')
                except: log['timestamp'] = str(log['timestamp'])
                
        rec = log.get('recipient', '')
        sub = log.get('subject', '')
        
        if rec in staff_emails or "Login Verification Code" in sub or "New Case Assigned" in sub:
            staff_logs.append(log)
        else:
            client_logs.append(log)
            
    return jsonify({"client_logs": client_logs, "staff_logs": staff_logs}), 200



@app.route('/api/email-section-password', methods=['POST'])
def email_section_password():
    data = request.json
    section = data.get('section')
    if section not in ['appointments', 'clients', 'addcase']:
        return jsonify({"error": "Invalid section"}), 400
        
    config = ensure_daily_passwords()
    pwd = config.get(section + '_password', '')
    
    advocates = list(advocates_col.find({"email": {"$exists": True, "$ne": ""}}))
    emails_sent = 0
    
    section_name = "Incoming Appointments" if section == "appointments" else "Clients Directory"
    
    with concurrent.futures.ThreadPoolExecutor() as executor:
        for adv in advocates:
            if adv.get('email') and adv.get(f'access_{section}', False):
                subject = f"JSM. Chambers - Daily Password for {section_name}"
                body = f"""
                <p>Dear {adv.get('name', 'Advocate')},</p>
                <p>The daily access password for the <strong>{section_name}</strong> section has been generated.</p>
                <h3 style="background: #f4f4f4; padding: 15px; border-radius: 5px; letter-spacing: 2px;">{pwd}</h3>
                <p>Please use this password to unlock the section in your Staff Dashboard.</p>
                <p>This password is valid for 24 hours.</p>
                <br>
                <p>Regards,<br>Admin Team</p>
                """
                msg = MIMEMultipart()
                msg['From'] = SMTP_USER
                msg['To'] = adv['email']
                msg['Subject'] = subject
                msg.attach(MIMEText(body, 'html', 'utf-8'))
                executor.submit(send_email_core, adv['email'], msg, subject)
                emails_sent += 1
            
    return jsonify({"success": True, "emails_sent": emails_sent}), 200

@app.route('/api/email-logs/<id>', methods=['DELETE'])
def delete_email_log(id):
    try:
        result = email_logs_col.delete_one({"_id": ObjectId(id)})
        if result.deleted_count > 0:
            return jsonify({"message": "Email log deleted"}), 200
        return jsonify({"error": "Email log not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/admin-login', methods=['POST'])
def admin_login():
    data = request.get_json(force=True, silent=True) or {}
    password = data.get('password')
    if password == 'admin123':
        return jsonify({"success": True}), 200
    return jsonify({"error": "Invalid credentials"}), 401

@app.route('/api/cases', methods=['POST'])
def create_case():
    data = request.get_json(force=True, silent=True) or {}
    password = ''.join(random.choices(string.ascii_letters + string.digits, k=8))
    case = {
        "client_name": data.get('client_name'),
        "email": data.get('email'),
        "case_type": data.get('case_type'),
        "password": password,
        "status": "Under Review",
        "next_hearing": "To Be Decided",
        "notes": "",
        "chamber_case_number": data.get("chamber_case_number", ""),
        "court_case_number": data.get("court_case_number", ""),
        "assigned_staff_email": "",
        "created_at": datetime.now().strftime("%d %b %Y")
    }
    result = cases_col.insert_one(case)
    email_sent = send_credentials_email(case['email'], case['client_name'], password)
    return jsonify({"message": "Case created", "id": str(result.inserted_id), "password": password, "email_sent": email_sent}), 201


def ensure_daily_passwords():
    today = datetime.now().strftime("%Y-%m-%d")
    config = config_col.find_one({"_id": "daily_passwords"})
    
    if not config or config.get("date_generated") != today or "addcase_password" not in config:
        # Generate new passwords
        new_appts = str(random.randint(100000, 999999))
        new_clients = str(random.randint(100000, 999999))
        new_addcase = str(random.randint(100000, 999999))
        
        config_col.update_one(
            {"_id": "daily_passwords"},
            {"$set": {
                "date_generated": today,
                "appointments_password": new_appts,
                "clients_password": new_clients,
                "addcase_password": new_addcase
            }},
            upsert=True
        )
        return {"appointments_password": new_appts, "clients_password": new_clients, "addcase_password": new_addcase, "date_generated": today}
    
    return config

@app.route('/api/cases', methods=['GET'])
def get_cases():
    cases = list(cases_col.find({"status": {"$ne": "Finished & Archived"}}).sort('_id', -1))
    for c in cases: c['_id'] = str(c['_id'])
    return jsonify(cases), 200

@app.route('/api/archived-cases', methods=['GET'])
def get_archived_cases():
    cases = list(cases_col.find({"status": "Finished & Archived"}).sort('_id', -1))
    for c in cases: c['_id'] = str(c['_id'])
    return jsonify(cases), 200



@app.route('/api/cases/<id>', methods=['GET'])
def get_single_case(id):
    c = cases_col.find_one({"_id": ObjectId(id)})
    if c:
        c['_id'] = str(c['_id'])
        
        email = c.get('email', '')
        if email:
            logs = list(email_logs_col.find({"recipient": email}).sort('_id', -1))
            for log in logs:
                log['_id'] = str(log['_id'])
                if 'timestamp' in log and log['timestamp']:
                    if not isinstance(log['timestamp'], str):
                        try:
                            log['timestamp'] = log['timestamp'].strftime('%Y-%m-%d %H:%M:%S')
                        except:
                            log['timestamp'] = str(log['timestamp'])
            c['email_logs'] = logs
        else:
            c['email_logs'] = []
            
        return jsonify(c), 200
    return jsonify({"error": "Not found"}), 404

@app.route('/api/cases/<id>', methods=['PUT'])
def update_case(id):
    data = request.get_json(force=True, silent=True) or {}
    
    # Check if staff assignment changed
    old_case = cases_col.find_one({"_id": ObjectId(id)})
    new_staff_email = data.get('assigned_staff_email')
    old_staff_email = old_case.get('assigned_staff_email', '') if old_case else ''
    
    update_fields = {}
    if 'status' in data: update_fields['status'] = data['status']
    if 'next_hearing' in data: 
        update_fields['next_hearing'] = data['next_hearing']
        cases_col.update_one({"_id": ObjectId(id)}, {"$addToSet": {"hearing_history": data['next_hearing']}})
    if 'notes' in data: update_fields['notes'] = data['notes']
    if 'chamber_case_number' in data: update_fields['chamber_case_number'] = data['chamber_case_number']
    if 'court_case_number' in data: update_fields['court_case_number'] = data['court_case_number']
    if 'assigned_staff_email' in data: update_fields['assigned_staff_email'] = data['assigned_staff_email']
    
    if update_fields:
        cases_col.update_one(
            {"_id": ObjectId(id)},
            {"$set": update_fields}
        )
    
    # Send email if newly assigned to a valid email
    if new_staff_email is not None and new_staff_email != '' and new_staff_email != old_staff_email:
        case_type = old_case.get('case_type', '') if old_case else ''
        client_name = old_case.get('client_name', '') if old_case else ''
        chamber_case_number = data.get('chamber_case_number', 'Not Assigned')
        court_case_number = data.get('court_case_number', 'Not Assigned')
        case_number = f"Chamber: {chamber_case_number} | Court: {court_case_number}"
        
        try:
            msg = MIMEMultipart()
            msg['Message-ID'] = make_msgid()
            msg['From'] = f"JSM Chambers <{SMTP_USER}>"
            msg['To'] = new_staff_email
            msg['Subject'] = f"New Case Assigned: {client_name}"
            
            text = f"Dear Advocate,\n\nYou have been assigned a new case.\n\nClient: {client_name}\nCase Type: {case_type}\nCase Number: {case_number}\n\nPlease log in to the Staff Portal to manage this case.\n\nRegards,\nAdmin, JSM Chambers"
            msg.attach(MIMEText(text, 'plain', 'utf-8'))
            
            with concurrent.futures.ThreadPoolExecutor() as executor:
                executor.submit(send_email_core, new_staff_email, msg, msg['Subject'])
        except Exception as e:
            logging.error(f"Failed to send staff assignment email: {e}")
            
    return jsonify({"message": "Case updated"}), 200

@app.route('/api/staff-cases/<email>', methods=['GET'])
def get_staff_cases(email):
    cases = list(cases_col.find({"assigned_staff_email": email, "status": {"$ne": "Finished & Archived"}}).sort('_id', -1))
    for c in cases: c['_id'] = str(c['_id'])
    return jsonify(cases), 200

@app.route('/api/cases/<id>', methods=['DELETE'])
def delete_case(id):
    cases_col.delete_one({"_id": ObjectId(id)})
    return jsonify({"message": "Case deleted"}), 200

@app.route('/api/cases/<id>/finish', methods=['POST'])
def finish_case(id):
    case = cases_col.find_one({"_id": ObjectId(id)})
    if not case: return jsonify({"error": "Not found"}), 404
    total = float(case.get('total_fee', 0))
    paid = float(case.get('fee_paid', 0))
    if paid < total:
        return jsonify({"unpaid": str(total - paid)}), 200
    cases_col.update_one({"_id": ObjectId(id)}, {"$set": {"status": "Finished & Archived"}})
    email = case.get('email')
    name = case.get('client_name')
    if email:
        msg = MIMEMultipart('alternative')
        msg['Date'] = formatdate(localtime=True)
        msg['Message-ID'] = make_msgid()
        msg['From'] = f"JSM Chambers <{SMTP_USER}>"
        msg['To'] = email
        subject = "JSM. Chambers - Case Finalized"
        msg['Subject'] = subject
        
        text = f"""Dear {name},

Congratulations! Your case file has been marked as Finished.
Access to the portal has been revoked.
If you require further assistance in the future, please feel free to reach out to us again.

Thank you,
JSM Chambers"""
        html = f"""
        <html><body style="font-family: Arial, sans-serif; color: #333;">
        <h2 style="color: #0A192F;">Case Finalized</h2>
        <p>Dear {name},</p>
        <p>Congratulations! Your case file has been marked as <strong>Finished</strong> and your payments are completely cleared.</p>
        <p>Your access to the active portal has been successfully archived. If you require further assistance in the future, please feel free to reach out to us again.</p>
        <p>Thank you,<br><strong>JSM Chambers</strong></p>
        </body></html>
        """
        msg.attach(MIMEText(text, 'plain', 'utf-8'))
        msg.attach(MIMEText(html, 'html', 'utf-8'))
        send_email_core(email, msg, subject)
    return jsonify({"message": "Case Finished & Archived Successfully!"}), 200

@app.route('/api/cases/<id>/email', methods=['POST'])
def send_case_email(id):
    # Support both JSON and multipart/form-data
    if request.content_type and 'multipart/form-data' in request.content_type:
        subject = request.form.get('subject')
        message_body = request.form.get('message')
        attachment = request.files.get('file')
    else:
        data = request.get_json(force=True, silent=True) or {}
        subject = data.get('subject')
        message_body = data.get('message')
        attachment = None

    if not subject or not message_body:
        return jsonify({"error": "Missing subject or message"}), 400
    case = cases_col.find_one({"_id": ObjectId(id)})
    if not case:
        return jsonify({"error": "Case not found"}), 404
    email = case.get('email')
    if not email:
        return jsonify({"error": "Client has no email on file"}), 400
    
    msg = MIMEMultipart()
    msg['Date'] = formatdate(localtime=True)
    msg['Message-ID'] = make_msgid()
    msg['From'] = f"JSM Chambers <{SMTP_USER}>"
    msg['To'] = email
    msg['Subject'] = subject
    
    text = f"Message from JSM Chambers:\n\n{message_body}\n\nRegards,\nJSM Chambers"
    html = f"<html><body><h3>Message regarding your case</h3><p>{message_body}</p><p>Regards,<br><strong>JSM Chambers</strong></p></body></html>"
    
    # Attach body
    body_part = MIMEMultipart('alternative')
    body_part.attach(MIMEText(text, 'plain', 'utf-8'))
    body_part.attach(MIMEText(html, 'html', 'utf-8'))
    msg.attach(body_part)

    # Attach file if present
    if attachment and attachment.filename:
        part = MIMEBase('application', 'octet-stream')
        part.set_payload(attachment.read())
        encoders.encode_base64(part)
        part.add_header('Content-Disposition', f'attachment; filename="{attachment.filename}"')
        msg.attach(part)
    
    result = send_email_core(email, msg, subject)
    if result["success"]:
        # Save notification to case
        cases_col.update_one(
            {"_id": ObjectId(id)},
            {"$push": {"notifications": {
                "message": message_body,
                "date": datetime.now().strftime("%d %b %Y %H:%M")
            }}}
        )
        return jsonify({"message": "Email submitted successfully."}), 200
    else:
        return jsonify({"error": f"Failed to send: {result['smtp_response']}"}), 500

@app.route('/api/my-case/<id>', methods=['GET'])
def get_my_case(id):
    case = cases_col.find_one({"_id": ObjectId(id)})
    if not case:
        return jsonify({"error": "Not found"}), 404
    if case.get("status") == "Finished & Archived":
        return jsonify({"error": "Portal Closed"}), 403
    case['_id'] = str(case['_id'])
    return jsonify(case), 200

@app.route('/api/client-login', methods=['POST'])
def client_login():
    data = request.get_json(force=True, silent=True) or {}
    case = cases_col.find_one({
        "email": data.get('email'), 
        "password": data.get('password'),
        "status": {"$ne": "Finished & Archived"}
    })
    if case:
        return jsonify({"success": True, "case": {"_id": str(case['_id'])}}), 200
    return jsonify({"error": "Invalid credentials or case closed"}), 401

@app.route('/api/forgot-password', methods=['POST'])
def forgot_password():
    try:
        data = request.get_json(force=True, silent=True) or {}
        email = data.get('email')
        case = cases_col.find_one({
            "email": email,
            "status": {"$ne": "Finished & Archived"}
        })
        if not case:
            return jsonify({"error": "No active case found for this email"}), 404
        code = ''.join(random.choices(string.digits, k=6))
        cases_col.update_one({"_id": case['_id']}, {"$set": {"reset_code": code}})
        send_verification_email(email, code)
        return jsonify({"message": "Verification code sent"}), 200
    except Exception as e:
        logging.error(f"Forgot password crash: {e}")
        return jsonify({"message": "Verification code sent but logging error"}), 200

@app.route('/api/verify-code', methods=['POST'])
def verify_code():
    data = request.get_json(force=True, silent=True) or {}
    case = cases_col.find_one({
        "email": data.get('email'), 
        "reset_code": data.get('code'),
        "status": {"$ne": "Finished & Archived"}
    })
    if case:
        return jsonify({"success": True, "password": case.get('password'), "case": {"_id": str(case['_id'])}}), 200
    return jsonify({"error": "Invalid code"}), 400


@app.route('/api/advocates', methods=['GET'])
def get_advocates():
    advocates = []
    for adv in advocates_col.find():
        adv['_id'] = str(adv['_id'])
        advocates.append(adv)
    return jsonify(advocates), 200

@app.route('/api/advocates', methods=['POST'])
def add_advocate():
    data = request.json
    name = data.get('name')
    email = data.get('email')
    specialty = data.get('specialty')
    role = data.get('role', 'Legal Professional')
    image_url = data.get('imageUrl', '')
    
    if not name or not specialty or not email:
        return jsonify({"error": "Missing required fields"}), 400
        
    # Check if email already exists
    if advocates_col.find_one({"email": email}):
        return jsonify({"error": "An advocate with this email already exists"}), 400
        
    password = ''.join(random.choices(string.ascii_letters + string.digits, k=8))
        
    result = advocates_col.insert_one({
        "name": name,
        "email": email,
        "password": password,
        "specialty": specialty,
        "role": role,
        "imageUrl": image_url
    })
    
    # Send credentials email to advocate
    try:
        msg = MIMEMultipart('alternative')
        msg['Date'] = formatdate(localtime=True)
        msg['Message-ID'] = make_msgid()
        msg['From'] = f"JSM Chambers <{SMTP_USER}>"
        msg['To'] = email
        msg['Subject'] = "Welcome to JSM Chambers - Staff Portal Credentials"
        
        text = f"Dear {name},\nWelcome to JSM. Chambers! \nWe warmly welcome you to our legal team. Wishing you great success and a rewarding journey ahead.\nAn advocate profile has been created for you.\n\nLogin ID: \n{email}\n Password: {password}\n\nPlease keep this secure."
        msg.attach(MIMEText(text, 'plain', 'utf-8'))
        
        send_email_core(email, msg, msg['Subject'])
    except Exception as e:
        logging.error(f"Failed to send advocate email: {e}")
        
    return jsonify({"message": "Advocate added", "id": str(result.inserted_id), "password": password}), 201

@app.route('/api/staff-login', methods=['POST'])
def staff_login():
    data = request.get_json(force=True, silent=True) or {}
    email = data.get('email')
    password = data.get('password')
    
    advocate = advocates_col.find_one({"email": email, "password": password})
    if advocate:
        return jsonify({
            "success": True, 
            "advocate": {
                "id": str(advocate['_id']),
                "name": advocate.get('name'),
                "email": advocate.get('email'),
                "access_appointments": advocate.get('access_appointments', False),
                "access_clients": advocate.get('access_clients', False),
                "access_add_case": advocate.get('access_add_case', False)
            }
        }), 200
        
    return jsonify({"error": "Invalid staff credentials"}), 401

@app.route('/api/advocates/<id>', methods=['PUT'])
def update_advocate(id):
    data = request.json
    update_fields = {}
    if 'name' in data:
        update_fields['name'] = data['name']
    if 'email' in data:
        update_fields['email'] = data['email']
    if 'specialty' in data:
        update_fields['specialty'] = data['specialty']
    if 'imageUrl' in data:
        update_fields['imageUrl'] = data['imageUrl']
    if not update_fields:
        return jsonify({"error": "No fields to update"}), 400
    result = advocates_col.update_one({"_id": ObjectId(id)}, {"$set": update_fields})
    if result.matched_count:
        return jsonify({"message": "Advocate updated"}), 200
    return jsonify({"error": "Advocate not found"}), 404

@app.route('/api/advocates/<id>', methods=['DELETE'])
def delete_advocate(id):
    result = advocates_col.delete_one({"_id": ObjectId(id)})
    if result.deleted_count:
        return jsonify({"message": "Advocate deleted"}), 200
    return jsonify({"error": "Advocate not found"}), 404

@app.route('/api/settings', methods=['GET'])
def get_settings():
    settings = settings_col.find_one({"_id": "office_info"}) or {}
    return jsonify(settings), 200

@app.route('/api/settings', methods=['POST'])
def save_settings():
    data = request.json
    settings_col.update_one({"_id": "office_info"}, {"$set": data}, upsert=True)
    return jsonify({"success": True}), 200



@app.route('/api/staff-forgot-password', methods=['POST'])
def staff_forgot_password():
    data = request.json
    email = data.get('email')
    
    advocate = advocates_col.find_one({"email": email})
    if not advocate:
        return jsonify({"error": "No staff member found with this email"}), 404
        
    code = ''.join(random.choices(string.digits, k=6))
    expiration = datetime.now() + timedelta(seconds=30)
    
    advocates_col.update_one(
        {"_id": advocate["_id"]}, 
        {"$set": {"reset_code": code, "code_expires": expiration}}
    )
    
    try:
        msg = MIMEMultipart('alternative')
        msg['Date'] = formatdate(localtime=True)
        msg['Message-ID'] = make_msgid()
        msg['From'] = f"JSM Chambers <{SMTP_USER}>"
        msg['To'] = email
        msg['Subject'] = "Staff Portal - Verification Code"
        
        text = f"Your verification code is: {code}\n\nThis code is valid for 30 seconds."
        msg.attach(MIMEText(text, 'plain', 'utf-8'))
        
        send_email_core(email, msg, msg['Subject'])
    except Exception as e:
        logging.error(f"Failed to send staff verification email: {e}")
        
    return jsonify({"message": "Verification code sent"}), 200

@app.route('/api/staff-verify-code', methods=['POST'])
def staff_verify_code():
    data = request.json
    email = data.get('email')
    code = data.get('code')
    
    advocate = advocates_col.find_one({"email": email, "reset_code": code})
    if not advocate:
        return jsonify({"error": "Invalid verification code"}), 400
        
    if datetime.now() > advocate.get("code_expires", datetime.now()):
        return jsonify({"error": "Verification code has expired. Please request a new one."}), 400
        
    # Clear the code and log them in
    advocates_col.update_one({"_id": advocate["_id"]}, {"$unset": {"reset_code": "", "code_expires": ""}})
    
    return jsonify({
        "success": True, 
        "advocate": {
            "id": str(advocate['_id']),
            "name": advocate.get('name'),
            "email": advocate.get('email'),
            "access_appointments": advocate.get('access_appointments', False),
            "access_clients": advocate.get('access_clients', False)
        }
    }), 200



@app.route('/api/system-config', methods=['GET'])
def get_system_config():
    config = ensure_daily_passwords()
    config['_id'] = str(config['_id']) if '_id' in config else None
    return jsonify(config), 200

@app.route('/api/advocates/<id>/access', methods=['POST'])
def update_advocate_access(id):
    data = request.json
    try:
        advocates_col.update_one(
            {"_id": ObjectId(id)},
            {"$set": {
                "access_appointments": data.get('access_appointments', False),
                "access_clients": data.get('access_clients', False),
                "access_add_case": data.get('access_add_case', False)
            }}
        )
        return jsonify({"message": "Access updated"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/staff/verify-section', methods=['POST'])
def verify_section_password():
    data = request.json
    section = data.get('section')
    password = data.get('password')
    
    config = ensure_daily_passwords()
    if section == 'appointments' and password == config.get('appointments_password'):
        return jsonify({"valid": True}), 200
    if section == 'clients' and password == config.get('clients_password'):
        return jsonify({"valid": True}), 200
    if section == 'addcase' and password == config.get('addcase_password'):
        return jsonify({"valid": True}), 200
        
    return jsonify({"valid": False, "error": "Incorrect password"}), 401

@app.route('/api/staff/send-section-code', methods=['POST'])
def send_section_code():
    data = request.json
    email = data.get('email')
    
    advocate = advocates_col.find_one({"email": email})
    if not advocate:
        return jsonify({"error": "Email not found"}), 404
        
    # Generate 6 digit code valid for 30s
    code = str(random.randint(100000, 999999))
    expires = datetime.now() + timedelta(seconds=30)
    
    advocates_col.update_one(
        {"email": email},
        {"$set": {"section_code": code, "section_code_expires": expires}}
    )
    
    try:
        msg = MIMEMultipart()
        msg['Subject'] = 'Your Section Verification Code'
        msg['From'] = f"JSM Chambers <{SMTP_USER}>"
        msg['To'] = email
        msg.attach(MIMEText(f"Your verification code is: {code}\nIt will expire in 30 seconds.", 'plain'))
        
        server = smtplib.SMTP(SMTP_HOST, int(SMTP_PORT))
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()
        return jsonify({"message": "Code sent"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/staff/verify-section-code', methods=['POST'])
def verify_section_code():
    data = request.json
    email = data.get('email')
    code = data.get('code')
    
    advocate = advocates_col.find_one({"email": email, "section_code": code})
    if not advocate:
        return jsonify({"valid": False, "error": "Invalid code"}), 400
        
    if datetime.now() > advocate.get("section_code_expires", datetime.now()):
        return jsonify({"valid": False, "error": "Code expired"}), 400
        
    advocates_col.update_one({"_id": advocate["_id"]}, {"$unset": {"section_code": "", "section_code_expires": ""}})
    return jsonify({"valid": True}), 200


@app.route('/api/staff/email-id-card', methods=['POST'])
def email_id_card():
    data = request.json
    email = data.get('email')
    name = data.get('name', 'Staff Member')
    image_data = data.get('image_data')
    
    if not email or not image_data:
        return jsonify({"error": "Missing email or image data"}), 400
        
    try:
        # Extract base64 data (remove data:image/png;base64, prefix)
        if ',' in image_data:
            image_data = image_data.split(',')[1]
            
        import base64
        img_bytes = base64.b64decode(image_data)
        
        msg = MIMEMultipart()
        msg['Subject'] = 'Your Official ID Card'
        msg['From'] = f"JSM Chambers <{SMTP_USER}>"
        msg['To'] = email
        
        body = f"<p>Hello {name},</p><p>Please find your Official ID Card attached.</p><p>You can print it or keep it on your device for access.</p><br><p>Regards,<br>Admin Team</p>"
        msg.attach(MIMEText(body, 'html'))
        
        from email.mime.image import MIMEImage
        img = MIMEImage(img_bytes, _subtype='png', name=f"ID_Card_{name.replace(' ', '_')}.png")
        img.add_header('Content-Disposition', 'attachment', filename=f"ID_Card_{name.replace(' ', '_')}.png")
        msg.attach(img)
        
        send_email_core(email, msg, msg['Subject'])
        return jsonify({"success": True}), 200
    except Exception as e:
        print("Error sending ID card email:", e)
        return jsonify({"error": str(e)}), 500


@app.after_request
def add_header(response):
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "-1"
    return response

if __name__ == '__main__':
    app.run(debug=False, port=8081, host='0.0.0.0')

