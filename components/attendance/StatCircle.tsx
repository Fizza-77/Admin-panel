type StatCircleProps = {
  label: string;
  value: string;
  sublabel?: string;
  percent?: number;
  accent?: 'green' | 'red' | 'yellow' | 'blue' | 'slate' | 'cyan';
  currencySymbol?: string;
};

const ACCENT: Record<NonNullable<StatCircleProps['accent']>, string> = {
  green: '#22c55e',
  red: '#ef4444',
  yellow: '#facc15',
  blue: '#3b82f6',
  slate: '#94a3b8',
  cyan: '#06b6d4',
};

export default function StatCircle({
  label,
  value,
  sublabel,
  percent,
  accent = 'cyan',
  currencySymbol,
}: StatCircleProps) {
  const color = ACCENT[accent];
  const ring = typeof percent === 'number' ? Math.min(100, Math.max(0, percent)) : 0;
  const size = 96;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (ring / 100) * circumference;

  return (
    <div className="att-stat-circle">
      <div className="att-stat-circle-ring" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth={stroke}
          />
          {typeof percent === 'number' && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circumference}`}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          )}
        </svg>
        <div className={`att-stat-circle-value${currencySymbol ? ' att-stat-circle-value--currency' : ''}`}>
          {currencySymbol && <span className="att-stat-circle-currency">{currencySymbol}</span>}
          <span className="att-stat-circle-number">{value}</span>
        </div>
      </div>
      <p className="att-stat-circle-label">{label}</p>
      {sublabel && <p className="att-stat-circle-sublabel">{sublabel}</p>}
    </div>
  );
}
