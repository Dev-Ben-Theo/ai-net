/**
 * Supplementary shared types for ai-net smart-contracts layer.
 *
 * Core agent types (SubTask, AgentResult, Agent, etc.) live in
 * src/types/agent.ts to match the upstream project convention.
 * This file holds additional domain types referenced across multiple issues.
 */

// Re-export everything from the canonical agent types file for convenience
export * from './agent';

// ---------------------------------------------------------------------------
// DAG / Coordinator types
// ---------------------------------------------------------------------------

export type Capability =
  | 'research'
  | 'risk'
  | 'coding'
  | 'design'
  | 'report'
  | string;

export type DAGNodeStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface DAGNode {
  id: string;
  taskType: Capability;
  dependsOn: string[];
  status: DAGNodeStatus;
}

// ---------------------------------------------------------------------------
// Registry event
// ---------------------------------------------------------------------------

export interface RegistryEvent {
  type: 'registered' | 'deregistered' | 'pricingUpdated';
  agentId: string;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Design agent output
// ---------------------------------------------------------------------------

export interface UIElement {
  type: string;
  label: string;
}

export interface WireframeSection {
  name: string;
  description: string;
  layout: 'grid' | 'flex' | 'absolute';
  elements: UIElement[];
}

export interface ColorToken {
  name: string;
  hex: string;
  usage: string;
}

export interface ComponentNode {
  id: string;
  name: string;
  parentId?: string;
  children?: ComponentNode[];
}

export interface AssetEntry {
  name: string;
  type: 'icon' | 'image' | 'font';
  description: string;
  suggestedSource: string;
}

export interface DesignOutput {
  wireframes: WireframeSection[];
  colorPalette: ColorToken[];
  componentHierarchy: ComponentNode[];
  assetManifest: AssetEntry[];
}
