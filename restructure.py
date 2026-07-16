import os
import shutil

root = '/Users/ujjwaljain/LedgerX'

# 1. Move API
if os.path.exists(os.path.join(root, 'apps/api')):
    shutil.move(os.path.join(root, 'apps/api'), os.path.join(root, 'server'))

# 2. Merge firebase-shared into apps/web/src/lib/firebase
firebase_dest = os.path.join(root, 'apps/web/src/lib/firebase')
os.makedirs(firebase_dest, exist_ok=True)
firebase_src = os.path.join(root, 'packages/firebase-shared/src')
for item in os.listdir(firebase_src):
    shutil.move(os.path.join(firebase_src, item), os.path.join(firebase_dest, item))

# 3. Find and replace imports in apps/web/src
web_src = os.path.join(root, 'apps/web/src')
for dirpath, _, filenames in os.walk(web_src):
    for f in filenames:
        if f.endswith('.ts') or f.endswith('.tsx'):
            filepath = os.path.join(dirpath, f)
            with open(filepath, 'r', encoding='utf-8') as file:
                content = file.read()
            content = content.replace("'@ledgerx/firebase-shared'", "'@/lib/firebase'")
            content = content.replace('"@ledgerx/firebase-shared"', '"@/lib/firebase"')
            with open(filepath, 'w', encoding='utf-8') as file:
                file.write(content)

# 4. Move web files to root
files_to_move = ['src', 'public', 'index.html', 'vite.config.ts', 'tailwind.config.js', 'tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json', '.oxlintrc.json']
for item in files_to_move:
    src_path = os.path.join(root, 'apps/web', item)
    dest_path = os.path.join(root, item)
    if os.path.exists(src_path):
        if os.path.exists(dest_path):
            if os.path.isdir(dest_path):
                shutil.rmtree(dest_path)
            else:
                os.remove(dest_path)
        shutil.move(src_path, dest_path)

# 5. Remove apps and packages
shutil.rmtree(os.path.join(root, 'apps'))
shutil.rmtree(os.path.join(root, 'packages'))
