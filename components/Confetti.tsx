
import React from 'react';

export const Confetti: React.FC = () => {
    const confettiCount = 100;
    const confettiColors = ['var(--accent)', 'var(--success)', 'var(--warning)', 'var(--danger)', '#c792ea', '#88C0D0'];

    return (
        <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
            {Array.from({ length: confettiCount }).map((_, i) => {
                const size = Math.random() * 8 + 4;
                const style: React.CSSProperties = {
                    position: 'absolute',
                    width: `${size}px`,
                    height: `${size}px`,
                    backgroundColor: confettiColors[Math.floor(Math.random() * confettiColors.length)],
                    top: '-10vh',
                    left: `${Math.random() * 100}vw`,
                    animation: `confetti-fall ${Math.random() * 3 + 2}s ${Math.random() * 2}s linear infinite`,
                    transform: `rotate(${Math.random() * 360}deg)`,
                    opacity: Math.random() * 0.5 + 0.5,
                };
                return <div key={i} style={style} />;
            })}
        </div>
    );
};
