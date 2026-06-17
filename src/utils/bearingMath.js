export const LISTENING_POSITION_ANGLE = -150

export const BLADE_BASE_ANGLES = {
  A: 0,
  B: 120,
  C: 240,
}

export function degreesToRadians(degrees) {
  return (degrees * Math.PI) / 180
}

export function normalizeAngle(degrees) {
  return ((degrees % 360) + 360) % 360
}

export function polarToCartesian(centerX, centerY, radius, angleDegrees) {
  const angleRadians = degreesToRadians(angleDegrees)

  return {
    x: centerX + radius * Math.cos(angleRadians),
    y: centerY + radius * Math.sin(angleRadians),
  }
}

export function getPitchDiameter(bearingData) {
  if (bearingData.pitchDiameterCm > 0) {
    return bearingData.pitchDiameterCm
  }

  return (bearingData.outerDiameterCm + bearingData.innerDiameterCm) / 2
}

export function getCageRpm(outerRpm, bearingData) {
  const pitchDiameter = getPitchDiameter(bearingData)

  if (!pitchDiameter || !bearingData.rollerDiameterCm) {
    return 0
  }

  return 0.5 * outerRpm * (1 - bearingData.rollerDiameterCm / pitchDiameter)
}

export function rpmToAngleDelta(rpm, elapsedMs, direction = 'ccw') {
  const directionSign = direction === 'ccw' ? -1 : 1

  return directionSign * rpm * 360 * (elapsedMs / 60000)
}

export function getRotorMarkerAngles(referenceBlade, outerAngleDeg) {
  const referenceBaseAngle = BLADE_BASE_ANGLES[referenceBlade] ?? 0
  const referenceOffset = -90 - referenceBaseAngle

  return Object.fromEntries(
    Object.entries(BLADE_BASE_ANGLES).map(([label, baseAngle]) => [
      label,
      baseAngle + referenceOffset + outerAngleDeg,
    ]),
  )
}

export function getRollerVisualAngle(index, rollerCount, cageAngleDeg) {
  return (360 / rollerCount) * index - 90 + cageAngleDeg
}

export function buildRollerPositions(count, radius, cageAngleDeg = 0) {
  return Array.from({ length: count }, (_, index) => {
    const angle = getRollerVisualAngle(index, count, cageAngleDeg)
    const position = polarToCartesian(200, 200, radius, angle)

    return {
      ...position,
      angle,
    }
  })
}

export function getNearestRollerIndexAtAngle(
  rollerCount,
  cageAngleDeg,
  targetAngle = LISTENING_POSITION_ANGLE,
) {
  const spacing = 360 / rollerCount
  const rawIndex = (targetAngle - cageAngleDeg + 90) / spacing

  return normalizeRollerIndex(Math.round(rawIndex), rollerCount)
}

export function normalizeRollerIndex(index, rollerCount) {
  return ((index % rollerCount) + rollerCount) % rollerCount
}

export function getRollerAngleToBladeA(
  rollerIndex,
  rollerCount,
  cageAngleDeg,
  referenceBlade,
  outerAngleDeg,
) {
  if (rollerIndex === null || rollerIndex === undefined) {
    return null
  }

  const rollerAngle = getRollerVisualAngle(rollerIndex, rollerCount, cageAngleDeg)
  const markerAngles = getRotorMarkerAngles(referenceBlade, outerAngleDeg)

  return normalizeAngle(rollerAngle - markerAngles.A)
}

export function getSmallestAngleDistance(firstAngle, secondAngle) {
  const distance = Math.abs(normalizeAngle(firstAngle) - normalizeAngle(secondAngle))

  return Math.min(distance, 360 - distance)
}

export function isAngleBetweenClockwise(angle, startAngle, endAngle) {
  const normalizedAngle = normalizeAngle(angle)
  const normalizedStart = normalizeAngle(startAngle)
  const normalizedEnd = normalizeAngle(endAngle)

  if (normalizedStart <= normalizedEnd) {
    return normalizedAngle >= normalizedStart && normalizedAngle < normalizedEnd
  }

  return normalizedAngle >= normalizedStart || normalizedAngle < normalizedEnd
}

export function describeRollerPosition(
  rollerIndex,
  rollerCount,
  cageAngleDeg,
  referenceBlade,
  outerAngleDeg,
) {
  if (rollerIndex === null || rollerIndex === undefined) {
    return 'kein Defekt markiert'
  }

  const rollerAngle = getRollerVisualAngle(rollerIndex, rollerCount, cageAngleDeg)

  if (getSmallestAngleDistance(rollerAngle, LISTENING_POSITION_ANGLE) <= 10) {
    return 'nahe 10 Uhr'
  }

  const markerAngles = getRotorMarkerAngles(referenceBlade, outerAngleDeg)

  if (isAngleBetweenClockwise(rollerAngle, markerAngles.A, markerAngles.B)) {
    return 'zwischen A und B'
  }

  if (isAngleBetweenClockwise(rollerAngle, markerAngles.B, markerAngles.C)) {
    return 'zwischen B und C'
  }

  return 'zwischen C und A'
}
