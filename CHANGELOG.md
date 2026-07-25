# Changelog

## 0.19.0

- Expanded the daily journal with month navigation, entry markers, text/date search, rotating reflection prompts, and up to 20 restorable revisions per day.
- Added workspace-wide search for tasks, habits, goals, completed work, and journal entries with direct navigation to the result.
- Added independent synchronized permissions for ChatGPT journal reading and writing.
- Added an MCP period reader for on-demand weekly journal summaries while preserving the rule that ChatGPT may not invent personal events.
- Clarified local, pending, syncing, synced, offline, and error save states in the top bar.
- Added module, browser, mobile, Electron, synchronization, and MCP regression coverage for the new workflows.

## 0.18.0

- Added a dedicated daily journal with one automatically saved multiline entry per selected date.
- Journal entries are included in local backups, JSON export, cloud synchronization, conflict resolution, and cloud snapshot summaries.
- Added authenticated MCP tools to read a journal day and append a new paragraph without replacing existing text.
- Journal writes made by ChatGPT are idempotent, visible in the MCP activity log, and undoable.
- Added journal search/fetch support plus desktop, mobile, synchronization, and MCP regression coverage.

## 0.17.2

- Added a compact synchronization diagnostic panel for network, project, account, pending changes, and last exchange state.
- Connection checks now leave a visible, timestamped result instead of relying only on a temporary toast.
- Cloud versions now show their contents and representative item names before restoration.
- Restoring a cloud version now updates synchronization metadata immediately, preventing a misleading follow-up merge.
- Added regression coverage for diagnostic rendering and authenticated snapshot previews.

## 0.17.1

- Hosted deployments now load their Supabase project settings automatically, while local and Electron builds remain manually configurable.
- Cloud recovery now lists all 30 retained versions with task, habit, and goal counts and offers immediate Undo after restoration.
- Account deletion now requires typing the signed-in email and cloud-only controls stay disabled while signed out.
- Browser notification limits are stated explicitly instead of implying closed-tab background delivery.
- Browser and MCP task repeats now use the same normalization implementation.
- The Windows voice assistant now recognizes partial dictation and send phrases without waiting indefinitely for Vosk to finalize an utterance.
- Accessibility E2E now runs against populated tasks, overlapping timeline blocks, habits, goals, and archive data.

## 0.17.0

- Added automatic Supabase state snapshots with retention of the latest 30 versions and a recovery interface in Settings.
- Added authenticated self-service account deletion while preserving local device data.
- Added a synchronized user time zone so the app and ChatGPT agree on today and tomorrow.
- Added atomic MCP task-plan preview/apply tools with one shared undo action.
- Added custom task recurrence to MCP and guided prompts for weekly planning, backlog review, and monthly review.
- Added real Electron accessibility and rendering checks across mobile and desktop views.
- Fixed primary-action, calendar, goal metric, and mobile navigation contrast plus the timeline ARIA hierarchy.
- Updated Electron, Electron Builder, and Wrangler and pinned vulnerable transitive build dependencies to audited versions.

## 0.16.0

- Expanded the authenticated ChatGPT MCP integration from 13 to 26 tools.
- Added calendar-range, backlog, productivity-statistics, and category-list read tools.
- Added habit creation, dated habit editing, pause/restore, goal editing/deletion, task duplication, overdue acknowledgement, and category management.
- Preserved task priority, recurring scope, habit history, synchronization metadata, and cross-device-safe undo for the new commands.
- Made all MCP writes idempotent by request ID, including retries after undo or deletion.
- Added regression coverage for calendar analytics, habit history, goal/category restoration, recurring duplication, and duplicate request delivery.

## 0.15.0

- Added safe MCP editing and rescheduling with explicit recurring scopes for one occurrence, following occurrences, or a whole series.
- Added confirmed task deletion, habit logging, goal creation, checkpoint updates, and morning/evening day briefs.
- Added a synchronized MCP activity log with undo support in both ChatGPT tools and the Settings interface.
- Added optimistic undo patches and tombstones so removed MCP-created records cannot reappear during device synchronization.
- Added per-user burst rate limiting and stricter MCP guidance for confirmation, IDs, and recurring changes.
- Expanded MCP regression coverage for task scopes, deletion safety, habits, goals, timeline conflicts, activity rendering, and undo.

## 0.14.0

- Added an authenticated MCP endpoint for connecting Parsitasks to ChatGPT.
- Added read tools for daily overviews and structured search across tasks, habits, and goals.
- Added idempotent task creation and per-occurrence completion tools without exposing deletion.
- Protected MCP access with Supabase OAuth 2.1 discovery, user validation, RLS, and a dedicated consent screen.
- Applied MCP writes through optimistic concurrency so changes from another device are preserved.
- Integrated the MCP Worker and OAuth bundle into the existing Cloudflare deployment.
- Added setup documentation and regression tests for MCP task operations, authentication, and conflicts.

