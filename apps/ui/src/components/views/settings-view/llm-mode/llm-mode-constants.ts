/**
 * LLM Mode Constants - Konstanten für LLM-Modus-Konfiguration
 * Erweiterte Informationen für Modellauswahl mit deutschen Empfehlungen
 */
import {
  Zap,
  Brain,
  Eye,
  FileText,
  Code,
  ListTodo,
  Search,
  Lightbulb,
  BookOpen,
  Check,
  AlertTriangle,
} from 'lucide-react';
import type { ModelRecommendation, PhaseConfig, MixedModeOption } from './llm-mode-types';

// Erweiterte Modell-Informationen mit deutschen Empfehlungen
export const MODEL_RECOMMENDATIONS: Record<string, ModelRecommendation> = {
  // === KLEINE MODELLE (< 3 GB) - Schnell & effizient ===
  'qwen2.5:3b': {
    description: 'Schnell & kompakt',
    sizeCategory: 'small',
    bestFor: ['enhancement', 'fileDescription', 'memoryExtraction', 'commitMessage', 'changelog'],
    sizeGB: 2.0,
    germanSupport: 'sehr gut',
    details:
      'Alibabas neuestes Modell. Exzellente Mehrsprachigkeit inkl. Deutsch. Ideal für schnelle Textaufgaben.',
    strengths: ['Sehr schnell', 'Gute deutsche Texte', 'Niedriger RAM-Verbrauch'],
  },
  moondream: {
    description: 'Vision-Spezialist',
    sizeCategory: 'small',
    bestFor: ['imageDescription'],
    sizeGB: 1.5,
    germanSupport: 'mittel',
    details:
      'Spezialisiertes Vision-Modell für Bildanalyse. Kompakt aber effektiv für UI-Screenshots.',
    strengths: ['Bildverständnis', 'UI-Analyse', 'Kompakt'],
  },
  'phi3:mini': {
    description: 'Microsofts Kleinster',
    sizeCategory: 'small',
    bestFor: ['enhancement', 'fileDescription'],
    sizeGB: 2.3,
    germanSupport: 'gut',
    details: 'Microsofts effizientes Mini-Modell. Sehr schnelle Antworten für einfache Aufgaben.',
    strengths: ['Extrem schnell', 'Gute Logik', 'Effizient'],
  },
  'starcoder2:3b': {
    description: 'Code-Assistent',
    sizeCategory: 'small',
    bestFor: ['docstring', 'formatting'],
    sizeGB: 2.0,
    germanSupport: 'mittel',
    details: 'Hugging Face Code-Modell. Gut für Dokumentation und einfache Code-Aufgaben.',
    strengths: ['Code-Dokumentation', 'Schnell', 'Fokussiert'],
  },

  // === MITTLERE MODELLE (4-6 GB) - Ausgewogen ===
  'qwen2.5:7b': {
    description: 'Deutscher Allrounder',
    sizeCategory: 'medium',
    bestFor: ['validation', 'backlogPlanning', 'projectAnalysis'],
    sizeGB: 4.5,
    germanSupport: 'exzellent',
    details:
      'Beste Wahl für deutsche Texte. Starke Reasoning-Fähigkeiten und natürliche deutsche Ausgabe.',
    strengths: ['Beste deutsche Qualität', 'Starkes Reasoning', 'Vielseitig'],
  },
  'qwen2.5-coder:7b': {
    description: 'Code-Experte',
    sizeCategory: 'medium',
    bestFor: ['specGeneration', 'featureGeneration', 'suggestions', 'docstring', 'formatting'],
    sizeGB: 4.5,
    germanSupport: 'gut',
    details: 'Auf Code spezialisierte Qwen-Variante. Beste lokale Option für Code-Generierung.',
    strengths: ['Beste Code-Qualität lokal', 'Gute Kommentare', 'TypeScript-Experte'],
  },
  'deepseek-coder:6.7b': {
    description: 'Code-Alternative',
    sizeCategory: 'medium',
    bestFor: ['featureGeneration', 'suggestions'],
    sizeGB: 4.0,
    germanSupport: 'mittel',
    details: 'DeepSeeks Code-Modell. Gute Alternative zu Qwen-Coder mit anderen Stärken.',
    strengths: ['Gute Code-Logik', 'Debugging-Hilfe', 'Algorithmen'],
  },
  'mistral:7b': {
    description: 'Französischer Allrounder',
    sizeCategory: 'medium',
    bestFor: ['enhancement', 'fileDescription'],
    sizeGB: 4.1,
    germanSupport: 'sehr gut',
    details: 'Mistrals Basismodell. Sehr gute europäische Sprachunterstützung inkl. Deutsch.',
    strengths: ['Gutes Deutsch', 'Schnell', 'Zuverlässig'],
  },
  'codegemma:7b': {
    description: 'Google Code-Modell',
    sizeCategory: 'medium',
    bestFor: ['featureGeneration', 'refactoring'],
    sizeGB: 5.0,
    germanSupport: 'mittel',
    details: 'Googles Code-Modell basierend auf Gemma. Gut für Refactoring-Aufgaben.',
    strengths: ['Google-Qualität', 'Refactoring', 'Moderne Patterns'],
  },
  'llama3.1:8b': {
    description: 'Metas Flaggschiff',
    sizeCategory: 'medium',
    bestFor: ['validation', 'backlogPlanning'],
    sizeGB: 4.7,
    germanSupport: 'gut',
    details: 'Metas neuestes Open-Source-Modell. Starke allgemeine Fähigkeiten.',
    strengths: ['Starke Logik', 'Gute Instruktionen', 'Vielseitig'],
  },
  'codellama:7b': {
    description: 'Meta Code-Fokus',
    sizeCategory: 'medium',
    bestFor: ['featureGeneration'],
    sizeGB: 3.8,
    germanSupport: 'mittel',
    details: 'Code-spezialisierte Llama-Variante. Gut für Python und JavaScript.',
    strengths: ['Python-Experte', 'JS/TS', 'Schnell'],
  },

  // === GROSSE MODELLE (> 7 GB) - Maximale Qualität ===
  'qwen2.5:14b': {
    description: 'Leistungsstark',
    sizeCategory: 'large',
    bestFor: ['specGeneration', 'featureGeneration'],
    sizeGB: 8.4,
    germanSupport: 'exzellent',
    details: 'Größere Qwen-Variante. Deutlich bessere Qualität aber hoher RAM-Verbrauch.',
    strengths: ['Höchste Qualität', 'Komplexe Aufgaben', 'Beste deutsche Texte'],
  },
  'codellama:13b': {
    description: 'Meta Code Pro',
    sizeCategory: 'large',
    bestFor: ['featureGeneration'],
    sizeGB: 7.3,
    germanSupport: 'mittel',
    details: 'Größere CodeLlama-Variante. Bessere Code-Qualität für komplexe Aufgaben.',
    strengths: ['Komplexer Code', 'Bessere Logik', 'Mehr Kontext'],
  },
};

