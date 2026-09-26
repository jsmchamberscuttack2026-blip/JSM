from datetime import timedelta
import concurrent.futures
import os
from flask import Flask, request, jsonify, send_from_directory, send_file
from pymongo import MongoClient
from bson import ObjectId
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from email.utils import formatdate, make_msgid
from datetime import datetime, timedelta
from fpdf import FPDF
import io
import math
import random
import certifi
import logging
import socket
import random
import string
import json
from dotenv import load_dotenv
from groq import Groq

# Load environment variables from .env
load_dotenv()

# Setup Groq API
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
if GROQ_API_KEY:
    groq_client = Groq(api_key=GROQ_API_KEY)
else:
    groq_client = None

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')


app = Flask(__name__, static_folder='.', static_url_path='')

@app.errorhandler(Exception)
def handle_exception(e):
    logging.error(f"Global Exception: {str(e)}")
    return jsonify({"error": "Internal Server Error", "details": str(e)}), 500

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
    gallery_col = db['gallery']
    ai_audit_logs_col = db['ai_audit_logs']
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


@app.route('/api/appointments/vacancy', methods=['GET'])
def get_appointment_vacancy():
    date_str = request.args.get('date')
    if not date_str:
        return jsonify({"error": "Missing date"}), 400
        
    try:
        parsed_date = datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        return jsonify({"error": "Invalid date"}), 400
        
    config = config_col.find_one({"_id": "global_config"}) or {}
    settings = config.get("appointment_settings", {})
    available_days = settings.get("available_days", ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"])
    max_per_day = int(settings.get("max_per_day", 5))
    
    day_name = parsed_date.strftime("%A")
    if day_name not in available_days:
        return jsonify({"available": False, "message": f"Closed on {day_name}s"}), 200
        
    if parsed_date.date() == datetime.now().date():
        sh, sm = map(int, settings.get("start_time", "10:00").split(':'))
        start_time_dt = datetime.now().replace(hour=sh, minute=sm, second=0, microsecond=0)
        if datetime.now() > start_time_dt:
            return jsonify({"available": False, "message": "Booking closed for today"}), 200
            
    count = appointments_col.count_documents({"appointment_date": date_str})
    remaining = max_per_day - count
    
    if remaining <= 0:
        return jsonify({"available": False, "message": "Fully booked"}), 200
        
    return jsonify({"available": True, "remaining": remaining}), 200



@app.route('/api/appointments/download', methods=['GET'])
def download_appointments_by_date():
    target_date = request.args.get('date')
    if not target_date:
        target_date = datetime.now().strftime("%Y-%m-%d")
        
    appointments = list(appointments_col.find({"appointment_date": target_date}).sort("appointment_time", 1))
    
    pdf = FPDF()
    pdf.add_page()
    
    try:
        pdf.image('assets/images/advocate_logo.jpg', x=85, y=10, w=40)
    except:
        pass
        
    pdf.set_font("Arial", 'B', 16)
    pdf.ln(40)
    pdf.cell(200, 10, txt=f"JSM Chambers - Appointments for {target_date}", ln=1, align='C')
    pdf.ln(10)
    
    if not appointments:
        pdf.set_font("Arial", size=12)
        pdf.cell(200, 10, txt=f"No appointments scheduled for {target_date}.", ln=1, align='C')
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
        download_name=f'Appointments_{target_date}.pdf'
    )

