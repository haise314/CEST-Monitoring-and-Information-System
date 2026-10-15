#!/usr/bin/env bash
set -e
python3 - <<'PY'
import re, pathlib

def edit(path, fn):
    p = pathlib.Path(path)
    s = fn(p.read_text(), path)
    p.write_text(s)

def lit(s, old, new, f):
    assert s.count(old) == 1, f'{f}: expected 1 match for {old[:60]!r}, got {s.count(old)}'
    return s.replace(old, new)

BUTTON = '''
                {canEdit && !addingEntryPoint && (
                  <button
                    type="button"
                    onClick={() => setShowEntryManager(true)}
                    disabled={dirty}
                    title={dirty ? 'Save your other changes first' : 'Rename or delete entry points'}
                    className="text-xs text-blue-500 hover:text-blue-700 underline mt-1 disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
                  >
                    Manage entry points
                  </button>
                )}'''

def add_button(s, f):
    pat = re.compile(r'<option value="__new_entry__">\+ Add new entry point\.\.\.</option>\s*</Select>\s*\)\}')
    assert len(pat.findall(s)) == 1, f'{f}: entry point select not found exactly once'
    return pat.sub(lambda m: m.group(0) + BUTTON, s)

# ── useProjects: quiet refetch (no loading flash) ──
def f_useProjects(s, f):
    s = lit(s, 'async function fetchProjects() {', 'async function fetchProjects(silent = false) {', f)
    s = lit(s, 'setLoading(true)', 'if (!silent) setLoading(true)', f)
    s = lit(s, 'refetch: fetchProjects,', 'refetch: fetchProjects,\n    refetchQuiet: () => fetchProjects(true),', f)
    return s
edit('src/hooks/useProjects.js', f_useProjects)

# ── useFormData: refresh the entry-point dropdown options ──
def f_useFormData(s, f):
    old = 'return { projectTypes, beneficiaries, entryPoints, loading, addProjectType, addBeneficiary, refetchProjectTypes }'
    new = '''// Silent refresh of the entry-point options (after the manager renames/deletes).
  async function refetchEntryPoints() {
    const { data } = await supabase.from('project_instances').select('entry_point').not('entry_point', 'is', null)
    if (data) setEntryPoints([...new Set(data.map(r => r.entry_point).filter(Boolean))].sort())
  }

  return { projectTypes, beneficiaries, entryPoints, loading, addProjectType, addBeneficiary, refetchProjectTypes, refetchEntryPoints }'''
    return lit(s, old, new, f)
edit('src/hooks/useFormData.js', f_useFormData)

# ── Full project page ──
def f_detail(s, f):
    s = lit(s, "import ProjectTypesManager from './ProjectTypesManager'",
            "import ProjectTypesManager from './ProjectTypesManager'\nimport EntryPointsManager from './EntryPointsManager'", f)
    s = lit(s, 'const { projects, loading, updateProject, deleteProject, reassignBeneficiary } = useProjects()',
            'const { projects, loading, updateProject, deleteProject, reassignBeneficiary, refetchQuiet: refetchProjects } = useProjects()', f)
    s = lit(s, 'addProjectType, addBeneficiary, refetchProjectTypes } = useFormData()',
            'addProjectType, addBeneficiary, refetchProjectTypes, refetchEntryPoints } = useFormData()', f)
    s = lit(s, 'const [showTypeManager, setShowTypeManager]',
            'const [showEntryManager, setShowEntryManager] = useState(false)\n  const [showTypeManager, setShowTypeManager]', f)
    s = add_button(s, f)
    s = lit(s, '{showTypeManager && (', '''{showEntryManager && (
        <EntryPointsManager
          onClose={() => setShowEntryManager(false)}
          onChanged={() => Promise.all([refetchEntryPoints(), refetchProjects()])}
        />
      )}

      {showTypeManager && (''', f)
    return s
edit('src/pages/projects/ProjectDetail.jsx', f_detail)

# ── Edit modal ──
def f_edit(s, f):
    s = lit(s, "import ProjectContacts from './ProjectContacts'",
            "import ProjectContacts from './ProjectContacts'\nimport EntryPointsManager from './EntryPointsManager'", f)
    s = lit(s, 'export default function EditPanel({ project, onClose, onUpdate, onDelete, onDocumentsChanged }) {',
            'export default function EditPanel({ project, onClose, onUpdate, onDelete, onDocumentsChanged, onProjectsChanged }) {', f)
    s = lit(s, 'const { projectTypes, entryPoints, loading } = useFormData()',
            'const { projectTypes, entryPoints, loading, refetchEntryPoints } = useFormData()', f)
    s = lit(s, 'const [addingEntryPoint, setAddingEntryPoint]',
            'const [showEntryManager, setShowEntryManager] = useState(false)\n  const [addingEntryPoint, setAddingEntryPoint]', f)
    s = add_button(s, f)
    s = lit(s, '{showCategoryWarning && (', '''{showEntryManager && (
        <EntryPointsManager
          onClose={() => setShowEntryManager(false)}
          onChanged={async () => { await refetchEntryPoints(); await onProjectsChanged?.() }}
        />
      )}

      {showCategoryWarning && (''', f)
    return s
edit('src/pages/projects/editPanel.jsx', f_edit)

# ── Pages that open the modal: let it refresh the project list quietly ──
edit('src/pages/projects/Projects.jsx', lambda s, f: lit(lit(s,
    'const { projects, loading, error, addProject, updateProject, deleteProject } = useProjects()',
    'const { projects, loading, error, addProject, updateProject, deleteProject, refetchQuiet } = useProjects()', f),
    'onDelete={deleteProject}', 'onDelete={deleteProject}\n          onProjectsChanged={refetchQuiet}', f))

edit('src/pages/documents/Documents.jsx', lambda s, f: lit(lit(s,
    'const { projects, loading: projectsLoading, updateProject, deleteProject } = useProjects()',
    'const { projects, loading: projectsLoading, updateProject, deleteProject, refetchQuiet } = useProjects()', f),
    'onDocumentsChanged={refetchDocuments}', 'onDocumentsChanged={refetchDocuments}\n          onProjectsChanged={refetchQuiet}', f))

print('done')
PY