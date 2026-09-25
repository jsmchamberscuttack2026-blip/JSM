import re

with open('staff-dashboard.html', 'r') as f:
    html = f.read()

# Remove the lock gates entirely
lock_gates = ['appointments', 'clients', 'addcase']

for section in lock_gates:
    gate_pattern = re.compile(rf'<div id="lock-gate-{section}"[^>]*>.*?</div>\s*</div>\s*</div>', re.DOTALL)
    html = gate_pattern.sub('', html)
    
    # Remove the content wrapper start tag (e.g. <div id="content-appointments" style="display: none;">)
    wrapper_pattern = re.compile(rf'<div id="content-{section}"[^>]*>', re.IGNORECASE)
    html = wrapper_pattern.sub('', html)
    
    # Actually wait! The wrapper might have a closing div at the end of the section.
    # We shouldn't do a naive regex replacement without being careful. Let's inspect the HTML of the sections.

