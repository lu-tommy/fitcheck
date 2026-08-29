import { cn } from '@/lib/cn';

/**
 * A flat lay, drawn as line work.
 *
 * The empty screens used to show a t-shirt icon in a grey square, which says
 * "no data" rather than "this is what goes here". A lay of the four things an
 * outfit is made of shows the shape of what she is about to build, at whatever
 * size it is dropped into, in whatever theme is on.
 */
export function WardrobeMark({ className }: { className?: string; 'aria-hidden'?: boolean }) {
  return (
    <svg
      viewBox="0 0 200 150"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
      className={cn('w-full', className)}
    >
      {/* top */}
      <path d="M52 24 q9 8 18 0 L84 28 L88 46 L77 48 L77 82 L45 82 L45 48 L34 46 L38 28 Z" />
      <path d="M55 25 L61 34 L64 28" strokeWidth={1.4} />
      {/* bottom */}
      <path d="M46 90 L78 90 L83 142 L70 142 L64 112 L58 142 L41 142 Z" />
      <path d="M46 97 L78 97" strokeWidth={1.4} />
      {/* shoe */}
      <path d="M116 136 q-1-22 16-23 q12 0 17 11 q7 9 22 13 q10 3 10 10 l0 5 L119 152 q-3 0-3-4 Z" />
      <path d="M116 143 L181 143" strokeWidth={1.4} />
      <path d="M129 118 L143 126 M134 127 L147 134" strokeWidth={1.4} />
      {/* watch */}
      <circle cx="147" cy="46" r="15" />
      <path d="M139 33 L139 20 q0-4 4-4 l8 0 q4 0 4 4 l0 13" />
      <path d="M139 59 L139 72 q0 4 4 4 l8 0 q4 0 4-4 l0-13" />
      <path d="M147 46 L147 38 M147 46 L153 49" strokeWidth={1.4} />
    </svg>
  );
}
