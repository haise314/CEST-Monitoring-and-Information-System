import re, pathlib, shutil

def edit(path, fn):
    p = pathlib.Path(path); s = p.read_text(encoding='utf-8'); n = fn(s)
    assert n != s, f'no change: {path}'
    p.write_text(n, encoding='utf-8'); print('ok', path)

def lit(*pairs):
    def f(s):
        for a, b in pairs:
            assert a in s, f'missing: {a!r}'
            s = s.replace(a, b)
        return s
    return f

CATS = "const BENEFICIARY_CATEGORIES = ['LGU', 'BLGU', 'SUC', 'NGA', 'SDO', 'Academe', 'NGO', 'Cooperative', 'Private', 'Others']"

# agency embeds now point at beneficiaries (alias keeps `agencies` in the result shape)
EMB = ('agencies (id, name)', 'agencies:beneficiaries!agency_id (id, name)')
for f in ('useProjects', 'useAllDocuments', 'useAllRemarks'):
    edit(f'src/hooks/{f}.js', lit(EMB))
edit('src/hooks/useProjectParties.js',
     lit(('agencies (id, name, type)', 'agencies:beneficiaries!agency_id (id, name, type:category)')))

# more organization categories
for f in ('src/pages/projects/ProjectDetail.jsx', 'src/pages/projects/ProjectParties.jsx', 'src/pages/projects/addModal.jsx'):
    edit(f, lambda s: re.sub(r"^const BENEFICIARY_CATEGORIES = .*$", CATS, s, flags=re.M))
edit('src/pages/beneficiaries/BeneficiaryModal.jsx',
     lambda s: re.sub(r"^const CATEGORIES = .*$",
        "const CATEGORIES = ['LGU', 'BLGU', 'SUC', 'NGA', 'SDO', 'Academe', 'NGO', 'Cooperative', 'Private', 'Others']", s, flags=re.M))
edit('src/lib/projectAgencies.js',
     lambda s: re.sub(r"^export const AGENCY_TYPES = .*$",
        "export const AGENCY_TYPES = ['LGU', 'BLGU', 'SUC', 'NGA', 'SDO', 'Academe', 'NGO', 'Cooperative', 'Private', 'Others']", s, flags=re.M))

# Backup page: no separate agencies table anymore
edit('src/pages/backup/Backup.jsx', lambda s: re.sub(r"^  agencies: .*\n", "", s, flags=re.M))

# Remove the Agencies page + route + nav entry
edit('src/App.jsx', lit(("import Agencies from './pages/agencies/Agencies'\n", ''),
                        ("      { path: '/agencies', element: <Agencies /> },\n", '')))
edit('src/components/layout/navConfig.jsx', lambda s: (
    lambda t: t.replace("label: 'Beneficiaries'", "label: 'Organizations'")
)(re.sub(r"^.*to: '/agencies'.*\n", "",
         re.sub(r"const AgenciesIcon = .*?\n\)\n\n", "", s, flags=re.S | re.M), flags=re.M)))
shutil.rmtree('src/pages/agencies'); print('removed src/pages/agencies')

# Command palette: agencies are already covered by beneficiaries
def palette(s):
    s = s.replace("import { useAgencies } from '../../hooks/useAgencies'\n", '')
    s = re.sub(r"^\s*const \{ agencies, loading: al \}.*\n", "", s, flags=re.M)
    s = re.sub(r"    for \(const a of agencies\) \{.*?\n    \}\n", "", s, flags=re.S)
    s = s.replace("[projects, beneficiaries, contacts, agencies])", "[projects, beneficiaries, contacts])")
    s = s.replace("pl || bl || cl || al", "pl || bl || cl")
    s = s.replace("['project', 'beneficiary', 'contact', 'agency']", "['project', 'beneficiary', 'contact']")
    s = s.replace("beneficiary: 'Beneficiaries'", "beneficiary: 'Organizations'")
    return s
edit('src/components/layout/CommandPalette.jsx', palette)

# Beneficiaries page -> Organizations list with role counts
edit('src/pages/beneficiaries/Beneficiaries.jsx', lit(
    ("import { useBeneficiaries, projectCount } from", "import { useBeneficiaries, projectCount, usageCount, implementingCount, cooperatingCount } from"),
    ("linkedProjectCount={editingBeneficiary ? projectCount(editingBeneficiary) : 0}",
     "linkedProjectCount={editingBeneficiary ? usageCount(editingBeneficiary) : 0}"),
    ("          Beneficiaries\n          <span", "          Organizations\n          <span"),
    ("+ Add Beneficiary", "+ Add Organization"),
    ("{n} project{n === 1 ? '' : 's'}",
     "{n} as beneficiary · {implementingCount(b)} implementing · {cooperatingCount(b)} cooperating"),
))