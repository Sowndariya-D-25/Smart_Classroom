// Euclidean distance between two face-api.js descriptors (128-length
// float vectors). Smaller = more similar.
//
// Production-calibrated defaults for 1:N open-set face identification:
// - FACE_MATCH_THRESHOLD: 0.50 (strict upper-bound for genuine match)
// - FACE_MARGIN_THRESHOLD: 0.08 (minimum gap between best and 2nd best candidate to reject ambiguity)
//
// Both values are configurable via environment variables in server/.env.
export const FACE_MATCH_THRESHOLD = Number(process.env.FACE_MATCH_THRESHOLD) || 0.50
export const FACE_MARGIN_THRESHOLD = Number(process.env.FACE_MARGIN_THRESHOLD) || 0.08

export const DESCRIPTOR_LENGTH = 128

/**
 * Validates that a descriptor is an array of exactly 128 finite numbers.
 * Rejects null, undefined, empty arrays, wrong lengths, NaN, Infinity, and non-numbers.
 */
export function isValidDescriptor(value) {
  return (
    Array.isArray(value) &&
    value.length === DESCRIPTOR_LENGTH &&
    value.every((n) => typeof n === 'number' && Number.isFinite(n))
  )
}

/**
 * Calculates Euclidean distance between two 128-d face descriptors.
 * Returns Infinity if either descriptor is invalid or non-finite.
 */
export function euclideanDistance(a, b) {
  if (!isValidDescriptor(a) || !isValidDescriptor(b)) {
    return Infinity
  }
  let sum = 0
  for (let i = 0; i < DESCRIPTOR_LENGTH; i += 1) {
    const diff = a[i] - b[i]
    sum += diff * diff
  }
  const dist = Math.sqrt(sum)
  return Number.isFinite(dist) ? dist : Infinity
}

/**
 * Evaluates the distance between a query descriptor and all enrollment samples
 * in a student's FaceProfile.
 *
 * For single-sample profiles:
 *   Returns the Euclidean distance.
 *
 * For multi-sample profiles:
 *   Calculates both bestSampleDistance (minimum) and meanSampleDistance (average).
 *   Applies conservative aggregation: Math.max(min, (min + mean) / 2) to ensure
 *   a query face must match the student consistently and cannot trigger a false
 *   acceptance from one noisy/outlier sample.
 */
export function evaluateProfileDistance(descriptor, profile) {
  if (!isValidDescriptor(descriptor) || !profile?.descriptors?.length) {
    return {
      effectiveDistance: Infinity,
      bestSampleDistance: Infinity,
      meanSampleDistance: Infinity,
      sampleCount: 0,
    }
  }

  const validSamples = profile.descriptors.filter(isValidDescriptor)
  if (validSamples.length === 0) {
    return {
      effectiveDistance: Infinity,
      bestSampleDistance: Infinity,
      meanSampleDistance: Infinity,
      sampleCount: 0,
    }
  }

  const distances = validSamples
    .map((sample) => euclideanDistance(descriptor, sample))
    .filter(Number.isFinite)

  if (distances.length === 0) {
    return {
      effectiveDistance: Infinity,
      bestSampleDistance: Infinity,
      meanSampleDistance: Infinity,
      sampleCount: 0,
    }
  }

  const bestSampleDistance = Math.min(...distances)
  const meanSampleDistance = distances.reduce((acc, d) => acc + d, 0) / distances.length

  if (distances.length === 1) {
    return {
      effectiveDistance: bestSampleDistance,
      bestSampleDistance,
      meanSampleDistance,
      sampleCount: 1,
    }
  }

  // Multi-sample conservative aggregation:
  // A genuine match has both low min and low mean. If an unregistered face
  // happens to be close to 1 outlier sample but far from others, the mean
  // pulls the effective distance upward, preventing an accidental false positive.
  const effectiveDistance = Math.max(bestSampleDistance, (bestSampleDistance + meanSampleDistance) / 2)

  return {
    effectiveDistance: Number.isFinite(effectiveDistance) ? effectiveDistance : Infinity,
    bestSampleDistance,
    meanSampleDistance,
    sampleCount: distances.length,
  }
}

/**
 * Backward-compatible helper returning the effective scalar distance to a profile.
 */
