import type { RegistryToken } from "./Registry";

export type Queryable = RegistryToken<unknown>;

type QueryResult<T extends Queryable> =
  T extends RegistryToken<infer R> ? R : never;

export type QueryResults<T extends Queryable[]> = {
  [K in keyof T]: QueryResult<T[K]>;
};

export interface CachedQuery<T extends Queryable[]> {
  types: T;
  results: QueryResults<T>[];
  dirty: boolean;
}
