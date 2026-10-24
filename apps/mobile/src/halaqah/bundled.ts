import programJson from "../../../../content/halaqah/ramadhan-1448/program.json";
import { isReleasable, parseProgram, type Program } from "./program";

let cached: Program | undefined;

/**
 * The program shipped in the app binary, so it works offline. Parsed on first use. To deliver a
 * newer program from the server, pass its JSON to `parseProgram` and use that instead.
 */
export function bundledProgram(): Program {
  cached ??= parseProgram(programJson);
  return cached;
}

/** Whether the bundled program may be shown in this build: approved content, or any content in `__DEV__`. */
export function halaqahAvailable(): boolean {
  return isReleasable(bundledProgram(), __DEV__);
}