// Empfohlene Modelle für Download (Priorität nach Aufgabentyp)
export const RECOMMENDED_MODELS = [
  // CODE-AUFGABEN (Priorität: Code-Qualität > Sprache)
  {
    name: 'qwen2.5-coder:7b',
    priority: 1,
    reason: 'PFLICHT für Code-Aufgaben - beste lokale Code-Qualität',
  },
  { name: 'deepseek-coder:6.7b', priority: 2, reason: 'Alternative für Code - starkes Reasoning' },
  // TEXT-AUFGABEN (Priorität: Deutsche Sprache)
  { name: 'qwen2.5:3b', priority: 3, reason: 'Schnell & deutschoptimiert für Text-Aufgaben' },
  { name: 'qwen2.5:7b', priority: 4, reason: 'Bester deutscher Allrounder für komplexe Texte' },
  // SPEZIAL-AUFGABEN
  { name: 'moondream', priority: 5, reason: 'Bildanalyse-Spezialist (Vision)' },
];

// Phasen-Konfiguration mit Aufgabentyp-spezifischen Empfehlungen
// CODE-AUFGABEN → Code-Modelle (qwen2.5-coder, deepseek-coder)
// TEXT-AUFGABEN → Deutsch-Modelle (qwen2.5:3b, qwen2.5:7b)
export const PHASES: PhaseConfig[] = [
  // === TEXT-AUFGABEN (gutes Deutsch wichtig) ===
  {
    key: 'enhancementModel',
    label: 'Verbesserung',
    description: 'Titel & Beschreibungen generieren',
    icon: Zap,
    category: 'quick',
    localCapable: true,
    recommendedModel: 'qwen2.5:3b',
    whyRecommended: 'TEXT-Aufgabe: Deutsch wichtig - qwen2.5 exzellent',
  },
  {
    key: 'fileDescriptionModel',
    label: 'Dateibeschreibung',
    description: 'Kontext-Dateien beschreiben',
    icon: FileText,
    category: 'quick',
    localCapable: true,
    recommendedModel: 'qwen2.5:3b',
    whyRecommended: 'TEXT-Aufgabe: Deutsche Zusammenfassungen',
  },
  {
    key: 'commitMessageModel',
    label: 'Commit-Nachrichten',
    description: 'Git-Commit-Texte generieren',
    icon: FileText,
    category: 'quick',
    localCapable: true,
    recommendedModel: 'qwen2.5:3b',
    whyRecommended: 'TEXT-Aufgabe: Kurze deutsche Texte',
  },
  {
    key: 'changelogModel',
    label: 'Changelog',
    description: 'Änderungsprotokolle erstellen',
    icon: ListTodo,
    category: 'quick',
    localCapable: true,
    recommendedModel: 'qwen2.5:3b',
    whyRecommended: 'TEXT-Aufgabe: Strukturierte deutsche Texte',
  },
  {
    key: 'memoryExtractionModel',
    label: 'Wissensextraktion',
    description: 'Learnings extrahieren',
    icon: Brain,
    category: 'memory',
    localCapable: true,
    recommendedModel: 'qwen2.5:3b',
    whyRecommended: 'TEXT-Aufgabe: Deutsche Notizen & Zusammenfassungen',
  },

  // === CODE-AUFGABEN (Code-Qualität wichtiger als Sprache!) ===
  {
    key: 'docstringModel',
    label: 'Code-Dokumentation',
    description: 'Docstrings & JSDoc generieren',
    icon: BookOpen,
    category: 'docs',
    localCapable: true,
    recommendedModel: 'qwen2.5-coder:7b',
    whyRecommended: 'CODE-Aufgabe: Code-Spezialist für präzise Docs',
  },
  {
    key: 'formattingModel',
    label: 'Code-Formatierung',
    description: 'Code-Stil & Best Practices',
    icon: Code,
    category: 'docs',
    localCapable: true,
    recommendedModel: 'qwen2.5-coder:7b',
    whyRecommended: 'CODE-Aufgabe: Kennt Konventionen & Patterns',
  },

  // === SPEZIAL-AUFGABEN ===
  {
    key: 'imageDescriptionModel',
    label: 'Bildanalyse',
    description: 'Bilder analysieren & beschreiben',
    icon: Eye,
    category: 'quick',
    localCapable: true,
    recommendedModel: 'moondream',
    whyRecommended: 'VISION-Aufgabe: Spezialisiert auf UI-Screenshots',
  },

  // === KOMPLEXE AUFGABEN (Claude empfohlen) ===
  {
    key: 'validationModel',
    label: 'Validierung',
    description: 'GitHub Issues validieren',
    icon: Check,
    category: 'validation',
    localCapable: false,
    whyRecommended: 'Komplexes Reasoning - lokale LLMs zu unzuverlässig',
  },
  {
    key: 'specGenerationModel',
    label: 'Spezifikation',
    description: 'Vollständige Specs generieren',
    icon: BookOpen,
    category: 'generation',
    localCapable: false,
    whyRecommended: 'Braucht Kreativität & Architektur-Verständnis',
  },
  {
    key: 'featureGenerationModel',
    label: 'Feature-Generierung',
    description: 'Code implementieren',
    icon: Code,
    category: 'generation',
    localCapable: false,
    whyRecommended: 'CODE-Qualität kritisch - Claude deutlich besser',
  },
  {
    key: 'backlogPlanningModel',
    label: 'Backlog-Planung',
    description: 'Backlog organisieren & priorisieren',
    icon: ListTodo,
    category: 'generation',
    localCapable: false,
    whyRecommended: 'Strategisches Denken erforderlich',
  },
  {
    key: 'projectAnalysisModel',
    label: 'Projektanalyse',
    description: 'Projektstruktur analysieren',
    icon: Search,
    category: 'generation',
    localCapable: false,
    whyRecommended: 'Tiefes Verständnis großer Codebasen nötig',
  },
  {
    key: 'suggestionsModel',
    label: 'Vorschläge',
    description: 'Verbesserungsvorschläge',
    icon: Lightbulb,
    category: 'generation',
    localCapable: false,
    whyRecommended: 'Kreativität & breites Wissen erforderlich',
  },
  {
    key: 'refactoringModel',
    label: 'Refactoring',
    description: 'Code umstrukturieren',
    icon: Code,
    category: 'generation',
    localCapable: false,
    whyRecommended: 'Komplexe Code-Transformationen - Fehlerrisiko hoch',
  },
  {
    key: 'bugfixingModel',
    label: 'Fehlerbehebung',
    description: 'Bugs analysieren & beheben',
    icon: AlertTriangle,
    category: 'generation',
    localCapable: false,
    whyRecommended: 'Root-Cause-Analyse erfordert tiefes Verständnis',
  },
];

