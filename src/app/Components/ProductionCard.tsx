import React from 'react';
import { FaHammer, FaCog, FaExclamationTriangle } from 'react-icons/fa';

interface ProductionCardProps {
  title: string;
  stock: number;
  unit: string; // e.g., "un", "kg", "lts"
  isCritical?: boolean;
  timesProduced?: number;
  onClick: () => void;
  onConfigure?: () => void; // Optional hook for settings
}

const ProductionCard: React.FC<ProductionCardProps> = ({
  title,
  stock,
  unit,
  isCritical = false,
  timesProduced,
  onClick,
  onConfigure,
}) => {
  return (
    <div
      onClick={onClick}
      className={`
        relative group cursor-pointer overflow-hidden rounded-2xl border-2 transition-all duration-300
        hover:shadow-xl hover:-translate-y-1 active:scale-[0.98]
        ${isCritical 
            ? 'bg-amber-500/10 border-amber-500 hover:bg-amber-500/20' 
            : 'bg-card border-border hover:border-primary/50'
        }
      `}
    >
        {isCritical && (
            <div className="absolute top-0 right-0 bg-amber-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-xl z-10">
                CRÍTICO
            </div>
        )}

      <div className="p-6 flex flex-col items-center text-center justify-between h-full min-h-[180px]">
        
        {/* Helper Actions */}
        {onConfigure && (
            <button 
                onClick={(e) => { e.stopPropagation(); onConfigure(); }}
                className="absolute top-3 left-3 text-muted-foreground/30 hover:text-foreground hover:bg-muted rounded-full p-2 transition-all outline-none"
                title="Configurar Estrategia"
            >
                <FaCog size={16} />
            </button>
        )}

        {/* Icon & Title */}
        <div className="mb-4 w-full flex-1 flex items-center justify-center">
            <h3 className="font-serif font-bold text-xl text-foreground leading-snug line-clamp-2 px-2">
                {title}
            </h3>
        </div>

        {/* Stock Display */}
        <div className="my-2 relative flex flex-col items-center">
            <div className={`text-5xl font-black tracking-tighter ${isCritical ? 'text-amber-600' : 'text-primary'}`}>
                {stock}
            </div>
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-1">
                {unit}
            </div>
            {timesProduced !== undefined && (
                <div className="mt-2 text-[10px] font-bold text-[#A0522D] bg-[#A0522D]/10 px-2 py-0.5 rounded-full inline-block">
                    {timesProduced} Entrenamientos
                </div>
            )}
        </div>

        {/* Action Hint */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-4 w-full left-0 flex justify-center">
            <span className="bg-foreground text-background text-xs px-3 py-1.5 rounded-full font-bold flex items-center gap-2 shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform">
                <FaHammer size={12} /> PRODUCIR
            </span>
        </div>
      </div>
    </div>
  );
};

export default ProductionCard;
