import { cn } from '@/lib/utils';
import { cva } from 'class-variance-authority';

interface AgentOrbProps {
    state: 'idle' | 'thinking' | 'speaking';
    className?: string;
}

export function AgentOrb({ state, className }: AgentOrbProps) {
    return (
        <div
            className={cn(
                'relative flex items-center justify-center transition-all duration-700 ease-in-out',
                state === 'idle' && 'scale-100 opacity-90',
                state === 'thinking' && 'scale-110 opacity-100',
                state === 'speaking' && 'scale-125 opacity-100',
                className
            )}
        >
            {/* Core - The main shape */}
            <div
                className={cn(
                    'absolute inset-0 bg-gradient-to-br from-foreground/80 via-foreground/20 to-transparent backdrop-blur-xl rounded-full',
                    state === 'idle' ? 'animate-liquid' : 'animate-liquid-fast',
                    'shadow-[0_0_15px_rgba(0,0,0,0.1)] dark:shadow-[0_0_20px_rgba(255,255,255,0.1)]'
                )}
            />

            {/* Inner Turbulence 1 - Rotating/Morphing layer */}
            <div
                className={cn(
                    'absolute inset-1 bg-gradient-to-tr from-transparent via-foreground/5 to-foreground/10 mix-blend-overlay rounded-full',
                    state === 'idle' ? 'animate-liquid' : 'animate-liquid-fast',
                    'animate-spin-slow'
                )}
                style={{ animationDirection: 'reverse', animationDuration: '12s' }}
            />

            {/* Inner Turbulence 2 - Faster morph for internal movement */}
            <div
                className={cn(
                    'absolute inset-2 bg-gradient-to-bl from-white/10 to-transparent opacity-30 rounded-full',
                    'animate-liquid-fast'
                )}
                style={{ animationDelay: '-1.5s' }}
            />
        </div>
    );
}