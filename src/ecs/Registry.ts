const MARKER = Symbol("marker");
export const TOKEN_ID = Symbol("token_id");

let tokenCounter = 0;

export interface RegistryToken<T> {
  [MARKER]: true;
  [TOKEN_ID]: number;
  __type: T;
}

export type ResourceToken<T> = RegistryToken<T>;
export type EventToken<T> = RegistryToken<T>;
export type ComponentTuple = [RegistryToken<unknown>, unknown];

export const register = <T>(): RegistryToken<T> => {
  return { [MARKER]: true, [TOKEN_ID]: tokenCounter++ } as RegistryToken<T>;
};

export function event<T extends object>(): EventToken<T> {
  return register<T>();
}

export function component<T, Args extends unknown[]>(
  factory: (...args: Args) => T,
): RegistryToken<T> & ((...args: Args) => [RegistryToken<T>, T]) {
  const token = register<T>();
  let merged: RegistryToken<T> & ((...args: Args) => [RegistryToken<T>, T]);
  const wrapper = (...args: Args): [RegistryToken<T>, T] => {
    return [merged, factory(...args)];
  };
  merged = Object.assign(wrapper, token) as typeof merged;
  return merged;
}

// Resource helper - similar to component but for singleton data
export function resource<T extends object, Args extends unknown[]>(
  factory: (...args: Args) => T,
): RegistryToken<T> & ((...args: Args) => [RegistryToken<T>, T]) {
  const token = register<T>();
  let merged: RegistryToken<T> & ((...args: Args) => [RegistryToken<T>, T]);
  const wrapper = (...args: Args): [RegistryToken<T>, T] => {
    return [merged, factory(...args)];
  };
  merged = Object.assign(wrapper, token) as typeof merged;
  return merged;
}
