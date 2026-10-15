import { useEffect, useRef, useState } from 'react'
import { VideoOff } from 'lucide-react'
import { loadFaceApiModels, getDetectorOptions, faceapi } from '../../utils/faceApiModels'

/**
 * Reusable webcam + face-api.js detection loop with real-time canvas overlays.
 *
 * Provides:
 * - Real-time camera feed
 * - High-precision canvas overlay with face bounding boxes, landmarks & name badges
 * - Clean start / stop camera handling
 * - Single face & multi-face detection reporting
 */
export default function FaceCamera({
  onStatusChange,
  onFaceDetected,
  intervalMs = 600,
  active = true,
  overlayInfo = null, // { status: 'success'|'already-marked'|'unknown'|'verifying', student: { name, studentId }, confidence }
  minFaceWidth = 80,
  minFaceHeight = 80,
}) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const intervalRef = useRef(null)
  const [ready, setReady] = useState(false)
  const overlayInfoRef = useRef(overlayInfo)

  useEffect(() => {
    overlayInfoRef.current = overlayInfo
  }, [overlayInfo])

  const report = (status) => onStatusChange?.(status)

  // Start or stop webcam stream based on `active` prop
  useEffect(() => {
    if (!active) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
      setReady(false)
      report('camera-stopped')
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d')
        ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      }
      return undefined
    }

    let cancelled = false

    async function start() {
      report('loading-models')
      try {
        await loadFaceApiModels()
      } catch {
        if (!cancelled) report('models-error')
        return
      }
      if (cancelled) return

      report('requesting-camera')
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        setReady(true)
      } catch {
        if (!cancelled) report('camera-error')
      }
    }

    start()

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [active]) // eslint-disable-line react-hooks/exhaustive-deps

  // Detection loop
  useEffect(() => {
    if (!ready || !active) return undefined

    intervalRef.current = setInterval(async () => {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || video.readyState < 2 || video.videoWidth === 0 || !canvas) return

      let detections
      try {
        detections = await faceapi
          .detectAllFaces(video, getDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptors()
      } catch (err) {
        console.error('Face detection error:', err)
        report('error')
        return
      }

      // Match canvas dimensions to video
      const displaySize = { width: video.clientWidth || 480, height: video.clientHeight || 360 }
      faceapi.matchDimensions(canvas, displaySize)
      const resizedDetections = faceapi.resizeResults(detections, displaySize)

      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, displaySize.width, displaySize.height)

      if (detections.length === 0) {
        report('no-face')
      } else if (detections.length > 1) {
        report('multiple-faces')

        // Draw bounding boxes for multiple faces
        resizedDetections.forEach((d) => {
          const { x, y, width, height } = d.detection.box
          ctx.strokeStyle = '#f59e0b'
          ctx.lineWidth = 2.5
          ctx.strokeRect(x, y, width, height)

          ctx.fillStyle = 'rgba(245, 158, 11, 0.85)'
          ctx.fillRect(x, Math.max(0, y - 24), Math.min(width, 180), 24)
          ctx.fillStyle = '#ffffff'
          ctx.font = '600 11px system-ui, sans-serif'
          ctx.fillText('Multiple Faces Detected', x + 6, Math.max(16, y - 8))
        })
      } else {
        const single = detections[0]
        const { width: boxW, height: boxH } = single.detection.box

        // Face quality filter: reject small or distant faces that cannot yield reliable embeddings
        if (boxW < minFaceWidth || boxH < minFaceHeight) {
          report('poor-quality')

          if (resizedDetections.length > 0) {
            const d = resizedDetections[0]
            const { x, y, width, height } = d.detection.box

            ctx.strokeStyle = '#f59e0b'
            ctx.lineWidth = 2
            ctx.setLineDash([6, 6])
            ctx.strokeRect(x, y, width, height)
            ctx.setLineDash([])

            ctx.fillStyle = 'rgba(245, 158, 11, 0.9)'
            ctx.beginPath()
            ctx.roundRect(x, Math.max(0, y - 26), Math.min(Math.max(width, 150), 220), 24, 4)
            ctx.fill()

            ctx.fillStyle = '#ffffff'
            ctx.font = 'bold 11px system-ui, sans-serif'
            ctx.fillText('Move closer to camera', x + 6, Math.max(16, y - 10))
          }
          return
        }

        report('detected')
        onFaceDetected?.(Array.from(single.descriptor), {
          box: single.detection.box,
          score: single.detection.score,
        })

        // Draw bounding box and label for detected face
        if (resizedDetections.length > 0) {
          const d = resizedDetections[0]
          const { x, y, width, height } = d.detection.box
          const currentOverlay = overlayInfoRef.current

          let strokeColor = '#3b82f6'
          let bgColor = 'rgba(59, 130, 246, 0.9)'
          let labelText = 'Scanning face…'
          let subText = ''

          if (currentOverlay?.status === 'success') {
            strokeColor = '#10b981' // emerald green
            bgColor = 'rgba(16, 185, 129, 0.95)'
            labelText = `✓ ${currentOverlay.student?.name || 'Recognized'}`
            subText = `${currentOverlay.student?.studentId || ''} · PRESENT`
          } else if (currentOverlay?.status === 'verifying') {
            strokeColor = '#eab308' // amber/yellow
            bgColor = 'rgba(234, 179, 8, 0.95)'
            labelText = `⏳ Verifying: ${currentOverlay.student?.name || 'Student'}…`
            subText = 'HOLD STEADY (1/2)'
          } else if (currentOverlay?.status === 'already-marked') {
            strokeColor = '#06b6d4' // cyan
            bgColor = 'rgba(6, 182, 212, 0.95)'
            labelText = `${currentOverlay.student?.name || 'Student'}`
            subText = `${currentOverlay.student?.studentId || ''} · ALREADY MARKED`
          } else if (currentOverlay?.status === 'unknown') {
            strokeColor = '#ef4444' // red
            bgColor = 'rgba(239, 68, 68, 0.95)'
            labelText = 'Unknown Face'
            subText = 'NOT REGISTERED'
          }


          // Draw main box
          ctx.strokeStyle = strokeColor
          ctx.lineWidth = 3
          ctx.strokeRect(x, y, width, height)

          // Corner accents
          const cornerLength = Math.min(width, height) * 0.2
          ctx.lineWidth = 5
          // Top-left
          ctx.beginPath()
          ctx.moveTo(x, y + cornerLength)
          ctx.lineTo(x, y)
          ctx.lineTo(x + cornerLength, y)
          ctx.stroke()
          // Top-right
          ctx.beginPath()
          ctx.moveTo(x + width - cornerLength, y)
          ctx.lineTo(x + width, y)
          ctx.lineTo(x + width, y + cornerLength)
          ctx.stroke()
          // Bottom-left
          ctx.beginPath()
          ctx.moveTo(x, y + height - cornerLength)
          ctx.lineTo(x, y + height)
          ctx.lineTo(x + cornerLength, y + height)
          ctx.stroke()
          // Bottom-right
          ctx.beginPath()
          ctx.moveTo(x + width - cornerLength, y + height)
          ctx.lineTo(x + width, y + height)
          ctx.lineTo(x + width, y + height - cornerLength)
          ctx.stroke()

          // Draw text label badge
          const badgeWidth = Math.max(width, 160)
          const badgeHeight = subText ? 36 : 24
          const badgeY = Math.max(0, y - badgeHeight - 4)

          ctx.fillStyle = bgColor
          ctx.beginPath()
          ctx.roundRect(x, badgeY, badgeWidth, badgeHeight, 4)
          ctx.fill()

          ctx.fillStyle = '#ffffff'
          ctx.font = 'bold 12px system-ui, sans-serif'
          ctx.fillText(labelText, x + 8, badgeY + 16)

          if (subText) {
            ctx.font = '500 10px system-ui, sans-serif'
            ctx.fillText(subText, x + 8, badgeY + 30)
          }
        }
      }
    }, intervalMs)

    return () => {
      clearInterval(intervalRef.current)
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d')
        ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      }
    }
  }, [ready, active, intervalMs]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative aspect-[4/3] w-full max-w-lg overflow-hidden rounded-2xl border-2 border-pine-900/20 bg-pine-950 shadow-card mx-auto">
      <video
        ref={videoRef}
        muted
        playsInline
        className={`h-full w-full object-cover transition-opacity duration-300 ${ready && active ? 'opacity-100' : 'opacity-0'}`}
      />
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />

      {/* Inactive / Camera Off Placeholder */}
      {(!active || !ready) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/95 p-4 text-center backdrop-blur-xs">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-ivory text-pine-600 shadow-sm border border-pine-900/10">
            <VideoOff size={30} />
          </div>
          <p className="mt-3 text-sm font-bold text-pine-950">
            {!active ? 'Camera Stopped' : 'Starting Camera…'}
          </p>
          <p className="mt-1 max-w-xs text-xs text-pine-700/80">
            {!active
              ? 'Click "Start Camera" above to activate the live face recognition feed.'
              : 'Waiting for camera permissions and neural network models…'}
          </p>
        </div>
      )}

      {/* Live Badge */}
      {ready && active && (
        <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-pine-950/70 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-md border border-white/20">
          <span className="h-2 w-2 animate-ping rounded-full bg-emerald-400" />
          <span>LIVE CAMERA FEED</span>
        </div>
      )}
    </div>
  )
}
