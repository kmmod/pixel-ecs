const MARKER = Symbol("marker");
export const TOKEN_ID = Symbol("token_id");

let tokenCounter = 0;

export interface RegistryToken<T> {
  [MARKER]: true;
  [TOKEN_ID]: number;
  __type: T;
}

export const register = <T>(): RegistryToken<T> => {
  return { [MARKER]: true, [TOKEN_ID]: tokenCounter++ } as RegistryToken<T>;
};

export function component<T>(
  factory: (...args: any[]) => T,
): RegistryToken<T> &
  ((...args: Parameters<typeof factory>) => [RegistryToken<T>, T]) {
  const token = register<T>();

  const wrapper = (
    ...args: Parameters<typeof factory>
  ): [RegistryToken<T>, T] => {
    // Use the merged object (wrapper itself) as the token, not `token`
    return [merged, factory(...args)];
  };

  // Merge token properties onto wrapper
  const merged = Object.assign(wrapper, token) as RegistryToken<T> &
    ((...args: Parameters<typeof factory>) => [RegistryToken<T>, T]);

  return merged;
}

// Resource helper - similar to component but for singleton data
export function resource<T extends object>(
  defaults: T,
): RegistryToken<T> & ((props?: Partial<T>) => [RegistryToken<T>, T]) {
  const token = register<T>();

  let merged: RegistryToken<T> &
    ((props?: Partial<T>) => [RegistryToken<T>, T]);

  const wrapper = (props: Partial<T> = {}): [RegistryToken<T>, T] => {
    return [merged, { ...defaults, ...props }];
  };

  merged = Object.assign(wrapper, token) as typeof merged;

  return merged;
}
