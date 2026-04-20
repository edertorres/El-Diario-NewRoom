import React from 'react';
import { ArrowRightLeft, AlertTriangle } from 'lucide-react';

interface WordCountIndicatorProps {
  current: number;
  original: number;
  showPercentage?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export const WordCountIndicator: React.FC<WordCountIndicatorProps> = ({
  current,
  original,
  showPercentage = true,
  size = 'medium'
}) => {
  const getStatusColor = () => {
    if (current > original) return 'bg-red-600 text-white border-red-700';
    if (current < original) return 'bg-amber-500 text-white border-amber-600';
    return 'bg-green-600 text-white border-green-700';
  };

  const calculatePercentage = (): string => {
    if (original === 0) return '0.0%';
    const diff = ((current - original) / original) * 100;
    return `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`;
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'small':
        return {
          container: 'px-4 py-1.5 text-xs',
          number: 'text-sm',
          label: 'text-[8px]'
        };
      case 'large':
        return {
          container: 'px-8 py-3 text-base',
          number: 'text-2xl',
          label: 'text-[9px]'
        };
      default:
        return {
          container: 'px-6 py-2 text-sm',
          number: 'text-xl',
          label: 'text-[7px]'
        };
    }
  };

  const sizeClasses = getSizeClasses();
  const statusColor = getStatusColor();

  return (
    <div className={`flex items-center gap-4 ${sizeClasses.container} rounded-2xl border font-bold ${statusColor} shadow-lg`}>
      <div className="flex flex-col items-center">
        <span className={`${sizeClasses.label} uppercase opacity-80`}>Original</span>
        <span className={`${sizeClasses.number} font-black font-mono`}>{original}</span>
      </div>
      <div className="flex flex-col items-center opacity-60">
        <ArrowRightLeft size={size === 'large' ? 20 : size === 'small' ? 12 : 16} />
        {showPercentage && (
          <span className={`${sizeClasses.number} font-black mt-1 text-white`}>
            {calculatePercentage()}
          </span>
        )}
      </div>
      <div className="flex flex-col items-center">
        <span className={`${sizeClasses.label} uppercase opacity-80`}>Caracteres</span>
        <span className={`${sizeClasses.number} font-black font-mono`}>{current}</span>
      </div>
      {current > original && (
        <div className="ml-2">
          <AlertTriangle
            size={size === 'large' ? 20 : size === 'small' ? 12 : 16}
            className="animate-pulse"
          />
        </div>
      )}
    </div>
  );
};
