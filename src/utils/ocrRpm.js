const MAX_RPM = 30
const MIN_RPM = 0
const STABLE_RPM_TOLERANCE = 0.15

function isPlausibleRpm(value) {
  return Number.isFinite(value) && value >= MIN_RPM && value <= MAX_RPM
}

function toRpmCandidate(rawValue) {
  const value = Number.parseFloat(rawValue.replace(',', '.'))

  return isPlausibleRpm(value) ? value : null
}

export function parseRpmFromText(text) {
  if (!text) {
    return null
  }

  const normalizedText = text.replace(/,/g, '.')
  const rpmNearNumberPatterns = [
    /rpm\s*[:=]?\s*(\d+(?:\.\d+)?)/i,
    /(\d+(?:\.\d+)?)\s*rpm/i,
  ]

  for (const pattern of rpmNearNumberPatterns) {
    const match = normalizedText.match(pattern)
    const candidate = match ? toRpmCandidate(match[1]) : null

    if (candidate !== null) {
      return candidate
    }
  }

  const numbers = normalizedText.match(/\d+(?:\.\d+)?/g) || []

  for (const number of numbers) {
    const candidate = toRpmCandidate(number)

    if (candidate !== null) {
      return candidate
    }
  }

  return null
}

export function getStableRpmValue(values, tolerance = STABLE_RPM_TOLERANCE) {
  const recentValues = values.filter(isPlausibleRpm).slice(-3)

  if (recentValues.length < 2) {
    return null
  }

  for (let firstIndex = 0; firstIndex < recentValues.length; firstIndex += 1) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < recentValues.length;
      secondIndex += 1
    ) {
      const firstValue = recentValues[firstIndex]
      const secondValue = recentValues[secondIndex]

      if (Math.abs(firstValue - secondValue) <= tolerance) {
        return (firstValue + secondValue) / 2
      }
    }
  }

  return null
}
