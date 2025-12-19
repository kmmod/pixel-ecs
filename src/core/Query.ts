import type { RegistryToken } from "./Component";

export type Queryable = RegistryToken<unknown>;

type QueryResult<T extends Queryable> =
  T extends RegistryToken<infer R> ? R : never;

export type QueryResults<T extends Queryable[]> = {
  [K in keyof T]: QueryResult<T[K]>;
};

export type ComponentTuple = [RegistryToken<unknown>, unknown];

export interface CachedQuery<T extends Queryable[]> {
  types: T;
  results: QueryResults<T>[];
  dirty: boolean;
}