## 0.13.6

- Preserved historical habit names, settings, values, and streaks across dated edits, pauses, and restorations.
- Prevented stale cloud state from resurrecting locally deleted items by queuing changes made during synchronization.
- Added password-recovery completion to device synchronization and protected remote replacement with a verified safety backup.
- Validated imported JSON before replacing data and kept the previous valid state as the automatic undo backup.
- Made task schedule fields follow the selected mode, kept recurrence edits scoped, and preserved task priority during moves.
- Expanded the timeline to the full day, constrained blocks to 15-minute boundaries, and improved touch drag, resize, and creation.
- Added touch-safe calendar dragging and an explicit recurring-move choice for one occurrence or all following occurrences.
- Prevented accidental form closure with unsaved changes and improved archive filtering, bulk selection, and pagination.
- Improved quick-input date disambiguation, invalid-token feedback, category safety, and year rollover.
- Added content security headers, stricter Electron navigation rules, a skip link, and clearer notification limitations.
- Expanded regression coverage to 145 tests plus Electron smoke, browser E2E, Cloudflare build, and mobile visual checks.

## 0.13.5

- Merge independently edited task, goal, habit, and category fields across devices instead of choosing one entire record.
- Keep cloud delivery queued when a browser storage quota error leaves the newest state only in memory.
- Wait for the Codex window to finish restoring or maximizing before voice input clicks the composer.
- Keep interface preferences explicitly device-local instead of uploading unused remote UI settings.
- Improved the 320px task form, bottom navigation labels, goal cards, timeline menus, and sticky mobile header.
- Added regression coverage for field-level synchronization, storage quota recovery, and narrow schedule controls.

## 0.13.4

- Persisted pending cloud uploads and resume them after reconnect, sign-in, or application restart.
- Recover malformed local state from the latest backup while preserving the damaged source for diagnostics.
- Keep storage quota failures visible and preserve the latest in-memory state for emergency JSON export.
- Removed legacy key synchronization from the UI, REST client, and Supabase anonymous RLS policies.
- Block synchronization when the server exposes a dangerous device clock difference.
- Added a conservative two-year retention policy for local deletion tombstones.
- Extended the live Supabase check with an optional content-preserving write and conflict test.
- Added 320px and 360px browser coverage, touch pointer coverage, and horizontal menu clamping.
- Extracted save and synchronization status formatting from `app.js`.

## 0.13.3

- Fixed task, habit, goal, overdue, navigation, and timeline menus being clipped by cards or viewport edges.
- Added browser-level regression coverage for floating card menus.
- Made the optional voice assistant prefer the largest visible Codex window, ignore cloaked windows, maximize undersized windows, and verify focus before typing.
- Disabled voice auto-send by default so recognition mistakes require an explicit `Отправь` or `Отправить`.
- Added an opt-in read-only live Supabase check for Auth, the `rhythm_states` table, and RLS.
- Extracted settings import, export, and reset behavior from `app.js` into a tested module.
- Updated release metadata and documentation for the current application structure.

## 0.13.2

- Extracted application-shell navigation/rendering and state persistence from `app.js` into focused controllers.
- Kept rendering scoped to the active section and added browser layout containment for large archives.
- Separated touch resize zones on 15-minute timeline blocks so their handles no longer compete for the same area.
- Reworded existing synchronization controls in user-facing language without changing their behavior.
- Added early dependency diagnostics for the optional Windows voice assistant.

## 0.13.1

- Fixed no-time tasks being stored as deadlines after creation, timeline removal, import, synchronization, or reload.
- Kept all three scheduling modes (`none`, `deadline`, and `block`) consistent across forms, quick input, recurring moves, and timeline actions.
- Added regression coverage for no-time quick tasks and schedule-mode normalization.

## 0.13.0

- Added stable URL routes for every section and calendar mode, including browser back/forward navigation and direct links.
- Reworked mobile navigation spacing, date controls, task cards, timeline blocks, forms, archive filters, and week-board scrolling.
- Kept task form actions visible while scrolling and made new tasks default to the clearer no-time mode without an automatic reminder.
- Removed duplicate weekly overview blocks and empty hourly timeline labels to reduce visual noise.
- Simplified goal progress cards and clarified overdue and archive bulk actions, restore destinations, and recurring-task semantics.
- Added confirmation before bulk archive restoration and expanded browser-level regression coverage.

## 0.12.11

- Reloading now preserves the active section, selected calendar period, browsed date, task filter, and archive period.
- A view left on today still follows the calendar when the app is reopened on a later day.
- Increased small timeline, calendar, and synchronization controls to mobile-friendly touch targets.

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
