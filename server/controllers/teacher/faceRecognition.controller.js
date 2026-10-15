import asyncHandler from '../../utils/asyncHandler.js'
import { FaceProfile, Attendance, AttendanceSession } from '../../models/index.js'
import {
  FACE_MATCH_THRESHOLD,
  FACE_MARGIN_THRESHOLD,
  evaluateFaceMatch,
  distanceToConfidence,
  isValidDescriptor,
} from '../../utils/faceDistance.js'
import { loadOwnedSession, getRoster } from './attendance.controller.js'

// POST /api/teacher/attendance/sessions/:id/recognize
// Body: { descriptor: [...128 floats], commit?: boolean }
// Exactly ONE face's descriptor is accepted.
// If commit === false: verifies candidate identity without writing Attendance (used for temporal confirmation frame 1).
// If commit === true (or omitted): commits Attendance to DB upon successful match (used for temporal confirmation frame 2).
export const recognizeFace = asyncHandler(async (req, res) => {
  const { descriptor, commit } = req.body
  const shouldCommit = commit !== false

  // Strict descriptor validation: must be exactly 128 finite numeric values
  if (!isValidDescriptor(descriptor)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid face descriptor. Expected an array of exactly 128 finite numbers.',
      data: {
        matched: false,
        reason: 'INVALID_DESCRIPTOR',
      },
    })
  }

  const session = await loadOwnedSession(req.params.id, req.teacher._id)
  if (!session) {
    res.status(404)
    throw new Error('Attendance session not found')
  }
  if (session.status === 'Completed' || session.status === 'Cancelled') {
    res.status(400)
    throw new Error(`Cannot recognize faces — this session is already ${session.status.toLowerCase()}`)
  }

  const roster = await getRoster(session.subject.course?._id, {
    department: session.department,
    section: session.section,
  })
  const rosterIds = roster.map((s) => s._id)

  // SECURITY: only loads FaceProfiles for students on THIS session's roster —
  // never the whole collection, and never students outside this class.
  const profiles = await FaceProfile.find({
    student: { $in: rosterIds },
    isActive: true,
    'descriptors.0': { $exists: true },
  })

  // Evaluate candidate matching with strict distance threshold AND margin requirement
  const evalResult = evaluateFaceMatch(descriptor, profiles, {
    threshold: FACE_MATCH_THRESHOLD,
    marginThreshold: FACE_MARGIN_THRESHOLD,
  })

  // Safe development telemetry logging (no raw descriptors)
  const bestStudent = evalResult.bestCandidate?.profile?.student
    ? roster.find((s) => s._id.equals(evalResult.bestCandidate.profile.student))
    : null
  const secondStudent = evalResult.secondCandidate?.profile?.student
    ? roster.find((s) => s._id.equals(evalResult.secondCandidate.profile.student))
    : null

  const bestLabel = bestStudent
    ? `${bestStudent.studentId} (${bestStudent.user?.name || 'Unknown'})`
    : 'None'
  const secondLabel = secondStudent
    ? `${secondStudent.studentId} (${secondStudent.user?.name || 'Unknown'})`
    : 'None'

  console.log(
    `[Face Recognition] Session: ${session._id} | Candidates: ${profiles.length} | ` +
    `Best: ${bestLabel} (${evalResult.bestDistance ?? 'N/A'}) | ` +
    `2nd: ${secondLabel} (${evalResult.secondBestDistance ?? 'N/A'}) | ` +
    `Margin: ${evalResult.margin ?? 'N/A'} (min req: ${FACE_MARGIN_THRESHOLD.toFixed(2)}) | ` +
    `Thresh: ${FACE_MATCH_THRESHOLD.toFixed(2)} | ` +
    `Decision: ${evalResult.decision} (${evalResult.reason}) | Commit: ${shouldCommit}`
  )

  const MAX_UNKNOWN_FACES = Number(process.env.MAX_UNKNOWN_FACES) || 50

  const recordUnknownFace = async (confidenceVal) => {
    if (!shouldCommit) return
    const conf = Number.isFinite(confidenceVal)
      ? Math.max(0, Math.min(1, Number(confidenceVal)))
      : 0

    session.unknownFaces.push({
      count: 1,
      confidence: conf,
      detectedAt: new Date(),
    })

    if (session.unknownFaces.length > MAX_UNKNOWN_FACES) {
      session.unknownFaces = session.unknownFaces.slice(-MAX_UNKNOWN_FACES)
    }

    await session.save()
  }

  if (!evalResult.isMatch || !Number.isFinite(evalResult.bestDistance)) {
    if (shouldCommit) {
      try {
        await recordUnknownFace(
          Number.isFinite(evalResult.bestDistance)
            ? distanceToConfidence(evalResult.bestDistance, FACE_MATCH_THRESHOLD)
            : 0
        )
      } catch (saveErr) {
        console.error('[Face Recognition] Failed to record unknown face in session:', saveErr)
        return res.status(500).json({
          success: false,
          message: 'Failed to record unknown face in attendance session',
        })
      }
    }

    return res.json({
      success: true,
      message: evalResult.reason === 'AMBIGUOUS_MARGIN'
        ? 'Ambiguous face detection. Closest candidates are too similar to reliably differentiate.'
        : 'Unknown / Unregistered Face. Not registered in this class.',
      data: {
        matched: false,
        alreadyMarked: false,
        student: null,
        confidence: 0,
        distance: evalResult.bestDistance,
        secondDistance: evalResult.secondBestDistance,
        margin: evalResult.margin,
        candidatesCount: evalResult.candidatesCount,
        decision: evalResult.decision,
        reason: evalResult.reason,
        threshold: FACE_MATCH_THRESHOLD,
        marginThreshold: FACE_MARGIN_THRESHOLD,
      },
    })
  }

  const student = roster.find((s) => s._id.equals(evalResult.bestCandidate.profile.student))
  if (!student) {
    if (shouldCommit) {
      try {
        await recordUnknownFace(
          Number.isFinite(evalResult.bestDistance)
            ? distanceToConfidence(evalResult.bestDistance, FACE_MATCH_THRESHOLD)
            : 0
        )
      } catch (saveErr) {
        console.error('[Face Recognition] Failed to record unknown face in session:', saveErr)
        return res.status(500).json({
          success: false,
          message: 'Failed to record unknown face in attendance session',
        })
      }
    }

    return res.json({
      success: true,
      message: 'Candidate outside session roster.',
      data: {
        matched: false,
        alreadyMarked: false,
        student: null,
        confidence: 0,
        distance: evalResult.bestDistance,
        secondDistance: evalResult.secondBestDistance,
        margin: evalResult.margin,
        candidatesCount: evalResult.candidatesCount,
        decision: 'UNKNOWN',
        reason: 'NOT_IN_ROSTER',
        threshold: FACE_MATCH_THRESHOLD,
        marginThreshold: FACE_MARGIN_THRESHOLD,
      },
    })
  }

  const confidence = Number(distanceToConfidence(evalResult.bestDistance, FACE_MATCH_THRESHOLD).toFixed(2))

  const existing = await Attendance.findOne({ student: student._id, session: session._id })
  if (existing) {
    return res.json({
      success: true,
      message: 'Attendance already marked for this student.',
      data: {
        matched: true,
        alreadyMarked: true,
        student: {
          _id: student._id,
          name: student.user?.name,
          studentId: student.studentId,
          rollNumber: student.rollNumber,
          department: student.department,
          section: student.section,
        },
        distance: evalResult.bestDistance,
        secondDistance: evalResult.secondBestDistance,
        margin: evalResult.margin,
        candidatesCount: evalResult.candidatesCount,
        confidence,
        decision: 'MATCH',
        reason: 'ALREADY_MARKED',
        threshold: FACE_MATCH_THRESHOLD,
        marginThreshold: FACE_MARGIN_THRESHOLD,
      },
    })
  }

  // Temporal confirmation step 1: verification only, do not insert Attendance yet
  if (!shouldCommit) {
    return res.json({
      success: true,
      message: 'Face verified. Awaiting temporal confirmation.',
      data: {
        matched: true,
        verified: true,
        alreadyMarked: false,
        student: {
          _id: student._id,
          name: student.user?.name,
          studentId: student.studentId,
          rollNumber: student.rollNumber,
          department: student.department,
          section: student.section,
        },
        distance: evalResult.bestDistance,
        secondDistance: evalResult.secondBestDistance,
        margin: evalResult.margin,
        candidatesCount: evalResult.candidatesCount,
        confidence,
        decision: 'MATCH',
        reason: 'TEMPORAL_PENDING',
        threshold: FACE_MATCH_THRESHOLD,
        marginThreshold: FACE_MARGIN_THRESHOLD,
      },
    })
  }

  // Temporal confirmation step 2: Commit attendance atomically with duplicate key handling
  let attendance
  let isDuplicate = false
  try {
    attendance = await Attendance.create({
      student: student._id,
      subject: session.subject._id,
      teacher: req.teacher._id,
      classroom: session.classroom?._id || session.classroom || null,
      department: session.department || student.department,
      section: session.section || student.section,
      session: session._id,
      date: session.date,
      period: session.period,
      status: 'Present',
      method: 'Face Recognition',
      confidence,
      markedBy: req.user._id,
    })
  } catch (err) {
    if (err.code === 11000) {
      attendance = await Attendance.findOne({ student: student._id, session: session._id })
      isDuplicate = true
    } else {
      throw err
    }
  }

  // Atomically add to detectedStudents on session
  await AttendanceSession.findByIdAndUpdate(session._id, {
    $addToSet: { detectedStudents: student._id },
  }).catch(() => {})

  if (isDuplicate) {
    return res.status(200).json({
      success: true,
      message: 'Attendance already marked for this student.',
      data: {
        matched: true,
        alreadyMarked: true,
        student: {
          _id: student._id,
          name: student.user?.name,
          studentId: student.studentId,
          rollNumber: student.rollNumber,
          department: student.department,
          section: student.section,
        },
        confidence,
        decision: 'MATCH',
        reason: 'ALREADY_MARKED',
        threshold: FACE_MATCH_THRESHOLD,
        marginThreshold: FACE_MARGIN_THRESHOLD,
      },
    })
  }

  res.status(201).json({
    success: true,
    message: 'Attendance marked successfully.',
    data: {
      matched: true,
      alreadyMarked: false,
      student: {
        _id: student._id,
        name: student.user?.name,
        studentId: student.studentId,
        rollNumber: student.rollNumber,
        department: student.department,
        section: student.section,
      },
      distance: evalResult.bestDistance,
      secondDistance: evalResult.secondBestDistance,
      margin: evalResult.margin,
      candidatesCount: evalResult.candidatesCount,
      confidence,
      attendance,
      decision: 'MATCH',
      reason: 'CONFIRMED',
      threshold: FACE_MATCH_THRESHOLD,
      marginThreshold: FACE_MARGIN_THRESHOLD,
    },
  })
})


