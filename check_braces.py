def check_braces(filename):
    with open(filename, 'r') as f:
        content = f.read()
    
    stack = []
    lines = content.split('\n')
    for i, line in enumerate(lines):
        for char in line:
            if char in '{[(': 
                stack.append((char, i+1))
            elif char in '}])':
                if not stack:
                    print(f"Unmatched {char} on line {i+1}")
                    return False
                top, _ = stack.pop()
                if (top == '{' and char != '}') or \
                   (top == '[' and char != ']') or \
                   (top == '(' and char != ')'):
                    print(f"Mismatched {char} on line {i+1}")
                    return False
    if stack:
        print(f"Unclosed {stack[-1][0]} from line {stack[-1][1]}")
        return False
    print("Braces are perfectly balanced.")
    return True

check_braces('js/admin.js')
