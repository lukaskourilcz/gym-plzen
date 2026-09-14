/** Google processes gtag commands as Arguments objects, not ordinary arrays. */
export function createGoogleTag(
  push: (command: IArguments) => void,
): (...args: unknown[]) => void {
  return function gtag() {
    // eslint-disable-next-line prefer-rest-params -- gtag.js requires Arguments, not Array.
    push(arguments);
  };
}
