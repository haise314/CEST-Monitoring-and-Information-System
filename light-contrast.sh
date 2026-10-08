#!/usr/bin/env bash
# Light-mode contrast pass. Run from the project root (the folder containing src/).
# Makes a .bak copy of every file it touches. Review with `git diff`.
#
# Rule: gray-300 is for borders only; gray-400 is for placeholders/disabled.
# Anything a person has to READ becomes gray-500 (4.6:1 on white) or darker.
set -euo pipefail

edit() { # edit <file> <sed-expression>
  [ -f "$1" ] || { echo "skip (not found): $1"; return; }
  sed -i.bak -E "$2" "$1"
  echo "patched: $1"
}

# Section titles (uppercase "PROJECT INFO" etc.)
edit src/pages/projects/ProjectDetail.jsx            's/(text-xs font-semibold )text-gray-400( uppercase tracking-wider mb-3)/\1text-gray-500\2/'
edit src/pages/projects/editPanel.jsx                's/(text-xs font-semibold )text-gray-400( uppercase tracking-wider mb-3)/\1text-gray-500\2/'
edit src/pages/beneficiaries/BeneficiaryContacts.jsx 's/(text-xs font-semibold )text-gray-400( uppercase tracking-wider mb-2)/\1text-gray-500\2/'
edit src/pages/projects/addModal.jsx                 's/(text-xs font-semibold )text-gray-500( uppercase tracking-wider mb-2\.5)/\1text-gray-600\2/'

# Remarks: Delete button + divider dot
edit src/pages/projects/RemarksSection.jsx 's/text-gray-300 hover:text-red-500/text-gray-500 hover:text-red-600/; s/text-xs text-gray-300/text-xs text-gray-500/'

# Pages where text-gray-400 is only ever a readable label/hint/empty state
for f in \
  src/pages/dashboard/Dashboard.jsx \
  src/pages/budget/Budget.jsx \
  src/pages/overview/Overview.jsx \
  src/pages/projects/ProjectContacts.jsx \
  src/pages/beneficiaries/BeneficiaryContacts.jsx \
  src/pages/documents/Documents.jsx \
  src/pages/projects/RemarksSection.jsx
do
  edit "$f" 's/(^|[^:-])text-gray-400/\1text-gray-500/g'
done

echo
echo "Done. Backups are *.bak; remove with:  find src -name '*.bak' -delete"