@app.route('/api/appointments', methods=['POST'])
def create_appointment():
    # Check if appointments are open
    settings = settings_col.find_one({"_id": "office_info"}) or {}
    if settings.get('appointments_open', True) is False:
        return jsonify({"error": "Appointments are currently locked by the administrator. Please try again later."}), 403

    data = request.get_json(force=True, silent=True) or {}
    name = data.get('name')
    email = data.get('email')
    subject = data.get('subject', 'General Consultation')
    requested_date = data.get('date')
    
    if not requested_date:
        return jsonify({"error": "Please select an appointment date."}), 400
        
    try:
        parsed_date = datetime.strptime(requested_date, "%Y-%m-%d")
    except ValueError:
        return jsonify({"error": "Invalid date format."}), 400
        
    if parsed_date.date() < datetime.now().date():
        return jsonify({"error": "Cannot book appointments in the past."}), 400

    # Auto-assign logic based on settings
    config = config_col.find_one({"_id": "global_config"}) or {}
    settings = config.get("appointment_settings", {})
    
    # Booking window check
    booking_start = settings.get("booking_start", "00:00")
    booking_end = settings.get("booking_end", "23:59")
    
    now = datetime.now()
    try:
        b_sh, b_sm = map(int, booking_start.split(':'))
        b_eh, b_em = map(int, booking_end.split(':'))
        start_m = b_sh * 60 + b_sm
        end_m = b_eh * 60 + b_em
        now_m = now.hour * 60 + now.minute
        
        allowed = False
        if start_m <= end_m:
            allowed = start_m <= now_m <= end_m
        else:
            # Overnight window (e.g. 09:00 PM to 09:00 AM)
            allowed = now_m >= start_m or now_m <= end_m
            
        if not allowed:
            def format_time_12hr(total_m):
                h = int(total_m // 60)
                m = int(total_m % 60)
                ampm = "AM" if h < 12 else "PM"
                dh = h if h <= 12 else h - 12
                if dh == 0: dh = 12
                return f"{dh:02d}:{m:02d} {ampm}"
                
            b_start_str = format_time_12hr(start_m)
            b_end_str = format_time_12hr(end_m)
            
            return jsonify({"error": f"Online booking is only available during our booking window: {b_start_str} to {b_end_str}. Please try again later."}), 400
    except Exception as e:
        pass
        
    available_days = settings.get("available_days", ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"])
    start_time_str = settings.get("start_time", "10:00")
    end_time_str = settings.get("end_time", "17:00")
    max_per_day = int(settings.get("max_per_day", 5))
    
    day_name = parsed_date.strftime("%A")
    if day_name not in available_days:
        return jsonify({"error": f"We do not accept appointments on {day_name}s. Please choose an available day: {', '.join(available_days)}."}), 400
        
    if parsed_date.date() == datetime.now().date():
        sh, sm = map(int, start_time_str.split(':'))
        start_time_dt = datetime.now().replace(hour=sh, minute=sm, second=0, microsecond=0)
        if datetime.now() > start_time_dt:
            return jsonify({"error": "Same-day bookings are not allowed after the day's start time has passed. Please select a future date."}), 400

    date_str = requested_date
    
    # Check if the date is emergency blocked
    blocked = settings.get("blocked_dates", []) if isinstance(settings, dict) else []
    if date_str in blocked:
        return jsonify({"error": "This day is fully booked due to an emergency shift. No slots available."}), 400
        
    count = appointments_col.count_documents({"appointment_date": date_str})
    
    if count >= max_per_day:
        return jsonify({"error": "This day is fully booked. Please select another date."}), 400
        
    # calculate precise time slot
    slot_duration = int(settings.get("slot_duration", 30))
    sh, sm = map(int, start_time_str.split(':'))
    
    start_mins = (sh*60 + sm) + (count * slot_duration)
    end_mins = start_mins + slot_duration
    
    def format_time_12hr(total_m):
        h = int(total_m // 60)
        m = int(total_m % 60)
        ampm = "AM" if h < 12 else "PM"
        dh = h if h <= 12 else h - 12
        if dh == 0: dh = 12
        return f"{dh:02d}:{m:02d} {ampm}"
        
    assigned_time = f"{format_time_12hr(start_mins)} - {format_time_12hr(end_mins)}"
    assigned_date = date_str
        
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
    

    settings_doc = settings_col.find_one({"_id": "office_info"}) or {}
    chamber_address = settings_doc.get('address', 'Cuttack, Odisha')
    chamber_email = settings_doc.get('email', 'jsmchamberscuttack2026@gmail.com')
    chamber_phone = settings_doc.get('phone', '+91 0000000000')

    # Send Email with HTML template
    try:
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText
        from email.utils import formatdate, make_msgid
        
        msg = MIMEMultipart('alternative')
        msg['Date'] = formatdate(localtime=True)
        msg['Message-ID'] = make_msgid()
        msg['From'] = f"JSM Chambers <{SMTP_USER}>"
        msg['To'] = email
        subject = "Confirmation of Your Consultation Appointment with JSM. Chambers"
        msg['Subject'] = subject
        
        text = f"""Dear {name},

Thank you for choosing JSM. Chambers. Your consultation appointment has been successfully confirmed.

Appointment Details:
Date: {assigned_date}
Time: {assigned_time}

Location:
{chamber_address}

Please arrive 10 minutes prior to your scheduled time and bring any relevant documents related to your legal matter.
If you need to reschedule or cancel, please contact us at least 24 hours in advance.

Email: {chamber_email}
Phone: {chamber_phone}

Warm regards,
JSM. Chambers Team"""

        html = f"""
        <html>
        <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #0A192F; padding: 25px; text-align: center;">
                <h1 style="margin: 0; font-family: 'Georgia', serif; font-size: 28px; color: #ffffff;">JSM. Chambers</h1>
                <p style="margin: 8px 0 0 0; font-size: 14px; color: #D4AF37; text-transform: uppercase; letter-spacing: 2px; font-weight: bold;">Law Firm Confirmation Email</p>
            </div>
            <div style="padding: 35px; background-color: #ffffff;">
                <p style="font-size: 16px;">Dear <strong>{name}</strong>,</p>
                <p style="font-size: 15px; color: #444;">Thank you for choosing JSM. Chambers. We are writing to confirm that your consultation appointment has been successfully confirmed by our team.</p>
                
                <div style="background-color: #f8fafc; border-left: 4px solid #D4AF37; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
                    <h3 style="margin-top: 0; color: #0A192F; font-size: 18px; margin-bottom: 15px;">Appointment Details</h3>
                    <p style="margin: 8px 0; font-size: 15px;"><strong>📅 Date:</strong> {assigned_date}</p>
                    <p style="margin: 8px 0; font-size: 15px;"><strong>⏰ Time:</strong> {assigned_time}</p>
                </div>

                <h3 style="color: #0A192F; font-size: 18px; margin-bottom: 10px;">Location</h3>
                <p style="margin: 5px 0; font-size: 15px;"><strong>📍 Address:</strong> {chamber_address}</p>
                
                <h3 style="color: #0A192F; font-size: 18px; margin-top: 30px; margin-bottom: 10px;">Important Instructions</h3>
                <ul style="padding-left: 20px; margin-top: 0; font-size: 15px; color: #444;">
                    <li style="margin-bottom: 5px;">Please arrive 10 minutes prior to your scheduled time.</li>
                    <li style="margin-bottom: 5px;">Bring any relevant documents, notices, or prior case files related to your legal matter.</li>
                    <li style="margin-bottom: 5px;">If you need to reschedule or cancel, please contact us at least 24 hours in advance.</li>
                </ul>
                
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
                
                <p style="margin-top: 0; font-size: 15px; color: #444;">For any inquiries, please contact us:</p>
                <p style="margin: 5px 0; font-size: 15px;"><strong>✉️ Email:</strong> {chamber_email}</p>
                <p style="margin: 5px 0; font-size: 15px;"><strong>📞 Phone:</strong> {chamber_phone}</p>
                
                <p style="margin-top: 35px; font-size: 16px;">Warm regards,<br><strong style="color: #0A192F; font-size: 18px;">JSM. Chambers Team</strong></p>
            </div>
            <div style="background-color: #f1f5f9; text-align: center; padding: 20px; font-size: 12px; color: #64748b;">
                <p style="margin: 0;">This is an automated appointment confirmation email. Please do not reply directly to this email address.</p>
            </div>
        </body>
        </html>
        """
        msg.attach(MIMEText(text, 'plain', 'utf-8'))
        msg.attach(MIMEText(html, 'html', 'utf-8'))
        
        send_email_core(email, msg, subject)
        log_email(email, "Appointment Confirmed - JSM Chambers", "Sent", "250 OK")
    except Exception as e:
        log_email(email, "Appointment Confirmed - JSM Chambers", "Failed", str(e))
        logging.error(f"Error sending email: {e}")

    return jsonify({"message": "Appointment created and assigned successfully", "id": str(result.inserted_id), "date": assigned_date, "time": assigned_time}), 201


@app.route('/api/appointments/shift', methods=['POST'])
def shift_appointments():
    data = request.json
    password = data.get('password')
    if password != 'JAYA@CDA11':
        return jsonify({"error": "Invalid Admin Password"}), 401
        
    old_date = data.get('old_date')
    new_date = data.get('new_date')
    start_time_str = data.get('start_time')
    end_time_str = data.get('end_time')
    
    if not old_date or not new_date or not start_time_str or not end_time_str:
        return jsonify({"error": "Missing required fields"}), 400
        
    appts = list(appointments_col.find({"appointment_date": old_date}))
    if not appts:
        return jsonify({"error": "No appointments found on the selected original date."}), 400
        
    config = config_col.find_one({"_id": "global_config"}) or {}
    settings = config.get("appointment_settings", {})
    max_per_day = int(settings.get("max_per_day", 5))
    
    new_date_count = appointments_col.count_documents({"appointment_date": new_date})
    if new_date_count + len(appts) > max_per_day:
        return jsonify({"error": f"No available slots! The new date can only accept {max_per_day - new_date_count} more appointments, but you are shifting {len(appts)}."}), 400
        
    office_info = settings_col.find_one({"_id": "office_info"}) or {"_id": "office_info"}
    blocked = office_info.get("blocked_dates", [])
    if old_date not in blocked:
        blocked.append(old_date)
    settings_col.update_one({"_id": "office_info"}, {"$set": {"blocked_dates": blocked}}, upsert=True)
    
    try:
        sh, sm = map(int, start_time_str.split(':'))
        eh, em = map(int, end_time_str.split(':'))
    except ValueError:
        return jsonify({"error": "Invalid time format"}), 400
        
    start_mins = sh * 60 + sm
    end_mins = eh * 60 + em
    if end_mins <= start_mins:
        return jsonify({"error": "End time must be after start time."}), 400
        
    duration_per_appt = (end_mins - start_mins) / len(appts)
    
    def format_time_12hr(total_m):
        h = int(total_m // 60)
        m = int(total_m % 60)
        ampm = "AM" if h < 12 else "PM"
        dh = h if h <= 12 else h - 12
        if dh == 0: dh = 12
        return f"{dh:02d}:{m:02d} {ampm}"
        
    for i, appt in enumerate(appts):
        slot_start = start_mins + (i * duration_per_appt)
        slot_end = slot_start + duration_per_appt
        new_time = f"{format_time_12hr(slot_start)} - {format_time_12hr(slot_end)}"
        
        appointments_col.update_one({"_id": appt["_id"]}, {"$set": {
            "appointment_date": new_date,
            "appointment_time": new_time,
            "shifted": True
        }})
        
        client_email = appt.get("email")
        if client_email:
            try:
                msg = MIMEMultipart('alternative')
                msg['Subject'] = 'EMERGENCY UPDATE: Appointment Date Shifted - JSM Chambers'
                msg['From'] = SMTP_USER
                msg['To'] = client_email
                body_html = f"""
                <html>
                <body style="font-family: Arial, sans-serif; color: #333;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-top: 4px solid #D32F2F;">
                        <h2 style="color: #D32F2F;">Appointment Rescheduled</h2>
                        <p>Dear {appt.get('name', 'Client')},</p>
                        <p>Due to an unforeseen emergency at the chamber, your upcoming appointment on <strong>{old_date}</strong> has been shifted to a new date.</p>
                        <div style="background: #f8fafc; padding: 15px; margin: 20px 0; border-radius: 5px;">
                            <h3 style="margin-top: 0; color: #0A192F;">Your New Appointment Details</h3>
                            <p><strong>New Date:</strong> {new_date}</p>
                            <p><strong>New Time:</strong> {new_time}</p>
                        </div>
                        <p>We apologize for any inconvenience this may cause. If this new time does not work for you, please contact us immediately.</p>
                        <p>Regards,<br><strong>JSM Chambers</strong></p>
                    </div>
                </body>
                </html>
                """
                msg.attach(MIMEText(body_html, 'html'))
                server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
                server.starttls()
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.send_message(msg)
                server.quit()
                log_email(client_email, "Appointment Shifted", "Sent", "250 OK")
            except Exception as e:
                log_email(client_email, "Appointment Shifted", "Failed", str(e))
                logging.error(f"Error sending shift email: {e}")

    return jsonify({"message": f"Successfully shifted {len(appts)} appointments to {new_date}. Emails sent to all clients."}), 200

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
            subject = "Confirmation of Your Consultation Appointment with JSM. Chambers"
            msg['Subject'] = subject
            
            settings = settings_col.find_one({"_id": "office_info"}) or {}
            chamber_address = settings.get('address', 'Cuttack, Odisha')
            chamber_email = settings.get('email', 'jsmchamberscuttack2026@gmail.com')
            chamber_phone = settings.get('phone', '+91 0000000000')
            
            text = f"""Dear {appt['name']},

Thank you for choosing JSM. Chambers. Your consultation appointment has been successfully confirmed.

Appointment Details:
Date: {date}
Time: {time}

Location:
{chamber_address}

Please arrive 10 minutes prior to your scheduled time and bring any relevant documents related to your legal matter.
If you need to reschedule or cancel, please contact us at least 24 hours in advance.

Email: {chamber_email}
Phone: {chamber_phone}

Warm regards,
JSM. Chambers Team"""
            html = f"""
            <html>
            <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
                <div style="background-color: #0A192F; padding: 25px; text-align: center;">
                    <h1 style="margin: 0; font-family: 'Georgia', serif; font-size: 28px; color: #ffffff;">JSM. Chambers</h1>
                    <p style="margin: 8px 0 0 0; font-size: 14px; color: #D4AF37; text-transform: uppercase; letter-spacing: 2px; font-weight: bold;">Law Firm Confirmation Email</p>
                </div>
                <div style="padding: 35px; background-color: #ffffff;">
                    <p style="font-size: 16px;">Dear <strong>{appt['name']}</strong>,</p>
                    <p style="font-size: 15px; color: #444;">Thank you for choosing JSM. Chambers. We are writing to confirm that your consultation appointment has been successfully confirmed by our team.</p>
                    
                    <div style="background-color: #f8fafc; border-left: 4px solid #D4AF37; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
                        <h3 style="margin-top: 0; color: #0A192F; font-size: 18px; margin-bottom: 15px;">Appointment Details</h3>
                        <p style="margin: 8px 0; font-size: 15px;"><strong>📅 Date:</strong> {date}</p>
                        <p style="margin: 8px 0; font-size: 15px;"><strong>⏰ Time:</strong> {time}</p>
                    </div>

                    <h3 style="color: #0A192F; font-size: 18px; margin-bottom: 10px;">Location</h3>
                    <p style="margin: 5px 0; font-size: 15px;"><strong>📍 Address:</strong> {chamber_address}</p>
                    
                    <h3 style="color: #0A192F; font-size: 18px; margin-top: 30px; margin-bottom: 10px;">Important Instructions</h3>
                    <ul style="padding-left: 20px; margin-top: 0; font-size: 15px; color: #444;">
                        <li style="margin-bottom: 5px;">Please arrive 10 minutes prior to your scheduled time.</li>
                        <li style="margin-bottom: 5px;">Bring any relevant documents, notices, or prior case files related to your legal matter.</li>
                        <li style="margin-bottom: 5px;">If you need to reschedule or cancel, please contact us at least 24 hours in advance.</li>
                    </ul>
                    
                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
                    
                    <p style="margin-top: 0; font-size: 15px; color: #444;">For any inquiries, please contact us:</p>
                    <p style="margin: 5px 0; font-size: 15px;"><strong>✉️ Email:</strong> {chamber_email}</p>
                    <p style="margin: 5px 0; font-size: 15px;"><strong>📞 Phone:</strong> {chamber_phone}</p>
                    
                    <p style="margin-top: 35px; font-size: 16px;">Warm regards,<br><strong style="color: #0A192F; font-size: 18px;">JSM. Chambers Team</strong></p>
                </div>
                <div style="background-color: #f1f5f9; text-align: center; padding: 20px; font-size: 12px; color: #64748b;">
                    <p style="margin: 0;">This is an automated appointment confirmation email. Please do not reply directly to this email address.</p>
                </div>
            </body>
            </html>
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

@app.route('/api/email-logs/staff/<path:email>', methods=['DELETE'])
def delete_staff_email_logs(email):
    try:
        result = email_logs_col.delete_many({"recipient": email})
        return jsonify({"message": f"{result.deleted_count} logs deleted"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/admin-login', methods=['POST'])
def admin_login():
    data = request.get_json(force=True, silent=True) or {}
    user_id = data.get('email', '').strip()
    password = data.get('password', '').strip()
    
    # Check both the User ID (which frontend sends as 'email') and the Password
    if user_id == 'JSM' and password == 'JAYA@CDA11':
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
        "created_at": datetime.now().strftime("%d %b %Y"),
        "status_history": [{"status": "Under Review", "date": datetime.now().strftime("%Y-%m-%d %I:%M %p")}]
    }
    result = cases_col.insert_one(case)
    email_sent = send_credentials_email(case['email'], case['client_name'], "Verification Code Only")
    return jsonify({"message": "Case created", "id": str(result.inserted_id), "password": "Verification Code Only", "email_sent": email_sent}), 201


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
    if 'status' in data:
        update_fields['status'] = data['status']
        if old_case and old_case.get('status') != data['status']:
            update_fields['status_updated_at'] = datetime.now().strftime("%Y-%m-%d %I:%M %p")
            cases_col.update_one({"_id": ObjectId(id)}, {"$push": {"status_history": {"status": data['status'], "date": datetime.now().strftime("%Y-%m-%d %I:%M %p")}}})
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
    # Restored assignment filtering based on user request
    cases = list(cases_col.find({
        "status": {"$ne": "Finished & Archived"},
        "assigned_staff_email": email
    }).sort('_id', -1))
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
    email = data.get('email')
    code = data.get('password')
    case = cases_col.find_one({
        "email": email, 
        "reset_code": code,
        "status": {"$ne": "Finished & Archived"}
    })
    if case:
        cases_col.update_one({"_id": case['_id']}, {"$set": {"reset_code": ""}})
        return jsonify({"success": True, "case": {"_id": str(case['_id'])}}), 200
    return jsonify({"error": "Invalid verification code or case closed"}), 401

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
    phone = data.get('phone', '')
    
    if not name or not specialty or not email:
        return jsonify({"error": "Missing required fields"}), 400
        
    # Check if email already exists
    if advocates_col.find_one({"email": email}):
        return jsonify({"error": "An advocate with this email already exists"}), 400
        
    password = ''.join(random.choices(string.ascii_letters + string.digits, k=8))
        
    result = advocates_col.insert_one({
        "name": name,
        "email": email,
        "phone": phone,
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
        
        text = f"Dear {name},\nWelcome to JSM. Chambers! \nWe warmly welcome you to our legal team.\nAn advocate profile has been created for you.\n\nLogin ID: {email}\n\nPlease use the Send Verification Code option to login."
        msg.attach(MIMEText(text, 'plain', 'utf-8'))
        
        send_email_core(email, msg, msg['Subject'])
    except Exception as e:
        logging.error(f"Failed to send advocate email: {e}")
        
    return jsonify({"message": "Advocate added", "id": str(result.inserted_id), "password": "OTP Only"}), 201

@app.route('/api/staff-login', methods=['POST'])
def staff_login():
    data = request.get_json(force=True, silent=True) or {}
    email = data.get('email')
    code_or_pwd = data.get('password')
    
    advocate = advocates_col.find_one({"email": email})
    if not advocate:
        return jsonify({"error": "Invalid credentials"}), 401
        
    settings = settings_col.find_one({"_id": "office_info"}) or {}
    allow_common = settings.get("allow_common_password", False)
    
    is_valid = False
    if allow_common and code_or_pwd == 'JSM@123456789':
        is_valid = True
    elif advocate.get('reset_code') and advocate.get('reset_code') == code_or_pwd:
        is_valid = True
        advocates_col.update_one({"_id": advocate['_id']}, {"$set": {"reset_code": ""}})
        
    if is_valid:
        return jsonify({
            "success": True, 
            "advocate": {
                "id": str(advocate['_id']),
                "name": advocate.get('name'),
                "email": advocate.get('email'),
                "access_appointments": advocate.get('access_appointments', False),
                "access_clients": advocate.get('access_clients', False),
                "access_add_case": advocate.get('access_add_case', False),
                "access_voice": advocate.get('access_voice', False)
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
    if 'phone' in data:
        update_fields['phone'] = data['phone']
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
            "access_clients": advocate.get('access_clients', False),
            "access_add_case": advocate.get('access_add_case', False),
            "access_voice": advocate.get('access_voice', False)
        }
    }), 200





@app.route('/api/appointments/settings', methods=['GET'])
def get_appointment_settings_public():
    config = config_col.find_one({"_id": "global_config"}) or {}
    settings = config.get("appointment_settings", {})
    return jsonify(settings), 200

@app.route('/api/system-config/appointments', methods=['POST'])
def save_appointment_settings():
    data = request.json
    config_col.update_one(
        {"_id": "global_config"},
        {"$set": {"appointment_settings": data}},
        upsert=True
    )
    return jsonify({"message": "Settings saved"}), 200

@app.route('/api/system-config', methods=['GET'])
def get_system_config():
    config = ensure_daily_passwords()
    global_config = config_col.find_one({"_id": "global_config"}) or {}
    config['appointment_settings'] = global_config.get('appointment_settings', {})
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
                "access_add_case": data.get('access_add_case', False),
                "access_voice": data.get('access_voice', False)
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



@app.route('/api/gallery', methods=['GET'])
def get_gallery():
    if gallery_col is None: return jsonify([])
    items = list(gallery_col.find())
    for item in items:
        item['_id'] = str(item['_id'])
    return jsonify(items)

@app.route('/api/gallery', methods=['POST'])
def add_gallery():
    data = request.get_json(force=True, silent=True) or {}
    image_url = data.get('imageUrl')
    description = data.get('description', '')
    if not image_url:
        return jsonify({"error": "Image is required"}), 400
    new_item = {
        "imageUrl": image_url,
        "description": description
    }
    result = gallery_col.insert_one(new_item)
    new_item['_id'] = str(result.inserted_id)
    return jsonify(new_item), 201

@app.route('/api/gallery/<id>', methods=['DELETE'])
def delete_gallery(id):
    gallery_col.delete_one({"_id": ObjectId(id)})
    return jsonify({"success": True}), 200

@app.after_request

def add_header(response):
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "-1"
    return response





@app.route('/api/ai/transcribe', methods=['POST'])
def transcribe_audio():
    if not groq_client:
        return jsonify({"error": "Groq client not initialized"}), 500
        
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file provided"}), 400
        
    audio_file = request.files['audio']
    if audio_file.filename == '':
        return jsonify({"error": "Empty audio file"}), 400
        
    try:
        # Read the file directly into memory and send to Groq Whisper
        file_bytes = audio_file.read()
        filename = audio_file.filename or "recording.webm"
        
        transcription = groq_client.audio.transcriptions.create(
            file=(filename, file_bytes),
            model="whisper-large-v3",
            response_format="json"
        )
        return jsonify({"transcript": transcription.text}), 200
    except Exception as e:
        logging.error(f"Groq Transcribe Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/ai/parse-command', methods=['POST'])
def parse_ai_command():
    # Only allow admins (in real production, add @login_required decorator equivalent)
    data = request.json
    transcript = data.get('transcript', '')
    
    if not transcript:
        return jsonify({"error": "No transcript provided"}), 400
        
    try:
        # Prompt the Gemini model using direct REST API to avoid SDK version issues
        prompt = f'''
        You are a Legal Case Management AI Assistant. Your job is to extract database query criteria and intended updates from a natural language transcript.
        
        Transcript: "{transcript}"
        
        Extract the case search criteria (e.g., case_number, client_name, court) and the proposed changes (e.g., status, next_hearing, notes).
        
        Supported Fields:
        - status (e.g., "Under Review", "Finished & Archived", "Active")
        - next_hearing (Date string)
        - notes (String)
        - client_name (String)
        - chamber_case_number (String)
        - court_case_number (String)
        
        CRITICAL RULES FOR EMAILS: 
        If the admin requests to "send an email" or "notify the client", you MUST create an "email_draft" object. 
        DO NOT put email messages into the "notes" field. The "notes" field is ONLY for internal admin notes, not emails.
        Do NOT include greetings or signatures (like "Dear Client" or "Regards") in the email body, just the core message.
        
        Return ONLY a JSON object in this exact format:
        {{
            "search_criteria": {{
                "case_number": "...",
                "client_name": "..."
            }},
            "proposed_changes": {{
                "status": "...",
                "next_hearing": "...",
                "notes": "..."
            }},
            "email_draft": {{
                "subject": "...",
                "body": "..."
            }}
        }}
        Do not wrap the JSON in Markdown or backticks. Return the raw JSON string. If a field is not mentioned, omit it.
        '''
        
        
        if not groq_client:
            return jsonify({"status": "error", "message": "Groq API not configured."}), 500
            
        completion = groq_client.chat.completions.create(
            model="openai/gpt-oss-20b",
            messages=[
                {
                    "role": "system",
                    "content": "You are a Legal Case Management AI Assistant."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.1,
            response_format={"type": "json_object"}
        )
        response_text = completion.choices[0].message.content
        
        # Clean markdown if present
        if response_text.startswith('```json'):
            response_text = response_text[7:-3].strip()
        elif response_text.startswith('```'):
            response_text = response_text[3:-3].strip()
            
        ai_payload = json.loads(response_text)
        print("GEMINI PAYLOAD:", json.dumps(ai_payload, indent=2))
        search_criteria = ai_payload.get('search_criteria', {})
        proposed_changes = ai_payload.get('proposed_changes', {})
        
        if not search_criteria and not proposed_changes:
             return jsonify({"status": "error", "message": "Could not understand the command."}), 400
             
        # Build MongoDB query
        query = {}
        if search_criteria.get('case_number'):
            case_no = search_criteria['case_number']
            query['$or'] = [
                {"chamber_case_number": {"$regex": case_no, "$options": "i"}},
                {"court_case_number": {"$regex": case_no, "$options": "i"}}
            ]
        if search_criteria.get('client_name'):
            query['client_name'] = {"$regex": search_criteria['client_name'], "$options": "i"}
            
        if not query:
            return jsonify({"status": "error", "message": "No case identifiers (Case No, Client) found in command."}), 400
            
        staff_email = data.get('staff_email')
        if staff_email:
            query['assigned_staff_email'] = staff_email
            
        matching_cases = list(cases_col.find(query).limit(5))
        for c in matching_cases:
            c['_id'] = str(c['_id'])
            
        email_draft = ai_payload.get('email_draft')
        
        if len(matching_cases) == 0:
            return jsonify({"status": "not_found", "message": "No cases matched your criteria."})
        elif len(matching_cases) == 1:
            return jsonify({
                "status": "confirm",
                "case": matching_cases[0],
                "proposed_changes": proposed_changes,
                "email_draft": email_draft
            })
        else:
            return jsonify({
                "status": "multiple_matches",
                "cases": matching_cases,
                "proposed_changes": proposed_changes,
                "email_draft": email_draft
            })
            
    except Exception as e:
        logging.error(f"AI Parse Error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/ai/execute-command', methods=['POST'])
def execute_ai_command():
    data = request.json
    case_id = data.get('case_id')
    changes = data.get('changes', {})
    admin_id = data.get('admin_id', 'Unknown Admin')
    transcript = data.get('transcript', '')
    
    email_draft = data.get('email_draft')
    if not case_id or (not changes and not email_draft):
        return jsonify({"error": "Invalid payload. No changes or email draft provided."}), 400
        
    try:
        # Get old case state
        old_case = cases_col.find_one({"_id": ObjectId(case_id)})
        
        # Apply changes only if there are any
        if changes:
            if "status" in changes and old_case and changes["status"] != old_case.get("status"):
                changes["status_updated_at"] = datetime.now().strftime("%Y-%m-%d %I:%M %p")
                cases_col.update_one({"_id": ObjectId(case_id)}, {"$push": {"status_history": {"status": changes["status"], "date": datetime.now().strftime("%Y-%m-%d %I:%M %p")}}})
            update_query = {"$set": changes}
            if "next_hearing" in changes:
                update_query["$addToSet"] = {"hearing_history": changes["next_hearing"]}
            cases_col.update_one({"_id": ObjectId(case_id)}, update_query)
        
        email_draft = data.get('email_draft')
        if email_draft and email_draft.get('subject') and old_case.get('email'):
            import concurrent.futures
            from email.mime.multipart import MIMEMultipart
            from email.mime.text import MIMEText
            
            msg = MIMEMultipart()
            msg['From'] = SMTP_USER
            msg['To'] = old_case['email']
            msg['Subject'] = email_draft.get('subject', 'Update regarding your case')
            
            body = email_draft.get('body', '')
            html_body = f'''
            <div style="font-family: Arial, sans-serif; color: #333;">
                <p>Dear {old_case.get('client_name', 'Client')},</p>
                <p>{body.replace(chr(10), '<br>')}</p>
                <br><br>
                <p>Best Regards,<br><strong>JSM Chambers</strong></p>
            </div>
            '''
            msg.attach(MIMEText(html_body, 'html', 'utf-8'))
            
            with concurrent.futures.ThreadPoolExecutor() as executor:
                executor.submit(send_email_core, old_case['email'], msg, msg['Subject'])
        
        # Audit Log
        audit_log = {
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "admin_id": admin_id,
            "original_transcript": transcript,
            "interpreted_changes": changes,
            "target_case_id": case_id,
            "status": "Success"
        }
        ai_audit_logs_col.insert_one(audit_log)
        
        return jsonify({"success": True}), 200
        
    except Exception as e:
        logging.error(f"AI Execute Error: {str(e)}")
        # Log failure
        ai_audit_logs_col.insert_one({
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "admin_id": admin_id,
            "original_transcript": transcript,
            "target_case_id": case_id,
            "status": f"Error: {str(e)}"
        })
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    app.run(debug=False, port=8081, host='0.0.0.0')