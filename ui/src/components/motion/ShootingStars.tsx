import React, { useEffect, useState, useRef } from 'react';

export interface ShootingStar {
  id: number;
  x: number;
  y: number;
  angle: number;
  scale: number;
  speed: number;
  distance: number;
}

export interface ShootingStarsProps {
  minSpeed?: number;
  maxSpeed?: number;
  minDelay?: number;
  maxDelay?: number;
  starColor?: string;
  trailColor?: string;
  starWidth?: number;
  starHeight?: number;
  className?: string;
}

export const ShootingStars: React.FC<ShootingStarsProps> = ({
  minSpeed = 12,
  maxSpeed = 28,
  minDelay = 1400,
  maxDelay = 4500,
  starColor = '#22d3ee',
  trailColor = '#6366f1',
  starWidth = 14,
  starHeight = 1.5,
  className = '',
}) => {
  const [star, setStar] = useState<ShootingStar | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const createStar = () => {
      const containerWidth = svgRef.current?.clientWidth || window.innerWidth;
      const containerHeight = svgRef.current?.clientHeight || window.innerHeight;

      // Spawn star from top or left edge
      const spawnFromTop = Math.random() > 0.4;
      const x = spawnFromTop ? Math.random() * containerWidth : 0;
      const y = spawnFromTop ? 0 : Math.random() * (containerHeight * 0.6);
      const angle = 35 + Math.random() * 20; // 35° to 55° downward sweep
      const scale = 0.6 + Math.random() * 0.8;
      const speed = minSpeed + Math.random() * (maxSpeed - minSpeed);
      const distance = 0;

      setStar({
        id: Date.now(),
        x,
        y,
        angle,
        scale,
        speed,
        distance,
      });

      const randomDelay = Math.random() * (maxDelay - minDelay) + minDelay;
      timeoutId = setTimeout(createStar, randomDelay);
    };

    createStar();

    return () => {
      clearTimeout(timeoutId);
    };
  }, [minSpeed, maxSpeed, minDelay, maxDelay]);

  useEffect(() => {
    let frameId: number;

    const moveStar = () => {
      if (star) {
        setStar((prevStar) => {
          if (!prevStar) return null;
          const rad = (prevStar.angle * Math.PI) / 180;
          const newX = prevStar.x + prevStar.speed * Math.cos(rad);
          const newY = prevStar.y + prevStar.speed * Math.sin(rad);
          const newDistance = prevStar.distance + prevStar.speed;

          const maxDist = (svgRef.current?.clientWidth || window.innerWidth) * 1.5;
          if (newDistance >= maxDist || newY > (svgRef.current?.clientHeight || window.innerHeight)) {
            return null;
          }
          return {
            ...prevStar,
            x: newX,
            y: newY,
            distance: newDistance,
          };
        });
      }
      frameId = requestAnimationFrame(moveStar);
    };

    frameId = requestAnimationFrame(moveStar);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [star]);

  return (
    <svg
      ref={svgRef}
      className={`w-full h-full absolute inset-0 pointer-events-none z-0 overflow-hidden ${className}`}
    >
      {star && (
        <rect
          key={star.id}
          x={star.x}
          y={star.y}
          width={starWidth * star.scale}
          height={starHeight}
          fill="url(#shooting-star-gradient)"
          transform={`rotate(${star.angle}, ${star.x}, ${star.y})`}
          style={{
            filter: 'drop-shadow(0 0 6px rgba(34, 211, 238, 0.8))',
          }}
        />
      )}
      <defs>
        <linearGradient
          id="shooting-star-gradient"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="0%"
        >
          <stop offset="0%" stopColor={trailColor} stopOpacity="0" />
          <stop offset="60%" stopColor={trailColor} stopOpacity="0.6" />
          <stop offset="100%" stopColor={starColor} stopOpacity="1" />
        </linearGradient>
      </defs>
    </svg>
  );
};

export default ShootingStars;
