

# Task Views -- Multi-View System with UI/UX Polish

## Current State

- **Desktop** (`StandardMode`): Has a list/kanban toggle -- good, but limited to two views
- **Mobile** (`CalendarHubPanel`): Only shows a compact list view -- no view options at all
- **Kanban Board**: Exists but is basic -- no filtering, no priority grouping, no delete action
- **List View**: Recently upgraded with stats bar, undo delete, inline edit, swipe gestures -- solid foundation
- **Missing views**: No priority-grouped view, no "by due date" timeline view

## What Changes

### 1. Add View Switcher to Mobile Task Tab

The mobile CalendarHubPanel currently hardcodes `compactMode={true}` for TaskList. Add a small view toggle inside the Tasks tab so mobile users can switch between List, Board, and Priority views.

### 2. New "Priority Board" View

A grouped view that organizes tasks into three horizontal sections: High, Medium, Low. Each section is collapsible. This gives an instant "what matters most" overview without the overhead of a full Kanban board.

- Three color-coded sections with task counts
- Collapsible sections (High expanded by default, Low collapsed)
- Same swipeable task items as list view for consistency
- Drag-to-reprioritize: drag a task from Low to High section

### 3. Upgrade Kanban Board

The existing Kanban is bare -- improve it:
- Add priority filter chips (All / High / Medium / Low) at the top
- Add a delete action (currently missing -- you can only complete/drag)
- Show overdue badges on cards
- Add task count badges on column headers (already exists, just verify)
- Improve empty column states with actionable prompts

### 4. "Timeline" View (Grouped by Due Date)

A chronological grouping: Overdue, Today, Tomorrow, This Week, Later, No Date. Each section shows task cards with priority indicators. This is the best "what's coming up" view.

- Sections auto-hide when empty
- Overdue section has a red accent
- "Today" section has primary accent
- Tasks within each section sorted by priority (high first)

### 5. View Switcher UI Component

A clean, reusable view toggle that works on both desktop and mobile:
- Icons: List (lines), Board (grid), Priority (layers), Timeline (clock)
- Tooltip labels on desktop, icon-only on mobile
- Remembers last-used view per device

### 6. TaskList Polish

Small improvements to the existing list:
- Add a sort dropdown: "Sort by: Due Date / Priority / Created / Name"
- Show task count in the header next to "Tasks" label
- Add priority color dot to the left of each task (in addition to the text badge) for faster scanning

---

## Technical Plan

### New File: `src/components/tasks/PriorityBoardView.tsx`
- Three collapsible sections: High (red accent), Medium (amber), Low (gray)
- Each renders SwipeableTaskItem wrapping a compact task row
- Supports onToggleComplete, onDeleteTask, onUpdateTask
- Drag between sections changes priority via onUpdateTask

### New File: `src/components/tasks/TimelineView.tsx`
- Groups tasks by temporal bucket: Overdue, Today, Tomorrow, This Week, Later, No Date
- Each bucket has a header with icon, label, and count
- Tasks sorted by priority within each group
- Same task row component as list view

### New File: `src/components/tasks/TaskViewSwitcher.tsx`
- Reusable toggle component accepting `activeView` and `onViewChange`
- Four view options: list, kanban, priority, timeline
- Compact icon buttons with tooltips
- Used in both StandardMode and CalendarHubPanel

### Modified: `src/components/calendar/CalendarHubPanel.tsx`
- Import TaskViewSwitcher, PriorityBoardView, TimelineView, KanbanBoard
- Add `taskView` state: 'list' | 'kanban' | 'priority' | 'timeline'
- Render TaskViewSwitcher inside the Tasks tab
- Conditionally render the selected view component
- Pass all necessary handlers (onUpdateTask is key for Kanban/Priority drag)

### Modified: `src/components/layout/StandardMode.tsx`
- Replace the manual list/kanban toggle buttons with TaskViewSwitcher
- Add PriorityBoardView and TimelineView as additional view options
- Extend `taskViewMode` type to include 'priority' | 'timeline'

### Modified: `src/components/tasks/KanbanBoard.tsx`
- Add priority filter chips row below header
- Add delete button on task cards (hover-visible, like list view)
- Add overdue badge on cards with past due dates
- Improve empty column messaging

### Modified: `src/components/tasks/TaskList.tsx`
- Add sort dropdown (Due Date / Priority / Created / Name) next to the time filter
- Show total task count in header
- Add small priority color dot before task title for faster visual scanning

### No database changes needed
All improvements are purely UI components and local state.

