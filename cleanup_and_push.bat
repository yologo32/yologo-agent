@echo off
cd /d "%~dp0"
echo === Removing git lock ===
del .git\index.lock 2>nul

echo === Removing HopDong_template.docx from all history ===
git filter-branch --force --index-filter "git rm --cached --ignore-unmatch HopDong_template.docx" --prune-empty --tag-name-filter cat -- --all

echo === Cleanup backup refs ===
git for-each-ref --format="delete %%(refname)" refs/original | git update-ref --stdin
git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo.
echo DONE! File da duoc xoa khoi lich su local.
pause
