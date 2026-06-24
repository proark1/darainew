export interface DbError {
  message: string;
  [key: string]: unknown;
}

// Edge functions here use dynamic PostgREST table names and projections heavily.
// A dynamic row is deliberate: callers still opt into concrete row interfaces
// via asRows<T>(), while legacy helper code can read projected columns without
// fighting Supabase's generated overloads for every stringly table name.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DbRow = any;
export type DbRows = DbRow[];

export interface DbResult<T = unknown> {
  data: T;
  error: DbError | null;
  count?: number | null;
}

export type DbQuery<T = DbRows> = PromiseLike<DbResult<T>> & {
  select(...args: unknown[]): DbQuery<T>;
  insert(...args: unknown[]): DbQuery<T>;
  upsert(...args: unknown[]): DbQuery<T>;
  update(...args: unknown[]): DbQuery<T>;
  delete(...args: unknown[]): DbQuery<T>;
  eq(...args: unknown[]): DbQuery<T>;
  neq(...args: unknown[]): DbQuery<T>;
  is(...args: unknown[]): DbQuery<T>;
  in(...args: unknown[]): DbQuery<T>;
  gte(...args: unknown[]): DbQuery<T>;
  gt(...args: unknown[]): DbQuery<T>;
  lte(...args: unknown[]): DbQuery<T>;
  lt(...args: unknown[]): DbQuery<T>;
  or(...args: unknown[]): DbQuery<T>;
  ilike(...args: unknown[]): DbQuery<T>;
  contains(...args: unknown[]): DbQuery<T>;
  not(...args: unknown[]): DbQuery<T>;
  filter(...args: unknown[]): DbQuery<T>;
  order(...args: unknown[]): DbQuery<T>;
  limit(...args: unknown[]): DbQuery<T>;
  range(...args: unknown[]): DbQuery<T>;
  single(): Promise<DbResult<DbRow>>;
  maybeSingle(): Promise<DbResult<DbRow | null>>;
};

export interface DbClient {
  from(table: string): DbQuery;
  rpc(name: string, args?: Record<string, unknown>): Promise<DbResult>;
  functions: {
    invoke(name: string, opts?: Record<string, unknown>): Promise<DbResult>;
  };
}

export function db(client: unknown): DbClient {
  return client as DbClient;
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function asRecordOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function asRows<T = Record<string, unknown>>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}
