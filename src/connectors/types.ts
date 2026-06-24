import type { ConnectorType } from "@prisma/client";

/**
 * Connector framework contracts.
 *
 * A connector is a self-contained module describing how to configure, test, and
 * sync against an external system. The framework (see ./runtime.ts) handles the
 * cross-cutting concerns — decryption of secrets, sync-run lifecycle, health
 * tracking, audit + debug logging — so each connector only implements the
 * system-specific behavior.
 */

/** Field descriptor used to render the admin configuration form dynamically. */
export interface ConnectorField {
  key: string;
  label: string;
  /** `password`/`secret` inputs are write-only in the UI and stored encrypted. */
  type: "text" | "url" | "password" | "select" | "textarea";
  required: boolean;
  /** Whether the value is a secret (encrypted at rest, never returned to client). */
  secret: boolean;
  placeholder?: string;
  helpText?: string;
  options?: { value: string; label: string }[];
  /** Default value pre-filled for a brand-new connector (non-secret fields). */
  default?: string;
}

export interface ConnectorTestResult {
  ok: boolean;
  /** Human-readable, secret-free summary of the result. */
  message: string;
  /** Optional safe details for display (e.g. company name, record counts). */
  details?: Record<string, string | number | boolean>;
  /** Latency of the probe call, if measured. */
  durationMs?: number;
}

export interface ConnectorSyncResult {
  imported: number;
  updated: number;
  skipped: number;
  /** Safe, non-secret summary persisted on the SyncRun. */
  summary?: Record<string, unknown>;
}

/**
 * Runtime context handed to a connector's operations. `config` holds non-secret
 * settings; `secrets` holds the decrypted secret bag. Neither must be logged.
 */
export interface ConnectorContext<
  TConfig = Record<string, unknown>,
  TSecrets = Record<string, unknown>,
> {
  connectorId: string;
  type: ConnectorType;
  config: TConfig;
  secrets: TSecrets;
  /**
   * Persist updated secrets (e.g. a refreshed OAuth token) back to the database,
   * encrypted. Used by connectors that rotate tokens mid-operation.
   */
  saveSecrets: (next: TSecrets) => Promise<void>;
}

export interface ConnectorDefinition<
  TConfig = Record<string, unknown>,
  TSecrets = Record<string, unknown>,
> {
  type: ConnectorType;
  displayName: string;
  description: string;
  /** Non-secret configuration fields. */
  configFields: ConnectorField[];
  /** Secret configuration fields (stored encrypted). */
  secretFields: ConnectorField[];
  /**
   * Validate that the supplied config+secrets are structurally complete enough
   * to attempt a connection. Returns a list of missing/invalid field messages;
   * empty array means ready. This is how we "fail visibly and ask for the
   * missing detail" instead of inventing behavior.
   */
  validateReadiness: (
    config: Record<string, unknown>,
    secrets: Record<string, unknown>,
  ) => string[];
  /** Perform a real, safe probe call against the external API. */
  testConnection: (
    ctx: ConnectorContext<TConfig, TSecrets>,
  ) => Promise<ConnectorTestResult>;
  /** Perform a real sync. Throws on failure; the runtime records the run. */
  sync: (
    ctx: ConnectorContext<TConfig, TSecrets>,
  ) => Promise<ConnectorSyncResult>;
}
