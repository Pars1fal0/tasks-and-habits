# Changelog

## Unreleased

- Extracted task rendering into `tasks-view.js`.
- Extracted habit rendering into `habits-view.js`.
- Extracted calendar rendering into `calendar-view.js`.
- Extracted archive rendering into `archive-view.js`.
- Extracted task and habit form handling into `task-form.js` and `habit-form.js`.
- Added `state-normalizer.js` for import/save normalization.
- Added unit tests for quick input, recurrence rules, storage, task moves, and state normalization.
- Added Electron file backups to `Documents/Ритм дня/backups`.
- Added sidebar UI for file backup status and opening the backup folder.

## 0.4.0

- Added monthly and weekly calendar views.
- Added drag-and-drop task rescheduling in calendar views.
- Added quick task input with date, time, category, and priority parsing.
- Added undo actions in toast messages.
- Added overdue tasks, task postponing, recurring exclusions, archive filters, and local JSON backup/restore.
