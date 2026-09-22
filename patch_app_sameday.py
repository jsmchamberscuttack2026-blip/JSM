import re

with open('app.py', 'r') as f:
    content = f.read()

# Update /api/appointments/vacancy
old_vacancy = """    if day_name not in available_days:
        return jsonify({"available": False, "message": f"Closed on {day_name}s"}), 200
        
    count = appointments_col.count_documents({"appointment_date": date_str})"""

new_vacancy = """    if day_name not in available_days:
        return jsonify({"available": False, "message": f"Closed on {day_name}s"}), 200
        
    if parsed_date.date() == datetime.now().date():
        sh, sm = map(int, settings.get("start_time", "10:00").split(':'))
        start_time_dt = datetime.now().replace(hour=sh, minute=sm, second=0, microsecond=0)
        if datetime.now() > start_time_dt:
            return jsonify({"available": False, "message": "Booking closed for today"}), 200
            
    count = appointments_col.count_documents({"appointment_date": date_str})"""

content = content.replace(old_vacancy, new_vacancy)


# Update /api/appointments
old_post = """    if day_name not in available_days:
        return jsonify({"error": f"We do not accept appointments on {day_name}s. Please choose an available day: {', '.join(available_days)}."}), 400
        
    date_str = requested_date
    count = appointments_col.count_documents({"appointment_date": date_str})"""

new_post = """    if day_name not in available_days:
        return jsonify({"error": f"We do not accept appointments on {day_name}s. Please choose an available day: {', '.join(available_days)}."}), 400
        
    if parsed_date.date() == datetime.now().date():
        sh, sm = map(int, start_time_str.split(':'))
        start_time_dt = datetime.now().replace(hour=sh, minute=sm, second=0, microsecond=0)
        if datetime.now() > start_time_dt:
            return jsonify({"error": "Same-day bookings are not allowed after the day's start time has passed. Please select a future date."}), 400

    date_str = requested_date
    count = appointments_col.count_documents({"appointment_date": date_str})"""

content = content.replace(old_post, new_post)

with open('app.py', 'w') as f:
    f.write(content)
