export function PlaneIllustration() {
  return (
    <svg
      width="280"
      height="140"
      viewBox="0 0 280 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="transition-colors duration-300"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="fuselageGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop
            offset="0%"
            className="[stop-color:rgb(148_163_184)]"
            stopOpacity="0.3"
          />
          <stop
            offset="50%"
            className="[stop-color:rgb(203_213_225)]"
            stopOpacity="0.5"
          />
          <stop
            offset="100%"
            className="[stop-color:rgb(148_163_184)]"
            stopOpacity="0.3"
          />
        </linearGradient>

        <linearGradient id="wingGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop
            offset="0%"
            className="[stop-color:rgb(148_163_184)]"
            stopOpacity="0.5"
          />
          <stop
            offset="100%"
            className="[stop-color:rgb(203_213_225)]"
            stopOpacity="0.2"
          />
        </linearGradient>

        <filter id="softShadow">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
          <feOffset dx="1" dy="2" result="offsetblur" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.2" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Clouds Background */}
      <g opacity="0.15" className="fill-slate-400 dark:fill-slate-500">
        <ellipse cx="50" cy="95" rx="25" ry="12" />
        <ellipse cx="70" cy="92" rx="18" ry="10" />
        <ellipse cx="220" cy="105" rx="30" ry="15" />
        <ellipse cx="240" cy="100" rx="20" ry="12" />
      </g>

      {/* Flight Path Dotted Line */}
      <path
        d="M15 110 Q140 20 265 90"
        className="stroke-slate-300 dark:stroke-slate-600"
        strokeWidth="1.5"
        strokeDasharray="5 8"
        strokeLinecap="round"
        opacity="0.4"
      />

      {/* Main A380 Body Group */}
      <g filter="url(#softShadow)">
        {/* Fuselage Main Body - Double Deck Characteristic */}
        <path
          d="M35 62
             C 35 55, 50 40, 110 38
             C 165 36, 230 42, 248 55
             L 254 58
             C 258 59, 259 62, 258 64
             L 254 67
             C 230 80, 165 86, 110 84
             C 50 82, 35 68, 35 62 Z"
          fill="url(#fuselageGradient)"
          className="stroke-slate-400 dark:stroke-slate-500"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* Double Deck Shadow Line */}
        <path
          d="M110 55 C 165 54, 230 57, 248 62"
          className="stroke-slate-400 dark:stroke-slate-600"
          strokeWidth="0.8"
          opacity="0.4"
          strokeLinecap="round"
        />

        {/* Cockpit Window */}
        <g className="opacity-60">
          <path
            d="M245 56 C 250 57, 254 59, 254 61 C 254 63, 250 65, 245 66 Z"
            className="fill-sky-200 dark:fill-sky-900 stroke-slate-400 dark:stroke-slate-500"
            strokeWidth="1"
          />
          <circle
            cx="250"
            cy="61"
            r="1.5"
            className="fill-sky-300 dark:fill-sky-800"
          />
        </g>

        {/* Main Wings - Characteristic A380 Swept Wings */}
        <path
          d="M140 53 L 95 15 L 105 14 L 115 18 L 160 53 Z"
          fill="url(#wingGradient)"
          className="stroke-slate-400 dark:stroke-slate-500"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />

        {/* Wing Detail Lines */}
        <path
          d="M135 50 L 100 18"
          className="stroke-slate-400 dark:stroke-slate-600"
          strokeWidth="0.6"
          opacity="0.3"
        />

        {/* Wingtip Fence - Iconic A380 Feature */}
        <path
          d="M95 15 L 92 8 L 98 8 L 100 12 Z"
          className="fill-slate-400 dark:fill-slate-600 stroke-slate-500 dark:stroke-slate-700"
          strokeWidth="0.8"
        />

        {/* Bottom Wing */}
        <path
          d="M140 69 L 95 107 L 105 108 L 115 104 L 160 69 Z"
          fill="url(#wingGradient)"
          className="stroke-slate-400 dark:stroke-slate-500"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />

        {/* Bottom Wing Detail */}
        <path
          d="M135 72 L 100 104"
          className="stroke-slate-400 dark:stroke-slate-600"
          strokeWidth="0.6"
          opacity="0.3"
        />

        {/* Bottom Wingtip Fence */}
        <path
          d="M95 107 L 92 114 L 98 114 L 100 110 Z"
          className="fill-slate-400 dark:fill-slate-600 stroke-slate-500 dark:stroke-slate-700"
          strokeWidth="0.8"
        />

        {/* Vertical Tail Fin */}
        <path
          d="M80 60 L 50 18 L 55 17 L 95 50 Z"
          fill="url(#wingGradient)"
          className="stroke-slate-400 dark:stroke-slate-500"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />

        {/* Tail Fin Detail */}
        <path
          d="M75 55 L 55 25"
          className="stroke-slate-400 dark:stroke-slate-600"
          strokeWidth="0.6"
          opacity="0.3"
        />

        {/* Horizontal Stabilizers */}
        <path
          d="M65 60 L 42 52 L 42 55 L 70 61 Z"
          className="fill-slate-300 dark:fill-slate-700 stroke-slate-400 dark:stroke-slate-500"
          strokeWidth="1"
        />
        <path
          d="M65 62 L 42 70 L 42 67 L 70 61 Z"
          className="fill-slate-300 dark:fill-slate-700 stroke-slate-400 dark:stroke-slate-500"
          strokeWidth="1"
        />

        {/* Four Engines - Rolls-Royce or Engine Alliance */}
        <g>
          {/* Top Inner Engine */}
          <ellipse
            cx="122"
            cy="42"
            rx="9"
            ry="5"
            className="fill-slate-400 dark:fill-slate-600 stroke-slate-500 dark:stroke-slate-700"
            strokeWidth="1"
          />
          <ellipse
            cx="122"
            cy="42"
            rx="5"
            ry="3"
            className="fill-slate-500 dark:fill-slate-800"
          />

          {/* Top Outer Engine */}
          <ellipse
            cx="145"
            cy="50"
            rx="10"
            ry="5.5"
            className="fill-slate-400 dark:fill-slate-600 stroke-slate-500 dark:stroke-slate-700"
            strokeWidth="1"
          />
          <ellipse
            cx="145"
            cy="50"
            rx="6"
            ry="3.5"
            className="fill-slate-500 dark:fill-slate-800"
          />

          {/* Bottom Inner Engine */}
          <ellipse
            cx="122"
            cy="80"
            rx="9"
            ry="5"
            className="fill-slate-400 dark:fill-slate-600 stroke-slate-500 dark:stroke-slate-700"
            strokeWidth="1"
          />
          <ellipse
            cx="122"
            cy="80"
            rx="5"
            ry="3"
            className="fill-slate-500 dark:fill-slate-800"
          />

          {/* Bottom Outer Engine */}
          <ellipse
            cx="145"
            cy="72"
            rx="10"
            ry="5.5"
            className="fill-slate-400 dark:fill-slate-600 stroke-slate-500 dark:stroke-slate-700"
            strokeWidth="1"
          />
          <ellipse
            cx="145"
            cy="72"
            rx="6"
            ry="3.5"
            className="fill-slate-500 dark:fill-slate-800"
          />
        </g>

        {/* Double Deck Windows - Upper Deck */}
        <g className="fill-sky-300 dark:fill-sky-900" opacity="0.6">
          {[145, 156, 167, 178, 189, 200, 211, 222, 233].map((x, i) => (
            <rect
              key={`upper-${x}`}
              x={x}
              y={48 + i * 0.3}
              width="5"
              height="2.5"
              rx="0.8"
              className="stroke-slate-400 dark:stroke-slate-600"
              strokeWidth="0.3"
            />
          ))}
        </g>

        {/* Double Deck Windows - Lower Deck */}
        <g className="fill-sky-300 dark:fill-sky-900" opacity="0.6">
          {[145, 156, 167, 178, 189, 200, 211, 222, 233].map((x, i) => (
            <rect
              key={`lower-${x}`}
              x={x}
              y={62 + i * 0.4}
              width="5"
              height="2.5"
              rx="0.8"
              className="stroke-slate-400 dark:stroke-slate-600"
              strokeWidth="0.3"
            />
          ))}
        </g>

        {/* Additional Cabin Windows */}
        <g className="fill-sky-300 dark:fill-sky-900" opacity="0.4">
          {[115, 125, 135].map((x) => (
            <rect
              key={`cabin-${x}`}
              x={x}
              y={56}
              width="4"
              height="2"
              rx="0.6"
              className="stroke-slate-400 dark:stroke-slate-600"
              strokeWidth="0.3"
            />
          ))}
        </g>
      </g>

      {/* Wake Vapor Trails */}
      <g
        opacity="0.15"
        className="stroke-slate-400 dark:stroke-slate-500"
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        <path d="M50 60 Q 35 58, 18 62" />
        <path d="M48 64 Q 32 64, 15 70" />
        <path d="M46 68 Q 30 69, 12 75" />
      </g>

      {/* Subtle Motion Blur Effect */}
      <g opacity="0.08">
        <path
          d="M35 62 L 30 62"
          className="stroke-slate-400 dark:stroke-slate-500"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d="M35 66 L 28 66"
          className="stroke-slate-400 dark:stroke-slate-500"
          strokeWidth="6"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
