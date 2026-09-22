import re

with open('app.py', 'r') as f:
    content = f.read()

# Replace the genai logic with standard requests logic
old_logic = """        # Prompt the Gemini model to parse the request
        model = genai.GenerativeModel('gemini-pro')
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
        response_text = response.text.strip()"""

new_logic = """        # Prompt the Gemini model using direct REST API to avoid SDK version issues
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
        
        import requests
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"
        headers = {'Content-Type': 'application/json'}
        payload = {
            "contents": [{"parts": [{"text": prompt}]}]
        }
        resp = requests.post(url, headers=headers, json=payload)
        
        if resp.status_code != 200:
            return jsonify({"status": "error", "message": f"Gemini API Error: {resp.text}"}), 500
            
        data = resp.json()
        try:
            response_text = data['candidates'][0]['content']['parts'][0]['text'].strip()
        except KeyError:
            return jsonify({"status": "error", "message": "Unexpected response from Gemini API"}), 500"""

content = content.replace(old_logic, new_logic)

with open('app.py', 'w') as f:
    f.write(content)
    print("Patched app.py to use requests for Gemini API.")
