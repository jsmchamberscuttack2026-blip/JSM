import re

with open('app.py', 'r') as f:
    content = f.read()

# 1. Add import and setup
import_str = """import string
import json
import google.generativeai as genai

# Setup Gemini API
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "AQ.Ab8RN6IBMVFLPYgY4N6qkf5E0qLnB9xgvgtqjlND2hITrOsNPA")
genai.configure(api_key=GEMINI_API_KEY)
"""
content = content.replace("import string", import_str)

# 2. Add collection
col_str = """    gallery_col = db['gallery']
    ai_audit_logs_col = db['ai_audit_logs']"""
content = content.replace("    gallery_col = db['gallery']", col_str)

# 3. Add API routes
ai_routes = """
@app.route('/api/ai/parse-command', methods=['POST'])
def parse_ai_command():
    # Only allow admins (in real production, add @login_required decorator equivalent)
    data = request.json
    transcript = data.get('transcript', '')
    
    if not transcript:
        return jsonify({"error": "No transcript provided"}), 400
        
    try:
        # Prompt the Gemini model to parse the request
        model = genai.GenerativeModel('gemini-1.5-flash')
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
            }}
        }}
        Do not wrap the JSON in Markdown or backticks. Return the raw JSON string. If a field is not mentioned, omit it.
        '''
        
        response = model.generate_content(prompt)
        response_text = response.text.strip()
        
        # Clean markdown if present
        if response_text.startswith('```json'):
            response_text = response_text[7:-3].strip()
        elif response_text.startswith('```'):
            response_text = response_text[3:-3].strip()
            
        ai_payload = json.loads(response_text)
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
            
        matching_cases = list(cases_col.find(query).limit(5))
        for c in matching_cases:
            c['_id'] = str(c['_id'])
            
        if len(matching_cases) == 0:
            return jsonify({"status": "not_found", "message": "No cases matched your criteria."})
        elif len(matching_cases) == 1:
            return jsonify({
                "status": "confirm",
                "case": matching_cases[0],
                "proposed_changes": proposed_changes
            })
        else:
            return jsonify({
                "status": "multiple_matches",
                "cases": matching_cases,
                "proposed_changes": proposed_changes
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
    
    if not case_id or not changes:
        return jsonify({"error": "Invalid payload"}), 400
        
    try:
        # Get old case state
        old_case = cases_col.find_one({"_id": ObjectId(case_id)})
        
        # Apply changes
        cases_col.update_one({"_id": ObjectId(case_id)}, {"$set": changes})
        
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
"""

content = content + "\n" + ai_routes

with open('app.py', 'w') as f:
    f.write(content)
