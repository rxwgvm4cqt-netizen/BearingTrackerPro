import {
  LISTENING_POSITION_ANGLE,
  buildRollerPositions,
  getRotorMarkerAngles,
  getRollerVisualAngle,
  polarToCartesian,
} from '../utils/bearingMath'

const VISUAL_ROLLER_COUNT = 24

function BearingVisualization({ bearingData, trackingState, t }) {
  const rollerCount = Math.max(1, bearingData.rollerCount || 198)
  const visualRollerCount = VISUAL_ROLLER_COUNT
  const visibleSuspectRollerIndex = trackingState.suspiciousRollerIndex ?? 0
  const hasMarkedDefect = trackingState.suspiciousRollerIndex !== null
  const visualRollerPositions = buildRollerPositions(
    visualRollerCount,
    130,
    trackingState.cageAngleDeg,
  )
  const suspectRollerAngle = getRollerVisualAngle(
    visibleSuspectRollerIndex,
    rollerCount,
    trackingState.cageAngleDeg,
  )
  const suspectRollerPosition = polarToCartesian(200, 200, 130, suspectRollerAngle)
  const markerRadius = 178
  const markerAngles = getRotorMarkerAngles(
    trackingState.referenceBlade,
    trackingState.outerAngleDeg,
  )
  const markers = Object.entries(markerAngles).map(([label, angle]) => ({
    label,
    angle,
  }))
  const listenPosition = polarToCartesian(
    200,
    200,
    177,
    LISTENING_POSITION_ANGLE,
  )
  const outerTicks = Array.from({ length: 24 }, (_, index) => index * 15)

  return (
    <section
      className={`bearing-visualization ${
        trackingState.cageRunning ? 'is-cage-running' : ''
      }`}
      aria-label={t('bearingVisualization')}
    >
      <svg viewBox="0 0 400 400" role="img">
        <title>{t('bearingVisualizationTitle')} {bearingData.label}</title>
        <defs>
          <radialGradient id="bearingGlow" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor="#162026" />
            <stop offset="62%" stopColor="#0f171d" />
            <stop offset="100%" stopColor="#070b0f" />
          </radialGradient>
          <filter id="softGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient
            id="normalRollerGradient"
            x1="0%"
            x2="100%"
            y1="0%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#fff0a6" />
            <stop offset="22%" stopColor="#ffc94a" />
            <stop offset="56%" stopColor="#ff9816" />
            <stop offset="100%" stopColor="#7c3508" />
          </linearGradient>
          <linearGradient
            id="suspectRollerGradient"
            x1="0%"
            x2="100%"
            y1="0%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#ffd0d5" />
            <stop offset="24%" stopColor="#ff6575" />
            <stop offset="58%" stopColor="#ff2439" />
            <stop offset="100%" stopColor="#720713" />
          </linearGradient>
          <radialGradient id="normalBallGradient" cx="34%" cy="30%" r="72%">
            <stop offset="0%" stopColor="#fff9c8" />
            <stop offset="24%" stopColor="#ffd85a" />
            <stop offset="62%" stopColor="#ffb21f" />
            <stop offset="100%" stopColor="#93530a" />
          </radialGradient>
          <radialGradient id="suspectBallGradient" cx="34%" cy="30%" r="74%">
            <stop offset="0%" stopColor="#ffe0e4" />
            <stop offset="25%" stopColor="#ff6b78" />
            <stop offset="64%" stopColor="#ff3045" />
            <stop offset="100%" stopColor="#7d0713" />
          </radialGradient>
          <filter id="normalRollerShadow" x="-80%" y="-40%" width="260%" height="180%">
            <feDropShadow
              dx="0.55"
              dy="0.85"
              floodColor="#000000"
              floodOpacity="0.48"
              stdDeviation="0.5"
            />
          </filter>
          <filter id="suspectRollerGlow" x="-120%" y="-80%" width="340%" height="260%">
            <feDropShadow
              dx="0"
              dy="0"
              floodColor="#ff3045"
              floodOpacity="0.95"
              stdDeviation="1.35"
            />
            <feDropShadow
              dx="0.7"
              dy="1"
              floodColor="#000000"
              floodOpacity="0.55"
              stdDeviation="0.45"
            />
          </filter>
        </defs>

        <rect width="400" height="400" rx="18" fill="url(#bearingGlow)" />
        <circle cx="200" cy="200" r="168" className="bearing-ring bearing-ring--outer" />
        <circle cx="200" cy="200" r="103" className="bearing-ring bearing-ring--inner" />
        <circle cx="200" cy="200" r="130" className="bearing-pitch" />

        <g
          className="outer-rotation-ticks"
          transform={`rotate(${trackingState.outerAngleDeg} 200 200)`}
        >
          {outerTicks.map((angle) => {
            const start = polarToCartesian(200, 200, 156, angle)
            const end = polarToCartesian(200, 200, 174, angle)

            return (
              <line
                key={angle}
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
              />
            )
          })}
        </g>

        <g
          className="cage-motion-indicator"
          transform={`rotate(${trackingState.cageAngleDeg} 200 200)`}
        >
          <line x1="200" y1="200" x2="200" y2="70" />
          <circle cx="200" cy="70" r="7" />
        </g>

        {visualRollerPositions.map((roller, index) => (
          <g
            key={index}
            transform={`translate(${roller.x} ${roller.y}) rotate(${roller.angle})`}
          >
            <circle className="roller roller--visual roller--ball" r="7.1" />
            <circle
              className="roller-highlight roller-highlight--ball"
              cx="-2.2"
              cy="-2.4"
              r="1.9"
            />
          </g>
        ))}

        <g
          transform={`translate(${suspectRollerPosition.x} ${suspectRollerPosition.y}) rotate(${suspectRollerAngle})`}
        >
          <circle
            className={`roller roller--suspect roller--ball ${
              hasMarkedDefect ? '' : 'roller--preview'
            }`}
            r="8.8"
          />
          <circle
            className="roller-highlight roller-highlight--suspect roller-highlight--ball"
            cx="-2.9"
            cy="-2.9"
            r="2.35"
          />
        </g>

        <g className="rotor-assembly">
          {markers.map((marker) => {
            const bladeTipX = 200 + markerRadius
            const bladeLabelX = 200 + markerRadius + 1

            return (
              <g
                className="rotor-blade"
                key={marker.label}
                transform={`rotate(${marker.angle} 200 200)`}
              >
                <path d="M200 200 C230 192 276 188 350 196 C362 200 362 207 350 211 C276 216 230 209 200 200 Z" />
                <line x1="200" y1="200" x2={bladeTipX} y2="200" />
                <circle cx={bladeLabelX} cy="200" r="16" />
                <text
                  x={bladeLabelX}
                  y="205"
                  transform={`rotate(${-marker.angle} ${bladeLabelX} 200)`}
                >
                  {marker.label}
                </text>
              </g>
            )
          })}
        </g>

        <g className="listen-marker" filter="url(#softGlow)">
          <path d="M49 107 L72 96 L72 119 Z" />
          <circle cx={listenPosition.x} cy={listenPosition.y} r="8" />
          <text x="34" y="88">{t('tenOClock')}</text>
        </g>

        <circle cx="200" cy="200" r="56" className="bearing-hub" />
        <circle cx="200" cy="200" r="25" className="rotor-nose" />
        <text className="bearing-center-label" x="200" y="194">
          {bearingData.rotatingRing === 'outer' ? 'OUTER' : 'INNER'}
        </text>
        <text className="bearing-center-sub" x="200" y="218">
          {bearingData.direction?.toUpperCase()} / {bearingData.rows} ROWS
        </text>
        <text className="bearing-reference-label" x="200" y="250">
          REF {trackingState.referenceBlade} @ 12
        </text>
      </svg>
    </section>
  )
}

export default BearingVisualization
