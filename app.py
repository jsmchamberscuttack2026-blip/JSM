import concurrent.futures
import os
from flask import Flask, request, jsonify, send_from_directory, send_file, Response
import re
import base64
from pymongo import MongoClient
from bson import ObjectId
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from email.utils import formatdate, make_msgid
from datetime import datetime, timedelta, timezone
from fpdf import FPDF
import io
import math
import random
import certifi
import logging
import socket
import string
import json
from dotenv import load_dotenv
from groq import Groq

# Indian Standard Time (IST = UTC+5:30) for JSM Chambers, Cuttack, Odisha
IST = timezone(timedelta(hours=5, minutes=30))

def get_now_ist():
    return datetime.now(IST)

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
    services_col = db['services']
    news_col = db['news']
    opinions_col = db['opinions']
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

def send_verification_email(recipient_email, code, attempts_left=None, total_logins_today=0):
    msg = MIMEMultipart('alternative')
    msg['Date'] = formatdate(localtime=True)
    msg['Message-ID'] = make_msgid()
    msg['From'] = f"JSM Chambers <{SMTP_USER}>"
    msg['To'] = recipient_email
    
    today_str = get_now_ist().strftime("%d %b %Y")
    attempt_num = (total_logins_today or 0) + 1
    rem = attempts_left if attempts_left is not None else max(0, 3 - (total_logins_today or 0))
    
    subject = f"JSM. Chambers - Login Verification Code (Attempt #{attempt_num}/3)"
    msg['Subject'] = subject
    
    text = f"""JSM CHAMBERS - CLIENT PORTAL VERIFICATION
===============================================

Your 6-Digit Verification Code is: {code}

DAILY LOGIN SECURITY REPORT:
- Date: {today_str}
- Login Attempt: #{attempt_num} of 3
- Logins Remaining Today: {rem} left
- Daily Policy: Maximum 3 logins per day per client

Please enter this verification code on the portal to access your case file.
If you did not request this login code, please contact JSM Chambers immediately.

JSM Chambers | Cuttack, Odisha
"""
    html = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px;">
      <div style="max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
        <div style="background: #0A1628; padding: 24px 30px; border-bottom: 3px solid #D4AF37; text-align: center;">
          <h2 style="color: #ffffff; margin: 0; font-family: Georgia, serif; font-size: 22px;">JSM CHAMBERS</h2>
          <p style="color: #D4AF37; margin: 4px 0 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; font-weight: 700;">Client Portal Verification</p>
        </div>
        <div style="padding: 30px;">
          <p style="color: #334155; font-size: 15px; margin: 0 0 16px 0;">You requested a verification code to securely access your legal case file on the client portal.</p>
          <div style="background: #f8fafc; border: 2px dashed #D4AF37; border-radius: 10px; padding: 18px; text-align: center; margin: 20px 0;">
            <div style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700; margin-bottom: 6px;">Your 6-Digit OTP</div>
            <div style="font-size: 34px; font-weight: 800; color: #0A1628; letter-spacing: 8px; font-family: monospace;">{code}</div>
          </div>
          
          <!-- Daily Login Security Report -->
          <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <div style="font-weight: 700; font-size: 13px; color: #1e40af; margin-bottom: 8px;">📊 DAILY LOGIN REPORT ({today_str})</div>
            <table style="width: 100%; font-size: 13px; color: #1e3a8a;">
              <tr>
                <td style="padding: 4px 0;">Current Attempt:</td>
                <td style="padding: 4px 0; font-weight: 700; text-align: right;">#{attempt_num} of 3</td>
              </tr>
              <tr>
                <td style="padding: 4px 0;">Remaining Logins Today:</td>
                <td style="padding: 4px 0; font-weight: 700; text-align: right; color: {'#15803d' if rem > 0 else '#b91c1c'};">{rem} login(s) left</td>
              </tr>
              <tr>
                <td style="padding: 4px 0;">Daily Limit Policy:</td>
                <td style="padding: 4px 0; font-weight: 700; text-align: right;">Max 3 Logins / Day</td>
              </tr>
            </table>
          </div>
          
          <p style="color: #64748b; font-size: 12.5px; line-height: 1.5; margin: 16px 0 0 0;">If you did not initiate this login request, please ignore this email or notify JSM Chambers immediately.</p>
        </div>
        <div style="background: #f8fafc; padding: 14px 30px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11.5px; color: #94a3b8;">
          🔒 JSM Chambers Legal Operations · Confidential Client Notification
        </div>
      </div>
    </body>
    </html>
    """
    msg.attach(MIMEText(text, 'plain', 'utf-8'))
    msg.attach(MIMEText(html, 'html', 'utf-8'))
    
    return send_email_core(recipient_email, msg, subject)

def send_admin_2fa_email(otp, expiry_time_str):
    recipient_email = "jsmchamberscuttack2026@gmail.com"
    msg = MIMEMultipart('alternative')
    msg['Date'] = formatdate(localtime=True)
    msg['Message-ID'] = make_msgid()
    msg['From'] = f"JSM Chambers Security <{SMTP_USER}>"
    msg['To'] = recipient_email
    subject = f"🔒 JSM Chambers - Admin 2FA Login OTP: {otp} (Valid 5 Mins)"
    msg['Subject'] = subject
    
    text = f"""JSM CHAMBERS - ADMINISTRATIVE 2FA VERIFICATION
===============================================

Admin Login Verification Code: {otp}

SECURITY & EXPIRATION NOTICE:
- Code is valid for 5 MINUTES ONLY (expires at {expiry_time_str} IST).
- Do NOT share this code with anyone.
- If you did not initiate this login request, your admin credentials may be compromised.

JSM Chambers | Cuttack, Odisha
"""
    html = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #071522; margin: 0; padding: 24px;">
      <div style="max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 14px; overflow: hidden; border: 2px solid #D4AF37; box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
        <div style="background: #0A1628; padding: 26px 30px; border-bottom: 3px solid #D4AF37; text-align: center;">
          <h2 style="color: #ffffff; margin: 0; font-family: Georgia, serif; font-size: 24px;">⚖️ JSM CHAMBERS</h2>
          <p style="color: #D4AF37; margin: 5px 0 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; font-weight: 700;">Admin 2FA Verification Portal</p>
        </div>
        <div style="padding: 32px 30px;">
          <p style="color: #1e293b; font-size: 15px; margin: 0 0 16px 0; font-weight: 500;">An administrator login attempt was initiated with valid credentials. Enter the verification code below to authorize dashboard access:</p>
          
          <div style="background: linear-gradient(135deg, #0A1628, #1E293B); border-radius: 12px; padding: 22px; text-align: center; margin: 24px 0; border: 1px solid #D4AF37;">
            <div style="font-size: 11px; color: #D4AF37; text-transform: uppercase; letter-spacing: 2px; font-weight: 700; margin-bottom: 8px;">2FA Security OTP (Valid 5 Mins)</div>
            <div style="font-size: 38px; font-weight: 900; color: #ffffff; letter-spacing: 10px; font-family: monospace;">{otp}</div>
            <div style="color: #94a3b8; font-size: 12px; margin-top: 8px;">⏱️ Expires at <strong>{expiry_time_str} IST</strong> (5 minutes validity)</div>
          </div>
          
          <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 14px; margin-top: 20px;">
            <p style="margin: 0; color: #92400e; font-size: 12.5px; line-height: 1.5;">
              <strong>⚠️ Security Alert:</strong> This code provides full administrative control over cases, appointments, and client directories. If you did not make this login attempt, please change the administrative password immediately.
            </p>
          </div>
        </div>
        <div style="background: #f8fafc; padding: 14px 30px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11.5px; color: #94a3b8;">
          🔒 JSM Chambers Legal Operations · Confidential Administrative Authentication
        </div>
      </div>
    </body>
    </html>
    """
    msg.attach(MIMEText(text, 'plain', 'utf-8'))
    msg.attach(MIMEText(html, 'html', 'utf-8'))
    return send_email_core(recipient_email, msg, subject)

def get_client_ip():
    if request.headers.get('X-Forwarded-For'):
        return request.headers.get('X-Forwarded-For').split(',')[0].strip()
    if request.headers.get('X-Real-IP'):
        return request.headers.get('X-Real-IP').strip()
    return request.remote_addr or '127.0.0.1'

def get_admin_lockout_doc():
    if config_col is None:
        return {}
    return config_col.find_one({"_id": "admin_security_lockout"}) or {}

def is_admin_locked():
    lock_doc = get_admin_lockout_doc()
    locked_until_ts = lock_doc.get("locked_until_timestamp", 0)
    now_ts = get_now_ist().timestamp()
    if now_ts < locked_until_ts:
        remaining_seconds = max(0, int(locked_until_ts - now_ts))
        return True, remaining_seconds, lock_doc
    return False, 0, lock_doc

