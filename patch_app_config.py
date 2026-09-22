import re

with open('app.py', 'r') as f:
    content = f.read()

# 1. Update get_system_config
old_get_config = """def get_system_config():
    config = ensure_daily_passwords()
    config['_id'] = str(config['_id']) if '_id' in config else None
    return jsonify(config), 200"""

new_get_config = """def get_system_config():
    config = ensure_daily_passwords()
    global_config = config_col.find_one({"_id": "global_config"}) or {}
    config['appointment_settings'] = global_config.get('appointment_settings', {})
    config['_id'] = str(config['_id']) if '_id' in config else None
    return jsonify(config), 200"""

content = content.replace(old_get_config, new_get_config)


# 2. Update POST /api/appointments
old_post_appt = """@app.route('/api/appointments', methods=['POST'])
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
        return jsonify({"error": "No appointment slots available in the next 30 days."}), 400"""

new_post_appt = """@app.route('/api/appointments', methods=['POST'])
def create_appointment():
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
    available_days = settings.get("available_days", ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"])
    start_time_str = settings.get("start_time", "10:00")
    end_time_str = settings.get("end_time", "17:00")
    max_per_day = int(settings.get("max_per_day", 5))
    
    day_name = parsed_date.strftime("%A")
    if day_name not in available_days:
        return jsonify({"error": f"We do not accept appointments on {day_name}s. Please choose an available day: {', '.join(available_days)}."}), 400
        
    date_str = requested_date
    count = appointments_col.count_documents({"appointment_date": date_str})
    
    if count >= max_per_day:
        return jsonify({"error": "This day is fully booked. Please select another date."}), 400
        
    # calculate time slot
    sh, sm = map(int, start_time_str.split(':'))
    eh, em = map(int, end_time_str.split(':'))
    total_mins = (eh*60 + em) - (sh*60 + sm)
    slot_size = total_mins / max_per_day
    
    start_mins = (sh*60 + sm) + (count * slot_size)
    ah = int(start_mins // 60)
    am = int(start_mins % 60)
    assigned_time = f"{ah:02d}:{am:02d}"
    assigned_date = date_str"""

content = content.replace(old_post_appt, new_post_appt)


# 3. Update Email Body to HTML format
old_email = """        body = f\"\"\"Dear {name},

Your appointment has been successfully scheduled.

Date: {assigned_date}
Time: {assigned_time}
Subject: {subject}

Please find your official appointment slip attached.

Regards,
JSM Chambers\"\"\"
        msg.attach(MIMEText(body, 'plain'))"""

new_email = """        body_html = f\"\"\"
        <html>
        <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
            <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #D4AF37;">Appointment Confirmed</h2>
                <p>Dear <strong>{name}</strong>,</p>
                <p>Your appointment has been successfully scheduled. Below are your confirmed details:</p>
                
                <table style="width: 100%; margin-top: 15px; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Date:</strong></td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">{assigned_date}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Time:</strong></td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">{assigned_time}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Subject/Reason:</strong></td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">{subject}</td>
                    </tr>
                </table>
                
                <p style="margin-top: 20px;">Please find your official PDF appointment slip attached to this email. You may be asked to present this upon arrival.</p>
                <p>Regards,<br><strong>JSM Chambers</strong></p>
            </div>
        </body>
        </html>
        \"\"\"
        msg.attach(MIMEText(body_html, 'html'))"""

content = content.replace(old_email, new_email)

with open('app.py', 'w') as f:
    f.write(content)