// Mixed-Mode Konfiguration mit Empfehlungen basierend auf Aufgabenkomplexität
export const MIXED_MODE_OPTIONS: MixedModeOption[] = [
  // === AUFGABEN WO LOKALE LLMs GUT FUNKTIONIEREN ===
  {
    key: 'localForEnhancement',
    label: 'Verbesserungen',
    description: 'Titel & Beschreibungen generieren',
    recommendation: 'local',
    reason: 'Einfache Textgenerierung - lokale LLMs liefern gute deutsche Texte',
    localCapable: true,
    recommendedModel: 'qwen2.5:3b',
  },
  {
    key: 'localForFileDescription',
    label: 'Dateibeschreibungen',
    description: 'Kontext-Dateien beschreiben',
    recommendation: 'local',
    reason: 'Kurze Zusammenfassungen - Qwen 3B schafft das zuverlässig auf Deutsch',
    localCapable: true,
    recommendedModel: 'qwen2.5:3b',
  },
  {
    key: 'localForImageDescription',
    label: 'Bildanalyse',
    description: 'Bilder analysieren & beschreiben',
    recommendation: 'local',
    reason: 'Moondream ist spezialisiert für Vision-Aufgaben',
    localCapable: true,
    recommendedModel: 'moondream',
  },
  {
    key: 'localForMemoryExtraction',
    label: 'Wissensextraktion',
    description: 'Learnings aus Sessions extrahieren',
    recommendation: 'local',
    reason: 'Strukturierte Datenextraktion - lokale LLMs zuverlässig',
    localCapable: true,
    recommendedModel: 'qwen2.5:3b',
  },
  {
    key: 'localForCommitMessages',
    label: 'Commit-Nachrichten',
    description: 'Git-Commit-Texte generieren',
    recommendation: 'local',
    reason: 'Kurze, strukturierte Texte - perfekt für schnelle lokale LLMs',
    localCapable: true,
    recommendedModel: 'qwen2.5:3b',
  },
  {
    key: 'localForChangelog',
    label: 'Changelog',
    description: 'Änderungsprotokolle erstellen',
    recommendation: 'local',
    reason: 'Strukturierte deutsche Zusammenfassung - lokale LLMs ausreichend',
    localCapable: true,
    recommendedModel: 'qwen2.5:3b',
  },
  {
    key: 'localForDocstrings',
    label: 'Dokumentation',
    description: 'Docstrings & JSDoc generieren',
    recommendation: 'local',
    reason: 'Qwen-Coder versteht Code-Kontext gut für Dokumentation',
    localCapable: true,
    recommendedModel: 'qwen2.5-coder:7b',
  },
  {
    key: 'localForFormatting',
    label: 'Code-Formatierung',
    description: 'Code-Stil & Formatierung verbessern',
    recommendation: 'local',
    reason: 'Regelbasierte Aufgabe - Qwen-Coder kennt Best Practices',
    localCapable: true,
    recommendedModel: 'qwen2.5-coder:7b',
  },
  // === AUFGABEN WO CLAUDE BESSER IST ===
  {
    key: 'localForValidation',
    label: 'Validierung',
    description: 'GitHub Issues validieren & verbessern',
    recommendation: 'cloud',
    reason: 'Komplexes Reasoning erforderlich - Claude viel zuverlässiger',
    localCapable: false,
  },
  {
    key: 'cloudForSpecGeneration',
    label: 'Spezifikation',
    description: 'Vollständige App-Specs generieren',
    recommendation: 'cloud',
    reason: 'Sehr komplex & kreativ - lokale LLMs produzieren oft Fehler',
    localCapable: false,
  },
  {
    key: 'cloudForFeatureGeneration',
    label: 'Feature-Generierung',
    description: 'Neuen Code implementieren',
    recommendation: 'cloud',
    reason: 'Code-Qualität kritisch - Claude produziert deutlich besseren Code',
    localCapable: false,
  },
  {
    key: 'cloudForBacklogPlanning',
    label: 'Backlog-Planung',
    description: 'Features priorisieren & organisieren',
    recommendation: 'cloud',
    reason: 'Strategisches Denken erforderlich - lokale Modelle zu oberflächlich',
    localCapable: false,
  },
  {
    key: 'cloudForProjectAnalysis',
    label: 'Projektanalyse',
    description: 'Codebase analysieren & verstehen',
    recommendation: 'cloud',
    reason: 'Tiefes Code-Verständnis nötig - Claude hat mehr Kontext',
    localCapable: false,
  },
  {
    key: 'cloudForSuggestions',
    label: 'Vorschläge',
    description: 'Verbesserungsvorschläge generieren',
    recommendation: 'cloud',
    reason: 'Kreativität & Erfahrung erforderlich - Claude kennt mehr Patterns',
    localCapable: false,
  },
  {
    key: 'cloudForRefactoring',
    label: 'Refactoring',
    description: 'Code umstrukturieren & optimieren',
    recommendation: 'cloud',
    reason: 'Komplexe Code-Transformationen - Fehlerrisiko bei lokalen zu hoch',
    localCapable: false,
  },
  {
    key: 'cloudForBugfixing',
    label: 'Fehlerbehebung',
    description: 'Bugs analysieren & beheben',
    recommendation: 'cloud',
    reason: 'Root-Cause-Analyse komplex - Claude versteht Zusammenhänge besser',
    localCapable: false,
  },
];

// Kategorie-Labels auf Deutsch
export const CATEGORY_LABELS: Record<string, string> = {
  quick: 'Schnelle Aufgaben',
  docs: 'Dokumentation',
  validation: 'Validierung',
  generation: 'Generierung',
  memory: 'Wissensmanagement',
};
