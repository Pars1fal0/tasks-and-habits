# Changelog

## 0.12.10

- Voice submission now accepts `Отправь`, `Отправить`, and `Отправляй` while remaining compatible with custom phrases.

## 0.12.9

- Removed the weekly summary panel and its unused rendering code.

## 0.12.8

- Redesigned the weekly summary as a compact responsive panel and removed empty zero-value metrics.
- Added a one-time PWA shell refresh to recover clients that combined new markup with stale assets.
- Static application assets now prefer the current network version and use the cache only as an offline fallback.

## 0.12.7

- Habit type, target, unit, and recurrence changes now apply from the selected date without rewriting earlier statistics.
- Numeric and check habit logs survive later type changes.
- Archived habits remain visible when browsing dates before their archive date.
- Added a compact weekly summary with completed totals and the strongest day.
- Added a user-controlled PWA update banner instead of switching versions mid-session.

## 0.12.6

- Habit renames now take effect from the selected date without rewriting names on earlier days.
- Habit title history is normalized and merged safely between devices.

## 0.12.5

- Dated task flags and habit logs now keep per-date revision metadata, including explicit resets.
- Task, habit, and goal checkpoint ordering now converges between devices.
- Goal checkpoints merge independently instead of replacing the whole goal checklist.
- Supabase writes use optimistic concurrency and retry after merging a conflicting revision.
- Deleting every category no longer restores the default categories on reload.
- Cloudflare builds generate a content-based service worker cache version.
- Added PNG PWA icons for Windows and Android installation.
- Extracted shared data normalizers, synchronization metadata, and PWA registration from `app.js`.

## Unreleased

- Added an isolated low-load Windows voice assistant with offline Russian wake-word recognition and Win32-based Codex prompt submission.
- Removed the ineffective simple/advanced interface mode and its obsolete persisted setting.
- Automatically merge duplicate categories by normalized name and preserve task-category links across devices.
- Fixed deleted records reappearing during two-device synchronization when device clocks or migrated timestamps differ.
- Made deletion markers authoritative during state merges and remove deleted task IDs from synchronized ordering.
- Prepared automatic Cloudflare Workers Static Assets deployment from the private GitHub repository and `master` branch.
- Added a clean static web build containing only the PWA application shell.
- Added live cross-device synchronization every 30 seconds and whenever the app regains focus, visibility, or network access.
- Merge newer remote changes before automatic pushes so two active devices do not silently overwrite each other.
- Reworked remote storage copy around a same-account multi-device setup while keeping offline-first local data.
- Renamed Overview to Calendar and made its week, month, and year metrics match the visible period.
- Moved archive period filtering into Archive and added safe single-entry deletion for completed recurring occurrences.
- Simplified mobile tasks, timeline, and habit cards with collapsible secondary controls and compact action menus.
- Added accessible task, habit, and goal dialogs with focus trapping, Escape handling, and focus restoration.
- Moved category management into Settings and removed duplicated data actions from the sidebar.
- Added Supabase password recovery and clearer disabled and ready states for manual remote sync actions.
- Clarified the sidebar progress metric with separate task and habit percentages.
- Removed the completed recurring-series manager from the task screen.
- Added Supabase email/password authentication with local-only session storage and authenticated RLS policies.
- Added a compact local sync history for push, pull, merge, and error events.
- Added archive period filters and a backlog of older unfinished one-off and recurring occurrences.
- Added compact, regular, and touch-friendly timeline scales with persisted preference.
- Extracted shared application utilities and planning-history logic from `app.js`.
- Added a real Electron browser test for the mobile habit form and timeline scale controls.

## 0.9.0 - 2026-07-13

- Fixed time-block reminders so offsets are calculated from the block start, while overdue state still uses its end.
- Added safety backup and undo when restoring local data, plus import access from mobile Settings.
- Made custom task and habit repeat editors available whenever “Настроить” is selected in simple mode.
- Added automatic merge-on-start for newer remote state and surfaced sync failures in the global save status.
- Improved narrow-screen forms, task actions, touch and keyboard ordering, timeline deadline markers, and mobile toast placement.
- Added a collapsed backlog for old unfinished one-off tasks and explicit restore destinations in the archive.
- Added pausing, restoring, and safe permanent deletion for habits, with target-aware numeric steppers.
- Added category editing, human-readable goal dates, and week/month/year modes in Overview.

## 0.8.0 - 2026-07-13

- Added recurring-task edit scopes for one occurrence, this and following occurrences, or the whole series.
- Preserved historical completion and notification flags when splitting a recurring series from the edited date.
- Replaced the goal checkpoint textarea with an inline editor for adding, renaming, deleting, and reordering checkpoints.
- Added keyboard-accessible checkpoint ordering and focused regression coverage for recurring edits.

## 0.7.0 - 2026-07-12

- Added an explicit no-time mode for task creation and editing.
- Added drag-to-unschedule for timeline tasks with a visible drop target.
- Added an "Убрать время" timeline menu action as a touch and keyboard-friendly alternative.
- Preserved recurring-task scope selection when removing timeline time.
- Extracted task schedule mode and preset handling into `task-schedule.js`.

## 0.6.0 - 2026-07-12

- Replaced goal-to-task links with independent deadline-free checkpoints and automatic progress.
- Added automatic goal completion, achieved-goal sorting, compact action menus, and a completion celebration.
- Migrated existing linked goal tasks into checkpoints without discarding their completion state.
- Added timeline scope selection for recurring tasks: one occurrence or the selected occurrence and all following ones.
- Split recurring series at the selected date so past timeline history keeps its original schedule.

## 0.5.0 - 2026-07-12

- Added one-click acknowledgement for all previous-day overdue tasks, with undo and per-task restore.
- Added entity update timestamps and deletion tombstones so stale remote state cannot overwrite newer edits or restore deleted records.
- Bumped the local data schema to version 8 and the application release to 0.5.0.
- Added safe deletion for moved recurring replacements and scoped duplication for recurring timeline tasks.
- Added cached overdue history with a persistent hide/show control.
- Limited the overdue block to the previous calendar day and made hiding remove the entire block.
- Calculate the one-day overdue window relative to the currently selected date.
- Added per-occurrence "Пометить просмотренной" without completing, deleting, or moving the task.
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
