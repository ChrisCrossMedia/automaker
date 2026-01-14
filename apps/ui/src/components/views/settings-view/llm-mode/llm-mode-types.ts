/**
 * LLM Mode Types - Typdefinitionen für LLM-Modus-Konfiguration
 */

export interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
}

export interface ModelRecommendation {
  description: string;
  sizeCategory: 'small' | 'medium' | 'large' | 'xlarge';
  bestFor: string[];
  sizeGB: number;
  germanSupport: 'exzellent' | 'sehr gut' | 'gut' | 'mittel';
  details: string;
  strengths: string[];
}

export interface PhaseConfig {
  key: string;
  label: string;
  description: string;
  icon: React.ElementType;
  category: 'quick' | 'validation' | 'generation' | 'memory' | 'docs';
  localCapable: boolean;
  recommendedModel?: string;
  whyRecommended?: string;
}

export interface MixedModeOption {
  key: string;
  label: string;
  description: string;
  recommendation: 'local' | 'cloud';
  reason: string;
  localCapable: boolean;
  recommendedModel?: string;
}

export interface RecommendedModel {
  name: string;
  priority: number;
  reason: string;
}

export interface DownloadProgress {
  model: string;
  status: 'pending' | 'downloading' | 'completed' | 'error';
  progress: number;
  error?: string;
}