def send_admin_security_alert_email(ip_address, user_agent, attempted_user, expiry_time_str):
    recipients = ["jsmchamberscuttack2026@gmail.com"]
    sec_officer = ""
    try:
        if settings_col is not None:
            setting_doc = settings_col.find_one({"_id": "office_info"}) or {}
            sec_officer = (setting_doc.get("security_officer_email") or "").strip()
            if sec_officer and "@" in sec_officer and sec_officer.lower() not in [r.lower() for r in recipients]:
                recipients.append(sec_officer)
    except Exception as e:
        logging.error(f"Error fetching security officer email: {e}")

    now_ist_str = get_now_ist().strftime("%d %b %Y, %I:%M:%S %p")
    subject = f"🚨 [CRITICAL ALERT] Admin Portal Locked - 3 Failed Logins Detected (IP: {ip_address})"

    text = f"""JSM CHAMBERS - CRITICAL SECURITY BREACH ALERT
=============================================================

ALERT: Administrative Login Portal Locked Down!
3 consecutive failed login attempts were detected from an unknown or unauthorized user.

INCIDENT REPORT:
- Intruder IP Address: {ip_address}
- Incident Timestamp: {now_ist_str} IST
- Attempted User ID: {attempted_user}
- Client Device / User Agent: {user_agent}
- Protective Action: Admin Portal has been LOCKED for 5 MINUTES.
- Lockout Expiration: {expiry_time_str} IST

All administrative login requests are currently blocked until {expiry_time_str} IST.
If this attempt was unauthorized, please review server access logs immediately.

Recipients Notified:
- Chamber Official Email: jsmchamberscuttack2026@gmail.com
""" + (f"- Security Officer Email: {sec_officer}\n" if sec_officer else "") + """
JSM Chambers Security Operations | Cuttack, Odisha
"""

    html = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; margin: 0; padding: 24px;">
  <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 14px; overflow: hidden; border: 2px solid #dc2626; box-shadow: 0 15px 50px rgba(220, 38, 38, 0.35);">
    <div style="background: linear-gradient(135deg, #7f1d1d, #991b1b, #450a0a); padding: 28px 30px; text-align: center; border-bottom: 3px solid #f87171;">
      <div style="font-size: 32px; margin-bottom: 6px;">🚨</div>
      <h2 style="color: #ffffff; margin: 0; font-family: Georgia, serif; font-size: 23px; letter-spacing: 1px;">CRITICAL SECURITY ALERT</h2>
      <p style="color: #fca5a5; margin: 6px 0 0 0; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; font-weight: 700;">Admin Portal Brute-Force Lockout Activated</p>
    </div>
    
    <div style="padding: 30px;">
      <div style="background: #fef2f2; border: 1.5px solid #fecaca; border-radius: 10px; padding: 16px; margin-bottom: 22px;">
        <div style="color: #991b1b; font-weight: 800; font-size: 14.5px; margin-bottom: 6px;">⚠️ 3 Consecutive Failed Login Attempts Detected</div>
        <p style="color: #7f1d1d; font-size: 13.5px; line-height: 1.55; margin: 0;">
          An unauthorized client or potential intruder repeatedly attempted to access the <strong>JSM Chambers Admin Panel</strong> with incorrect credentials. To safeguard case files and sensitive data, the portal has been <strong>strictly locked for 5 minutes</strong>.
        </p>
      </div>

      <div style="font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 10px;">📋 Incident Telemetry & Attacker Details</div>
      
      <table style="width: 100%; border-collapse: collapse; font-size: 13.5px; background: #f8fafc; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;">
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 11px 14px; font-weight: 700; color: #334155; width: 38%;">Attacker IP Address:</td>
          <td style="padding: 11px 14px; font-weight: 800; color: #b91c1c; font-family: monospace; font-size: 14.5px;">{ip_address}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e2e8f0; background: #ffffff;">
          <td style="padding: 11px 14px; font-weight: 700; color: #334155;">Incident Timestamp:</td>
          <td style="padding: 11px 14px; color: #1e293b; font-weight: 600;">{now_ist_str} IST</td>
        </tr>
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 11px 14px; font-weight: 700; color: #334155;">Attempted Username:</td>
          <td style="padding: 11px 14px; color: #0f172a; font-weight: 700; font-family: monospace;">{attempted_user}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e2e8f0; background: #ffffff;">
          <td style="padding: 11px 14px; font-weight: 700; color: #334155;">Protection Status:</td>
          <td style="padding: 11px 14px; color: #991b1b; font-weight: 800;">🔒 LOCKED FOR 5 MINUTES</td>
        </tr>
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 11px 14px; font-weight: 700; color: #334155;">Lockout Expiration:</td>
          <td style="padding: 11px 14px; color: #15803d; font-weight: 700;">{expiry_time_str} IST</td>
        </tr>
        <tr style="background: #ffffff;">
          <td style="padding: 11px 14px; font-weight: 700; color: #334155; vertical-align: top;">Client User-Agent:</td>
          <td style="padding: 11px 14px; color: #64748b; font-size: 11.5px; font-family: monospace; word-break: break-all;">{user_agent}</td>
        </tr>
      </table>

      <div style="margin-top: 24px; padding: 16px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px;">
        <div style="font-weight: 700; color: #166534; font-size: 13px; margin-bottom: 4px;">🛡️ Automated Defense Activated</div>
        <p style="margin: 0; color: #15803d; font-size: 12.5px; line-height: 1.5;">
          All login requests to the Admin Panel will be rejected automatically until {expiry_time_str} IST. If you did not authorize this login attempt, please notify the chamber administrator immediately.
        </p>
      </div>
    </div>
    
    <div style="background: #0f172a; padding: 16px 30px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #1e293b;">
      JSM Chambers Cyber Defense &bull; Dispatched to Official Chamber &amp; Security Officer Inboxes
    </div>
  </div>
</body>
</html>
"""
    results = {}
    for r in recipients:
        try:
            msg = MIMEMultipart('alternative')
            msg['Date'] = formatdate(localtime=True)
            msg['Message-ID'] = make_msgid()
            msg['From'] = f"JSM Security Sentinel <{SMTP_USER}>"
            msg['To'] = r
            msg['Subject'] = subject
            msg.attach(MIMEText(text, 'plain', 'utf-8'))
            msg.attach(MIMEText(html, 'html', 'utf-8'))
            results[r] = send_email_core(r, msg, subject)
        except Exception as e:
            results[r] = {"success": False, "error": str(e)}
    return results

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
@app.route('/index.html')
def serve_index():
    try:
        with open('index.html', 'r', encoding='utf-8') as f:
            html = f.read()
        
        setting_doc = settings_col.find_one({"_id": "office_info"}) or {}
        gsv = str(setting_doc.get("google_site_verification", "") or "").strip()
        owner_name = str(setting_doc.get("about_chamber_owner_name", "") or "").strip() or "Adv. Jayasankar Mishra"
        chamber_name = str(setting_doc.get("chamber_name", "") or "").strip() or "JSM. Chambers"
        phone = str(setting_doc.get("phone", "") or "").strip() or "+91 94370 00000"
        email = str(setting_doc.get("email", "") or "").strip() or "jsmchamberscuttack2026@gmail.com"
        address = str(setting_doc.get("address", "") or "").strip() or "High Court of Orissa, Cuttack, Odisha, India"
        
        base_url = request.url_root.rstrip('/')
        owner_img_url = f"{base_url}/chamber-owner.jpg"
        logo_url = f"{base_url}/chamber-logo.jpg"

        # 1. Google Site Verification Tag
        if gsv:
            m = re.search(r'content=["\']([^"\']+)["\']', gsv)
            token = m.group(1) if m else gsv
            tag = f'<meta name="google-site-verification" content="{token}" id="google-site-verification-meta">'
            if 'id="google-site-verification-meta"' in html:
                html = re.sub(r'<meta\s+name=["\']google-site-verification["\'][^>]*>', tag, html)
            else:
                html = html.replace('</head>', f'    {tag}\n</head>', 1)
        
        # 2. Rich Search Engine & Social Preview Meta Tags (Google, Knowledge Graph, OpenGraph, Twitter)
        seo_meta = f"""    <title>{chamber_name} | Chamber Owner: {owner_name} | High Court Advocates & Legal Organization</title>
    <meta name="description" content="Welcome to {chamber_name} — an independent private legal organization founded and owned by {owner_name}. Dedicated to professional legal consultation, strategic advocacy and complex civil, writ, and corporate litigation.">
    <meta name="keywords" content="JSM Chambers, JSM Chambers owner, JSM Chambers founder, {owner_name}, Jayasankar Mishra advocate, High Court lawyer Cuttack, legal consultation, civil litigation, constitutional writ petitions, criminal defense, corporate counsel">
    <meta name="author" content="{owner_name}">
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
    
    <!-- Open Graph (Facebook, WhatsApp, LinkedIn, Google Preview) -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="{base_url}/">
    <meta property="og:title" content="{chamber_name} | Chamber Owner: {owner_name}">
    <meta property="og:description" content="Official chamber profile of {chamber_name}. Owned by {owner_name}. Professional legal consultation, strategic advocacy and trial practice.">
    <meta property="og:image" content="{owner_img_url}">
    <meta property="og:image:alt" content="{owner_name} - Chamber Owner of {chamber_name}">
    <meta property="og:image:type" content="image/jpeg">
    <meta property="og:image:width" content="800">
    <meta property="og:image:height" content="800">
    
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{chamber_name} | Chamber Owner: {owner_name}">
    <meta name="twitter:description" content="Official website of {chamber_name} — Owned by {owner_name}. Strategic legal advocacy and consultation.">
    <meta name="twitter:image" content="{owner_img_url}">"""

        # Replace static title & description with rich dynamic meta
        html = re.sub(r'<title>.*?</title>', '', html, flags=re.DOTALL)
        html = re.sub(r'<meta\s+name=["\']description["\'][^>]*>', '', html, flags=re.DOTALL)
        html = re.sub(r'<meta\s+name=["\']robots["\'][^>]*>', '', html, flags=re.DOTALL)
        
        # 3. Dynamic JSON-LD Structured Data for Google Search & Console Verification
        # For all ADVOCATES & CHAMBER MEMBERS: Include ONLY name and image (no email, no about/description)
        employee_refs = []
        member_person_schemas = []
        
        all_advocates = list(advocates_col.find().sort([("is_owner", -1), ("_id", 1)]))
        for adv in all_advocates:
            adv_id = str(adv["_id"])
            adv_name = adv.get("name", "").strip()
            if not adv_name:
                continue
                
            is_owner = bool(adv.get("is_owner"))
            local_img = f"assets/images/members/{adv_id}.jpg"
            if is_owner:
                member_img = f"{base_url}/chamber-owner.jpg"
            elif os.path.exists(local_img):
                member_img = f"{base_url}/assets/images/members/{adv_id}.jpg"
            else:
                member_img = f"{base_url}/assets/images/advocate_logo.jpg"
                
            member_id = f"{base_url}/#owner" if is_owner else f"{base_url}/#member-{adv_id}"
            employee_refs.append({"@id": member_id})
            
            p_schema = {
                "@type": "Person",
                "@id": member_id,
                "name": adv_name,
                "image": member_img,
                "worksFor": {
                    "@id": f"{base_url}/#organization"
                }
            }
            if is_owner:
                p_schema["alternateName"] = [
                    f"{adv_name} - Chamber Owner",
                    "JSM Chambers Owner",
                    "Owner of JSM Chambers",
                    "JSM Chamber Founder"
                ]
            member_person_schemas.append(p_schema)

        json_ld_schema = {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": ["LegalService", "Attorney"],
                    "@id": f"{base_url}/#organization",
                    "name": "JSM. Chambers",
                    "alternateName": [
                        "JSM Chambers",
                        "JSM Chambers & Associates",
                        "JSM Legal",
                        chamber_name
                    ],
                    "url": f"{base_url}/",
                    "logo": logo_url,
                    "image": owner_img_url,
                    "founder": {
                        "@id": f"{base_url}/#owner"
                    },
                    "employee": employee_refs,
                    "knowsAbout": [
                        "Constitutional Law & Writ Petitions",
                        "Civil Litigation & Title Disputes",
                        "Commercial Arbitration & Contractual Enforcement",
                        "Criminal Defense & Bail Matters",
                        "Appellate Courtroom Advocacy"
                    ]
                }
            ] + member_person_schemas
        }
        json_ld_str = json.dumps(json_ld_schema, indent=2, ensure_ascii=False)
        json_ld_tag = f'<script type="application/ld+json">\n{json_ld_str}\n</script>'
        
        # Replace existing schema or inject
        if 'application/ld+json' in html:
            html = re.sub(r'<script\s+type=["\']application/ld\+json["\']>.*?</script>', json_ld_tag, html, flags=re.DOTALL)
        else:
            html = html.replace('</head>', f'{json_ld_tag}\n</head>', 1)
            
        html = html.replace('<head>', f'<head>\n{seo_meta}\n', 1)
        
        # Ensure owner name in index.html is updated server-side for initial crawl
        html = re.sub(r'(<h2\s+id=["\']about-doc-owner-name["\'][^>]*>)(.*?)(</h2>)', f'\\g<1>{owner_name}\\g<3>', html)
        
        return Response(html, mimetype='text/html')
    except Exception as e:
        logging.error(f"Error serving index.html with verification: {e}")
        return send_from_directory('.', 'index.html')

@app.route('/chamber-owner.jpg')
def serve_chamber_owner_image():
    try:
        setting_doc = settings_col.find_one({"_id": "office_info"}) or {}
        img_data = setting_doc.get("about_chamber_owner_image") or setting_doc.get("about_chamber_image1")
        if img_data and 'base64,' in img_data:
            header, encoded = img_data.split('base64,', 1)
            mime = 'image/jpeg'
            if 'image/png' in header: mime = 'image/png'
            elif 'image/webp' in header: mime = 'image/webp'
            img_bytes = base64.b64decode(encoded)
            return Response(img_bytes, mimetype=mime, headers={
                "Cache-Control": "public, max-age=86400",
                "Content-Disposition": "inline; filename=\"jsm-chambers-owner.jpg\""
            })
    except Exception as e:
        logging.error(f"Error serving owner image: {e}")
    return send_from_directory('assets/images', 'advocate_logo.jpg')

@app.route('/chamber-logo.jpg')
def serve_chamber_logo_image():
    try:
        setting_doc = settings_col.find_one({"_id": "office_info"}) or {}
        img_data = setting_doc.get("logoUrl")
        if img_data and 'base64,' in img_data:
            header, encoded = img_data.split('base64,', 1)
            mime = 'image/jpeg'
            if 'image/png' in header: mime = 'image/png'
            elif 'image/webp' in header: mime = 'image/webp'
            img_bytes = base64.b64decode(encoded)
            return Response(img_bytes, mimetype=mime, headers={
                "Cache-Control": "public, max-age=86400",
                "Content-Disposition": "inline; filename=\"jsm-chambers-logo.jpg\""
            })
    except Exception as e:
        logging.error(f"Error serving chamber logo: {e}")
    return send_from_directory('assets/images', 'advocate_logo.jpg')

@app.route('/google<string:code>.html')
def serve_google_verification_file(code):
    return f"google-site-verification: google{code}.html", 200, {'Content-Type': 'text/html; charset=utf-8'}

@app.route('/robots.txt')
def serve_robots_txt():
    base_url = request.url_root.rstrip('/')
    robots = f"""User-agent: *
