import os
from flask import Flask, request, jsonify, send_from_directory
from pymongo import MongoClient
from bson import ObjectId
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formatdate, make_msgid
from datetime import datetime
import certifi
import logging
import socket
import random
import string

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

app = Flask(__name__, static_folder='.', static_url_path='')
app.config['SECRET_KEY'] = 'secret!'

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
    cases_col = db['cases']
    logging.info("Successfully connected to MongoDB")
except Exception as e:
    logging.error(f"Error connecting to MongoDB: {e}")

class IPv4SMTP(smtplib.SMTP):
    def _get_socket(self, host, port, timeout):
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        if timeout is not None and timeout is not socket._GLOBAL_DEFAULT_TIMEOUT:
            sock.settimeout(timeout)
        sock.connect((host, port))
        return sock

def send_credentials_email(recipient_email, name, password):
    if not recipient_email or "@" not in recipient_email: return False
    if not SMTP_USER or not SMTP_PASSWORD: return False
    try:
        msg = MIMEMultipart('alternative')
        msg['Date'] = formatdate(localtime=True)
        msg['Message-ID'] = make_msgid()
        msg['From'] = f"JSM Chambers <{SMTP_USER}>"
        msg['To'] = recipient_email
        msg['Subject'] = "JSM. Chambers - Your Client Portal Login Details"
        
        text = f"""Dear {name},\n\nA case file has been successfully opened for you.\nYou can now track your case status, hearing dates, and fees via our Client Portal.\n\nLogin Link: https://jsmchambers.vercel.app/client-login.html\nEmail: {recipient_email}\nPassword: {password}\n\nThank you,\nJSM Chambers"""
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
        with IPv4SMTP(SMTP_HOST, SMTP_PORT, timeout=5) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_USER, recipient_email, msg.as_string())
        return True
    except Exception as e:
        logging.error(f"Failed to send credentials: {e}")
        return False

def send_verification_email(recipient_email, code):
    if not recipient_email or "@" not in recipient_email: return False
    if not SMTP_USER or not SMTP_PASSWORD: return False
    try:
        msg = MIMEMultipart('alternative')
        msg['Date'] = formatdate(localtime=True)
        msg['Message-ID'] = make_msgid()
        msg['From'] = f"JSM Chambers <{SMTP_USER}>"
        msg['To'] = recipient_email
        msg['Subject'] = "JSM. Chambers - Login Verification Code"
        
        text = f"""You requested a verification code to access your case file.\n\nYour Verification Code is: {code}\n\nIf you did not request this, please ignore this email."""
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
        with IPv4SMTP(SMTP_HOST, SMTP_PORT, timeout=5) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_USER, recipient_email, msg.as_string())
        return True
    except Exception as e:
        logging.error(f"Failed to send verification code: {e}")
        return False

def send_appointment_received_email(recipient_email, name, service):
    if not recipient_email or "@" not in recipient_email: return False
    if not SMTP_USER or not SMTP_PASSWORD: return False
    try:
        # 1. Send confirmation to the client
        msg = MIMEMultipart('alternative')
        msg['Date'] = formatdate(localtime=True)
        msg['Message-ID'] = make_msgid()
        msg['From'] = f"JSM Chambers <{SMTP_USER}>"
        msg['To'] = recipient_email
        msg['Subject'] = "JSM. Chambers - Appointment Request Received"
        text = f"""Dear {name},\n\nWe have successfully received your appointment request for: {service}.\n\nOur administrative team will review your request and set a Date and Time for your consultation. You will receive another email once your appointment is confirmed.\n\nThank you,\nJSM Chambers"""
        html = f"""
        <html><body style="font-family: Arial, sans-serif; color: #333;">
        <h2 style="color: #0A192F;">JSM. Chambers - Legal Services</h2>
        <p>Dear {name},</p>
        <p>We have successfully received your appointment request for: <strong>{service}</strong>.</p>
        <p>Our administrative team will review your request and set a Date and Time for your consultation. You will receive another email once your appointment is confirmed.</p>
        <p>Thank you,<br><strong>JSM Chambers</strong></p>
        </body></html>
        """
        msg.attach(MIMEText(text, 'plain', 'utf-8'))
        msg.attach(MIMEText(html, 'html', 'utf-8'))

        # 2. Send notification to the ADMIN
        admin_msg = MIMEMultipart('alternative')
        admin_msg['Date'] = formatdate(localtime=True)
        admin_msg['Message-ID'] = make_msgid()
        admin_msg['From'] = f"JSM Chambers <{SMTP_USER}>"
        admin_msg['To'] = SMTP_USER
        admin_msg['Subject'] = f"New Appointment Request: {name}"
        admin_text = f"""You have a new appointment request.\n\nClient Name: {name}\nEmail: {recipient_email}\nService: {service}\n\nPlease log into the Admin Dashboard to approve and set a date/time."""
        admin_html = f"""
        <html><body style="font-family: Arial, sans-serif; color: #333;">
        <h2 style="color: #0A192F;">New Appointment Request</h2>
        <p><strong>Client Name:</strong> {name}</p>
        <p><strong>Email:</strong> {recipient_email}</p>
        <p><strong>Service:</strong> {service}</p>
        <p>Please log into the Admin Dashboard to approve and schedule this appointment.</p>
        </body></html>
        """
        admin_msg.attach(MIMEText(admin_text, 'plain', 'utf-8'))
        admin_msg.attach(MIMEText(admin_html, 'html', 'utf-8'))

        with IPv4SMTP(SMTP_HOST, SMTP_PORT, timeout=5) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_USER, recipient_email, msg.as_string())
            server.sendmail(SMTP_USER, SMTP_USER, admin_msg.as_string())
        return True
    except Exception as e:
        logging.error(f"Failed to send appointment received email: {e}")
        return False

