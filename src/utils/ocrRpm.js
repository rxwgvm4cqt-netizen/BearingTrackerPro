const MAX_RPM = 30
const MIN_RPM = 0
const STABLE_RPM_TOLERANCE = 0.15

function isPlausibleRpm(value) {
  return Number.isFinite(value) && value >= MIN_RPM && value <= MAX_RPM
}

function normalizeNumberText(value) {
  return value.replace(',', '.')
}

function toRpmCandidate(rawValue, context = '') {
  const normalizedValue = normalizeNumberText(rawValue)
  const value = Number.parseFloat(normalizedValue)

  if (!isPlausibleRpm(value)) {
    return null
  }

  const decimalMatch = normalizedValue.match(/\.(\d+)/)
  const decimalPlaces = decimalMatch?.[1]?.length ?? 0
  const hasDecimal = decimalPlaces > 0
  const hasPreferredDecimal = decimalPlaces >= 1 && decimalPlaces <= 2
  const nearRpm = /rpm/i.test(context)
  const score =
    (nearRpm ? 100 : 0) +
    (hasPreferredDecimal ? 40 : 0) +
    (hasDecimal ? 20 : 0) -
    (decimalPlaces > 2 ? 18 : 0)

  return {
    hasDecimal,
    raw: rawValue,
    score,
    value,
  }
}

export function getRpmCandidatesFromText(text) {
  if (!text) {
    return []
  }

  const normalizedText = text.replace(/,/g, '.')
  const candidates = []
  const rpmNumberPatterns = [
    /rpm\s*[:=]?\s*(\d+(?:\.\d+)?)/gi,
    /(\d+(?:\.\d+)?)\s*rpm/gi,
  ]

  for (const pattern of rpmNumberPatterns) {
    for (const match of normalizedText.matchAll(pattern)) {
      const rawValue = match[1]
      const candidate = toRpmCandidate(rawValue, match[0])

      if (candidate) {
        candidates.push(candidate)
      }
    }
  }

  for (const match of normalizedText.matchAll(/\d+(?:\.\d+)?/g)) {
    const candidate = toRpmCandidate(match[0])

    if (candidate) {
      candidates.push(candidate)
    }
  }

  const uniqueCandidateMap = new Map()

  for (const candidate of candidates) {
    const key = `${candidate.value.toFixed(3)}-${candidate.raw}`
    const currentCandidate = uniqueCandidateMap.get(key)

    if (!currentCandidate || candidate.score > currentCandidate.score) {
      uniqueCandidateMap.set(key, candidate)
    }
  }

  const uniqueCandidates = Array.from(uniqueCandidateMap.values())

  return uniqueCandidates.sort((firstCandidate, secondCandidate) => {
    if (secondCandidate.score !== firstCandidate.score) {
      return secondCandidate.score - firstCandidate.score
    }

    if (Number(secondCandidate.hasDecimal) !== Number(firstCandidate.hasDecimal)) {
      return Number(secondCandidate.hasDecimal) - Number(firstCandidate.hasDecimal)
    }

    return firstCandidate.value - secondCandidate.value
  })
}

export function parseRpmFromText(text) {
  return getRpmCandidatesFromText(text)[0]?.value ?? null
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
