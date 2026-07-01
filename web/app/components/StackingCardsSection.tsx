'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform, useMotionValueEvent, type MotionValue } from 'motion/react';
import CheckpointSection, { type CheckpointSectionHandle } from './CheckpointSection';
import LocalFirstSectionB from './LocalFirstSectionB';
import LocalFirstSectionC from './LocalFirstSectionC';
import LocalFirstSectionD from './LocalFirstSectionD';

interface CardProps {
  i: number;
  bg?: string;
  progress: MotionValue<number>;
  range: [number, number];
  targetScale: number;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  children?: React.ReactNode;
}

function Card({ i, bg, progress, range, targetScale, onMouseEnter, onMouseLeave, children }: CardProps) {
  const scale = useTransform(progress, range, [1, targetScale]);

  return (
    <div className="h-screen flex items-center justify-center sticky top-0 pointer-events-none">
      <motion.div
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        style={{
          scale,
          top: `calc(-5vh + ${i * 25}px)`,
          background: bg,
          borderRadius: 6,
          height: 640,
          overflow: 'hidden',
          pointerEvents: 'auto',
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

  const card1Ref = useRef<CheckpointSectionHandle>(null);

  useMotionValueEvent(scrollYProgress, 'change', (latest) => {
    if (!container.current) return;
    if (latest > 0.85) {
      container.current.setAttribute('inert', '');
    } else {
      container.current.removeAttribute('inert');
    }
  });

  const CARDS = [
    {
      id: 1,
      content: <CheckpointSection ref={card1Ref} />,
      onMouseEnter: () => card1Ref.current?.hoverEnter(),
      onMouseLeave: () => card1Ref.current?.hoverLeave(),
    },
    {
      id: 2,
      content: <LocalFirstSectionB reversed />,
    },
    {
      id: 3,
      content: <LocalFirstSectionC />,
    },
    {
      id: 4,
      content: <LocalFirstSectionD />,
    },
  ];

  return (
    <section ref={container} style={{ background: '#ffffff', padding: '0 32px' }}>
      {CARDS.map((card, i) => {
        const targetScale = 1 - (CARDS.length - i) * 0.04;
        return (
          <Card
            key={card.id}
            i={i}
            progress={scrollYProgress}
            range={[i * (1 / CARDS.length), 1]}
            targetScale={targetScale}
            onMouseEnter={card.onMouseEnter}
            onMouseLeave={card.onMouseLeave}
          >
            {card.content}
          </Card>
        );
      })}
    </section>
  );
}
