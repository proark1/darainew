export type EnergyLevel = "low" | "medium" | "high";

export interface PlanningTask {
  id: string;
  title: string;
  estimatedMinutes: number;
  priority?: "low" | "medium" | "high" | "urgent";
  dueAt?: Date | string | null;
  energy?: EnergyLevel;
  fixedStart?: Date | string | null;
}

export interface BusyBlock {
  id?: string;
  title?: string;
  start: Date | string;
  end: Date | string;
}

export interface PlanOptions {
  day: Date | string;
  workdayStartHour?: number;
  workdayEndHour?: number;
  minBlockMinutes?: number;
  bufferMinutes?: number;
  preferredEnergyByHour?: Record<number, EnergyLevel>;
}

export interface PlannedBlock {
  taskId: string;
  title: string;
  start: Date;
  end: Date;
  reason: string;
}

export interface DailyPlan {
  date: string;
  scheduled: PlannedBlock[];
  unscheduled: Array<{ taskId: string; title: string; reason: string }>;
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? new Date(value) : new Date(value);
}

function atHour(day: Date, hour: number): Date {
  const d = new Date(day);
  d.setHours(Math.floor(hour), Math.round((hour % 1) * 60), 0, 0);
  return d;
}

function minutesBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 60_000));
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function priorityWeight(priority: PlanningTask["priority"]): number {
  if (priority === "urgent") return 4;
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
}

function taskScore(task: PlanningTask, day: Date): number {
  const due = task.dueAt ? toDate(task.dueAt) : null;
  const dueSoon =
    due && !Number.isNaN(due.getTime())
      ? Math.max(0, 7 - Math.ceil((due.getTime() - day.getTime()) / 86_400_000))
      : 0;
  return priorityWeight(task.priority) * 10 + dueSoon - Math.max(0, task.estimatedMinutes - 90) / 30;
}

function buildFreeSlots(day: Date, busy: BusyBlock[], options: Required<Pick<PlanOptions, "workdayStartHour" | "workdayEndHour" | "bufferMinutes">>) {
  const workStart = atHour(day, options.workdayStartHour);
  const workEnd = atHour(day, options.workdayEndHour);
  const sortedBusy = busy
    .map((block) => ({ start: toDate(block.start), end: toDate(block.end) }))
    .filter((block) => block.end > workStart && block.start < workEnd)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const slots: Array<{ start: Date; end: Date }> = [];
  let cursor = workStart;

  for (const block of sortedBusy) {
    const start = new Date(Math.max(block.start.getTime(), workStart.getTime()));
    const end = new Date(Math.min(block.end.getTime(), workEnd.getTime()));
    if (cursor < start) {
      slots.push({ start: cursor, end: addMinutes(start, -options.bufferMinutes) });
    }
    if (cursor < end) cursor = addMinutes(end, options.bufferMinutes);
  }

  if (cursor < workEnd) slots.push({ start: cursor, end: workEnd });
  return slots.filter((slot) => slot.end > slot.start);
}

function energyFits(task: PlanningTask, slotStart: Date, options: PlanOptions): boolean {
  if (!task.energy || !options.preferredEnergyByHour) return true;
  const preferred = options.preferredEnergyByHour[slotStart.getHours()];
  return !preferred || preferred === task.energy;
}

export function planDay(tasks: PlanningTask[], busy: BusyBlock[], options: PlanOptions): DailyPlan {
  const day = toDate(options.day);
  const minBlockMinutes = options.minBlockMinutes ?? 15;
  const bufferMinutes = options.bufferMinutes ?? 10;
  const freeSlots = buildFreeSlots(day, busy, {
    workdayStartHour: options.workdayStartHour ?? 8,
    workdayEndHour: options.workdayEndHour ?? 18,
    bufferMinutes,
  });
  const scheduled: PlannedBlock[] = [];
  const unscheduled: DailyPlan["unscheduled"] = [];

  const sortedTasks = [...tasks].sort((a, b) => taskScore(b, day) - taskScore(a, day));

  for (const task of sortedTasks) {
    const duration = Math.max(minBlockMinutes, Math.ceil(task.estimatedMinutes / minBlockMinutes) * minBlockMinutes);
    const fixedStart = task.fixedStart ? toDate(task.fixedStart) : null;

    if (fixedStart && !Number.isNaN(fixedStart.getTime())) {
      const fixedEnd = addMinutes(fixedStart, duration);
      const conflict = busy.some((block) => overlaps(fixedStart, fixedEnd, toDate(block.start), toDate(block.end)));
      if (conflict) {
        unscheduled.push({ taskId: task.id, title: task.title, reason: "Fixed time conflicts with existing calendar." });
        continue;
      }
      scheduled.push({ taskId: task.id, title: task.title, start: fixedStart, end: fixedEnd, reason: "User requested a fixed time." });
      busy.push({ start: fixedStart, end: fixedEnd });
      continue;
    }

    const slotIndex = freeSlots.findIndex(
      (slot) => minutesBetween(slot.start, slot.end) >= duration && energyFits(task, slot.start, options),
    );

    if (slotIndex === -1) {
      unscheduled.push({ taskId: task.id, title: task.title, reason: "No free slot long enough in the planning window." });
      continue;
    }

    const slot = freeSlots[slotIndex];
    const start = slot.start;
    const end = addMinutes(start, duration);
    scheduled.push({
      taskId: task.id,
      title: task.title,
      start,
      end,
      reason: `${task.priority ?? "normal"} priority${task.dueAt ? " with a due date" : ""}.`,
    });

    const nextStart = addMinutes(end, bufferMinutes);
    if (nextStart >= slot.end) freeSlots.splice(slotIndex, 1);
    else freeSlots[slotIndex] = { start: nextStart, end: slot.end };
  }

  return {
    date: day.toISOString().slice(0, 10),
    scheduled,
    unscheduled,
  };
}
