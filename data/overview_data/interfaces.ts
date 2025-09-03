
export type IntentType = "create_event" | "add_reminder" | "create_note" | "read_email" | "send_email" | "none";

export interface IntentResult {
  intent: IntentType;
  confidence: number;
  scores?: Record<string, number>;
}

export type Slots = Record<string, unknown>;

export interface Classifier {
  classify(text: string): Promise<IntentResult>;
  learn?(example: { text: string; intent: IntentType }): Promise<void>;
}

export interface Extractor {
  extract(text: string, intent: IntentType): Promise<Slots>;
}

export interface Handler {
  canHandle(i: IntentType): boolean;
  perform(slots: Slots): Promise<{ ok: boolean; id?: string; meta?: any }>;
}

export interface DecisionLog {
  text: string;
  ts: string;
  predicted: IntentResult;
  slots: Slots;
  decision: "auto" | "confirm" | "cancel";
  outcome?: { ok: boolean; id?: string };
  version: { model: string; registry: string };
}
