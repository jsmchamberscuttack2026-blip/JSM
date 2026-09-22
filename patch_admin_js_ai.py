import re

with open('js/admin.js', 'r') as f:
    content = f.read()

ai_js = """
// ==========================================
// AI VOICE ASSISTANT MODULE
// ==========================================

let aiRecognition = null;
let aiConfirmationRecognition = null;
let currentAiPayload = null;
let isAiListening = false;
let isAiConfirming = false;

function initSpeechRecognition() {
    window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!window.SpeechRecognition) {
        alert("Your browser does not support Speech Recognition. Please use Google Chrome or Microsoft Edge.");
        return null;
    }
    const recognition = new window.SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    return recognition;
}

window.startAiVoice = function() {
    if (isAiListening) return;
    
    aiRecognition = initSpeechRecognition();
    if (!aiRecognition) return;
    
    const overlay = document.getElementById('ai-listening-overlay');
    const preview = document.getElementById('ai-transcript-preview');
    
    overlay.style.display = 'flex';
    preview.innerText = "Speak now...";
    isAiListening = true;
    
    let finalTranscript = '';
    
    aiRecognition.onresult = function(event) {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }
        preview.innerText = finalTranscript + interimTranscript;
    };
    
    aiRecognition.onerror = function(event) {
        console.error("Speech Recognition Error", event.error);
        if (event.error !== 'no-speech') {
            alert("Microphone error: " + event.error);
            overlay.style.display = 'none';
            isAiListening = false;
        }
    };
    
    aiRecognition.onend = function() {
        isAiListening = false;
        if (finalTranscript.trim().length > 0) {
            preview.innerText = "Processing command...";
            processAiTranscript(finalTranscript.trim());
        } else {
            overlay.style.display = 'none';
        }
    };
    
    aiRecognition.start();
};

async function processAiTranscript(transcript) {
    try {
        const res = await fetch('/api/ai/parse-command', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ transcript })
        });
        const data = await res.json();
        
        document.getElementById('ai-listening-overlay').style.display = 'none';
        
        if (data.status === 'confirm') {
            showAiConfirmModal(data.case, data.proposed_changes, transcript);
        } else if (data.status === 'multiple_matches') {
            // Future enhancement: show disambiguation UI
            alert("Found multiple cases matching your voice request. Please be more specific with the Case Number.");
        } else {
            alert(data.message || "Could not process your request.");
        }
        
    } catch (err) {
        console.error(err);
        document.getElementById('ai-listening-overlay').style.display = 'none';
        alert("Server error processing voice command.");
    }
}

function showAiConfirmModal(targetCase, changes, originalTranscript) {
    const modal = document.getElementById('ai-confirm-modal');
    document.getElementById('ai-confirm-case-title').innerText = `${targetCase.client_name} (Case: ${targetCase.chamber_case_number || '-'})`;
    document.getElementById('ai-confirm-case-subtitle').innerText = `Court No: ${targetCase.court_case_number || '-'} | Type: ${targetCase.case_type || '-'}`;
    
    const list = document.getElementById('ai-confirm-changes-list');
    list.innerHTML = '';
    
    for (const [key, value] of Object.entries(changes)) {
        list.innerHTML += `<li><strong>${key.replace('_', ' ').toUpperCase()}:</strong> ${value}</li>`;
    }
    
    currentAiPayload = {
        case_id: targetCase._id,
        changes: changes,
        transcript: originalTranscript,
        admin_id: window.globalAdminId || 'Admin'
    };
    
    modal.style.display = 'flex';
    
    // Start listening for verbal Confirm/Cancel
    startAiConfirmationListening();
}

function startAiConfirmationListening() {
    if (isAiConfirming) return;
    
    aiConfirmationRecognition = initSpeechRecognition();
    if (!aiConfirmationRecognition) return;
    
    aiConfirmationRecognition.continuous = true;
    aiConfirmationRecognition.interimResults = false;
    isAiConfirming = true;
    
    document.getElementById('ai-voice-prompt').style.display = 'flex';
    
    aiConfirmationRecognition.onresult = function(event) {
        const last = event.results.length - 1;
        const text = event.results[last][0].transcript.trim().toLowerCase();
        
        console.log("Confirmation heard:", text);
        
        if (text.includes('confirm') || text.includes('yes') || text.includes('proceed') || text.includes('apply')) {
            aiConfirmationRecognition.stop();
            confirmAiAction();
        } else if (text.includes('cancel') || text.includes('no') || text.includes('stop') || text.includes('abort')) {
            aiConfirmationRecognition.stop();
            cancelAiAction();
        }
    };
    
    aiConfirmationRecognition.onend = function() {
        isAiConfirming = false;
        // Optionally restart if modal is still open, but for now we let it end after a while.
        document.getElementById('ai-voice-prompt').style.display = 'none';
    };
    
    aiConfirmationRecognition.start();
}

window.cancelAiAction = function() {
    if (aiConfirmationRecognition && isAiConfirming) {
        aiConfirmationRecognition.stop();
    }
    document.getElementById('ai-confirm-modal').style.display = 'none';
    currentAiPayload = null;
};

window.confirmAiAction = async function() {
    if (aiConfirmationRecognition && isAiConfirming) {
        aiConfirmationRecognition.stop();
    }
    
    const btn = document.querySelector('#ai-confirm-modal .btn-primary');
    btn.innerText = 'Updating...';
    btn.disabled = true;
    
    try {
        const res = await fetch('/api/ai/execute-command', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(currentAiPayload)
        });
        
        if (res.ok) {
            alert("Case updated successfully via AI!");
            document.getElementById('ai-confirm-modal').style.display = 'none';
            // Reload cases UI
            if (typeof loadAllCases === 'function') loadAllCases();
            if (typeof loadRecentCases === 'function') loadRecentCases();
        } else {
            const data = await res.json();
            alert("Failed to update: " + data.error);
        }
    } catch(err) {
        console.error(err);
        alert("Server error applying changes.");
    }
    
    btn.innerText = 'Confirm Update';
    btn.disabled = false;
    currentAiPayload = null;
};
"""

content = content + "\n\n" + ai_js

with open('js/admin.js', 'w') as f:
    f.write(content)
