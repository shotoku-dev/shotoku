'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform, type MotionValue } from 'motion/react';
import { ReactLenis } from 'lenis/react';
import CheckpointSection from './CheckpointSection';

const CARDS = [
  { id: 1, bg: undefined },   // CheckpointSection provides its own #F2F1ED
  { id: 2, bg: '#E8E6E1' },
  { id: 3, bg: '#DEDAD3' },
  { id: 4, bg: '#D3CFC7' },
];

interface CardProps {
  i: number;
  bg?: string;
  progress: MotionValue<number>;
  range: [number, number];
  targetScale: number;
  children?: React.ReactNode;
}

function Card({ i, bg, progress, range, targetScale, children }: CardProps) {
  const scale = useTransform(progress, range, [1, targetScale]);

  return (
    <div className="h-screen flex items-center justify-center sticky top-0">
      <motion.div
        style={{
          scale,
          top: `calc(-5vh + ${i * 25}px)`,
          background: bg,
          borderRadius: 6,
          height: 640,
          overflow: 'hidden',
        }}
        className="relative w-[calc(100%-64px)] max-w-[960px] origin-top"
      >
        {children}
      </motion.div>
    </div>
  );
}

export default function StackingCardsSection() {
  const container = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: container,
    offset: ['start start', 'end end'],
  });

  return (
    <ReactLenis root>
      <section ref={container} style={{ background: '#ffffff', padding: '0 32px' }}>
        {CARDS.map((card, i) => {
          const targetScale = 1 - (CARDS.length - i) * 0.05;
          return (
            <Card
              key={card.id}
              i={i}
              bg={card.bg}
              progress={scrollYProgress}
              range={[i * (1 / CARDS.length), 1]}
              targetScale={targetScale}
            >
              {i === 0 ? <CheckpointSection /> : null}
            </Card>
          );
        })}
      </section>
    </ReactLenis>
  );
}
