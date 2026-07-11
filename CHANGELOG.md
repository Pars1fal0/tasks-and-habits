# Changelog

## Unreleased

- Added safe deletion for moved recurring replacements and scoped duplication for recurring timeline tasks.
- Added cached overdue history with a persistent hide/show control.
- Limited the overdue block to the previous calendar day and made hiding remove the entire block.
- Added ended-series management with resume-from-today behavior.
- Added goal-link deletion warnings and direct navigation from goals to linked tasks.
- Added offline, pending-sync, and synchronized status states plus local/remote state merging.
- Extracted application event binding and calendar drag behavior into dedicated controllers.
- Added visible repeat end dates with resume support and preserved timed recurring replacements without exposing false exclusions.
- Replaced the silent overdue history cap with complete history and incremental "show more" controls.
- Automatically removes deleted task links from goals and repairs orphaned links during normalization.
- Added secure sync-key generation, legacy-key warnings, and complete offline app-shell caching.
- Extracted overdue calculations, task-state mutations, and sync-key policy into dedicated modules.
- Fixed clipped overdue task action menus and made them open above the trigger.
- Fixed moving overdue recurring occurrences to today without creating an excluded duplicate occurrence.
- Added recurring-task deletion scope: one occurrence or the selected day and all future occurrences.
- Exposed both recurring deletion scopes directly in the overdue task menu without a second confirmation step.
- Linked goals to existing tasks and calculate goal progress from their real completion state.
- Added archive bulk selection, restore, deletion, and date-grouped history.
- Added a guided Supabase connection flow with private key generation.
- Converted unscheduled timeline drops into resizable one-hour blocks while preserving priority.
- Improved coarse-pointer resize targets for 15-minute timeline blocks.
- Added touch and keyboard reordering controls for habits.
- Added quick-input hint chips and automatic active-day rollover after midnight.
- Added `view-renderer.js` to avoid rebuilding every hidden view after each state change.
- Fixed mobile More navigation, active states, and view scroll reset.
- Moved task, habit, and goal lists before collapsed editing forms on narrow layouts.
- Fixed mutually exclusive deadline and time-block fields in the task form.
- Removed automatic demo task and habit creation from an empty profile.
- Added a two-row mobile year heatmap and compact month task markers.
- Increased mobile action targets, made the desktop sidebar scrollable, and reduced settings density.
- Extracted task rendering into `tasks-view.js`.
- Extracted habit rendering into `habits-view.js`.
- Extracted calendar rendering into `calendar-view.js`.
- Extracted archive rendering into `archive-view.js`.
- Extracted task and habit form handling into `task-form.js` and `habit-form.js`.
- Extracted categories, notifications, and import/export backup logic into separate modules.
- Removed unreachable legacy render code from `app.js`.
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
