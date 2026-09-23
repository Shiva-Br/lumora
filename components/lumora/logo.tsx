import Image from 'next/image';

import type { CSSProperties } from 'react';

// Official Lumora brand assets (in /public). The full wordmark drives primary
// nav identity; the icon mark is for compact/loading placements.
const FULL_RATIO = 400 / 88; // wordmark intrinsic aspect ratio
const WORDMARK_SRC = '/lumora-wordmark.svg';
const MARK_SRC = '/lumora-mark.svg';

export function LogoFull({
  height = 28,
  style,
}: {
  height?: number;
  style?: CSSProperties;
}) {
  const width = Math.round(height * FULL_RATIO);
  return (
    <Image
      src={WORDMARK_SRC}
      alt="Lumora"
      width={width}
      height={height}
      priority
      style={{ height, width: 'auto', display: 'block', ...style }}
    />
  );
}

// Width-driven wordmark for hero/auth placements (responsive down to viewport).
// Uses a plain <img> on purpose: the brand wordmark is treated like a single
// art asset, and `width + height:auto` keeps it intact in flexible layouts.
export function LogoWordmark({
  maxWidth = 480,
  style,
}: {
  maxWidth?: number;
  style?: CSSProperties;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={WORDMARK_SRC}
      alt="Lumora"
      width={400}
      height={88}
      style={{
        width: `min(${maxWidth}px, calc(100vw - 48px))`,
        height: 'auto',
        display: 'block',
        userSelect: 'none',
        ...style,
      }}
    />
  );
}

export function LogoMark({
  size = 28,
  className,
  priority = false,
  style,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
  style?: CSSProperties;
}) {
  return (
    <Image
      src={MARK_SRC}
      alt="Lumora"
      width={size}
      height={size}
      className={className}
      priority={priority}
      style={{ height: size, width: size, display: 'block', ...style }}
    />
  );
}
