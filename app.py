

import os
from flask import Flask, request, jsonify, send_from_directory
from pymongo import MongoClient
from bson import ObjectId
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formatdate, make_msgid
from datetime import datetime

app = Flask(__name__, static_folder='.', static_url_path='')
app.config['SECRET_KEY'] = 'secret!'

# Configuration loaded from Environment Variables
MONGO_URI = os.environ.get("MONGO_URI")
DB_NAME = os.environ.get("DB_NAME", "jsmchambers_db")
SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", 587))
SMTP_USER = os.environ.get("SMTP_USER")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD")

import certifi
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# MongoDB Setup
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

import socket

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
        msg = MIMEMultipart()
        msg['Date'] = formatdate(localtime=True)
        msg['Message-ID'] = make_msgid()
        msg['From'] = f"JSM Chambers <{SMTP_USER}>"
        msg['To'] = recipient_email
        msg['Subject'] = "JSM. Chambers - Your Client Portal Login Details"
        body = f"""JSM Chambers — Client Portal ⚖️\n\nDear {name},\n\nA case file has been successfully opened for you.\nYou can now track your case status, hearing dates, and fees via our Client Portal.\n\nLogin Link: https://my-project-89coqi0xj-arnnav.vercel.app/client-login.html\nEmail: {recipient_email}\nPassword: {password}\n\nThank you,\nJSM Chambers"""
        msg.attach(MIMEText(body, 'plain'))
        with IPv4SMTP(SMTP_HOST, SMTP_PORT) as server:
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
        msg = MIMEMultipart()
        msg['Date'] = formatdate(localtime=True)
        msg['Message-ID'] = make_msgid()
        msg['From'] = f"JSM Chambers <{SMTP_USER}>"
        msg['To'] = recipient_email
        msg['Subject'] = "JSM. Chambers - Login Verification Code"
        body = f"""JSM Chambers — Client Portal ⚖️\n\nYou requested a verification code to access your case file.\n\nYour Verification Code is: {code}\n\nIf you did not request this, please ignore this email."""
        msg.attach(MIMEText(body, 'plain'))
        with IPv4SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_USER, recipient_email, msg.as_string())
        return True
    except Exception as e:
        logging.error(f"Failed to send verification code: {e}")
        return False

# Helper Function: Send Email
def send_approval_email(recipient_email, name, service, date, time):
    if not recipient_email or "@" not in recipient_email:
        logging.error(f"Invalid or missing recipient email address: {recipient_email}")
        return False
        
    if not SMTP_USER or not SMTP_PASSWORD:
        logging.error("SMTP_USER or SMTP_PASSWORD environment variables are missing.")
        return False

    try:
        msg = MIMEMultipart()
        msg['Date'] = formatdate(localtime=True)
        msg['Message-ID'] = make_msgid()
        msg['From'] = f"JSM Chambers <{SMTP_USER}>"
        msg['To'] = recipient_email
        msg['Subject'] = "JSM. Chambers Appointment Approved"

        body = f"""JSM Chambers — Appointment Approved ⚖️

Dear {name},

Your appointment with JSM Chambers has been successfully approved.

📅 Date: {date}
🕐 Time: {time}
📍 Location: JSM Chambers


Please arrive 10–15 minutes before your scheduled appointment time and carry any relevant case documents.

For any changes or assistance, please contact JSM Chambers.

Thank you,
JSM Chambers
Advocates"""
        msg.attach(MIMEText(body, 'plain'))

        # Using IPv4SMTP to prevent Render from crashing on IPv6
        with IPv4SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(SMTP_USER, SMTP_PASSWORD)
            text = msg.as_string()
            server.sendmail(SMTP_USER, recipient_email, text)
            
        logging.info(f"Email sent successfully to {recipient_email}")
        return True
    except smtplib.SMTPAuthenticationError as e:
        logging.error("SMTP Authentication Error: Please check SMTP_USER and SMTP_PASSWORD.")
        return False
    except smtplib.SMTPConnectError as e:
        logging.error(f"SMTP Connection Error: Failed to connect to {SMTP_HOST}:{SMTP_PORT}.")
        return False
    except Exception as e:
        logging.error(f"Failed to send email to {recipient_email}. Error: {e}")
        return False

# ========================
# API Routes

import random
import string

