import re
import json

with open(r'C:\Users\cjysu\.gemini\antigravity\brain\29c68174-3514-4da4-a283-62d907ccd0b5\.system_generated\tasks\task-2958.log', 'r', encoding='utf-8') as f:
    text = f.read()

# Find the JSON array Window captured errors: [...]
match = re.search(r'Window captured errors: (\[.*?\])\s*at run', text, re.DOTALL)
if match:
    err_json = match.group(1)
    errs = json.loads(err_json)
    print(f'Total captured errors: {len(errs)}')
    for idx, e in enumerate(errs[:15]):
        print(f"\n--- ERROR {idx+1} ---")
        print("Message:", e.get("message"))
        print("Stack:\n", e.get("stack", "")[:300])
else:
    print('Pattern not matched, searching messages...')
    msgs = re.findall(r'"message":"(.*?)"', text)
    print(f'Total messages: {len(msgs)}')
    for idx, m in enumerate(msgs[:10]):
        print(f'{idx+1}: {m}')
