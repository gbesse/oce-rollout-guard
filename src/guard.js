import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
export const messages = {
  blocked: { fr: "Le brouillon a changé ; créez un nouveau plan.", en: "The draft changed; create a new plan.", es: "El borrador cambió; cree un plan nuevo." },
  unknown: { fr: "Résultat de déploiement incertain ; vérifiez les révisions avant toute nouvelle demande.", en: "Deployment outcome unknown; inspect revisions before another request.", es: "Resultado del despliegue incierto; revise las revisiones antes de otra solicitud." },
  failed: { fr: "Échec : corrigez la source enregistrée et déployez une nouvelle révision.", en: "Failed: fix the saved source and deploy a new revision.", es: "Fallo: corrija la fuente guardada y despliegue una revisión nueva." },
  incomplete: { fr: "État enregistré, preuve du modèle manquante.", en: "State recorded; model proof is missing.", es: "Estado registrado; falta una prueba del modelo." },
  pass: { fr: "Révision active et sonde réussie.", en: "Revision active and probe passed.", es: "Revisión activa y prueba superada." }
};

export async function systemExec(command, args) {
  const { stdout } = await execFileAsync(command, args, { timeout: 30000, maxBuffer: 1048576 });
  return JSON.parse(stdout);
}
const unwrap = (value) => value?.data && typeof value.data === "object" ? value.data : value;
const occArgs = (plan, ...parts) => ["--output", "json", "--namespace", plan.namespaceId, ...parts];

export async function makePlan(config, exec = systemExec) {
  if (!config?.namespaceId || !config?.agentId) throw new Error("E_CONFIG");
  const command = config.occCommand || "occ";
  const base = { namespaceId: config.namespaceId, agentId: config.agentId };
  const agent = unwrap(await exec(command, occArgs(base, "agent", "get", config.agentId)));
  if (agent.id !== config.agentId || typeof agent.configurationId !== "string") throw new Error("E_AGENT");
  const configuration = unwrap(await exec(command, occArgs(base, "configuration", "get", agent.configurationId)));
  if (configuration.id !== agent.configurationId || !Number.isInteger(configuration.generation)) throw new Error("E_CONFIGURATION");
  return {
    schema: "oce-rollout-plan.v1", namespaceId: config.namespaceId, agentId: config.agentId,
    configurationId: agent.configurationId, configurationGeneration: configuration.generation,
    previousActiveRevisionId: agent.activeRevisionId || null,
    occCommand: command, probeCommand: config.probeCommand || null
  };
}

export async function dispatch(plan, writeIntent, exec = systemExec) {
  if (plan?.schema !== "oce-rollout-plan.v1") throw new Error("E_PLAN");
  const current = await makePlan(plan, exec);
  if (current.configurationId !== plan.configurationId ||
      current.configurationGeneration !== plan.configurationGeneration ||
      current.previousActiveRevisionId !== plan.previousActiveRevisionId) {
    return { status: "blocked", message: messages.blocked };
  }
  const intent = { schema: "oce-rollout-intent.v1", namespaceId: plan.namespaceId, agentId: plan.agentId,
    previousActiveRevisionId: plan.previousActiveRevisionId, configurationGeneration: plan.configurationGeneration,
    requestedAt: new Date().toISOString() };
  await writeIntent(intent);
  try {
    const revision = unwrap(await exec(plan.occCommand, occArgs(plan, "agent", "deploy", plan.agentId)));
    if (typeof revision.id !== "string") throw new Error("E_REVISION");
    return { schema: "oce-rollout-dispatch.v1", status: "accepted", revisionId: revision.id,
      namespaceId: plan.namespaceId, agentId: plan.agentId, previousActiveRevisionId: plan.previousActiveRevisionId,
      occCommand: plan.occCommand, probeCommand: plan.probeCommand };
  } catch {
    return { status: "unknown", message: messages.unknown, intent };
  }
}

export async function verify(record, exec = systemExec) {
  if (record?.schema !== "oce-rollout-dispatch.v1" || !record.revisionId) throw new Error("E_RECORD");
  const status = unwrap(await exec(record.occCommand, occArgs(record, "agent", "deployment-status", record.agentId, record.revisionId)));
  if (status.deploymentId !== record.revisionId || status.agentId !== record.agentId ||
      status.namespaceId !== record.namespaceId) throw new Error("E_STATUS_IDENTITY");
  if (status.status === "failed") return { status: "failed", revisionId: record.revisionId, message: messages.failed };
  if (status.status !== "succeeded") return { status: "incomplete", revisionId: record.revisionId, deploymentStatus: status.status, message: messages.incomplete };
  if (Array.isArray(status.warnings) && status.warnings.length) return { status: "incomplete", revisionId: record.revisionId, warningCount: status.warnings.length, message: messages.incomplete };
  const agent = unwrap(await exec(record.occCommand, occArgs(record, "agent", "get", record.agentId)));
  if (agent.activeRevisionId !== record.revisionId) return { status: "failed", revisionId: record.revisionId, message: messages.failed };
  if (!Array.isArray(record.probeCommand) || !record.probeCommand.length) return { status: "incomplete", revisionId: record.revisionId, message: messages.incomplete };
  let probe;
  try { probe = await exec(record.probeCommand[0], record.probeCommand.slice(1)); } catch { probe = null; }
  return {
    status: probe?.status === "pass" ? "pass" : "failed",
    revisionId: record.revisionId,
    message: probe?.status === "pass" ? messages.pass : messages.failed
  };
}
