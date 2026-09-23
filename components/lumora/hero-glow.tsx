const streaks = [
  {
    top: '4%',
    left: '42%',
    w: 2,
    h: '62%',
    color: 'rgba(242,193,78,0.28)',
    blur: true,
  },
  {
    top: '8%',
    left: '58%',
    w: 2,
    h: '54%',
    color: 'rgba(246,192,121,0.26)',
    blur: true,
  },
  {
    top: '2%',
    left: '35%',
    w: 1,
    h: '50%',
    color: 'rgba(232,137,46,0.18)',
    blur: false,
  },
  {
    top: '10%',
    left: '66%',
    w: 1,
    h: '46%',
    color: 'rgba(242,193,78,0.16)',
    blur: false,
  },
];

const specks = [
  {
    top: '18%',
    left: '46%',
    size: 5,
    color: 'rgba(246,192,121,0.68)',
    blur: true,
  },
  {
    top: '30%',
    left: '60%',
    size: 4,
    color: 'rgba(246,192,121,0.48)',
    blur: false,
  },
  {
    top: '44%',
    left: '39%',
    size: 3,
    color: 'rgba(242,193,78,0.42)',
    blur: false,
  },
  {
    top: '52%',
    left: '63%',
    size: 4,
    color: 'rgba(242,193,78,0.38)',
    blur: false,
  },
  {
    top: '24%',
    left: '54%',
    size: 3,
    color: 'rgba(246,192,121,0.46)',
    blur: false,
  },
];

export function HeroGlow() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div
        className="absolute top-[-6%] left-1/2 h-[620px] w-[760px] -translate-x-1/2 blur-[8px]"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(242,193,78,0.2) 0%, rgba(232,137,46,0.08) 38%, rgba(232,137,46,0) 70%)',
        }}
      />
      <div
        className="absolute top-[40%] left-1/2 h-[340px] w-[900px] -translate-x-1/2"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(242,193,78,0.12) 0%, rgba(242,193,78,0) 68%)',
        }}
      />

      {streaks.map((s, i) => (
        <div
          key={`streak-${i}`}
          className="absolute"
          style={{
            top: s.top,
            left: s.left,
            width: s.w,
            height: s.h,
            background: `linear-gradient(to bottom, rgba(242,193,78,0) 0%, ${s.color} 50%, rgba(242,193,78,0) 100%)`,
            filter: s.blur ? 'blur(1px)' : undefined,
          }}
        />
      ))}

      {specks.map((p, i) => (
        <div
          key={`speck-${i}`}
          className="absolute rounded-full"
          style={{
            top: p.top,
            left: p.left,
            width: p.size,
            height: p.size,
            background: p.color,
            filter: p.blur ? 'blur(0.5px)' : undefined,
          }}
        />
      ))}
    </div>
  );
}
