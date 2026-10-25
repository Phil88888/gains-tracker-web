#!/bin/zsh
# Legt das öffentliche GitHub-Repo an (nur beim ersten Mal), lädt die Seite hoch und schaltet GitHub Pages ein.
cd "$(dirname "$0")"
GH=~/.local/bin/gh
REPO=gains-tracker-web
git add -A && git commit -qm "Webseite $(date +%d.%m.%Y)" 2>/dev/null
if ! git remote get-url origin >/dev/null 2>&1; then
  $GH repo create "$REPO" --public --source=. --push --description "Webseite der App Gains Tracker" || { read "?Fehler – Enter"; exit 1; }
  $GH api -X POST "repos/{owner}/$REPO/pages" -f "source[branch]=main" -f "source[path]=/" >/dev/null && echo "GitHub Pages eingeschaltet."
else
  git push -q
fi
USER=$($GH api user -q .login)
echo ""
echo "Fertig. In 1–2 Minuten online unter: https://${USER:l}.github.io/$REPO/"
read "?Enter drücken zum Schliessen"