@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

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
    send_appointment_received_email(email, name, service)
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
    data = request.get_json(force=True, silent=True) or {}
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
            msg['Subject'] = "JSM. Chambers - Appointment Approved"
            
            text = f"""Dear {appt['name']},\n\nYour appointment for {appt['service']} has been APPROVED.\nDate: {date}\nTime: {time}\n\nThank you,\nJSM Chambers"""
            html = f"""
            <html><body style="font-family: Arial, sans-serif; color: #333;">
            <h2 style="color: #0A192F;">Appointment Confirmed</h2>
            <p>Dear {appt['name']},</p>
            <p>Your appointment for <strong>{appt['service']}</strong> has been successfully approved.</p>
            <p><strong>Date:</strong> {date}<br>
            <strong>Time:</strong> {time}</p>
            <p>Thank you,<br><strong>JSM Chambers</strong></p>
            </body></html>
            """
            msg.attach(MIMEText(text, 'plain', 'utf-8'))
            msg.attach(MIMEText(html, 'html', 'utf-8'))
            with IPv4SMTP(SMTP_HOST, SMTP_PORT, timeout=5) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.sendmail(SMTP_USER, appt['email'], msg.as_string())
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
        "total_fee": "0",
        "fee_paid": "0",
        "next_hearing": "To Be Decided",
        "notes": "",
        "created_at": datetime.now().strftime("%d %b %Y")
    }
    result = cases_col.insert_one(case)
    email_sent = send_credentials_email(case['email'], case['client_name'], password)
    return jsonify({"message": "Case created", "id": str(result.inserted_id), "password": password, "email_sent": email_sent}), 201

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

@app.route('/api/cases/<id>', methods=['PUT'])
def update_case(id):
    data = request.get_json(force=True, silent=True) or {}
    cases_col.update_one(
        {"_id": ObjectId(id)},
        {"$set": {
            "status": data.get('status', 'Under Review'),
            "total_fee": data.get('total_fee', '0'),
            "fee_paid": data.get('fee_paid', '0'),
            "next_hearing": data.get('next_hearing', 'To Be Decided'),
            "notes": data.get('notes', '')
        }}
    )
    return jsonify({"message": "Case updated"}), 200

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
    if email and SMTP_USER and SMTP_PASSWORD:
        msg = MIMEMultipart('alternative')
        msg['Date'] = formatdate(localtime=True)
        msg['Message-ID'] = make_msgid()
        msg['From'] = f"JSM Chambers <{SMTP_USER}>"
        msg['To'] = email
        msg['Subject'] = "JSM. Chambers - Case Finalized"
        
        text = f"""Dear {name},\n\nCongratulations! Your case file has been marked as Finished.\nAccess to the portal has been revoked.\nIf you require further assistance in the future, please feel free to reach out to us again.\n\nThank you,\nJSM Chambers"""
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
        try:
            with IPv4SMTP(SMTP_HOST, SMTP_PORT, timeout=5) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.sendmail(SMTP_USER, email, msg.as_string())
        except Exception as e:
            logging.error(e)
    return jsonify({"message": "Case Finished & Archived Successfully!"}), 200

@app.route('/api/cases/<id>/email', methods=['POST'])
def send_case_email(id):
    data = request.get_json(force=True, silent=True) or {}
    subject = data.get('subject')
    message_body = data.get('message')
    if not subject or not message_body:
        return jsonify({"error": "Missing subject or message"}), 400
    case = cases_col.find_one({"_id": ObjectId(id)})
    if not case:
        return jsonify({"error": "Case not found"}), 404
    email = case.get('email')
    if not email:
        return jsonify({"error": "Client has no email on file"}), 400
    try:
        msg = MIMEMultipart('alternative')
        msg['Date'] = formatdate(localtime=True)
        msg['Message-ID'] = make_msgid()
        msg['From'] = f"JSM Chambers <{SMTP_USER}>"
        msg['To'] = email
        msg['Subject'] = subject
        
        text = f"Message from JSM Chambers:\n\n{message_body}"
        html = f"""
        <html><body style="font-family: Arial, sans-serif; color: #333;">
        <h2 style="color: #0A192F;">Message from JSM Chambers</h2>
        <p style="white-space: pre-wrap;">{message_body}</p>
        </body></html>
        """
        msg.attach(MIMEText(text, 'plain', 'utf-8'))
        msg.attach(MIMEText(html, 'html', 'utf-8'))
        
        with IPv4SMTP(SMTP_HOST, SMTP_PORT, timeout=5) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_USER, email, msg.as_string())
        return jsonify({"message": "Email sent"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

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

if __name__ == '__main__':
    app.run(debug=False, port=8081, host='0.0.0.0')
