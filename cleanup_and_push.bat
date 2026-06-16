@echo off
cd /d "%~dp0"
echo === Removing git lock ===
del .git\index.lock 2>nul

echo === Removing HopDong_template.docx from all history ===
git filter-branch --force --index-filter "git rm --cached --ignore-unmatch HopDong_template.docx" --prune-empty --tag-name-filter cat -- --all

echo === Adding to .gitignore ===
git add .gitignore
git add -A
git commit -m "chore: remove template file, update gitignore"

echo === Force push ===
git push origin main --force

echo === Cleanup filter-branch backup refs ===
git for-each-ref --format="delete %%(refname)" refs/original | git update-ref --stdin
git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo.
echo DONE! Kiem tra tren GitHub de xac nhan.
pause
