import { TOKEN_ID, type RegistryToken } from "./Registry";

// Marker for Without filter
const WITHOUT_MARKER = Symbol("without");

/**
 * Filter token that excludes entities with the specified component.
 */
export interface WithoutFilter<T> {
  [WITHOUT_MARKER]: true;
  [TOKEN_ID]: number;
  __type: T;
}

export type Queryable = RegistryToken<unknown> | WithoutFilter<unknown>;

/**
 * Extract result type from a single queryable.
 * Without filters return never (filtered out later).
 */
type QueryResult<T> =
  T extends WithoutFilter<unknown>
    ? never
    : T extends RegistryToken<infer R>
      ? R
      : never;

/**
 * Filter a tuple type to remove `never` entries.
 */
type FilterNever<T extends unknown[]> = T extends []
  ? []
  : T extends [infer H, ...infer R]
    ? [H] extends [never]
      ? FilterNever<R>
      : [H, ...FilterNever<R>]
    : T;

/**
 * Map queryable types to their result types.
 */
type MapQueryResults<T extends Queryable[]> = {
  [K in keyof T]: QueryResult<T[K]>;
};

/**
 * Final query results type - maps queryables to results and removes Without entries.
 */
export type QueryResults<T extends Queryable[]> = FilterNever<
  MapQueryResults<T>
>;

export interface CachedQuery<T extends Queryable[]> {
  types: T;
  results: QueryResults<T>[];
  dirty: boolean;
}

/**
 * Exclude entities that have the specified component.
 *
 * @param token - Component token to exclude
 * @returns A filter token for use in queries
 *
 * @example
 * ```ts
 * // Query entities with Position but without Enemy component
 * for (const [entity, pos] of world.query(Entity, Position, Without(Enemy))) {
 *   // Only friendly entities here
 * }
 * ```
 */
export const Without = <T>(token: RegistryToken<T>): WithoutFilter<T> => {
  return {
    [WITHOUT_MARKER]: true,
    [TOKEN_ID]: token[TOKEN_ID],
  } as WithoutFilter<T>;
};

/**
 * Check if a queryable is a Without filter.
 */
export const isWithout = (
  token: Queryable,
): token is WithoutFilter<unknown> => {
  return typeof token === "object" && token !== null && WITHOUT_MARKER in token;
};
