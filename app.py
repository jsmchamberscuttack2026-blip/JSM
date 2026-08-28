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
MONGO_URI = os.environ.get("MONGO_URI", "mongodb+srv://arnnavpanda2006_db_user:w52rYxHisbslJ4hp@cluster0.fxakspf.mongodb.net/?appName=Cluster0")
DB_NAME = os.environ.get("DB_NAME", "jsmchambers_db")
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "jsmchamberscuttack2026@gmail.com")
SENDER_PASSWORD = os.environ.get("SENDER_PASSWORD", "tqqm pcze xens hygo")

import certifi

# MongoDB Setup
try:
    client = MongoClient(MONGO_URI, tlsCAFile=certifi.where())
    db = client[DB_NAME]
    appointments_col = db['appointments']
    advocates_col = db['advocates']
    print("Successfully connected to MongoDB")
except Exception as e:
    print(f"Error connecting to MongoDB: {e}")

# Helper Function: Send Email
def send_approval_email(recipient_email, name, service, date, time):
    try:
        msg = MIMEMultipart()
        msg['From'] = SENDER_EMAIL
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

        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SENDER_EMAIL, SENDER_PASSWORD)
        text = msg.as_string()
        server.sendmail(SENDER_EMAIL, recipient_email, text)
        server.quit()
        return True
    except Exception as e:
        print(f"Failed to send email: {e}")
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
    appointments_col.update_one(
        {"_id": ObjectId(appt_id)},
        {"$set": {
            "status": "Approved",
            "appointment_date": date,
            "appointment_time": time
        }}
    )

    # Send Email
    email_sent = send_approval_email(appt['email'], appt['name'], appt['service'], date, time)

    socketio.emit('appointments_updated')

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
    socketio.run(app, host='0.0.0.0', port=port, debug=False)
