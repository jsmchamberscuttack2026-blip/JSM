import gevent.monkey
gevent.monkey.patch_all()

import os
from flask import Flask, request, jsonify, send_from_directory
from flask_socketio import SocketIO
from pymongo import MongoClient
from bson import ObjectId
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime

app = Flask(__name__, static_folder='.', static_url_path='')
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, cors_allowed_origins="*")

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
        msg['From'] = SMTP_USER
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
    socketio.emit('appointments_updated')
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

    socketio.emit('appointments_updated')

    if email_sent:
        logging.info(f"Approval successful and email sent for appointment {appt_id}")
    else:
        logging.warning(f"Approval successful but email failed for appointment {appt_id}")

    return jsonify({
        "message": "Appointment approved successfully",
        "email_sent": email_sent
    }), 200

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
    socketio.emit('advocates_updated')
    return jsonify({"message": "Advocate added", "id": str(result.inserted_id)}), 201

@app.route('/api/advocates/<id>', methods=['DELETE'])
def delete_advocate(id):
    result = advocates_col.delete_one({"_id": ObjectId(id)})
    if result.deleted_count > 0:
        socketio.emit('advocates_updated')
        return jsonify({"message": "Deleted successfully"}), 200
    return jsonify({"error": "Not found"}), 404

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 8081))
    socketio.run(app, host='0.0.0.0', port=port, debug=False, allow_unsafe_werkzeug=True)
