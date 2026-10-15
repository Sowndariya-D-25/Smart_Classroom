import * as faceapi from 'face-api.js'

// Model weight files are expected at /models (i.e.
// client/public/models/*) — see docs/COMPUTER_VISION.md for the exact
// file list and where they came from. Vite serves everything under
// public/ from the site root, so this path works in both dev and build.
const MODEL_URL = '/models'

let loadPromise = null

/**
 * Loads the three face-api.js models this app needs, exactly once
 * (subsequent calls reuse the same in-flight/completed promise):
 *   - tiny_face_detector: fast face *detection* (where is a face?)
 *   - face_landmark_68:   68-point landmarks, used to align the face
 *                         before generating a descriptor
 *   - face_recognition:   128-length descriptor generation, used for
 *                         both registration and matching
 *
 * Throws if any model fails to load — callers must catch this and show
 * a clear error (see FaceCamera.jsx) rather than silently continuing
 * with a half-initialized detector.
 */
export function loadFaceApiModels() {
  if (!loadPromise) {
    loadPromise = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]).catch((err) => {
      loadPromise = null // allow retrying on next call rather than caching a permanent failure
      throw err
    })
  }
  return loadPromise
}

export function getDetectorOptions(options = {}) {
  // Tuned for a webcam-distance face in a typical classroom laptop
  // camera — inputSize must be one of face-api.js's supported buckets
  // (128/160/224/320/416/512/608). Default scoreThreshold tuned to 0.60
  // to reject weak background noise while maintaining high sensitivity.
  const inputSize = options.inputSize || 320
  const scoreThreshold = typeof options.scoreThreshold === 'number' ? options.scoreThreshold : 0.60
  return new faceapi.TinyFaceDetectorOptions({ inputSize, scoreThreshold })
}


export { faceapi }
