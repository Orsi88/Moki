// A CLI runs only as its own entry point. Bundlers give imported modules the
// entry point's URL too, so the launched file's name must also be allowed.
import { basename } from 'node:path';
import { pathToFileURL } from 'node:url';

export function isMain(moduleUrl, names) {
  const entry = process.argv[1];
  return Boolean(entry && names.includes(basename(entry)) && moduleUrl === pathToFileURL(entry).href);
}