@app.route('/api/cases', methods=['POST'])
def create_case():
    data = request.json
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
    data = request.json
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
    return jsonify({"message": "Case updated successfully"}), 200

@app.route('/api/cases/<id>', methods=['DELETE'])
def delete_case(id):
    cases_col.delete_one({"_id": ObjectId(id)})
    return jsonify({"message": "Deleted successfully"}), 200



@app.route('/api/forgot-password', methods=['POST'])
def forgot_password():
    data = request.json
    email = data.get('email')
    
    # We only want to allow forgot password for active cases
    case = cases_col.find_one({"email": email})
    if not case:
        return jsonify({"error": "Email not found"}), 404
        
    if case.get('status') == 'Finished & Archived':
        return jsonify({"error": "Your case file has been closed. Portal access is disabled."}), 403
        
    code = ''.join(random.choices(string.digits, k=6))
    cases_col.update_one({"email": email}, {"$set": {"verification_code": code}})
    
    email_sent = send_verification_email(email, code)
    if email_sent:
        return jsonify({"message": "Code sent successfully"}), 200
    else:
        return jsonify({"error": "Failed to send email. Please contact support."}), 500


@app.route('/api/verify-code', methods=['POST'])
def verify_code():
    data = request.json
    email = data.get('email')
    code = data.get('code')
    
    case = cases_col.find_one({"email": email, "verification_code": code})
    if case:
        # Clear the code after successful use
        cases_col.update_one({"email": email}, {"$unset": {"verification_code": ""}})
        case['_id'] = str(case['_id'])
        return jsonify({"message": "Login successful", "case": case}), 200
        
    return jsonify({"error": "Invalid or expired verification code"}), 401


@app.route('/api/cases/<case_id>/email', methods=['POST'])
def send_case_email(case_id):
    data = request.json
    subject = data.get('subject', 'Update on your Case')
    message = data.get('message', '')
    
    case = cases_col.find_one({"_id": ObjectId(case_id)})
    if not case: return jsonify({"error": "Case not found"}), 404
    
    email = case.get('email')
    if not email: return jsonify({"error": "No email for this client"}), 400
    
    if not SMTP_USER or not SMTP_PASSWORD:
        return jsonify({"error": "Email server not configured"}), 500
        
    try:
        msg = MIMEMultipart()
        msg['Date'] = formatdate(localtime=True)
        msg['Message-ID'] = make_msgid()
        msg['From'] = f"JSM Chambers <{SMTP_USER}>"
        msg['To'] = email
        msg['Subject'] = subject
        msg.attach(MIMEText(message, 'plain'))
        
        with IPv4SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_USER, email, msg.as_string())
            
        return jsonify({"message": "Email sent successfully"}), 200
    except Exception as e:
        logging.error(f"Failed to send email to {email}: {e}")
        return jsonify({"error": "Failed to send email"}), 500


@app.route('/api/cases/<case_id>/finish', methods=['POST'])
def finish_case(case_id):
    case = cases_col.find_one({"_id": ObjectId(case_id)})
    if not case: return jsonify({"error": "Case not found"}), 404
    
    total = int(case.get('total_fee', 0) or 0)
    paid = int(case.get('fee_paid', 0) or 0)
    email = case.get('email')
    client_name = case.get('client_name', 'Client')
    
    if paid >= total:
        # Fully paid! Send Congratulations email.
        try:
            if email and SMTP_USER and SMTP_PASSWORD:
                msg = MIMEMultipart()
                msg['Date'] = formatdate(localtime=True)
                msg['Message-ID'] = make_msgid()
                msg['From'] = f"JSM Chambers <{SMTP_USER}>"
                msg['To'] = email
                msg['Subject'] = "Congratulations - Your Case is Successfully Concluded"
                body = f"""Dear {client_name},

Congratulations! Your case has been successfully concluded and all fees are settled.

Your Client Portal access has now been securely deactivated as the case file is closed and archived.

If you need our legal services again in the future, please do not hesitate to contact us.

Warm regards,
JSM. Chambers"""
                msg.attach(MIMEText(body, 'plain'))
                with IPv4SMTP(SMTP_HOST, SMTP_PORT) as server:
                    server.ehlo()
                    server.starttls()
                    server.ehlo()
                    server.login(SMTP_USER, SMTP_PASSWORD)
                    server.sendmail(SMTP_USER, email, msg.as_string())
        except Exception as e:
            logging.error(f"Failed to send congratulations email: {e}")

        # Archive it. Remove password.
        cases_col.update_one(
            {"_id": ObjectId(case_id)}, 
            {"$set": {"status": "Finished & Archived"}, "$unset": {"password": ""}}
        )
        return jsonify({"message": "Case finished and archived. Customer portal access revoked and Congratulations email sent."}), 200
    else:
        # Not paid. Mark as finished but keep portal access active.
        cases_col.update_one(
            {"_id": ObjectId(case_id)},
            {"$set": {"status": "Finished - Unpaid Balance"}}
        )
        return jsonify({
            "message": f"Case finished but not paying ₹{total - paid} amount.",
            "unpaid": total - paid
        }), 200



