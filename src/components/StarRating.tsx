import React from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  rating: number; // 0.0 to 5.0
  maxStars?: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showNumeric?: boolean;
  className?: string;
}

export const StarRating: React.FC<StarRatingProps> = ({
  rating,
  maxStars = 5,
  size = 'md',
  showNumeric = true,
  className = '',
}) => {
  const roundedRating = Math.max(0, Math.min(maxStars, rating));

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
    xl: 'w-8 h-8',
  };

  const textClasses = {
    sm: 'text-xs font-semibold',
    md: 'text-sm font-bold',
    lg: 'text-base font-bold',
    xl: 'text-xl font-extrabold',
  };

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <div className="flex items-center gap-0.5">
        {Array.from({ length: maxStars }).map((_, idx) => {
          const fillAmount = Math.max(0, Math.min(1, roundedRating - idx));
          return (
            <div key={idx} className="relative inline-block">
              {/* Background empty star */}
              <Star className={`${sizeClasses[size]} text-slate-300 fill-slate-200 dark:text-slate-700 dark:fill-slate-800`} />
              {/* Filled star portion */}
              {fillAmount > 0 && (
                <div
                  className="absolute top-0 left-0 overflow-hidden"
                  style={{ width: `${fillAmount * 100}%` }}
                >
                  <Star className={`${sizeClasses[size]} text-amber-500 fill-amber-400 drop-shadow-sm`} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {showNumeric && (
        <span className={`${textClasses[size]} text-slate-800 dark:text-slate-100 ml-1`}>
          {roundedRating.toFixed(1)}
        </span>
      )}
    </div>
  );
};
