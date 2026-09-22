import re

with open('admin-dashboard.html', 'r') as f:
    content = f.read()

# We need to remove the first occurrence of the availability settings block
# It starts at "<!-- Availability Settings -->" and ends at `<table class="data-table" style="margin-top: 2rem;">`

pattern = re.compile(r'<!-- Availability Settings -->.*?<table class="data-table" style="margin-top: 2rem;">', re.DOTALL)

# Find all occurrences
matches = pattern.findall(content)
if len(matches) > 1:
    # Replace the first occurrence with just the table tag
    content = content.replace(matches[0], '<table class="data-table" style="margin-top: 2rem;">', 1)
    
    with open('admin-dashboard.html', 'w') as f:
        f.write(content)
    print("Fixed duplicate injection.")
else:
    print("No duplicates found.")
