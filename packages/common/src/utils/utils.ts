
export function deepCompare(x: any, y: any): boolean {

  if (x === y) { return true; }
  // if both x and y are null or undefined and exactly the same

  if (!(x instanceof Object) || !(y instanceof Object)) { return false; }
  // if they are not strictly equal, they both need to be Objects

  if (x.constructor !== y.constructor) { return false; }
  // they must have the exact same prototype chain, the closest we can do is
  // test there constructor.

  for (const p in x) {
    if (!Object.prototype.hasOwnProperty.call(x, p)) { continue; }
    // other properties were tested using x.constructor === y.constructor

    if (!Object.prototype.hasOwnProperty.call(y, p)) { return false; }
    // allows to compare x[ p ] and y[ p ] when set to undefined

    if (x[p] === y[p]) { continue; }
    // if they have the same strict value or identity then they are equal

    if (typeof (x[p]) !== 'object') { return false; }
    // Numbers, Strings, Functions, Booleans must be strictly equal

    if (!deepCompare(x[p], y[p])) { return false; }
    // Objects and Arrays must be tested recursively
  }

  for (const p in y) {
    if (Object.prototype.hasOwnProperty.call(y, p) && !Object.prototype.hasOwnProperty.call(x, p)) { return false; }
    // allows x[ p ] to be set to undefined
  }
  return true;
}

export function deepIterate(source: any, callback: (holder: any, key: string, value: any) => void): void {
  if (source === null) { return; }

  if (source instanceof Array) {
    source.forEach((item: any) => deepIterate(item, callback));
  }

  if (source instanceof Object) {
    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        deepIterate(source[key], callback);
        callback(source, key, source[key]);
      }
    }
  }
}

export function deepClone(source: any, ignores: Function[] = []): any {
  return cloneValue(source, ignores, new Map());
}

// An object reached twice is cloned once (refMap); arrays are always copied. The map lookup
// replaces a linear search over every object cloned so far, which made a clone O(n^2).
// Object.keys gives the same keys in the same order as for-in filtered by hasOwnProperty.
function cloneValue(source: any, ignores: Function[], refMap: Map<Object, Object>): any {
  if (source === null) { return null; }

  if (Array.isArray(source)) {
    const n = source.length;
    const out = new Array(n);
    for (let i = 0; i < n; i++) {
      out[i] = cloneValue(source[i], ignores, refMap);
    }
    return out;
  }

  if (source instanceof Object) {
    for (let i = 0; i < ignores.length; i++) {
      if (source instanceof ignores[i]) {
        return source;
      }
    }
    const ref = refMap.get(source);
    if (ref !== undefined) {
      return ref;
    }
    // A copy on the same prototype as the source, not one whose prototype is the source:
    // that made every cloned object a prototype, which V8 keeps in a slower representation.
    const dest = Object.create(Object.getPrototypeOf(source));
    refMap.set(source, dest);
    const keys = Object.keys(source);
    for (let i = 0; i < keys.length; i++) {
      dest[keys[i]] = cloneValue(source[keys[i]], ignores, refMap);
    }
    return dest;
  }

  return source;
}

export function generateId<T extends {id: number}[]>(array: T): number {
  if (array.length === 0) {
    return 1;
  }

  const last = array[array.length - 1];
  let id = last.id + 1;

  while (array.find(g => g.id === id)) {
    if (id === Number.MAX_VALUE) {
      id = 0;
    }
    id = id + 1;
  }

  return id;
}
