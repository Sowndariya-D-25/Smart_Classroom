import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  Camera,
  RotateCcw,
  Save,
  LoaderCircle,
  UserPlus,
  Users,
  Search,
  CheckCircle2,
  ScanFace,
  GraduationCap,
  Calendar,
} from 'lucide-react'
import PageContainer from '../../components/layout/PageContainer'
import SectionHeader from '../../components/common/SectionHeader'
import StatusBadge from '../../components/common/StatusBadge'
import FormField, { inputClass } from '../../components/FormField'
import FaceCamera from '../../components/vision/FaceCamera'
import FaceRecognitionStatus from '../../components/vision/FaceRecognitionStatus'
import { useToast } from '../../context/ToastContext'
import { normalizeDepartment } from '../../utils/department'
import {
  getTeacherStudents,
  getCourses,
  getReportFilterOptions,
  registerStudentWithFace,
  registerFace,
} from '../../services/teacherService'

const SAMPLES_RECOMMENDED = 3
const SAMPLES_MAX = 5

function calcDescriptorDistance(a, b) {
  if (!a || !b || a.length !== b.length) return Infinity
  let sum = 0
  for (let i = 0; i < a.length; i += 1) {
    const diff = a[i] - b[i]
    sum += diff * diff
  }
  return Math.sqrt(sum)
}

