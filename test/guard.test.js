import test from "node:test";
import assert from "node:assert/strict";
import { makePlan, dispatch, verify } from "../src/guard.js";

function fakeExec(command, args) {
  if (command === "probe") return { status: "pass" };
  const joined = args.join(" ");
  if (joined.includes("agent get")) return { id: "agt-1", configurationId: "cfg-1", activeRevisionId: "rev-old" };
  if (joined.includes("configuration get")) return { id: "cfg-1", generation: 2 };
  if (joined.includes("deployment-status")) return { deploymentId: "rev-new", namespaceId: "ns-1", agentId: "agt-1", status: "succeeded" };
  if (joined.includes("agent deploy")) return { id: "rev-new" };
  throw new Error("unexpected");
}
const config = { namespaceId: "ns-1", agentId: "agt-1", probeCommand: ["probe"] };

test("plan, intent before dispatch and accepted revision", async () => {
  const plan = await makePlan(config, fakeExec);
  const order = [];
  const result = await dispatch(plan, async () => { order.push("intent"); }, async (command, args) => {
    if (args.includes("deploy")) order.push("deploy");
    return fakeExec(command, args);
  });
  assert.deepEqual(order, ["intent", "deploy"]);
  assert.equal(result.revisionId, "rev-new");
});

test("drift blocks dispatch and unknown outcome is not replayed", async () => {
  const plan = await makePlan(config, fakeExec);
  let writes = 0;
  const drift = { ...plan, configurationGeneration: 1 };
  assert.equal((await dispatch(drift, async () => { writes++; }, fakeExec)).status, "blocked");
  assert.equal(writes, 0);
  const unknown = await dispatch(plan, async () => { writes++; }, async (command, args) => {
    if (args.includes("deploy")) throw new Error("lost response");
    return fakeExec(command, args);
  });
  assert.equal(unknown.status, "unknown");
  assert.equal(writes, 1);
});

test("success requires exact revision and independent probe", async () => {
  const record = { schema: "oce-rollout-dispatch.v1", namespaceId: "ns-1", agentId: "agt-1",
    revisionId: "rev-new", occCommand: "occ", probeCommand: ["probe"] };
  const changed = async (command, args) => {
    if (args.includes("get")) return { id: "agt-1", activeRevisionId: "rev-new" };
    return fakeExec(command, args);
  };
  assert.equal((await verify(record, changed)).status, "pass");
  assert.equal((await verify({ ...record, probeCommand: null }, changed)).status, "incomplete");
  const warning = async (command, args) => {
    if (args.includes("deployment-status")) return { deploymentId: "rev-new", namespaceId: "ns-1", agentId: "agt-1", status: "succeeded", warnings: [{ code: "PLUGIN_WARNING" }] };
    return changed(command, args);
  };
  assert.equal((await verify(record, warning)).status, "incomplete");
});
