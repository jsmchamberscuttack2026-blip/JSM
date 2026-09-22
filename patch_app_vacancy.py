import re

with open('app.py', 'r') as f:
    content = f.read()

new_route = """
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
        
    count = appointments_col.count_documents({"appointment_date": date_str})
    remaining = max_per_day - count
    
    if remaining <= 0:
        return jsonify({"available": False, "message": "Fully booked"}), 200
        
    return jsonify({"available": True, "remaining": remaining}), 200

"""

content = content.replace("@app.route('/api/appointments', methods=['POST'])", new_route + "\n@app.route('/api/appointments', methods=['POST'])")

with open('app.py', 'w') as f:
    f.write(content)