@app.route('/api/client-login', methods=['POST'])
def client_login():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    
    case = cases_col.find_one({"email": email, "password": password})
    if case:
        if case.get('status') == 'Finished & Archived':
            return jsonify({"error": "Your case file has been closed. Portal access is disabled."}), 403
            
        case['_id'] = str(case['_id'])
        return jsonify({"message": "Login successful", "case": case}), 200
        
    return jsonify({"error": "Invalid email or password"}), 401


@app.route('/api/my-case/<id>', methods=['GET'])
def get_my_case(id):
    case = cases_col.find_one({"_id": ObjectId(id)})
    if case:
        case['_id'] = str(case['_id'])
        return jsonify(case), 200
    return jsonify({"error": "Not found"}), 404


# ========================

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/api/appointments', methods=['POST'])
def create_appointment():
    data = request.json
    appointment = {
        "name": data.get('name'),
        "email": data.get('email'),
        "service": data.get('service'),
        "request_date": datetime.now().strftime("%d %b %Y"),
        "status": "Pending",
        "appointment_date": "",
        "appointment_time": ""
    }
    result = appointments_col.insert_one(appointment)
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

    # Update DB
    try:
        result = appointments_col.update_one(
            {"_id": ObjectId(appt_id)},
            {"$set": {
                "status": "Approved",
                "appointment_date": date,
                "appointment_time": time
            }}
        )
        if result.modified_count == 0 and result.matched_count == 0:
             logging.warning(f"No appointment found to update for ID {appt_id}")
             return jsonify({"error": "Failed to update database"}), 500
    except Exception as e:
        logging.error(f"Database update failed during approval for {appt_id}: {e}")
        return jsonify({"error": "Database update failed"}), 500

    # Send Email only if DB update succeeded
    email_sent = send_approval_email(appt.get('email'), appt.get('name'), appt.get('service'), date, time)

    if email_sent:
        logging.info(f"Approval successful and email sent for appointment {appt_id}")
    else:
        logging.warning(f"Approval successful but email failed for appointment {appt_id}")

    return jsonify({
        "message": "Appointment approved successfully",
        "email_sent": email_sent
    }), 200

@app.route('/api/appointments/<id>', methods=['DELETE'])
def delete_appointment(id):
    result = appointments_col.delete_one({"_id": ObjectId(id)})
    if result.deleted_count > 0:
        return jsonify({"message": "Deleted successfully"}), 200
    return jsonify({"error": "Not found"}), 404

@app.route('/api/appointments', methods=['DELETE'])
def delete_all_appointments():
    result = appointments_col.delete_many({})
    return jsonify({"message": f"Deleted {result.deleted_count} appointments"}), 200

@app.route('/api/advocates', methods=['GET'])
def get_advocates():
    advs = []
    for adv in advocates_col.find():
        adv['_id'] = str(adv['_id'])
        advs.append(adv)
    return jsonify(advs), 200

@app.route('/api/advocates', methods=['POST'])
def add_advocate():
    data = request.json
    adv = {
        "name": data.get('name'),
        "specialty": data.get('specialty'),
        "imageUrl": data.get('imageUrl', '')
    }
    result = advocates_col.insert_one(adv)
    return jsonify({"message": "Advocate added", "id": str(result.inserted_id)}), 201

@app.route('/api/advocates/<id>', methods=['DELETE'])
def delete_advocate(id):
    result = advocates_col.delete_one({"_id": ObjectId(id)})
    if result.deleted_count > 0:
        return jsonify({"message": "Deleted successfully"}), 200
    return jsonify({"error": "Not found"}), 404

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 8081))
    app.run(host='0.0.0.0', port=port, debug=False)