export default function FaceRegistration() {
  const [searchParams] = useSearchParams()
  const initialStudentId = searchParams.get('studentId') || ''
  const toast = useToast()
  const navigate = useNavigate()

  // Mode: 'new' (register new student + face) or 'existing' (select student & register face)
  const [activeTab, setActiveTab] = useState(initialStudentId ? 'existing' : 'new')

  // Shared metadata options
  const [courses, setCourses] = useState([])
  const [filterData, setFilterData] = useState(null)
  const [studentsList, setStudentsList] = useState([])
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Camera state
  const [cameraActive, setCameraActive] = useState(true)
  const [cameraStatus, setCameraStatus] = useState('loading-models')
  const latestDescriptor = useRef(null)
  const latestDetection = useRef(null)
  const [samples, setSamples] = useState([])
  const [saving, setSaving] = useState(false)

  // New Student Form State
  const [newStudent, setNewStudent] = useState({
    name: '',
    studentId: '',
    department: '',
    section: '',
    course: '',
    email: '',
    phone: '',
    gender: 'Other',
    year: '1',
    password: '',
  })

  // Selected Existing Student State
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [existingFilters, setExistingFilters] = useState({
    department: 'CSE',
    year: '',
    section: '',
  })

  // Load teacher's courses and filter options
  useEffect(() => {
    Promise.all([getCourses(), getReportFilterOptions()])
      .then(([coursesData, filterOpts]) => {
        const rawItems = coursesData?.items || []
        const uniqueCourses = [...new Map(rawItems.map((c) => [c._id.toString(), c])).values()]
        setCourses(uniqueCourses)
        if (filterOpts) setFilterData(filterOpts)

        const defaultCourse = uniqueCourses[0]
        const defaultDept = normalizeDepartment(
          defaultCourse?.department || defaultCourse?.code || filterOpts?.departments?.[0] || 'CSE',
          'CSE'
        )
        const defaultSec = filterOpts?.sections?.[0] || 'A'

        setNewStudent((s) => ({
          ...s,
          course: s.course || defaultCourse?._id || '',
          department: s.department ? normalizeDepartment(s.department, 'CSE') : defaultDept,
          section: s.section || defaultSec,
        }))
      })
      .catch(() => {})
  }, [])

  // Dynamic departments from database
  const availableDepartments = useMemo(() => {
    const list = new Set()
    courses.forEach((c) => {
      const d1 = normalizeDepartment(c.department, '')
      if (d1) list.add(d1)
    })
    if (filterData?.departments) {
      filterData.departments.forEach((d) => {
        const d2 = normalizeDepartment(d, '')
        if (d2) list.add(d2)
      })
    }
    return Array.from(list).filter(Boolean).sort()
  }, [courses, filterData])

  // Dynamic sections from database
  const availableSections = useMemo(() => {
    if (filterData?.students?.length && newStudent.department) {
      const normDept = normalizeDepartment(newStudent.department, '')
      const matched = filterData.students.filter(
        (s) => normalizeDepartment(s.department, '') === normDept
      )
      const secList = Array.from(new Set(matched.map((s) => s.section).filter(Boolean))).sort()
      if (secList.length > 0) return secList
    }
    if (filterData?.sections?.length) {
      return filterData.sections
    }
    return ['A', 'B', 'C']
  }, [filterData, newStudent.department])

  const handleCourseChange = (courseId) => {
    const found = courses.find((c) => c._id === courseId)
    setNewStudent((prev) => ({
      ...prev,
      course: courseId,
      department: normalizeDepartment(found?.department || found?.code, '') || prev.department,
    }))
  }

  const handleDepartmentChange = (dept) => {
    const norm = normalizeDepartment(dept, '')
    setNewStudent((prev) => {
      const matchingCourse = courses.find(
        (c) => normalizeDepartment(c.department, '') === norm || normalizeDepartment(c.code, '') === norm
      )
      return {
        ...prev,
        department: norm,
        course: matchingCourse?._id || prev.course,
      }
    })
  }

  // Load student list
  const loadStudents = () => {
    setLoadingStudents(true)
    getTeacherStudents({
      search: searchQuery,
      department: existingFilters.department,
      year: existingFilters.year,
      section: existingFilters.section,
    })
      .then((data) => {
        setStudentsList(data.items || [])
        if (initialStudentId && !selectedStudent) {
          const found = data.items?.find((s) => s._id === initialStudentId || s.studentId === initialStudentId)
          if (found) {
            setSelectedStudent(found)
            setActiveTab('existing')
          }
        }
      })
      .catch((err) => toast.error(err.response?.data?.message || 'Could not load student list.'))
      .finally(() => setLoadingStudents(false))
  }

  useEffect(() => {
    loadStudents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, existingFilters.department, existingFilters.year, existingFilters.section])

  const handleFaceDetected = (descriptor, detectionMeta) => {
    latestDescriptor.current = descriptor
    latestDetection.current = detectionMeta
  }

  const handleCaptureSample = () => {
    if (cameraStatus !== 'detected' || !latestDescriptor.current) {
      toast.warning('Please align face in camera until detected before capturing.')
      return
    }
    if (samples.length >= SAMPLES_MAX) return

    const captured = latestDescriptor.current
    const meta = latestDetection.current

    // Validate descriptor is exactly 128 finite numbers
    if (
      !Array.isArray(captured) ||
      captured.length !== 128 ||
      !captured.every((n) => typeof n === 'number' && Number.isFinite(n))
    ) {
      toast.error('Invalid face embedding vector. Please wait for camera to stabilize.')
      return
    }

    // Require detector confidence >= 0.70 for registration quality
    if (typeof meta?.score === 'number' && meta.score < 0.70) {
      toast.warning(`Face confidence too low (${Math.round(meta.score * 100)}% < 70%). Please look directly at camera with clear lighting.`)
      return
    }

    // Require face bounding box >= 100x100 for sufficient enrollment detail
    const box = meta?.box
    if (box && (box.width < 100 || box.height < 100)) {
      toast.warning('Face is too small (need at least 100x100 px). Please move closer to the camera.')
      return
    }

    // Guard against rapid duplicate clicks capturing identical frames
    if (samples.some((existing) => calcDescriptorDistance(existing, captured) < 0.05)) {
      toast.warning('Please turn head slightly (different angle/expression) for the next sample.')
      return
    }

    setSamples((s) => [...s, captured])
    // Consume descriptor so a fresh live camera detection frame is required for next capture
    latestDescriptor.current = null
    latestDetection.current = null
    toast.success(`Face sample #${samples.length + 1} captured!`)
  }

  const handleResetSamples = () => {
    latestDescriptor.current = null
    latestDetection.current = null
    setSamples([])
    toast.info('Captured samples reset.')
  }


  // Handle Register New Student + Face
  const handleSaveNewStudent = async (e) => {
    e.preventDefault()
    if (!newStudent.name.trim()) {
      toast.error('Student Full Name is required.')
      return
    }
    if (!newStudent.studentId.trim()) {
      toast.error('Register Number / Student ID is required.')
      return
    }
    if (!newStudent.department) {
      toast.error('Department is required.')
      return
    }
    if (!newStudent.section) {
      toast.error('Section is required.')
      return
    }
    if (!newStudent.course) {
      toast.error('Academic Course is required.')
      return
    }
    if (!newStudent.email.trim()) {
      toast.error('Email is required.')
      return
    }
    if (!newStudent.phone.trim()) {
      toast.error('Mobile Number is required.')
      return
    }
    if (samples.length === 0) {
      toast.error('Please capture at least 1 face sample before registering.')
      return
    }

    setSaving(true)
    try {
      const payload = {
        name: newStudent.name.trim(),
        studentId: newStudent.studentId.trim(),
        department: newStudent.department.trim(),
        section: newStudent.section.trim(),
        course: newStudent.course,
        email: newStudent.email.trim(),
        phone: newStudent.phone.trim(),
        gender: newStudent.gender || 'Other',
        year: Number(newStudent.year) || 1,
        descriptors: samples,
        password: newStudent.password ? newStudent.password.trim() : undefined,
      }
      const res = await registerStudentWithFace(payload)
      toast.success(res.message || 'Student and face registered successfully!')
      // Reset form
      setNewStudent((prev) => ({
        name: '',
        studentId: '',
        department: prev.department,
        section: prev.section,
        course: prev.course,
        email: '',
        phone: '',
        gender: 'Other',
        year: '1',
        password: '',
      }))
      latestDescriptor.current = null
      setSamples([])
      loadStudents()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to register student.')
    } finally {
      setSaving(false)
    }
  }

  // Handle Update Existing Student Face
  const handleSaveExistingFace = async () => {
    if (!selectedStudent) {
      toast.error('Please select a student from the list first.')
      return
    }
    if (samples.length === 0) {
      toast.error('Please capture at least 1 face sample.')
      return
    }

    setSaving(true)
    try {
      const res = await registerFace(selectedStudent._id, samples)
      toast.success(res.message || 'Face registered successfully!')
      latestDescriptor.current = null
      setSamples([])
      loadStudents()
      setSelectedStudent((s) => ({ ...s, faceRegistered: true, sampleCount: samples.length }))
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to register face.')
    } finally {
      setSaving(false)
    }
  }

  const canCapture = cameraStatus === 'detected' && samples.length < SAMPLES_MAX && cameraActive

  return (
    <PageContainer>
      <SectionHeader
        title="Student Registration & Face Registration"
        subtitle="One-time student enrollment and computer-vision face biometric registration."
      />

      {/* Tabs */}
      <div className="flex border-b border-pine-900/10 mt-6">
        <button
          type="button"
          onClick={() => {
            setActiveTab('new')
            latestDescriptor.current = null
            setSamples([])
          }}
          className={`flex items-center gap-2 border-b-2 px-6 py-3.5 text-sm font-bold transition-all ${
            activeTab === 'new'
              ? 'border-pine-900 text-pine-950'
              : 'border-transparent text-pine-600 hover:text-pine-950'
          }`}
        >
          <UserPlus size={18} />
          Register New Student & Face
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('existing')
            latestDescriptor.current = null
            setSamples([])
          }}
          className={`flex items-center gap-2 border-b-2 px-6 py-3.5 text-sm font-bold transition-all ${
            activeTab === 'existing'
              ? 'border-pine-900 text-pine-950'
              : 'border-transparent text-pine-600 hover:text-pine-950'
          }`}
        >
          <Users size={18} />
          Existing Students & Face Status ({studentsList.length})
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-12 mt-6">
        {/* Left Column: Live Camera & Biometric Capture (Always Visible) */}
        <div className="space-y-4 lg:col-span-5">
          <div className="bg-white rounded-2xl border border-pine-900/10 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-bold text-pine-950">
                <ScanFace size={18} className="text-olive-700" />
                Live Camera Face Scanner
              </h3>
              <button
                type="button"
                onClick={() => setCameraActive(!cameraActive)}
                className="text-xs font-bold text-olive-700 hover:underline"
              >
                {cameraActive ? 'Stop Camera' : 'Start Camera'}
              </button>
            </div>

            <FaceCamera
              active={cameraActive}
              onStatusChange={setCameraStatus}
              onFaceDetected={handleFaceDetected}
            />

            <FaceRecognitionStatus status={cameraActive ? cameraStatus : 'camera-stopped'} />

            {/* Sample Progress */}
            <div className="rounded-2xl border border-pine-900/10 bg-ivory/50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-pine-950">
                  Samples Captured: {samples.length} / {SAMPLES_MAX}
                </span>
                <span className="text-[11px] font-semibold text-pine-700">
                  {samples.length >= SAMPLES_RECOMMENDED ? '✓ Ready to Save' : `Need ${SAMPLES_RECOMMENDED - samples.length} more`}
                </span>
              </div>

              <div className="mt-2.5 flex gap-1.5">
                {Array.from({ length: SAMPLES_MAX }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-2.5 flex-1 rounded-full transition-all ${
                      i < samples.length ? 'bg-olive-600' : 'bg-pine-900/10'
                    }`}
                  />
                ))}
              </div>

              <p className="mt-2 text-xs text-pine-600/80">
                Tip: Have the student face forward, then turn slightly left and right between captures.
              </p>

              <div className="mt-3.5 flex gap-2">
                <button
                  type="button"
                  onClick={handleCaptureSample}
                  disabled={!canCapture}
                  className="btn-primary flex-1 justify-center py-2.5 text-xs font-semibold shadow-sm"
                >
                  <Camera size={16} /> Capture Sample
                </button>
                <button
                  type="button"
                  onClick={handleResetSamples}
                  disabled={samples.length === 0}
                  className="btn-secondary py-2.5 text-xs font-semibold"
                >
                  <RotateCcw size={16} /> Reset
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Tab Content */}
        <div className="space-y-4 lg:col-span-7">
          {activeTab === 'new' ? (
            /* TAB 1: REGISTER NEW STUDENT */
            <form onSubmit={handleSaveNewStudent} className="bg-white rounded-2xl border border-pine-900/10 p-6 shadow-sm space-y-4">
              <div className="border-b border-pine-900/10 pb-3">
                <h3 className="text-lg font-bold text-pine-950">Student Profile & Biometrics</h3>
                <p className="text-xs text-pine-700/80 mt-0.5">
                  Register this student once. Their 128-d face embedding vector will be saved to MongoDB.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Student Full Name *" htmlFor="name">
                  <input
                    id="name"
                    name="name"
                    required
                    placeholder="e.g. Jordan Lee"
                    value={newStudent.name}
                    onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                    className={inputClass}
                  />
                </FormField>

                <FormField label="Register Number / Student ID *" htmlFor="studentId">
                  <input
                    id="studentId"
                    name="studentId"
                    required
                    placeholder="e.g. 23CS001"
                    value={newStudent.studentId}
                    onChange={(e) => setNewStudent({ ...newStudent, studentId: e.target.value })}
                    className={inputClass}
                  />
                </FormField>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <FormField label="Department *" htmlFor="department">
                  <select
                    id="department"
                    name="department"
                    required
                    value={newStudent.department}
                    onChange={(e) => handleDepartmentChange(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Select Department…</option>
                    {availableDepartments.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Academic Year *" htmlFor="year">
                  <select
                    id="year"
                    name="year"
                    required
                    value={newStudent.year}
                    onChange={(e) => setNewStudent({ ...newStudent, year: e.target.value })}
                    className={inputClass}
                  >
                    <option value="1">1st Year</option>
                    <option value="2">2nd Year</option>
                    <option value="3">3rd Year</option>
                    <option value="4">4th Year</option>
                  </select>
                </FormField>

                <FormField label="Section *" htmlFor="section">
                  <select
                    id="section"
                    name="section"
                    required
                    value={newStudent.section}
                    onChange={(e) => setNewStudent({ ...newStudent, section: e.target.value })}
                    className={inputClass}
                  >
                    <option value="">Select Section…</option>
                    {availableSections.map((sec) => (
                      <option key={sec} value={sec}>
                        Section {sec}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>

              <FormField label="Academic Course *" htmlFor="course">
                <select
                  id="course"
                  name="course"
                  required
                  value={newStudent.course}
                  onChange={(e) => handleCourseChange(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select Academic Course…</option>
                  {courses.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </FormField>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Email *" htmlFor="email">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    placeholder="e.g. student@college.edu"
                    value={newStudent.email}
                    onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                    className={inputClass}
                  />
                </FormField>

                <FormField label="Mobile Number *" htmlFor="phone">
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    required
                    placeholder="e.g. 9876543210"
                    value={newStudent.phone}
                    onChange={(e) => setNewStudent({ ...newStudent, phone: e.target.value })}
                    className={inputClass}
                  />
                </FormField>
              </div>

              <FormField label="Initial Login Password (optional, defaults to Password123!)" htmlFor="initialPassword">
                <input
                  id="initialPassword"
                  name="initialPassword"
                  type="password"
                  placeholder="Min 8 characters (default: Password123!)"
                  value={newStudent.password}
                  onChange={(e) => setNewStudent({ ...newStudent, password: e.target.value })}
                  className={inputClass}
                />
              </FormField>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={saving || samples.length === 0}
                  className="btn-primary w-full justify-center py-3 text-sm font-semibold shadow-sm"
                >
                  {saving && <LoaderCircle size={18} className="animate-spin" />}
                  <Save size={18} />
                  {saving
                    ? 'Saving Student & Face Data…'
                    : `Register Student & Save Face (${samples.length} sample${samples.length === 1 ? '' : 's'})`}
                </button>
                {samples.length === 0 && (
                  <p className="mt-2 text-center text-xs font-semibold text-amber-700">
                    * Capture at least one face sample in the camera panel before submitting.
                  </p>
                )}
              </div>
            </form>
          ) : (
            /* TAB 2: EXISTING STUDENTS LIST & FACE REGISTRATION */
            <div className="bg-white rounded-2xl border border-pine-900/10 p-6 shadow-sm space-y-5">
              <div className="border-b border-pine-900/10 pb-3">
                <h3 className="text-lg font-bold text-pine-950">Registered Students & Face Status</h3>
                <p className="text-xs text-pine-700/80 mt-0.5">
                  Select a student below to update or register their face using the camera.
                </p>
              </div>

              {/* Selected Student Banner */}
              {selectedStudent ? (
                <div className="flex items-center justify-between rounded-2xl border-2 border-olive-500 bg-olive-50/40 p-4">
                  <div>
                    <span className="text-xs font-bold text-olive-800">Currently Selected for Face Update:</span>
                    <p className="text-base font-bold text-pine-950 mt-0.5">
                      {selectedStudent.name} ({selectedStudent.studentId})
                    </p>
                    <p className="text-xs text-pine-700 mt-0.5">
                      {normalizeDepartment(selectedStudent.department)} · Sec {selectedStudent.section} · Roll {selectedStudent.rollNumber}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSaveExistingFace}
                      disabled={saving || samples.length === 0}
                      className="btn-primary py-2 px-4 text-xs font-semibold shadow-sm"
                    >
                      {saving && <LoaderCircle size={14} className="animate-spin" />}
                      <Save size={14} /> Save Face ({samples.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedStudent(null)
                        latestDescriptor.current = null
                        setSamples([])
                      }}
                      className="btn-secondary py-2 px-3 text-xs font-semibold"
                    >
                      Deselect
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-pine-900/15 bg-ivory/40 p-4 text-center text-xs text-pine-700">
                  Click <strong>&quot;Select &amp; Register Face&quot;</strong> on any student below to bind new camera samples to their profile.
                </div>
              )}

              {/* Filters Bar: Department -> Year -> Section */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-bold text-pine-700 mb-1">Department</label>
                  <select
                    value={existingFilters.department}
                    onChange={(e) => setExistingFilters((f) => ({ ...f, department: e.target.value }))}
                    className={`${inputClass} text-xs`}
                  >
                    <option value="">All Departments</option>
                    {availableDepartments.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-pine-700 mb-1">Academic Year</label>
                  <select
                    value={existingFilters.year}
                    onChange={(e) => setExistingFilters((f) => ({ ...f, year: e.target.value }))}
                    className={`${inputClass} text-xs`}
                  >
                    <option value="">All Years</option>
                    <option value="1">1st Year</option>
                    <option value="2">2nd Year</option>
                    <option value="3">3rd Year</option>
                    <option value="4">4th Year</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-pine-700 mb-1">Section</label>
                  <select
                    value={existingFilters.section}
                    onChange={(e) => setExistingFilters((f) => ({ ...f, section: e.target.value }))}
                    className={`${inputClass} text-xs`}
                  >
                    <option value="">All Sections</option>
                    {availableSections.map((sec) => (
                      <option key={sec} value={sec}>
                        Section {sec}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-pine-600" />
                <input
                  type="text"
                  placeholder="Search by name, student ID, roll number…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`${inputClass} pl-10`}
                />
              </div>

              {/* Student List Table */}
              <div className="max-h-[420px] overflow-y-auto rounded-2xl border border-pine-900/10">
                {loadingStudents ? (
                  <p className="p-6 text-center text-sm text-pine-600">Loading students…</p>
                ) : studentsList.length === 0 ? (
                  <p className="p-6 text-center text-sm text-pine-600">No students found.</p>
                ) : (
                  <ul className="divide-y divide-pine-900/5">
                    {studentsList.map((student) => {
                      const isSelected = selectedStudent?._id === student._id
                      return (
                        <li
                          key={student._id}
                          className={`flex items-center justify-between gap-3 p-3.5 transition-colors ${
                            isSelected ? 'bg-olive-50/70' : 'hover:bg-ivory/50'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-bold text-pine-950">{student.name}</p>
                              <StatusBadge status={student.faceRegistered ? 'Active' : 'Pending'} />
                            </div>
                            <p className="mt-0.5 text-xs text-pine-700">
                              ID: <strong>{student.studentId}</strong> · Dept: {normalizeDepartment(student.department)} · Year {student.year || 1} · Sec {student.section}
                              {student.faceRegistered && ` · ${student.sampleCount} sample(s)`}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedStudent(student)
                              latestDescriptor.current = null
                              setSamples([])
                            }}
                            className={`btn-secondary shrink-0 text-xs font-semibold py-1.5 px-3 ${
                              isSelected ? 'border-olive-600 bg-olive-100 text-olive-800' : ''
                            }`}
                          >
                            <ScanFace size={14} />
                            {student.faceRegistered ? 'Update Face' : 'Select & Register'}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  )
}
