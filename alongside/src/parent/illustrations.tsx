// Simple, friendly pictures for the Home tiles. Decorative: every tile also has a text label.

export function CalendarPicture() {
  return (
    <svg viewBox="0 0 160 120" aria-hidden="true">
      <rect width="160" height="120" fill="#dbeafe" />
      <rect x="34" y="20" width="92" height="86" rx="12" fill="#fff" stroke="#1d4ed8" strokeWidth="5" />
      <rect x="34" y="20" width="92" height="24" rx="10" fill="#2563eb" />
      <rect x="54" y="12" width="8" height="18" rx="4" fill="#1e3a8a" />
      <rect x="98" y="12" width="8" height="18" rx="4" fill="#1e3a8a" />
      {[0, 1, 2].map((r) =>
        [0, 1, 2, 3].map((c) => (
          <rect key={`${r}${c}`} x={46 + c * 18} y={54 + r * 16} width="12" height="10" rx="3" fill={r === 1 && c === 2 ? '#f59e0b' : '#bfdbfe'} />
        )),
      )}
      <circle cx="122" cy="96" r="18" fill="#22c55e" />
      <path d="M113 96 l6 6 l12 -13" stroke="#fff" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function TaxiPicture() {
  return (
    <svg viewBox="0 0 160 120" aria-hidden="true">
      <rect width="160" height="120" fill="#fef3c7" />
      <rect y="92" width="160" height="28" fill="#94a3b8" />
      <rect x="10" y="104" width="22" height="4" fill="#fff" /><rect x="60" y="104" width="22" height="4" fill="#fff" /><rect x="110" y="104" width="22" height="4" fill="#fff" />
      <path d="M30 78 L42 52 Q46 44 56 44 L104 44 Q114 44 118 52 L130 78 Z" fill="#facc15" stroke="#854d0e" strokeWidth="3" />
      <rect x="20" y="70" width="120" height="24" rx="10" fill="#facc15" stroke="#854d0e" strokeWidth="3" />
      <path d="M50 70 L58 52 L78 52 L78 70 Z" fill="#bae6fd" />
      <path d="M84 70 L84 52 L102 52 L110 70 Z" fill="#bae6fd" />
      <rect x="62" y="30" width="36" height="14" rx="4" fill="#1f2937" />
      <text x="80" y="41" textAnchor="middle" fontFamily="Arial" fontWeight="700" fontSize="10" fill="#fde047">TAXI</text>
      <circle cx="46" cy="94" r="12" fill="#1f2937" /><circle cx="46" cy="94" r="5" fill="#cbd5e1" />
      <circle cx="114" cy="94" r="12" fill="#1f2937" /><circle cx="114" cy="94" r="5" fill="#cbd5e1" />
      <rect x="20" y="78" width="10" height="7" rx="2" fill="#fff7ed" /><rect x="130" y="78" width="10" height="7" rx="2" fill="#f87171" />
    </svg>
  )
}

export function PuzzlePicture() {
  const letters = ['C', 'A', 'T', 'S', 'U', 'N', 'E', 'M', 'U', 'T', 'E', 'A']
  return (
    <svg viewBox="0 0 160 120" aria-hidden="true">
      <rect width="160" height="120" fill="#ffedd5" />
      <rect x="28" y="12" width="104" height="96" rx="10" fill="#fff" stroke="#c2410c" strokeWidth="4" />
      {letters.map((l, i) => {
        const x = 44 + (i % 4) * 24
        const y = 36 + Math.floor(i / 4) * 26
        return (
          <text key={i} x={x} y={y} textAnchor="middle" fontFamily="Arial" fontWeight="700" fontSize="18" fill="#7c2d12">
            {l}
          </text>
        )
      })}
      <rect x="32" y="18" width="72" height="24" rx="12" fill="none" stroke="#16a34a" strokeWidth="4" />
      <rect x="104" y="40" width="24" height="56" rx="12" fill="none" stroke="#2563eb" strokeWidth="4" transform="translate(-24 0)" />
    </svg>
  )
}

export function OutingPicture() {
  return (
    <svg viewBox="0 0 160 120" aria-hidden="true">
      <rect width="160" height="120" fill="#ccfbf1" />
      <circle cx="128" cy="26" r="14" fill="#fde047" />
      <rect y="88" width="160" height="32" fill="#86efac" />
      <circle cx="64" cy="46" r="12" fill="#f2c9a0" /><rect x="52" y="60" width="24" height="32" rx="10" fill="#db2777" />
      <circle cx="98" cy="46" r="12" fill="#d9a37a" /><rect x="86" y="60" width="24" height="32" rx="10" fill="#2563eb" />
    </svg>
  )
}
