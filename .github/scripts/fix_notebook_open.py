from pathlib import Path

path = Path('src/App.tsx')
text = path.read_text(encoding='utf-8')

replacements = [
    (
        "  const [selectedId, setSelectedId] = useState<string | null>(activeTaskId || tasks.find((task) => !task.notebookCompleted)?.id || null);",
        "  const [selectedId, setSelectedId] = useState<string | null>(null);",
    ),
    (
        """  useEffect(() => {\n    if (selectedId && tasks.some((task) => task.id === selectedId)) return;\n    const fallback = (activeTaskId && tasks.some((task) => task.id === activeTaskId) ? activeTaskId : null) || workingTasks[0]?.id || completedTasks[0]?.id || null;\n    setSelectedId(fallback);\n  }, [tasks, selectedId, activeTaskId]);""",
        """  useEffect(() => {\n    if (selectedId && !tasks.some((task) => task.id === selectedId)) setSelectedId(null);\n  }, [tasks, selectedId]);""",
    ),
    (
        """      if (typing) return;\n      const currentIndex = workingTasks.findIndex((task) => task.id === selectedId);""",
        """      if (typing) return;\n      if (!selectedTask) return;\n      const currentIndex = workingTasks.findIndex((task) => task.id === selectedId);""",
    ),
    (
        """onClick={(event) => { event.stopPropagation(); onSelect(); setEditing(true); }}""",
        """onClick={(event) => { event.stopPropagation(); setEditing(true); }}""",
    ),
]

for old, new in replacements:
    if old not in text:
        raise SystemExit(f'Expected fragment not found:\n{old[:180]}')
    text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
print('Notebook closed-by-default interaction patched')
