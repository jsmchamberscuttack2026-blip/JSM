import re

with open('admin-dashboard.html', 'r') as f:
    content = f.read()

# 1. Add Mic Button to Header
old_header = """            <header class="header">
                <div>
                    <h2>Admin Dashboard</h2>
                    <p style="color: var(--color-text-light);">System Overview</p>
                </div>
                <div>
                </div>
            </header>"""

new_header = """            <header class="header">
                <div>
                    <h2>Admin Dashboard</h2>
                    <p style="color: var(--color-text-light);">System Overview</p>
                </div>
                <div style="display: flex; gap: 1rem; align-items: center;">
                    <button id="ai-voice-btn" class="btn btn-primary" onclick="startAiVoice()" style="background: linear-gradient(135deg, #102a43, #D4AF37); color: white; display: flex; align-items: center; gap: 8px; border: none; padding: 0.6rem 1.2rem; border-radius: 8px; box-shadow: 0 4px 15px rgba(212, 175, 55, 0.3);">
                        <span style="font-size: 1.2rem;">🎙️</span> AI Voice Update
                    </button>
                </div>
            </header>"""

content = content.replace(old_header, new_header)

# 2. Add AI Voice Modals before the closing </body> tag
ai_modals = """
<!-- AI Voice Overlays -->
<div id="ai-listening-overlay" style="display: none; position: fixed; inset: 0; background: rgba(16, 42, 67, 0.9); z-index: 10000; align-items: center; justify-content: center; flex-direction: column;">
    <div style="width: 100px; height: 100px; border-radius: 50%; background: #D4AF37; display: flex; align-items: center; justify-content: center; font-size: 3rem; animation: pulse-ai 1.5s infinite; box-shadow: 0 0 30px rgba(212, 175, 55, 0.6);">🎙️</div>
    <h2 style="color: white; margin-top: 2rem; font-family: 'Poppins', sans-serif;">Listening...</h2>
    <p id="ai-transcript-preview" style="color: #cbd5e1; font-size: 1.1rem; margin-top: 1rem; max-width: 600px; text-align: center; font-style: italic;"></p>
</div>

<div id="ai-confirm-modal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 10000; align-items: center; justify-content: center;">
    <div style="background: white; padding: 2.5rem; border-radius: 12px; max-width: 500px; width: 90%; box-shadow: 0 10px 40px rgba(0,0,0,0.2);">
        <h2 style="color: var(--color-primary); margin-top: 0; border-bottom: 2px solid #f1f5f9; padding-bottom: 10px;">🤖 AI Action Confirmation</h2>
        <p style="color: #64748b; font-size: 0.9rem;">Please confirm the changes the AI intends to make.</p>
        
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1.5rem; margin: 1.5rem 0;">
            <h4 style="margin: 0 0 10px 0; color: #334155;">Target Case:</h4>
            <p id="ai-confirm-case-title" style="margin: 0; font-weight: bold; color: #0f172a;"></p>
            <p id="ai-confirm-case-subtitle" style="margin: 5px 0 0 0; font-size: 0.85rem; color: #64748b;"></p>
            
            <h4 style="margin: 15px 0 10px 0; color: #334155; border-top: 1px solid #e2e8f0; padding-top: 15px;">Proposed Changes:</h4>
            <ul id="ai-confirm-changes-list" style="margin: 0; padding-left: 20px; color: #0f172a;"></ul>
        </div>
        
        <div id="ai-voice-prompt" style="text-align: center; margin-bottom: 15px; color: #e11d48; font-weight: bold; font-size: 0.9rem; display: flex; align-items: center; justify-content: center; gap: 8px;">
            <span style="display: inline-block; width: 10px; height: 10px; background: #e11d48; border-radius: 50%; animation: pulse-ai 1s infinite;"></span> Listening for "Confirm" or "Cancel"...
        </div>

        <div style="display: flex; gap: 10px; justify-content: flex-end;">
            <button class="btn btn-outline" onclick="cancelAiAction()">Cancel</button>
            <button class="btn btn-primary" onclick="confirmAiAction()">Confirm Update</button>
        </div>
    </div>
</div>

<style>
@keyframes pulse-ai {
    0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(212, 175, 55, 0.7); }
    70% { transform: scale(1.1); box-shadow: 0 0 0 20px rgba(212, 175, 55, 0); }
    100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(212, 175, 55, 0); }
}
</style>
"""

content = content.replace("</body>", ai_modals + "\n</body>")

with open('admin-dashboard.html', 'w') as f:
    f.write(content)
