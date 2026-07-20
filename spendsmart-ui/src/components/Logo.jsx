/**
 * SpendSmart Logo — icon mark + optional wordmark
 * size: icon size in px (default 32)
 * showText: show "SpendSmart" wordmark beside icon
 */
export default function Logo({ size = 32, showText = true, className = '' }) {
  const r = size / 40   // scale ratio

  return (
    <div className={`flex items-center gap-2.5 ${className}`} style={{ lineHeight: 1 }}>
      {/* Icon mark */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >
        <defs>
          <linearGradient id="ss-bg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop stopColor="#8b5cf6" />
            <stop offset="1" stopColor="#06b6d4" />
          </linearGradient>
          <linearGradient id="ss-shine" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop stopColor="white" stopOpacity="0.18" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Background */}
        <rect width="40" height="40" rx="10" fill="url(#ss-bg)" />
        <rect width="40" height="40" rx="10" fill="url(#ss-shine)" />

        {/* ₹ mark */}
        {/* Top horizontal bar */}
        <line x1="12" y1="11" x2="28" y2="11" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
        {/* Second bar */}
        <line x1="12" y1="17" x2="25" y2="17" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
        {/* Vertical stem */}
        <line x1="14" y1="11" x2="14" y2="30" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
        {/* Bowl of R */}
        <path d="M14 11 Q28 11 28 14 Q28 17 14 17" stroke="white" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        {/* Diagonal slash */}
        <line x1="14" y1="17" x2="27" y2="30" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
      </svg>

      {/* Wordmark */}
      {showText && (
        <span
          style={{
            fontSize: size * 0.4,
            fontWeight: 700,
            letterSpacing: '0.02em',
            background: 'linear-gradient(135deg, #a78bfa, #06b6d4)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            lineHeight: 1,
          }}
        >
          SpendSmart
        </span>
      )}
    </div>
  )
}
