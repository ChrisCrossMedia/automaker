/**
 * LLM Mode Selector - Wiederverwendbare Komponente für Modus-Auswahl
 * Kann in Settings UND Agent Runner verwendet werden
 */
import { Badge } from '@/components/ui/badge';
import { Cloud, Server, Shuffle } from 'lucide-react';

export type LLMMode = 'cloud' | 'local' | 'mixed';

interface LLMModeOption {
  value: LLMMode;
  label: string;
  sublabel: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
  shadowColor: string;
}

const MODE_OPTIONS: LLMModeOption[] = [
  {
    value: 'cloud',
    label: 'Cloud',
    sublabel: 'Claude API',
    icon: Cloud,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500',
    shadowColor: 'shadow-blue-500/20',
  },
  {
    value: 'mixed',
    label: 'Mixed',
    sublabel: 'Optimiert',
    icon: Shuffle,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500',
    shadowColor: 'shadow-purple-500/20',
  },
  {
    value: 'local',
    label: 'Lokal',
    sublabel: '100% Privat',
    icon: Server,
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500',
    shadowColor: 'shadow-green-500/20',
  },
];

interface LLMModeSelectorProps {
  value: LLMMode;
  onChange: (mode: LLMMode) => void;
  size?: 'sm' | 'md' | 'lg';
  showLabels?: boolean;
  className?: string;
}

export function LLMModeSelector({
  value,
  onChange,
  size = 'md',
  showLabels = true,
  className = '',
}: LLMModeSelectorProps) {
  const sizeClasses = {
    sm: 'p-2 rounded-lg',
    md: 'p-4 rounded-xl',
    lg: 'p-6 rounded-2xl',
  };

  const iconSizes = {
    sm: 'w-5 h-5',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  return (
    <div className={`grid grid-cols-3 gap-2 ${className}`}>
      {MODE_OPTIONS.map((option) => {
        const isActive = value === option.value;
        const Icon = option.icon;

        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`relative ${sizeClasses[size]} border-2 transition-all ${
              isActive
                ? `${option.borderColor} ${option.bgColor} shadow-lg ${option.shadowColor}`
                : 'border-border hover:border-opacity-50 hover:bg-accent/50'
            }`}
          >
            <div className="flex flex-col items-center gap-1">
              <Icon
                className={`${iconSizes[size]} ${isActive ? option.color : 'text-muted-foreground'}`}
              />
              {showLabels && (
                <>
                  <span className={`font-semibold text-sm ${isActive ? option.color : ''}`}>
                    {option.label}
                  </span>
                  <span className="text-[9px] text-muted-foreground text-center">
                    {option.sublabel}
                  </span>
                </>
              )}
            </div>
            {isActive && size !== 'sm' && (
              <Badge
                className={`absolute -top-1.5 -right-1.5 text-[10px] ${option.borderColor.replace('border', 'bg')}`}
              >
                Aktiv
              </Badge>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Kompakte Modus-Anzeige (nur Icon + Label)
 */
export function LLMModeBadge({ mode }: { mode: LLMMode }) {
  const option = MODE_OPTIONS.find((o) => o.value === mode)!;
  const Icon = option.icon;

  return (
    <Badge variant="outline" className={`${option.bgColor} ${option.color} gap-1`}>
      <Icon className="w-3 h-3" />
      {option.label}
    </Badge>
  );
}