Allow: /
Allow: /chamber-owner.jpg
Allow: /chamber-logo.jpg
Disallow: /admin-dashboard.html
Disallow: /admin-login.html
Disallow: /api/

Sitemap: {base_url}/sitemap.xml
"""
    return Response(robots, mimetype='text/plain')

@app.route('/sitemap.xml')
def serve_sitemap_xml():
    base = request.url_root.rstrip('/')
    now = datetime.utcnow().strftime('%Y-%m-%d')
    
    # Generate image entries for all advocates & chamber members
    all_advocates = list(advocates_col.find().sort([("is_owner", -1), ("_id", 1)]))
    image_entries = []
    
    for adv in all_advocates:
        adv_id = str(adv["_id"])
        adv_name = adv.get("name", "").strip()
        if not adv_name:
            continue
        is_owner = bool(adv.get("is_owner"))
        local_file = f"assets/images/members/{adv_id}.jpg"
        if is_owner:
            img_url = f"{base}/chamber-owner.jpg"
            title = f"{adv_name} - Chamber Owner | JSM. Chambers"
        elif os.path.exists(local_file):
            img_url = f"{base}/assets/images/members/{adv_id}.jpg"
            title = f"{adv_name} | JSM. Chambers"
        else:
            img_url = f"{base}/assets/images/advocate_logo.jpg"
            title = f"{adv_name} | JSM. Chambers"
            
        image_entries.append(f"""    <image:image>
      <image:loc>{img_url}</image:loc>
      <image:title>{title}</image:title>
    </image:image>""")
        
    images_xml = "\n".join(image_entries)
    
    sitemap = f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>{base}/</loc>
    <lastmod>{now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
{images_xml}
  </url>
  <url>
    <loc>{base}/client-portal.html</loc>
    <lastmod>{now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>"""
    return Response(sitemap, mimetype='application/xml')



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
    
    now_ist = get_now_ist()
    if parsed_date.date() < now_ist.date():
        return jsonify({"available": False, "message": "Past date"}), 200
        
    if parsed_date.date() == now_ist.date():
        b_end_str = settings.get("booking_end") or settings.get("end_time", "17:00")
        try:
            beh, bem = map(int, b_end_str.split(':'))
            end_m = beh * 60 + bem
            now_m = now_ist.hour * 60 + now_ist.minute
            if now_m > end_m:
                return jsonify({"available": False, "message": "Booking closed for today"}), 200
        except Exception:
            pass
            
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
        
    now_ist = get_now_ist()
    if parsed_date.date() < now_ist.date():
        return jsonify({"error": "Cannot book appointments in the past."}), 400

    # Auto-assign logic based on settings
    config = config_col.find_one({"_id": "global_config"}) or {}
    settings = config.get("appointment_settings", {})
    
    # Booking window check
    booking_start = (settings.get("booking_start") or "00:00").strip()
    booking_end = (settings.get("booking_end") or "23:59").strip()
    
    try:
        # If booking window is defined and not 24h
        if booking_start and booking_end and booking_start != booking_end and not (booking_start == "00:00" and booking_end in ["00:00", "23:59"]):
            b_sh, b_sm = map(int, booking_start.split(':'))
            b_eh, b_em = map(int, booking_end.split(':'))
            start_m = b_sh * 60 + b_sm
            end_m = b_eh * 60 + b_em
            now_m = now_ist.hour * 60 + now_ist.minute
            
            allowed = False
            if start_m < end_m:
                allowed = (start_m <= now_m <= end_m)
            elif start_m > end_m:
                # Overnight window (e.g. 09:00 PM to 06:00 AM)
                allowed = (now_m >= start_m or now_m <= end_m)
            else:
                allowed = True
                
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
                
                return jsonify({"error": f"Online booking is only available during our booking window: {b_start_str} to {b_end_str} (IST). Please try again during booking hours."}), 400
    except Exception as e:
        logging.error(f"Error checking booking window: {e}")
        
    available_days = settings.get("available_days", ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"])
    start_time_str = settings.get("start_time", "10:00")
    end_time_str = settings.get("end_time", "17:00")
    max_per_day = int(settings.get("max_per_day", 5))
    
    day_name = parsed_date.strftime("%A")
    if day_name not in available_days:
        return jsonify({"error": f"We do not accept appointments on {day_name}s. Please choose an available day: {', '.join(available_days)}."}), 400
        
    if parsed_date.date() == now_ist.date():
        # For same-day bookings, ensure booking window has not closed
        b_end_str = settings.get("booking_end") or end_time_str
        try:
            beh, bem = map(int, b_end_str.split(':'))
            end_m = beh * 60 + bem
            now_m = now_ist.hour * 60 + now_ist.minute
            if now_m > end_m:
                return jsonify({"error": "Same-day bookings are closed for today as the booking window has passed. Please select a future date."}), 400
        except Exception:
            pass

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


@app.route('/api/admin-lock-status', methods=['GET'])
def admin_lock_status():
    is_locked, remaining_seconds, lock_doc = is_admin_locked()
    return jsonify({
        "locked": is_locked,
        "remaining_seconds": remaining_seconds,
        "failed_attempts": lock_doc.get("failed_attempts", 0),
        "locked_until": lock_doc.get("locked_until_iso")
    }), 200

@app.route('/api/admin-login', methods=['POST'])
def admin_login():
    data = request.get_json(force=True, silent=True) or {}
    user_id = (data.get('email') or data.get('admin_id') or '').strip()
    password = data.get('password', '').strip()
    
    # 1. Enforce active lockout
    is_locked, rem_secs, lock_doc = is_admin_locked()
    if is_locked:
        rem_min = (rem_secs + 59) // 60
        return jsonify({
            "error": f"Security Lockdown Active: Admin portal is locked for {rem_min} minute(s) due to multiple failed login attempts. No requests accepted.",
            "locked": True,
            "lockout_remaining_seconds": rem_secs,
            "locked_until": lock_doc.get("locked_until_iso")
        }), 423
    
    # 2. Check credentials
    if user_id == 'JSM' and password == 'JAYA@CDA11':
        # Valid login: reset failed attempts counter
        if config_col is not None:
            config_col.update_one(
                {"_id": "admin_security_lockout"},
                {"$set": {
                    "failed_attempts": 0,
                    "locked_until_timestamp": 0,
                    "last_successful_login": get_now_ist().isoformat()
                }},
                upsert=True
            )

        # Generate 6-digit OTP valid for 5 minutes
        otp = str(random.randint(100000, 999999))
        now_ist = get_now_ist()
        expires_at = now_ist + timedelta(minutes=5)
        
        if config_col is not None:
            config_col.update_one(
                {"_id": "admin_2fa_otp"},
                {"$set": {
                    "otp": otp,
                    "created_at": now_ist.isoformat(),
                    "expires_at": expires_at.isoformat(),
                    "expires_timestamp": expires_at.timestamp(),
                    "target_email": "jsmchamberscuttack2026@gmail.com",
                    "verified": False
                }},
                upsert=True
            )
            
        expiry_str = expires_at.strftime("%I:%M %p")
        email_sent = send_admin_2fa_email(otp, expiry_str)
        
        return jsonify({
            "requires_2fa": True,
            "target_email": "jsmchamberscuttack2026@gmail.com",
            "expires_in_seconds": 300,
            "message": "Admin credentials verified. A 6-digit 2FA code has been dispatched to jsmchamberscuttack2026@gmail.com (valid for 5 minutes).",
            "email_sent": email_sent
        }), 200
    
    # 3. Failed attempt handling
    client_ip = get_client_ip()
    user_agent = request.headers.get('User-Agent', 'Unknown Device')
    now_ist = get_now_ist()
    current_fails = int(lock_doc.get("failed_attempts", 0)) + 1
    
    if current_fails >= 3:
        # Lockout triggered for 5 minutes (300 seconds)
        locked_until = now_ist + timedelta(minutes=5)
        locked_until_ts = locked_until.timestamp()
        locked_until_iso = locked_until.isoformat()
        expiry_str = locked_until.strftime("%I:%M %p")
        
        if config_col is not None:
            config_col.update_one(
                {"_id": "admin_security_lockout"},
                {"$set": {
                    "failed_attempts": current_fails,
                    "locked_until_timestamp": locked_until_ts,
                    "locked_until_iso": locked_until_iso,
                    "last_failed_ip": client_ip,
                    "last_failed_user_agent": user_agent,
                    "last_failed_time": now_ist.isoformat(),
                    "last_attempted_user": user_id
                },
                "$push": {
                    "attempt_history": {
                        "$each": [{
                            "ip": client_ip,
                            "user_agent": user_agent,
                            "attempted_user": user_id,
                            "timestamp": now_ist.isoformat()
                        }],
                        "$slice": -10
                    }
                }},
                upsert=True
            )
            
        # Dispatch emergency security breach alert with IP address to official email + security officer
        alert_sent = send_admin_security_alert_email(client_ip, user_agent, user_id or "Anonymous/Blank", expiry_str)
        
        return jsonify({
            "error": "🚨 CRITICAL SECURITY ALERT: 3 consecutive failed login attempts detected. The admin portal has been locked for 5 minutes. Security alert dispatched with IP address.",
            "locked": True,
            "lockout_remaining_seconds": 300,
            "locked_until": expiry_str,
            "attempts_left": 0,
            "alert_sent": alert_sent
        }), 423
    else:
        # Under 3 attempts: record failure and warn user
        if config_col is not None:
            config_col.update_one(
                {"_id": "admin_security_lockout"},
                {"$set": {
                    "failed_attempts": current_fails,
                    "last_failed_ip": client_ip,
                    "last_failed_user_agent": user_agent,
                    "last_failed_time": now_ist.isoformat(),
                    "last_attempted_user": user_id
                }},
                upsert=True
            )
        attempts_left = 3 - current_fails
        return jsonify({
            "error": f"Invalid Admin ID or Password. Warning: {attempts_left} attempt(s) remaining before security lockout (5 minutes).",
            "attempts_left": attempts_left,
            "failed_attempts": current_fails,
            "locked": False
        }), 401

@app.route('/api/admin-verify-otp', methods=['POST'])
def admin_verify_otp():
    is_locked, rem_secs, lock_doc = is_admin_locked()
    if is_locked:
        rem_min = (rem_secs + 59) // 60
        return jsonify({
            "error": f"Security Lockdown Active: Admin portal is locked for {rem_min} minute(s). No requests accepted.",
            "locked": True,
            "lockout_remaining_seconds": rem_secs
        }), 423

    data = request.get_json(force=True, silent=True) or {}
    otp = str(data.get('otp', '')).strip()
    
    if not otp:
        return jsonify({"error": "Please enter the 6-digit verification code"}), 400
        
    if config_col is None:
        return jsonify({"error": "DB error"}), 500
        
    doc = config_col.find_one({"_id": "admin_2fa_otp"})
    if not doc or not doc.get("otp"):
        return jsonify({"error": "No pending 2FA verification found. Please login again."}), 400
        
    now_ist = get_now_ist()
    expires_ts = doc.get("expires_timestamp", 0)
    
    if now_ist.timestamp() > expires_ts:
        return jsonify({"error": "The verification code has expired (valid for 5 minutes). Please click 'Resend Code'."}), 400
        
    if doc.get("otp") != otp:
        return jsonify({"error": "Invalid verification code. Please check your email and try again."}), 400
        
    # Mark verified & invalidate OTP
    config_col.update_one(
        {"_id": "admin_2fa_otp"},
        {"$set": {"verified": True, "otp": "", "used_at": now_ist.isoformat()}}
    )
    
    return jsonify({
        "success": True,
        "message": "Admin 2FA verification successful. Access granted."
    }), 200

@app.route('/api/admin-resend-otp', methods=['POST'])
def admin_resend_otp():
    is_locked, rem_secs, lock_doc = is_admin_locked()
    if is_locked:
        rem_min = (rem_secs + 59) // 60
        return jsonify({
            "error": f"Security Lockdown Active: Admin portal is locked for {rem_min} minute(s). No requests accepted.",
            "locked": True,
            "lockout_remaining_seconds": rem_secs
        }), 423

    if config_col is None:
        return jsonify({"error": "DB error"}), 500
        
    otp = str(random.randint(100000, 999999))
    now_ist = get_now_ist()
    expires_at = now_ist + timedelta(minutes=5)
    
    config_col.update_one(
        {"_id": "admin_2fa_otp"},
        {"$set": {
            "otp": otp,
            "created_at": now_ist.isoformat(),
            "expires_at": expires_at.isoformat(),
            "expires_timestamp": expires_at.timestamp(),
            "target_email": "jsmchamberscuttack2026@gmail.com",
            "verified": False
        }},
        upsert=True
    )
    
    expiry_str = expires_at.strftime("%I:%M %p")
    email_sent = send_admin_2fa_email(otp, expiry_str)
    
    return jsonify({
        "success": True,
        "target_email": "jsmchamberscuttack2026@gmail.com",
        "expires_in_seconds": 300,
        "message": "A fresh 6-digit verification code has been dispatched to jsmchamberscuttack2026@gmail.com (valid for 5 minutes).",
        "email_sent": email_sent
    }), 200

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



def get_premium_email_html(title, client_name, case_number, amount, message, is_verified=False, phase_num='Phase-1'):
    color = "#10b981" if is_verified else "#D4AF37"
    icon = "✅" if is_verified else "📄"
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap');
            body {{
                font-family: 'Plus Jakarta Sans', Arial, sans-serif;
                background-color: #f8fafc;
                margin: 0;
                padding: 0;
            }}
            .container {{
                max-width: 600px;
                margin: 40px auto;
                background: #ffffff;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 4px 20px rgba(0,0,0,0.08);
            }}
            .header {{
                background-color: #051426;
                padding: 30px 40px;
                text-align: center;
                border-bottom: 4px solid #D4AF37;
            }}
            .header h1 {{
                margin: 0;
                color: #D4AF37;
                font-family: 'Playfair Display', serif;
                font-size: 28px;
                letter-spacing: 2px;
            }}
            .content {{
                padding: 40px;
                color: #334155;
                line-height: 1.6;
            }}
            .content h2 {{
                color: #051426;
                font-family: 'Playfair Display', serif;
                margin-top: 0;
                font-size: 24px;
            }}
            .amount-box {{
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                border-left: 4px solid {color};
                padding: 20px;
                margin: 25px 0;
                border-radius: 6px;
            }}
            .amount-box .amount {{
                font-size: 28px;
                font-weight: 700;
                color: {color};
                margin: 10px 0 0 0;
            }}
            .footer {{
                background: #f1f5f9;
                padding: 20px 40px;
                text-align: center;
                color: #64748b;
                font-size: 13px;
                border-top: 1px solid #e2e8f0;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>JSM CHAMBERS</h1>
            </div>
            <div class="content">
                <h2>{title}</h2>
                <p>Dear <strong>{client_name}</strong>,</p>
                <p>{message}</p>
                
                <div class="amount-box">
                    <p style="margin:0; color:#64748b; font-size:14px; text-transform:uppercase; letter-spacing:1px;">Total Amount</p>
                    <p class="amount">{icon} Rs. {amount}</p>
                    <div style="margin:15px 0 0 0; font-size:14px; color:#475569; display: flex; flex-direction: column; gap: 4px;">
                        <div>Phase Number: <strong>{phase_num}</strong></div>
                        <div>Case Ref: <strong>{case_number}</strong></div>
                    </div>
                </div>
                
                <p>Please log in to your Client Dashboard to view your complete billing history and download official receipts.</p>
            </div>
            <div class="footer">
                <p>&copy; 2026 JSM Chambers. All rights reserved.</p>
                <p>This is an automated notification. Please do not reply directly to this email.</p>
            </div>
        </div>
    </body>
    </html>
    """

@app.route('/api/cases/<case_id>/bills', methods=['POST'])
def add_bill(case_id):
    data = request.get_json(force=True, silent=True) or {}
    amount = data.get('amount')
    if not amount:
        return jsonify({"error": "Amount required"}), 400
    
    try:
        case = cases_col.find_one({"_id": ObjectId(case_id)})
        if not case: return jsonify({"error": "Case not found"}), 404
        
        bill_id = str(ObjectId())
        phase_num = f"Phase-{len(case.get('bills', [])) + 1}"
        new_bill = {
            "id": bill_id,
            "amount": amount,
            "date_added": datetime.now().strftime("%d %b %Y"),
            "status": "unpaid",
            "verified_date": None,
            "phase": phase_num
        }
        
        cases_col.update_one(
            {"_id": ObjectId(case_id)},
            {
                "$push": {
                    "bills": new_bill,
                    "notifications": {
                        "date": datetime.now().strftime("%d %b %Y %H:%M"),
                        "message": f"A new fee payment of Rs. {amount} ({phase_num}) has been added to your case."
                    }
                }
            }
        )
        
        # Send Email
        recipient = case.get('email', '')
        if recipient and "@" in recipient:
            msg = MIMEMultipart()
            msg['Date'] = formatdate(localtime=True)
            msg['Message-ID'] = make_msgid()
            msg['From'] = f"JSM Chambers <{SMTP_USER}>"
            msg['To'] = recipient
            case_no = case.get('chamber_case_number', 'N/A')
            msg['Subject'] = f"Important Update: Case Ledger {phase_num} (Ref: {case_no}) - {datetime.now().strftime('%d %b %H:%M:%S')}"
            client_name = case.get('client_name', 'Client')
            message = f"A new fee payment ({phase_num}) has been generated for your legal case. Please review the pending charges at your earliest convenience."
            html_body = get_premium_email_html(f"New Fee Generated: {phase_num}", client_name, case_no, amount, message, is_verified=False, phase_num=phase_num)
            text_body = f"{message}\n\nPhase: {phase_num}\nTotal Amount: Rs. {amount}\nCase Ref: {case_no}\n\nPlease log in to your Client Dashboard to view complete details."
            
            # Create alternative part for better deliverability
            alt = MIMEMultipart('alternative')
            alt.attach(MIMEText(text_body, 'plain'))
            alt.attach(MIMEText(html_body, 'html'))
            msg.attach(alt)
            
            with concurrent.futures.ThreadPoolExecutor() as executor:
                executor.submit(send_email_core, recipient, msg, "New Case Fee Bill Added")
            
        return jsonify({"success": True, "bill": new_bill}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/cases/<case_id>/bills/<bill_id>/verify', methods=['POST'])
def verify_bill(case_id, bill_id):
    try:
        data = request.json or {}
        case = cases_col.find_one({"_id": ObjectId(case_id)})
        if not case: return jsonify({"error": "Case not found"}), 404
        
        bills = case.get('bills', [])
        bill = next((b for b in bills if b.get('id') == bill_id), None)
        if not bill: return jsonify({"error": "Bill not found"}), 404
        
        total_amt = float(bill.get('amount', 0))
        paid_so_far = float(bill.get('paid_amount', 0))
        if bill.get('status') == 'verified':
            paid_so_far = total_amt
            
        payment_received = float(data.get('amount', total_amt - paid_so_far))
        new_paid = paid_so_far + payment_received
        
        status = 'verified' if new_paid >= total_amt else 'partial'
        now_str = datetime.now().strftime("%d %b %Y")
        phase_num = bill.get('phase', 'Phase-1')
        
        cases_col.update_one(
            {"_id": ObjectId(case_id), "bills.id": bill_id},
            {"$set": {
                "bills.$.paid_amount": new_paid,
                "bills.$.status": status,
                "bills.$.verified_date": now_str if status == 'verified' else bill.get('verified_date')
            }}
        )
        
        cases_col.update_one(
            {"_id": ObjectId(case_id)},
            {"$push": {
                "notifications": {
                    "date": datetime.now().strftime("%d %b %Y %H:%M"),
                    "message": f"Payment of Rs. {payment_received} recorded for {phase_num}." + (f" Phase fully cleared. Receipt available." if status == 'verified' else f" Remaining balance for {phase_num}: Rs. {total_amt - new_paid}.")
                }
            }}
        )
        
        # Send Email
        recipient = case.get('email', '')
        if recipient and "@" in recipient:
            msg = MIMEMultipart()
            msg['Date'] = formatdate(localtime=True)
            msg['Message-ID'] = make_msgid()
            msg['From'] = f"JSM Chambers <{SMTP_USER}>"
            msg['To'] = recipient
            case_no = case.get('chamber_case_number', 'N/A')
            client_name = case.get('client_name', 'Client')
            
            if status == 'verified':
                msg['Subject'] = f"Payment Verified: Official Receipt {phase_num} (Ref: {case_no}) - {datetime.now().strftime('%d %b %H:%M:%S')}"
                message = f"We have successfully received your payment of Rs. {payment_received}. Your {phase_num} bill is now fully cleared, and a printable PDF receipt has been securely generated."
                html_body = get_premium_email_html(f"Payment Verified - {phase_num}", client_name, case_no, total_amt, message, is_verified=True, phase_num=phase_num)
                text_body = f"{message}\n\n{phase_num} Amount: Rs. {total_amt}\nFully Paid.\n\nA printable receipt is available in your dashboard."
            else:
                remaining = total_amt - new_paid
                msg['Subject'] = f"Partial Payment Received {phase_num} (Ref: {case_no}) - {datetime.now().strftime('%d %b %H:%M:%S')}"
                message = f"We have received your custom/partial payment of Rs. {payment_received} for {phase_num}. Please clear the remaining balance of Rs. {remaining} as soon as possible."
                html_body = get_premium_email_html(f"Partial Payment Logged - {phase_num}", client_name, case_no, payment_received, message, is_verified=False, phase_num=phase_num)
                text_body = f"{message}\n\nPhase: {phase_num}\nAmount Paid: Rs. {payment_received}\nRemaining Balance: Rs. {remaining}\n\nPlease log in to your dashboard to view the ledger."
            
            alt = MIMEMultipart('alternative')
            alt.attach(MIMEText(text_body, 'plain'))
            alt.attach(MIMEText(html_body, 'html'))
            msg.attach(alt)
            
            with concurrent.futures.ThreadPoolExecutor() as executor:
                executor.submit(send_email_core, recipient, msg, "Payment Received Successfully")
            
        return jsonify({"success": True}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500



@app.route('/api/cases/<case_id>/bills/<bill_id>', methods=['DELETE'])
def delete_bill(case_id, bill_id):
    try:
        cases_col.update_one(
            {"_id": ObjectId(case_id)},
            {"$pull": {"bills": {"id": bill_id}}}
        )
        return jsonify({"success": True}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

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
    email = data.get('email', '').strip().lower()
    code = data.get('password', '').strip()
    case = cases_col.find_one({
        "email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}, 
        "reset_code": code,
        "status": {"$ne": "Finished & Archived"}
    })
    if not case:
        return jsonify({"error": "Invalid verification code or case closed"}), 401
        
    today_str = get_now_ist().strftime("%Y-%m-%d")
    daily = case.get("daily_logins") or {}
    count = int(daily.get("count", 0)) if daily.get("date") == today_str else 0
    
    if count >= 3:
        return jsonify({
            "error": "Daily login limit reached (3/3 used). You have exhausted your allowed 3 logins for today. Access will be unlocked tomorrow.",
            "limit_reached": True,
            "attempts_left": 0,
            "count_today": count
        }), 429
        
    new_count = count + 1
    new_rem = max(0, 3 - new_count)
    cases_col.update_one(
        {"_id": case['_id']}, 
        {"$set": {
            "reset_code": "",
            "daily_logins": {
                "date": today_str,
                "count": new_count,
                "last_login": get_now_ist().isoformat()
            }
        }}
    )
    return jsonify({
        "success": True, 
        "case": {"_id": str(case['_id'])},
        "logins_used": new_count,
        "attempts_left": new_rem,
        "daily_max": 3,
        "message": f"Login successful! You have {new_rem} login(s) remaining for today."
    }), 200

@app.route('/api/forgot-password', methods=['POST'])
def forgot_password():
    try:
        data = request.get_json(force=True, silent=True) or {}
        email = data.get('email', '').strip().lower()
        if not email:
            return jsonify({"error": "Email is required"}), 400
            
        case = cases_col.find_one({
            "email": {"$regex": f"^{re.escape(email)}$", "$options": "i"},
            "status": {"$ne": "Finished & Archived"}
        })
        if not case:
            return jsonify({"error": "No active case found for this email address."}), 404
            
        today_str = get_now_ist().strftime("%Y-%m-%d")
        daily = case.get("daily_logins") or {}
        count = int(daily.get("count", 0)) if daily.get("date") == today_str else 0
        
        if count >= 3:
            return jsonify({
                "error": f"Daily login limit reached (3/3 used). You have reached the maximum allowed 3 logins per day for your client portal. Access will reopen tomorrow.",
                "limit_reached": True,
                "attempts_left": 0,
                "count_today": count,
                "daily_max": 3
            }), 429
            
        attempts_left = 3 - count
        code = ''.join(random.choices(string.digits, k=6))
        cases_col.update_one({"_id": case['_id']}, {"$set": {"reset_code": code}})
        
        email_sent = send_verification_email(case['email'], code, attempts_left=attempts_left, total_logins_today=count)
        
        return jsonify({
            "message": f"Verification code sent to your email. Security Report: You have {attempts_left} login(s) remaining for today.",
            "attempts_left": attempts_left,
            "count_today": count,
            "daily_max": 3,
            "email_sent": email_sent
        }), 200
    except Exception as e:
        logging.error(f"Forgot password crash: {e}")
        return jsonify({"error": "Server error while sending verification code"}), 500

@app.route('/api/verify-code', methods=['POST'])
def verify_code():
    data = request.get_json(force=True, silent=True) or {}
    email = data.get('email', '').strip().lower()
    code = data.get('code', '').strip()
    
    if not email or not code:
        return jsonify({"error": "Email and verification code are required"}), 400
        
    case = cases_col.find_one({
        "email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}, 
        "reset_code": code,
        "status": {"$ne": "Finished & Archived"}
    })
    if not case:
        return jsonify({"error": "Invalid verification code. Please check your email."}), 400
        
    today_str = get_now_ist().strftime("%Y-%m-%d")
    daily = case.get("daily_logins") or {}
    count = int(daily.get("count", 0)) if daily.get("date") == today_str else 0
    
    if count >= 3:
        return jsonify({
            "error": "Daily login limit reached (3/3 used). You cannot log in again today. Please try again tomorrow.",
            "limit_reached": True,
            "attempts_left": 0,
            "count_today": count
        }), 429
        
    new_count = count + 1
    new_rem = max(0, 3 - new_count)
    cases_col.update_one(
        {"_id": case['_id']},
        {"$set": {
            "reset_code": "",
            "daily_logins": {
                "date": today_str,
                "count": new_count,
                "last_login": get_now_ist().isoformat()
            }
        }}
    )
    return jsonify({
        "success": True, 
        "password": case.get('password'), 
        "case": {"_id": str(case['_id'])},
        "logins_used": new_count,
        "attempts_left": new_rem,
        "daily_max": 3,
        "message": f"Login successful! You have {new_rem} login(s) remaining for today."
    }), 200


def ensure_chamber_owner_advocate():
    try:
        setting_doc = settings_col.find_one({"_id": "office_info"}) or {}
        owner_name = str(setting_doc.get("about_chamber_owner_name", "") or "").strip() or "Adv. Jayasankar Mishra"
        owner_email = str(setting_doc.get("email", "") or "").strip() or "jsmchamberscuttack2026@gmail.com"
        owner_phone = str(setting_doc.get("phone", "") or "").strip() or "+91 736353763"
        owner_img = setting_doc.get("about_chamber_owner_image") or setting_doc.get("about_chamber_image1") or "assets/images/advocate_logo.jpg"
        owner_specialty = "35 years of advocacy; specialized in Constitutional Law, Civil Law, Insurance and Banking Law, Education and Technical Education Law, Service and Industrial Law, Land."
        owner_role = "Chamber Owner & Lead Counsel"
        owner_location = str(setting_doc.get("address", "") or "").strip() or "High Court of Orissa, Cuttack"

        owner_adv = advocates_col.find_one({"is_owner": True})
        if not owner_adv:
            owner_adv = advocates_col.find_one({"name": owner_name})
            
        if not owner_adv:
            advocates_col.insert_one({
                "is_owner": True,
                "name": owner_name,
                "email": owner_email,
                "phone": owner_phone,
                "specialty": owner_specialty,
                "role": owner_role,
                "location": owner_location,
                "linkedin": "",
                "imageUrl": owner_img,
                "access_appointments": True,
                "access_clients": True,
                "access_add_case": True,
                "access_voice": True,
                "welcome_mail_sent": True
            })
        else:
            if not owner_adv.get("is_owner"):
                advocates_col.update_one({"_id": owner_adv["_id"]}, {"$set": {"is_owner": True}})
    except Exception as e:
        logging.error(f"Error ensuring chamber owner advocate: {e}")

@app.route('/api/advocates', methods=['GET'])
def get_advocates():
    ensure_chamber_owner_advocate()
    advocates = []
    for adv in advocates_col.find().sort([("is_owner", -1), ("_id", 1)]):
        adv['_id'] = str(adv['_id'])
        advocates.append(adv)
    return jsonify(advocates), 200

def save_advocate_image_file(adv_id, img_data):
    try:
        if img_data and 'base64,' in img_data:
            _, encoded = img_data.split('base64,', 1)
            raw = base64.b64decode(encoded)
            os.makedirs('assets/images/members', exist_ok=True)
            path = f'assets/images/members/{adv_id}.jpg'
            with open(path, 'wb') as f:
                f.write(raw)
    except Exception as e:
        logging.error(f"Error saving advocate image file {adv_id}: {e}")

@app.route('/advocates/<id>/photo.jpg')
@app.route('/api/advocates/<id>/photo.jpg')
def serve_advocate_photo(id):
    try:
        local_file = f"assets/images/members/{id}.jpg"
        if os.path.exists(local_file):
            return send_file(local_file, mimetype='image/jpeg', max_age=86400)
            
        adv = advocates_col.find_one({"_id": ObjectId(id)})
        if not adv:
            return send_from_directory('assets/images', 'advocate_logo.jpg')
            
        img_data = adv.get('imageUrl') or ""
        if 'base64,' in img_data:
            save_advocate_image_file(id, img_data)
            if os.path.exists(local_file):
                return send_file(local_file, mimetype='image/jpeg', max_age=86400)
                
        if adv.get('is_owner'):
            return serve_chamber_owner_image()
            
        return send_from_directory('assets/images', 'advocate_logo.jpg')
    except Exception as e:
        logging.error(f"Error serving advocate photo {id}: {e}")
        return send_from_directory('assets/images', 'advocate_logo.jpg')

@app.route('/api/advocates', methods=['POST'])
def add_advocate():
    data = request.json
    name = data.get('name')
    email = data.get('email')
    specialty = data.get('specialty')
    role = data.get('role', 'Legal Professional')
    location = data.get('location', 'Cuttack, Odisha')
    linkedin = data.get('linkedin', '')
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
        "location": location,
        "linkedin": linkedin,
        "imageUrl": image_url
    })
    
    adv_id = str(result.inserted_id)
    if image_url:
        save_advocate_image_file(adv_id, image_url)
    
    return jsonify({"message": "Advocate added", "id": adv_id, "password": "OTP Only"}), 201

@app.route('/api/advocates/<id>/send-welcome-mail', methods=['POST'])
def send_advocate_welcome_mail(id):
    try:
        adv = advocates_col.find_one({"_id": ObjectId(id)})
        if not adv:
            return jsonify({"error": "Advocate not found"}), 404
            
        email = adv.get('email')
        name = adv.get('name') or "Advocate"
        
        if not email or "@" not in email:
            return jsonify({"error": "Advocate does not have a valid email address"}), 400
            
        msg = MIMEMultipart('alternative')
        msg['Date'] = formatdate(localtime=True)
        msg['Message-ID'] = make_msgid()
        msg['From'] = f"JSM Chambers <{SMTP_USER}>"
        msg['To'] = email
        msg['Subject'] = "Welcome to JSM Chambers - Staff Portal Credentials"
        
        text = (
            f"Dear {name},\n\n"
            f"Welcome to JSM. Chambers! We warmly welcome you to our legal team.\n"
            f"An advocate profile has been created for you.\n\n"
            f"Login ID: {email}\n\n"
            f"Please visit the chamber portal and use the 'Send Verification Code' option to sign in.\n\n"
            f"Best regards,\nJSM. Chambers Management"
        )
        
        html = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 8px 24px rgba(0,0,0,0.06);">
    <tr>
      <td style="background:linear-gradient(135deg, #071322 0%, #0A1628 100%);padding:30px 24px;text-align:center;border-bottom:3px solid #D4AF37;">
        <div style="color:#D4AF37;font-size:11px;font-weight:800;letter-spacing:3px;text-transform:uppercase;margin-bottom:6px;">Legal Counsel & Advocacy</div>
        <h1 style="color:#ffffff;font-size:24px;margin:0;font-weight:700;letter-spacing:1px;">JSM. CHAMBERS</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:32px 28px;">
        <h2 style="color:#0A1628;font-size:20px;margin-top:0;margin-bottom:16px;">Welcome to the Team, {name}</h2>
        <p style="font-size:15px;line-height:1.7;color:#334155;margin-bottom:20px;">
          We warmly welcome you to <strong>JSM. Chambers</strong>. Your advocate profile and chamber credentials have been configured on our staff management portal.
        </p>
        <div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-left:4px solid #D4AF37;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
          <div style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Staff Portal Login ID</div>
          <div style="font-size:17px;font-weight:700;color:#0A1628;">{email}</div>
        </div>
        <p style="font-size:14px;line-height:1.6;color:#475569;margin-bottom:24px;">
          To access the staff portal, navigate to the <strong>Staff / Client Login</strong> section and use the <em>Send Verification Code</em> option with your registered email.
        </p>
        <div style="text-align:center;padding:12px 0;">
          <a href="https://jsm-chamber-cuttack-odisha-30.vercel.app/" style="background:#0A1628;color:#D4AF37;border:1px solid #D4AF37;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:700;font-size:14px;display:inline-block;letter-spacing:0.5px;">Open Chamber Portal →</a>
        </div>
      </td>
    </tr>
    <tr>
      <td style="background:#f8fafc;padding:16px 24px;text-align:center;font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0;">
        © {datetime.utcnow().year} JSM. Chambers · High Court of Orissa, Cuttack · All rights reserved.
      </td>
    </tr>
  </table>
</body>
</html>"""
        
        msg.attach(MIMEText(text, 'plain', 'utf-8'))
        msg.attach(MIMEText(html, 'html', 'utf-8'))
        
        res = send_email_core(email, msg, msg['Subject'])
        if res.get('success'):
            now_iso = datetime.utcnow().isoformat()
            advocates_col.update_one({"_id": ObjectId(id)}, {"$set": {"welcome_mail_sent": True, "welcome_mail_sent_at": now_iso}})
            return jsonify({"success": True, "message": f"Welcome email sent successfully to {email}"}), 200
        else:
            return jsonify({"error": f"Failed to send email: {res.get('smtp_response', 'SMTP error')}"}), 500
    except Exception as e:
        logging.error(f"Error sending welcome email to advocate {id}: {e}")
        return jsonify({"error": str(e)}), 500

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
    data = request.json or {}
    update_fields = {}
    if 'name' in data:
        update_fields['name'] = data['name']
    if 'email' in data:
        update_fields['email'] = data['email']
    if 'specialty' in data:
        update_fields['specialty'] = data['specialty']
    if 'role' in data:
        update_fields['role'] = data['role']
    if 'location' in data:
        update_fields['location'] = data['location']
    if 'linkedin' in data:
        update_fields['linkedin'] = data['linkedin']
    if 'phone' in data:
        update_fields['phone'] = data['phone']
    if 'imageUrl' in data:
        update_fields['imageUrl'] = data['imageUrl']
    if not update_fields:
        return jsonify({"error": "No fields to update"}), 400
        
    try:
        adv = advocates_col.find_one({"_id": ObjectId(id)})
        if not adv:
            return jsonify({"error": "Advocate not found"}), 404
            
        advocates_col.update_one({"_id": ObjectId(id)}, {"$set": update_fields})
        
        if 'imageUrl' in update_fields and update_fields['imageUrl']:
            save_advocate_image_file(id, update_fields['imageUrl'])
        
        # If updating chamber owner, sync relevant fields with office_info
        if adv.get('is_owner'):
            office_update = {}
            if 'name' in update_fields:
                office_update['about_chamber_owner_name'] = update_fields['name']
            if 'imageUrl' in update_fields and update_fields['imageUrl']:
                office_update['about_chamber_owner_image'] = update_fields['imageUrl']
            if 'phone' in update_fields:
                office_update['phone'] = update_fields['phone']
            if 'email' in update_fields:
                office_update['email'] = update_fields['email']
            if office_update:
                settings_col.update_one({"_id": "office_info"}, {"$set": office_update}, upsert=True)
                
        return jsonify({"message": "Advocate updated successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/api/advocates/<id>', methods=['DELETE'])
def delete_advocate(id):
    try:
        adv = advocates_col.find_one({"_id": ObjectId(id)})
        if adv and adv.get('is_owner'):
            return jsonify({"error": "Chamber Owner is permanent and cannot be deleted."}), 400
        result = advocates_col.delete_one({"_id": ObjectId(id)})
        if result.deleted_count:
            return jsonify({"message": "Advocate deleted"}), 200
        return jsonify({"error": "Advocate not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 400

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



DEFAULT_SERVICES = [
    {
        "title": "Civil Litigation",
        "short_desc": "Expert representation in civil disputes, property matters and contractual disagreements.",
        "icon": "⚖",
        "order": 1,
        "book_pages": [
            {
                "chapter": "Overview & Practice Scope",
                "content": "JSM Chambers provides distinguished legal counsel across the broad spectrum of civil disputes. Our civil litigation practice represents individuals, institutions, and corporations in civil original suits, money recovery claims, declaratory suits, injunctions, and specific performance of contracts. We maintain a meticulous approach to drafting pleadings, conducting cross-examinations, and preparing appellate arguments before the District Courts and the High Court."
            },
            {
                "chapter": "Property & Real Estate Law",
                "content": "Our property litigation team specializes in partition suits, boundary disputes, title investigations, land acquisition matters, and eviction proceedings under rent control statutes. We represent buyers, sellers, and builders in resolving real estate conflicts and consumer forum actions. In contractual matters, we aggressively seek damages, restitution, and specific enforcement for commercial breaches."
            },
            {
                "chapter": "Appeals & Strategic Advisory",
                "content": "Appellate litigation demands razor-sharp legal acumen. We prepare and argue First Appeals, Second Appeals, Civil Revision Petitions, and Writ Petitions before the Hon'ble High Court. Every case is supported by deep research into statutory precedents and Supreme Court citations to construct bulletproof legal theories for our clients."
            },
            {
                "chapter": "Our Courtroom Track Record",
                "content": "At JSM Chambers, every client receives personalized attention. From pre-litigation legal notices to interim relief hearings and final execution decrees, our dedicated advocates ensure timely filing, transparent case tracking, and unwavering courtroom advocacy."
            }
        ]
    },
    {
        "title": "Criminal Defense",
        "short_desc": "Defense strategy, legal representation, bail applications and trial advocacy.",
        "icon": "◈",
        "order": 2,
        "book_pages": [
            {
                "chapter": "Constitutional & Criminal Safeguards",
                "content": "Criminal proceedings jeopardize liberty and reputation. Our defense counsel provides round-the-clock emergency assistance, from preliminary police station appearances to formal chargesheet filings. We safeguard constitutional rights under Articles 20, 21, and 22 of the Constitution, ensuring fair trial adherence at every stage."
            },
            {
                "chapter": "Bail & Anticipatory Protection",
                "content": "Time is of the essence in criminal defense. We specialize in swift, persuasive Anticipatory Bail applications before the Sessions Courts and High Courts, as well as Regular Bail, Interim Bail, and Default Bail petitions under the Code of Criminal Procedure. Our persuasive arguments highlight lack of flight risk, witness tampering safeguards, and prima facie infirmities in prosecution allegations."
            },
            {
                "chapter": "Trial Strategy & Cross-Examination",
                "content": "The hallmark of criminal defense is masterful cross-examination. Our senior advocates dissect witness testimonies, scrutinize forensic and electronic evidence, and expose investigative procedural lapses, ensuring the highest standard of reasonable doubt."
            },
            {
                "chapter": "White-Collar & Quashing Proceedings",
                "content": "We handle complex white-collar crimes including financial fraud, economic offences, cybercrime, defamation, and corporate malfeasance. Furthermore, we actively file Section 482 Quashing Petitions to strike down frivolous and malicious FIRs before the High Court."
            }
        ]
    },
    {
        "title": "Corporate & Commercial Law",
        "short_desc": "Corporate advisory, commercial disputes, compliance, contracts and business matters.",
        "icon": "▣",
        "order": 3,
        "book_pages": [
            {
                "chapter": "Corporate Governance & Advisory",
                "content": "JSM Chambers acts as strategic legal partners to startups, enterprises, and multinational corporations. We advise boards of directors and executive leadership on corporate governance, statutory compliance, Companies Act mandates, and regulatory scrutiny by the Ministry of Corporate Affairs and SEBI."
            },
            {
                "chapter": "Commercial Drafting & Negotiation",
                "content": "A strong contract is the bedrock of business stability. We draft, review, and negotiate high-stakes agreements including Shareholder Agreements, Joint Ventures, Master Service Agreements, Intellectual Property licenses, Non-Disclosure Agreements, and Vendor Contracts, eliminating ambiguities that lead to costly litigation."
            },
            {
                "chapter": "Insolvency & Debt Recovery (IBC / NCLT)",
                "content": "We maintain an active practice before the National Company Law Tribunal (NCLT) and NCLAT for Corporate Insolvency Resolution Processes (CIRP) under the Insolvency and Bankruptcy Code. We represent both financial and operational creditors seeking rapid recovery as well as corporate debtors in distress."
            },
            {
                "chapter": "Arbitration & ADR",
                "content": "We prioritize fast-track commercial dispute resolution through domestic and international arbitration. Our team handles interim relief measures, arbitrator appointments, and arbitral award challenges before the Commercial Division of the High Court."
            }
        ]
    },
    {
        "title": "Family & Matrimonial Law",
        "short_desc": "Professional handling of matrimonial, custody, maintenance and family-related disputes.",
        "icon": "◇",
        "order": 4,
        "book_pages": [
            {
                "chapter": "Compassionate & Discreet Advocacy",
                "content": "Family disputes require legal precision paired with profound empathy and discretion. JSM Chambers provides compassionate yet resolute representation in mutual consent divorces, contested marital dissolution, judicial separation, and restitution of conjugal rights under the Hindu Marriage Act, Special Marriage Act, and personal laws."
            },
            {
                "chapter": "Child Custody & Guardianship",
                "content": "The welfare of the child is paramount in our approach. We navigate contentious child custody petitions, interim visitation schedules, and guardianship disputes, advocating vigorously for sustainable parenting arrangements that prioritize the emotional and educational stability of the minor."
            },
            {
                "chapter": "Maintenance, Alimony & Domestic Violence",
                "content": "We represent clients in maintenance proceedings under Section 125 CrPC, Section 24 HMA, and the Protection of Women from Domestic Violence Act. We ensure fair assessment of spousal lifestyle, asset disclosure, and equitable permanent alimony determinations."
            },
            {
                "chapter": "Pre-Litigation Mediation & Settlements",
                "content": "Wherever feasible, we champion confidential mediation to prevent acrimonious public court battles. Our experienced counsel facilitates fair asset division, financial settlements, and MoU drafting to secure peaceful resolution for families."
            }
        ]
    }
]

@app.route('/api/services', methods=['GET'])
def get_services():
    if services_col is None: return jsonify([])
    try:
        if services_col.count_documents({}) == 0:
            services_col.insert_many(DEFAULT_SERVICES)
    except Exception as e:
        logging.error(f"Error seeding services: {e}")
        
    services = list(services_col.find().sort("order", 1))
    for s in services:
        s['_id'] = str(s['_id'])
    return jsonify(services), 200

@app.route('/api/services', methods=['POST'])
def add_service():
    if services_col is None: return jsonify({"error": "DB error"}), 500
    data = request.get_json(force=True, silent=True) or {}
    title = data.get('title', '').strip()
    if not title:
        return jsonify({"error": "Service title is required"}), 400
    new_service = {
        "title": title,
        "short_desc": data.get('short_desc', '').strip(),
        "icon": data.get('icon', '⚖').strip(),
        "order": int(data.get('order', 99)),
        "book_pages": data.get('book_pages', [])
    }
    result = services_col.insert_one(new_service)
    new_service['_id'] = str(result.inserted_id)
    return jsonify(new_service), 201

@app.route('/api/services/<id>', methods=['PUT'])
def update_service(id):
    if services_col is None: return jsonify({"error": "DB error"}), 500
    data = request.get_json(force=True, silent=True) or {}
    update_fields = {}
    if 'title' in data: update_fields['title'] = data['title'].strip()
    if 'short_desc' in data: update_fields['short_desc'] = data['short_desc'].strip()
    if 'icon' in data: update_fields['icon'] = data['icon'].strip()
    if 'order' in data: update_fields['order'] = int(data['order'])
    if 'book_pages' in data: update_fields['book_pages'] = data['book_pages']
    
    services_col.update_one({"_id": ObjectId(id)}, {"$set": update_fields})
    return jsonify({"success": True}), 200

@app.route('/api/services/<id>', methods=['DELETE'])
def delete_service(id):
    if services_col is None: return jsonify({"error": "DB error"}), 500
    services_col.delete_one({"_id": ObjectId(id)})
    return jsonify({"success": True}), 200

# ==========================================
# NEWS AND INSIGHTS MANAGEMENT API
# ==========================================
DEFAULT_NEWS = [
    {
        "title": "Supreme Court Clarifies Guidelines on Section 482 CrPC for Quashing FIRs",
        "category": "Supreme Court Update",
        "date": "2026-10-24",
        "author": "JSM Legal Research Wing",
        "summary": "In a landmark precedent, the Apex Court emphasizes preventing malicious prosecution and upholding personal liberty where civil disputes are dressed up as criminal offenses.",
        "content": "The Supreme Court of India in its recent judgment has reiterated the fundamental parameters governing the exercise of inherent powers by High Courts under Section 482 of the Code of Criminal Procedure (now Section 528 of the Bharatiya Nagarik Suraksha Sanhita).\n\nThe Bench held that High Courts must not hesitate to quash criminal proceedings if the dispute is essentially of a commercial or civil character, and criminal prosecution has been weaponized as an arm-twisting tactic.\n\nOur criminal defense practice regularly invokes these constitutional safeguards to protect clients from harassment, securing timely pre-arrest bail and discharge remedies.",
        "image": "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=900&q=80",
        "icon": "⚖️",
        "order": 1
    },
    {
        "title": "Orissa High Court Reiterates Test of Irreparable Injury in Temporary Injunctions",
        "category": "High Court Ruling",
        "date": "2026-10-18",
        "author": "Advocate Jaya Sankar Mishra & Associates",
        "summary": "The High Court rules that mere establishing of a prima facie case is inadequate without conclusive proof of irreparable loss and balance of convenience under Order XXXIX Rules 1 & 2.",
        "content": "Delivering an essential ruling in property and declaratory suits, the High Court of Orissa clarified the rigorous three-pronged test governing temporary injunction applications.\n\nThe Court observed that injunction is an equitable remedy, and judicial discretion must balance hardship carefully between the parties. The ruling highlights the necessity for detailed documentation and site inspection reports at the interlocutory stage.\n\nAt JSM Chambers, our civil litigation team specializes in drafting comprehensive interim applications and urgent mentions before the roster benches.",
        "image": "https://images.unsplash.com/photo-1453733197783-64a088968997?auto=format&fit=crop&w=900&q=80",
        "icon": "🏛️",
        "order": 2
    },
    {
        "title": "Fast-Track Commercial Arbitration: Navigating Statutory Timelines & Enforcement",
        "category": "Corporate & Commercial",
        "date": "2026-10-10",
        "author": "Corporate Advisory Team",
        "summary": "Key insights into the enforcement of domestic arbitral awards under Section 34 & 36 of the Arbitration Act, emphasizing speed and commercial certainty.",
        "content": "With commercial disputes demanding rapid adjudication to preserve capital and operational momentum, institutional arbitration has taken center stage in India's legal ecosystem.\n\nThis monograph explores recent judicial trends concerning minimal court intervention, the enforcement of foreign seated awards, and expedited tribunal constitutions under the amended rules.\n\nOur chambers advises enterprises, joint ventures, and contractors on structuring robust dispute resolution clauses that pre-empt multi-year litigation.",
        "image": "https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=900&q=80",
        "icon": "📜",
        "order": 3
    }
]

@app.route('/api/news', methods=['GET'])
def get_news():
    if news_col is None: return jsonify([])
    try:
        if news_col.count_documents({}) == 0:
            news_col.insert_many(DEFAULT_NEWS)
    except Exception as e:
        logging.error(f"Error seeding news: {e}")
        
    news = list(news_col.find().sort("date", -1))
    for n in news:
        n['_id'] = str(n['_id'])
        n['image_url'] = n.get('image') or n.get('image_url') or ''
        n['icon'] = n.get('icon') or '⚖️'
    return jsonify(news), 200

@app.route('/api/news', methods=['POST'])
def add_news():
    if news_col is None: return jsonify({"error": "DB error"}), 500
    data = request.get_json(force=True, silent=True) or {}
    
    if data.get('is_staff'):
        return add_staff_news()
        
    title = data.get('title', '').strip()
    if not title:
        return jsonify({"error": "Article title is required"}), 400
        
    new_article = {
        "title": title,
        "category": data.get('category', 'Judicial Update').strip(),
        "date": data.get('date', get_now_ist().strftime("%Y-%m-%d")),
        "author": data.get('author', 'JSM Chambers').strip(),
        "author_email": data.get('author_email', '').strip().lower(),
        "staff_id": data.get('staff_id', '').strip(),
        "summary": data.get('summary', '').strip(),
        "content": data.get('content', '').strip(),
        "icon": data.get('icon', '⚖️').strip(),
        "image": (data.get('image') or data.get('image_url') or '').strip(),
        "order": int(data.get('order', 99)),
        "created_at": get_now_ist().isoformat()
    }
    result = news_col.insert_one(new_article)
    new_article['_id'] = str(result.inserted_id)
    new_article['image_url'] = new_article['image']
    return jsonify(new_article), 201

@app.route('/api/news/<id>', methods=['PUT'])
def update_news(id):
    if news_col is None: return jsonify({"error": "DB error"}), 500
    data = request.get_json(force=True, silent=True) or {}
    update_fields = {}
    if 'title' in data: update_fields['title'] = data['title'].strip()
    if 'category' in data: update_fields['category'] = data['category'].strip()
    if 'date' in data: update_fields['date'] = data['date'].strip()
    if 'author' in data: update_fields['author'] = data['author'].strip()
    if 'summary' in data: update_fields['summary'] = data['summary'].strip()
    if 'content' in data: update_fields['content'] = data['content'].strip()
    if 'icon' in data: update_fields['icon'] = data['icon'].strip()
    if 'image' in data: update_fields['image'] = data['image'].strip()
    if 'image_url' in data: update_fields['image'] = data['image_url'].strip()
    if 'order' in data: update_fields['order'] = int(data['order'])
    
    news_col.update_one({"_id": ObjectId(id)}, {"$set": update_fields})
    return jsonify({"success": True}), 200

@app.route('/api/news/<id>', methods=['DELETE'])
def delete_news(id):
    if news_col is None: return jsonify({"error": "DB error"}), 500
    news_col.delete_one({"_id": ObjectId(id)})
    return jsonify({"success": True}), 200

# =========================================================
# STAFF DASHBOARD NEWS & INSIGHTS (1 Per Day Limit)
# =========================================================
@app.route('/api/staff/news-status', methods=['GET'])
def get_staff_news_status():
    if news_col is None: return jsonify({"error": "DB error"}), 500
    email = request.args.get('email', '').strip().lower()
    staff_id = request.args.get('staff_id', '').strip()
    
    if not email and not staff_id:
        return jsonify({"error": "Staff email or staff_id is required"}), 400
        
    today_str = get_now_ist().strftime("%Y-%m-%d")
    
    # Query for articles matching this staff member
    or_clauses = []
    if email:
        or_clauses.append({"author_email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}})
    if staff_id:
        or_clauses.append({"staff_id": staff_id})
        
    query_identity = {"$or": or_clauses} if len(or_clauses) > 1 else or_clauses[0]
    
    # Check if article already uploaded today
    today_query = {
        "$and": [
            query_identity,
            {"date": today_str}
        ]
    }
    
    today_article = news_col.find_one(today_query)
    if today_article:
        today_article['_id'] = str(today_article['_id'])
        today_article['image_url'] = today_article.get('image') or today_article.get('image_url') or ''
        return jsonify({
            "can_upload": False,
            "limit_reached": True,
            "today": today_str,
            "today_article": today_article,
            "message": f"Daily limit reached: You have already published your 1 News & Insights article for today ({today_str}). Next submission opens tomorrow."
        }), 200
        
    # Get past articles by this staff member
    try:
        past_articles = list(news_col.find(query_identity).sort("date", -1).limit(20))
        for a in past_articles:
            a['_id'] = str(a['_id'])
            a['image_url'] = a.get('image') or a.get('image_url') or ''
    except Exception as e:
        past_articles = []
        
    return jsonify({
        "can_upload": True,
        "limit_reached": False,
        "today": today_str,
        "today_article": None,
        "past_articles": past_articles,
        "message": f"Daily quota available: You are allowed to upload 1 article today ({today_str})."
    }), 200

@app.route('/api/staff/news', methods=['POST'])
def add_staff_news():
    if news_col is None: return jsonify({"error": "DB error"}), 500
    data = request.get_json(force=True, silent=True) or {}
    
    email = data.get('author_email', '').strip().lower()
    staff_id = data.get('staff_id', '').strip()
    author_name = data.get('author', '').strip() or 'Staff Advocate'
    
    if not email and not staff_id:
        return jsonify({"error": "Author email or staff_id is required"}), 400
        
    title = data.get('title', '').strip()
    if not title:
        return jsonify({"error": "Article title is required"}), 400
        
    summary = data.get('summary', '').strip()
    content = data.get('content', '').strip()
    if not summary and not content:
        return jsonify({"error": "Article summary or content is required"}), 400
        
    today_str = get_now_ist().strftime("%Y-%m-%d")
    
    # 1-per-day enforcement
    or_clauses = []
    if email:
        or_clauses.append({"author_email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}})
    if staff_id:
        or_clauses.append({"staff_id": staff_id})
    query_identity = {"$or": or_clauses} if len(or_clauses) > 1 else or_clauses[0]
    
    existing_today = news_col.find_one({
        "$and": [
            query_identity,
            {"date": today_str}
        ]
    })
    
    if existing_today:
        return jsonify({
            "error": f"Daily limit reached: You have already published 1 News & Insights article today ({today_str}). Only 1 article per staff member per day is allowed. Please try again tomorrow.",
            "limit_reached": True,
            "today": today_str,
            "published_title": existing_today.get('title', '')
        }), 429
        
    new_article = {
        "title": title,
        "category": data.get('category', 'Chamber Insights').strip() or 'Chamber Insights',
        "date": today_str,
        "author": author_name,
        "author_email": email,
        "staff_id": staff_id,
        "summary": summary,
        "content": content or summary,
        "icon": data.get('icon', '⚖️').strip() or '⚖️',
        "image": (data.get('image') or data.get('image_url') or '').strip(),
        "order": 1,
        "is_staff_post": True,
        "created_at": get_now_ist().isoformat()
    }
    
    result = news_col.insert_one(new_article)
    new_article['_id'] = str(result.inserted_id)
    new_article['image_url'] = new_article['image']
    
    return jsonify({
        "success": True,
        "message": "News & Insights article published successfully! (Daily quota: 1/1 used for today)",
        "article": new_article
    }), 201

# =========================================================
# TODAY'S OPINION (Day-wise Chamber Editorial & Insights)
# =========================================================

def get_default_opinions():
    now_ist = get_now_ist()
    return [
        {
            "date": now_ist.strftime("%Y-%m-%d"),
            "title": "Constitutional Due Process & Institutional Restraint in Judicial Review",
            "author": "Managing Counsel",
            "category": "Constitutional Law",
            "message": "The equilibrium between executive expediency and judicial scrutiny remains the lodestar of our constitutional order. Under Article 226 and Article 32, the High Courts and Supreme Court serve not merely as appellate corrections, but as vigilance posts ensuring that state discretion does not degenerate into administrative arbitrariness.\n\nRecent jurisprudence reinforces that procedural fairness is not an ornamental formality; it is the lifeblood of administrative validity. Where documentary records reveal an absence of reasoned deliberation, judicial intervention is not just permitted—it is constitutionally mandated.",
            "order": 1
        },
        {
            "date": (now_ist - timedelta(days=1)).strftime("%Y-%m-%d"),
            "title": "Minimal Court Intervention & Expedited Enforcement in Commercial Arbitration",
            "author": "Chamber Arbitration Bench",
            "category": "Arbitration & Commercial",
            "message": "The modern commercial landscape demands that arbitration awards be respected as definitive adjudications rather than interim milestones. The narrow aperture of Section 34 of the Arbitration and Conciliation Act mandates that courts refrain from re-evaluating evidentiary conclusions or substituting their own view for that of the arbitral tribunal.\n\nParties drafting commercial pacts must prioritize clear forum selection, institutional rules, and well-defined terms of reference. Precision in the arbitration clause ensures prompt enforcement under Section 36 without multi-year appellate detours.",
            "order": 2
        },
        {
            "date": (now_ist - timedelta(days=2)).strftime("%Y-%m-%d"),
            "title": "Evidentiary Rigor & Forensic Documentary Review in Complex Civil Trials",
            "author": "Senior Advocate",
            "category": "Civil Jurisprudence",
            "message": "Trial advocacy in high-stakes civil and property disputes is fundamentally won during the discovery and documentary admission phases. Oral testimony, however compelling, cannot cure deficits in foundational pleadings or unproven exhibited documents under the Evidence Act.\n\nOur chamber's trial philosophy centers on comprehensive chronological indexing, admissibility scrutiny, and anticipating cross-examination vectors long before the matter reaches final oral arguments.",
            "order": 3
        }
    ]

def is_opinions_seeded():
    if config_col is None: return False
    doc = config_col.find_one({"_id": "opinions_seeded_flag"})
    return doc is not None and doc.get("seeded") is True

def mark_opinions_seeded():
    if config_col is not None:
        try:
            config_col.update_one(
                {"_id": "opinions_seeded_flag"},
                {"$set": {"seeded": True, "updated_at": get_now_ist().isoformat()}},
                upsert=True
            )
        except Exception:
            pass

@app.route('/api/opinions', methods=['GET'])
def get_opinions():
    if opinions_col is None:
        return jsonify([])
    try:
        if not is_opinions_seeded():
            if opinions_col.count_documents({}) == 0:
                opinions_col.insert_many(get_default_opinions())
            mark_opinions_seeded()
    except Exception as e:
        logging.error(f"Error seeding opinions: {e}")
        
    try:
        date_filter = request.args.get('date')
        query = {"date": date_filter} if date_filter else {}
        
        opinions = list(opinions_col.find(query).sort([("date", -1), ("order", 1)]))
        for op in opinions:
            op['_id'] = str(op['_id'])
            op['category'] = op.get('category') or 'Legal Editorial'
            op['author'] = op.get('author') or 'Chamber Counsel'
        return jsonify(opinions), 200
    except Exception as e:
        logging.error(f"Error fetching opinions: {e}")
        return jsonify([]), 200

@app.route('/api/opinions', methods=['POST'])
def add_opinion():
    if opinions_col is None: return jsonify({"error": "DB error"}), 500
    try:
        data = request.get_json(force=True, silent=True) or {}
        title = data.get('title', '').strip()
        message = data.get('message', '').strip()
        now_ist = get_now_ist()
        date_val = data.get('date', '').strip() or now_ist.strftime("%Y-%m-%d")
        
        if not title:
            return jsonify({"error": "Opinion title is required"}), 400
        if not message:
            return jsonify({"error": "Opinion message content is required"}), 400
            
        new_op = {
            "title": title,
            "date": date_val,
            "author": data.get('author', 'Chamber Counsel').strip(),
            "category": data.get('category', 'Legal Editorial').strip(),
            "message": message,
            "order": int(data.get('order', 1)),
            "created_at": now_ist.strftime("%Y-%m-%d %H:%M:%S")
        }
        result = opinions_col.insert_one(new_op)
        new_op['_id'] = str(result.inserted_id)
        return jsonify(new_op), 201
    except Exception as e:
        logging.error(f"Error adding opinion: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/opinions/<id>', methods=['PUT'])
def update_opinion(id):
    if opinions_col is None: return jsonify({"error": "DB error"}), 500
    try:
        data = request.get_json(force=True, silent=True) or {}
        update_fields = {}
        if 'title' in data: update_fields['title'] = data['title'].strip()
        if 'date' in data: update_fields['date'] = data['date'].strip()
        if 'author' in data: update_fields['author'] = data['author'].strip()
        if 'category' in data: update_fields['category'] = data['category'].strip()
        if 'message' in data: update_fields['message'] = data['message'].strip()
        if 'order' in data: update_fields['order'] = int(data['order'])
        
        opinions_col.update_one({"_id": ObjectId(id)}, {"$set": update_fields})
        return jsonify({"success": True}), 200
    except Exception as e:
        logging.error(f"Error updating opinion {id}: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/opinions/<id>', methods=['DELETE'])
def delete_opinion(id):
    if opinions_col is None: return jsonify({"error": "DB error"}), 500
    try:
        opinions_col.delete_one({"_id": ObjectId(id)})
        mark_opinions_seeded()
        return jsonify({"success": True}), 200
    except Exception as e:
        logging.error(f"Error deleting opinion {id}: {e}")
        return jsonify({"error": str(e)}), 500


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
        
        is_general = ai_payload.get('is_general_query', False)
        general_resp = ai_payload.get('general_response', '')
        
        if is_general or (general_resp and not search_criteria):
            return jsonify({"status": "general_query", "message": general_resp}), 200
            
        if not search_criteria and not proposed_changes:
             return jsonify({"status": "error", "message": "Could not understand the command. Please specify a case."}), 400
             
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