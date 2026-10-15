import asyncHandler from '../../utils/asyncHandler.js'
import teacherCanAccessStudent from '../../utils/teacherAccess.js'
import { FaceProfile, Student, Notification } from '../../models/index.js'

// POST /api/teacher/face-profiles
// Body: { student, descriptors: [[...128 floats], ...] }
//
// Reuses the existing FaceProfile model unchanged (see models/FaceProfile.js
// — it already supports exactly this shape). Updates the student's
// existing profile in place rather than creating a second one, which is
// what keeps "one FaceProfile per student" true after re-registration.
export const registerFace = asyncHandler(async (req, res) => {
  const { student: studentId, descriptors } = req.body

  const student = await Student.findById(studentId)
  if (!student) {
    res.status(404)
    throw new Error('Student not found')
  }

  // Ownership: a teacher may only register a face for a student they
  // actually teach (via a shared Subject → course relationship) — never
  // an arbitrary studentId typed into a request.
  const hasAccess = await teacherCanAccessStudent(req.teacher._id, student)
  if (!hasAccess) {
    res.status(403)
    throw new Error("You do not have access to register this student's face")
  }

  let profile = await FaceProfile.findOne({ student: studentId })
  const isNew = !profile

  if (profile) {
    profile.descriptors = descriptors
    // sampleCount/lastUpdated are recomputed by the model's own
    // pre('save') hook — not touched here.
    await profile.save()
  } else {
    profile = await FaceProfile.create({ student: studentId, descriptors })
  }

  if (!student.faceProfile) {
    student.faceProfile = profile._id
    await student.save()
  }

  // Create face registration completed notification for the teacher
  try {
    const studentUser = await student.populate('user', 'name')
    const studentName = studentUser.user?.name || student.studentId
    const registerNo = student.rollNumber || student.studentId
    await Notification.create({
      recipient: req.user._id,
      title: '✓ Face Registration Completed',
      message: `Student: ${studentName}\nRegister No: ${registerNo}\n\nFace successfully registered.`,
      type: 'STUDENT_REGISTRATION',
      link: '/teacher/classes',
      metadata: {
        studentId: student._id,
        sampleCount: profile.sampleCount,
      },
    })
  } catch (err) {
    console.error('Failed to create face registration notification:', err.message)
  }

  res.status(isNew ? 201 : 200).json({
    success: true,
    message: isNew ? 'Face registered successfully' : 'Face registration updated successfully',
    data: { sampleCount: profile.sampleCount, lastUpdated: profile.lastUpdated },
  })
})

// GET /api/teacher/face-profiles/status/:studentId
// Returns only whether/how a face is registered — never the descriptor
// itself. Face descriptors are biometric-related data and are never
// returned to the browser once stored (see docs/COMPUTER_VISION.md).
export const getFaceStatus = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.studentId)
  if (!student) {
    res.status(404)
    throw new Error('Student not found')
  }

  const hasAccess = await teacherCanAccessStudent(req.teacher._id, student)
  if (!hasAccess) {
    res.status(403)
    throw new Error('You do not have access to this student')
  }

  const profile = await FaceProfile.findOne({ student: student._id }).select('sampleCount lastUpdated isActive')

  res.json({
    success: true,
    data: {
      registered: Boolean(profile?.isActive && profile.sampleCount > 0),
      sampleCount: profile?.sampleCount || 0,
      lastUpdated: profile?.lastUpdated || null,
    },
  })
})
