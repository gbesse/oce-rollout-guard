#!/usr/bin/env node
import { access, readFile, writeFile } from "node:fs/promises";
import { makePlan, dispatch, verify } from "./guard.js";

const [command, source, destination, flag] = process.argv.slice(2);
const usage = "Utilisation / Usage / Uso: node src/cli.js plan CONFIG.json PLAN.json | dispatch PLAN.json RESULT.json --apply | verify RESULT.json REPORT.json";
const read = async (path) => JSON.parse(await readFile(path, "utf8"));
const save = async (path, value) => writeFile(path, JSON.stringify(value, null, 2) + "\n", { mode: 0o600, flag: "wx" });
try {
  if (!source || !destination) throw new Error("E_USAGE");
  let result;
  if (command === "plan") result = await makePlan(await read(source));
  else if (command === "dispatch" && flag === "--apply") {
    try { await access(destination); throw new Error("E_DEST_EXISTS"); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    const plan = await read(source);
    result = await dispatch(plan, async (intent) => save(destination + ".intent", intent));
  } else if (command === "verify") result = await verify(await read(source));
  else throw new Error("E_USAGE");
  await save(destination, result);
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  process.exitCode = result.status === "blocked" || result.status === "unknown" || result.status === "failed" ? 1 :
    result.status === "incomplete" ? 2 : 0;
} catch (error) {
  process.stderr.write((error.message === "E_USAGE" ? usage : error.message?.startsWith("E_") ? error.message : "E_RUN") + "\n");
  process.exitCode = 1;
}
