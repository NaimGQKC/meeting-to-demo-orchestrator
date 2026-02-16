import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { GateName, RunPacket } from "@m2d/schemas";

export function nowIso(): string {
  return new Date().toISOString();
}

export function newRunId(): string {
  return "run-" + crypto.randomBytes(4).toString("hex");
}

export class FsRunStore {
  constructor(private runsDir: string) {
    fs.mkdirSync(this.runsDir, { recursive: true });
  }

  runDir(runId: string) {
    return path.join(this.runsDir, runId);
  }

  packetPath(runId: string) {
    return path.join(this.runDir(runId), "run_packet.json");
  }

  save(packet: RunPacket) {
    fs.mkdirSync(this.runDir(packet.run_id), { recursive: true });
    fs.writeFileSync(this.packetPath(packet.run_id), JSON.stringify(packet, null, 2), "utf-8");
  }

  load(runId: string): RunPacket {
    const p = this.packetPath(runId);
    if (!fs.existsSync(p)) throw new Error("Run not found: " + runId);
    return JSON.parse(fs.readFileSync(p, "utf-8")) as RunPacket;
  }
}

export function approveGate(packet: RunPacket, gate: GateName, notes?: string): RunPacket {
  const updated: RunPacket = {
    ...packet,
    approvals: [...packet.approvals, { gate, approved_at: nowIso(), notes }]
  };
  return updated;
}