export function bestDistanceToProfile(descriptor, profile) {
  return evaluateProfileDistance(descriptor, profile).effectiveDistance
}

/**
 * Returns the absolute minimum distance among valid samples in a FaceProfile.
 */
export function minDistanceToProfile(descriptor, profile) {
  return evaluateProfileDistance(descriptor, profile).bestSampleDistance
}

/**
 * Evaluates candidate matching against an authorized roster.
 *
 * Implements strict decision criteria:
 * 1. Finds best and second-best candidates.
 * 2. Requires bestDistance <= threshold.
 * 3. When candidates >= 2, requires (secondBestDistance - bestDistance) >= marginThreshold.
 *
 * Returns structured diagnostic telemetry without exposing raw descriptors.
 */
export function evaluateFaceMatch(descriptor, profiles, options = {}) {
  const threshold = typeof options.threshold === 'number' ? options.threshold : FACE_MATCH_THRESHOLD
  const marginThreshold = typeof options.marginThreshold === 'number' ? options.marginThreshold : FACE_MARGIN_THRESHOLD

  if (!isValidDescriptor(descriptor)) {
    return {
      isMatch: false,
      bestCandidate: null,
      secondCandidate: null,
      bestDistance: null,
      secondBestDistance: null,
      margin: null,
      candidatesCount: 0,
      decision: 'UNKNOWN',
      reason: 'INVALID_DESCRIPTOR',
    }
  }

  const evaluated = []
  for (const profile of profiles || []) {
    const stats = evaluateProfileDistance(descriptor, profile)
    if (Number.isFinite(stats.effectiveDistance)) {
      evaluated.push({
        profile,
        distance: stats.effectiveDistance,
        bestSampleDistance: stats.bestSampleDistance,
        meanSampleDistance: stats.meanSampleDistance,
        sampleCount: stats.sampleCount,
      })
    }
  }

  if (evaluated.length === 0) {
    return {
      isMatch: false,
      bestCandidate: null,
      secondCandidate: null,
      bestDistance: null,
      secondBestDistance: null,
      margin: null,
      candidatesCount: 0,
      decision: 'UNKNOWN',
      reason: 'NO_VALID_CANDIDATES',
    }
  }

  // Sort candidates ascending by distance
  evaluated.sort((a, b) => a.distance - b.distance)

  const bestCandidate = evaluated[0]
  const secondCandidate = evaluated.length > 1 ? evaluated[1] : null

  const bestDistance = Number(bestCandidate.distance.toFixed(4))
  const secondBestDistance = secondCandidate ? Number(secondCandidate.distance.toFixed(4)) : null
  const margin = secondCandidate ? Number((secondBestDistance - bestDistance).toFixed(4)) : null

  // Condition 1: Distance must be strictly within threshold
  if (bestDistance > threshold) {
    return {
      isMatch: false,
      bestCandidate,
      secondCandidate,
      bestDistance,
      secondBestDistance,
      margin,
      candidatesCount: evaluated.length,
      decision: 'UNKNOWN',
      reason: 'DISTANCE_TOO_HIGH',
    }
  }

  // Condition 2: Ambiguity margin check when 2+ candidates exist
  if (secondCandidate && margin < marginThreshold) {
    return {
      isMatch: false,
      bestCandidate,
      secondCandidate,
      bestDistance,
      secondBestDistance,
      margin,
      candidatesCount: evaluated.length,
      decision: 'UNKNOWN',
      reason: 'AMBIGUOUS_MARGIN',
    }
  }

  // Both conditions satisfied
  return {
    isMatch: true,
    bestCandidate,
    secondCandidate,
    bestDistance,
    secondBestDistance,
    margin,
    candidatesCount: evaluated.length,
    decision: 'MATCH',
    reason: 'CONFIRMED',
  }
}

/**
 * 0–1 "confidence" normalized against the match threshold itself, so a
 * distance right at the threshold reads as confidence 0 and a
 * near-perfect match (distance ≈ 0) reads as confidence ≈ 1.
 */
export function distanceToConfidence(distance, threshold = FACE_MATCH_THRESHOLD) {
  if (!Number.isFinite(distance) || distance > threshold) {
    return 0
  }
  return Math.max(0, Math.min(1, 1 - distance / threshold))
}

