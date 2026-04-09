export function TalentHubLogo({ size = 44 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Connecting spokes */}
      <line x1="22" y1="22" x2="22" y2="5"  stroke="#87CDE0" strokeWidth="2.2" strokeLinecap="round"/>
      <line x1="22" y1="22" x2="37" y2="13" stroke="#87CDE0" strokeWidth="2.2" strokeLinecap="round"/>
      <line x1="22" y1="22" x2="37" y2="31" stroke="#87CDE0" strokeWidth="2.2" strokeLinecap="round"/>
      <line x1="22" y1="22" x2="22" y2="39" stroke="#87CDE0" strokeWidth="2.2" strokeLinecap="round"/>
      <line x1="22" y1="22" x2="7"  y2="31" stroke="#87CDE0" strokeWidth="2.2" strokeLinecap="round"/>
      <line x1="22" y1="22" x2="7"  y2="13" stroke="#87CDE0" strokeWidth="2.2" strokeLinecap="round"/>

      {/* Outer nodes */}
      <circle cx="22" cy="5"  r="3.5" fill="#48B6D3"/>
      <circle cx="37" cy="13" r="3.5" fill="#48B6D3"/>
      <circle cx="37" cy="31" r="3.5" fill="#48B6D3"/>
      <circle cx="22" cy="39" r="3.5" fill="#48B6D3"/>
      <circle cx="7"  cy="31" r="3.5" fill="#48B6D3"/>
      <circle cx="7"  cy="13" r="3.5" fill="#48B6D3"/>

      {/* Center hub */}
      <circle cx="22" cy="22" r="11" fill="#19708C"/>

      {/* TH monogram */}
      <text
        x="22"
        y="27"
        textAnchor="middle"
        fontFamily="system-ui, sans-serif"
        fontSize="11"
        fontWeight="700"
        fill="white"
        letterSpacing="-0.5"
      >
        TH
      </text>
    </svg>
  )
}
