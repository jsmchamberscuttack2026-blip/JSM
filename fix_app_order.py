import re

with open('app.py', 'r') as f:
    content = f.read()

# Separate the bottom part (from `if __name__ == '__main__':`)
split_str = "if __name__ == '__main__':\n    app.run(debug=False, port=8081, host='0.0.0.0')"
parts = content.split(split_str)

if len(parts) == 2:
    # Everything after split_str is the AI routes!
    ai_routes = parts[1]
    # Move them BEFORE split_str
    new_content = parts[0] + ai_routes + "\n\n" + split_str
    with open('app.py', 'w') as f:
        f.write(new_content)
        print("Success")
else:
    print("Could not split!")
