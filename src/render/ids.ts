const ID_RADIX = 36;
const ID_START = 2;

/** A new id prefix like `sc-k3j9x2`, unique within the page in practice. */
export function idPrefix(): string {
  return `sc-${Math.random().toString(ID_RADIX).slice(ID_START)}`;
}
