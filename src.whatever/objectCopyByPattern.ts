
// a deep copy variant for typescript
function objectCopyByPattern<T>( source: T, target: T| Partial<T>, pattern?: Map<string, any>): void {

  const isObject = ( obj: any) => typeof obj === 'function' || typeof obj === 'object' && !!obj;

  for (const prop in source) {
    if ( source.hasOwnProperty(prop) && (pattern && pattern.has(prop)) ) {
      // if the value is a nested object, recursively copy all it's properties
      if (isObject(source[prop])) {
        objectCopyByPattern(source[prop], target[prop],
          pattern && pattern.has(prop) && ( pattern.get(prop) instanceof Map ? pattern.get(prop) : undefined ));
      } else {
        target[prop] = source[prop];
      }
    }
  }
}

// ref:
// https://medium.com/better-programming/3-ways-to-clone-objects-in-javascript-f752d148054d
// ...ref: https://github.com/jashkenas/underscore
