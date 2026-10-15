import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ScanFace,
  CheckCircle2,
  Users,
  GraduationCap,
  BarChart3,
  ShieldCheck,
  ArrowRight,
  ClipboardCheck,
  CalendarCheck2,
  FileSpreadsheet,
  Menu,
  X,
} from 'lucide-react'

export default function Landing() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const scrollToSection = (e, id) => {
    e.preventDefault()
    setMobileMenuOpen(false)
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <div className="min-h-screen bg-[#F7FAF7] text-ink selection:bg-emerald-100 selection:text-emerald-900">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-line bg-surface/95 px-6 py-3.5 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          {/* Logo & Portal Identity */}
          <a
            href="#home"
            onClick={(e) => scrollToSection(e, 'home')}
            className="flex items-center gap-3 transition hover:opacity-90"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#081B15] border border-emerald-500/30 shadow-xs">
              <img src="/logo.png" alt="ClassVision AI Logo" className="h-full w-full object-contain" />
            </div>
            <div>
              <span className="font-display text-base sm:text-lg font-bold tracking-tight text-ink">
                ClassVision AI
              </span>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
                Smart Classroom Portal
              </p>
            </div>
          </a>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-muted">
            <a
              href="#home"
              onClick={(e) => scrollToSection(e, 'home')}
              className="hover:text-ink transition"
            >
              Home
            </a>
            <a
              href="#features"
              onClick={(e) => scrollToSection(e, 'features')}
              className="hover:text-ink transition"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              onClick={(e) => scrollToSection(e, 'how-it-works')}
              className="hover:text-ink transition"
            >
              How It Works
            </a>
            <a
              href="#benefits"
              onClick={(e) => scrollToSection(e, 'benefits')}
              className="hover:text-ink transition"
            >
              Benefits
            </a>
          </nav>

          {/* Desktop Sign In CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              to="/login"
              className="btn-primary !py-2 !px-4 !text-xs !font-bold shadow-xs hover:shadow-sm"
            >
              Sign In
            </Link>
          </div>

          {/* Mobile Hamburger Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden rounded-lg p-2 text-muted hover:bg-surface-elevated hover:text-ink transition"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-line mt-3 pt-3 pb-2 space-y-2">
            <a
              href="#home"
              onClick={(e) => scrollToSection(e, 'home')}
              className="block rounded-lg px-3 py-2 text-xs font-semibold text-muted hover:bg-white hover:text-ink"
            >
              Home
            </a>
            <a
              href="#features"
              onClick={(e) => scrollToSection(e, 'features')}
              className="block rounded-lg px-3 py-2 text-xs font-semibold text-muted hover:bg-white hover:text-ink"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              onClick={(e) => scrollToSection(e, 'how-it-works')}
              className="block rounded-lg px-3 py-2 text-xs font-semibold text-muted hover:bg-white hover:text-ink"
            >
              How It Works
            </a>
            <a
              href="#benefits"
              onClick={(e) => scrollToSection(e, 'benefits')}
              className="block rounded-lg px-3 py-2 text-xs font-semibold text-muted hover:bg-white hover:text-ink"
            >
              Benefits
            </a>
            <div className="pt-2">
              <Link
                to="/login"
                className="btn-primary w-full !py-2.5 !text-xs !font-bold text-center block"
              >
                Sign In
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* 1. Home / Hero Section */}
      <section id="home" className="relative overflow-hidden mx-auto max-w-7xl px-6 py-12 sm:py-16 lg:py-20">
        {/* Ambient background glows */}
        <div className="absolute -top-24 -left-20 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 right-0 h-96 w-96 rounded-full bg-amber-500/5 blur-3xl pointer-events-none" />

        <div className="relative z-10 grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/90 px-3.5 py-1 text-xs font-bold text-emerald-800 shadow-2xs">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Smart Classroom &amp; Attendance Analytics Portal</span>
            </div>

            <h1 className="mt-4 text-3xl sm:text-4xl lg:text-[44px] font-black font-display tracking-tight text-ink leading-tight">
              Modern Attendance Management for Higher Education
            </h1>

            <p className="mt-4 text-sm sm:text-base leading-relaxed text-muted">
              ClassVision AI empowers educational institutions with unified student registration, automated facial recognition verification, academic course tracking, and comprehensive attendance analytics across Administrators, Faculty, and Students.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3.5">
              <Link
                to="/login"
                className="btn-primary !py-3 !px-6 !text-xs sm:!text-sm !font-bold shadow-md hover:shadow-lg"
              >
                <span>Sign In to Portal</span>
                <ArrowRight size={15} />
              </Link>
              <a
                href="#features"
                onClick={(e) => scrollToSection(e, 'features')}
                className="btn-secondary !py-3 !px-5 !text-xs sm:!text-sm !font-bold"
              >
                Explore Features
              </a>
            </div>

            {/* Practical highlights */}
            <div className="mt-10 grid grid-cols-3 gap-4 border-t border-line/80 pt-6">
              <div>
                <p className="text-base sm:text-lg font-black font-display text-ink">Automated</p>
                <p className="text-xs text-muted font-medium mt-0.5">Contactless Verification</p>
              </div>
              <div>
                <p className="text-base sm:text-lg font-black font-display text-primary">Role-Based</p>
                <p className="text-xs text-muted font-medium mt-0.5">Admin, Teacher, Student</p>
              </div>
              <div>
                <p className="text-base sm:text-lg font-black font-display text-ink">Actionable</p>
                <p className="text-xs text-muted font-medium mt-0.5">Auditable Reports</p>
              </div>
            </div>
          </div>

          {/* Hero Visual Card: Clean image without any text overlays */}
          <div className="relative">
            <div className="relative overflow-hidden rounded-[26px] border border-line/90 bg-white p-2 shadow-xl transition-all duration-300 hover:shadow-2xl">
              <img
                src="/classroom_hero_banner.jpg"
                alt="Interactive Smart Classroom with Faculty and Students"
                className="h-72 w-full rounded-[20px] object-cover sm:h-84 lg:h-96"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 2. Features Section */}
      <section id="features" className="border-t border-line/80 bg-white px-6 py-14 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-primary">Core Capabilities</span>
            <h2 className="mt-2 text-2xl sm:text-3xl lg:text-4xl font-black font-display text-ink">
              Purpose-Built for Institutional Excellence
            </h2>
            <p className="mt-2.5 text-xs sm:text-sm text-muted">
              Explore the core modules powering seamless classroom operations and attendance governance.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* Feature 1 */}
            <div className="rounded-[22px] border border-line/90 bg-[#FAFCFA] p-6 transition-all duration-300 hover:bg-white hover:shadow-card-hover hover:-translate-y-1 group">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/60 shadow-[0_0_12px_rgba(16,185,129,0.15)] mb-4 transition-transform group-hover:scale-105">
                <CalendarCheck2 size={22} />
              </div>
              <h3 className="text-base font-bold text-ink font-display">Smart Attendance Management</h3>
              <p className="mt-2 text-xs sm:text-sm text-muted leading-relaxed">
                Streamlined session recording with automated classification of Present, Late, and Absent statuses. Supports both live face-recognition sessions and manual adjustments.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="rounded-[22px] border border-line/90 bg-[#FAFCFA] p-6 transition-all duration-300 hover:bg-white hover:shadow-card-hover hover:-translate-y-1 group">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200/60 shadow-[0_0_12px_rgba(99,102,241,0.15)] mb-4 transition-transform group-hover:scale-105">
                <ScanFace size={22} />
              </div>
              <h3 className="text-base font-bold text-ink font-display">Face Recognition Attendance</h3>
              <p className="mt-2 text-xs sm:text-sm text-muted leading-relaxed">
                Contactless verification utilizing pre-trained facial embeddings. Detects registered students in live webcam frames with temporal stability to ensure reliable records.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="rounded-[22px] border border-line/90 bg-[#FAFCFA] p-6 transition-all duration-300 hover:bg-white hover:shadow-card-hover hover:-translate-y-1 group">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-sky-700 border border-sky-200/60 shadow-[0_0_12px_rgba(14,165,233,0.15)] mb-4 transition-transform group-hover:scale-105">
                <Users size={22} />
              </div>
              <h3 className="text-base font-bold text-ink font-display">Student Management</h3>
              <p className="mt-2 text-xs sm:text-sm text-muted leading-relaxed">
                Centralized student directory with register numbers, academic departments, semester years, and section allocations. Enables authorized faculty to enroll face profiles.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="rounded-[22px] border border-line/90 bg-[#FAFCFA] p-6 transition-all duration-300 hover:bg-white hover:shadow-card-hover hover:-translate-y-1 group">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-700 border border-amber-200/60 shadow-[0_0_12px_rgba(245,158,11,0.15)] mb-4 transition-transform group-hover:scale-105">
                <GraduationCap size={22} />
              </div>
              <h3 className="text-base font-bold text-ink font-display">Academic Management</h3>
              <p className="mt-2 text-xs sm:text-sm text-muted leading-relaxed">
                Structured organization of degree programs, academic departments, semester subjects, and timetable scheduling for organized classroom workflows.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="rounded-[22px] border border-line/90 bg-[#FAFCFA] p-6 transition-all duration-300 hover:bg-white hover:shadow-card-hover hover:-translate-y-1 group">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-700 border border-rose-200/60 shadow-[0_0_12px_rgba(244,63,94,0.15)] mb-4 transition-transform group-hover:scale-105">
                <BarChart3 size={22} />
              </div>
              <h3 className="text-base font-bold text-ink font-display">Attendance Analytics &amp; Reports</h3>
              <p className="mt-2 text-xs sm:text-sm text-muted leading-relaxed">
                Institutional trends, department compliance percentages, threshold warnings for low attendance, and downloadable CSV and PDF reports for official record-keeping.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="rounded-[22px] border border-line/90 bg-[#FAFCFA] p-6 transition-all duration-300 hover:bg-white hover:shadow-card-hover hover:-translate-y-1 group">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-50 text-purple-700 border border-purple-200/60 shadow-[0_0_12px_rgba(168,85,247,0.15)] mb-4 transition-transform group-hover:scale-105">
                <ShieldCheck size={22} />
              </div>
              <h3 className="text-base font-bold text-ink font-display">Role-Based Dashboards</h3>
              <p className="mt-2 text-xs sm:text-sm text-muted leading-relaxed">
                Dedicated interfaces for Administrators, Teachers, and Students with strictly scoped permissions, tailored workflows, and personalized academic views.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. How It Works Section */}
      <section id="how-it-works" className="px-6 py-14 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-primary">Workflow</span>
            <h2 className="mt-2 text-2xl sm:text-3xl lg:text-4xl font-black font-display text-ink">
              How ClassVision AI Operates
            </h2>
            <p className="mt-2.5 text-xs sm:text-sm text-muted">
              A straightforward four-step workflow from student enrollment to institutional reporting.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {/* Step 1 */}
            <div className="group relative rounded-[22px] border border-line/90 bg-white p-6 shadow-card hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300">
              <div className="inline-block rounded-lg bg-emerald-50 border border-emerald-200/60 px-2.5 py-1 text-[11px] font-black text-emerald-800 mb-3 tracking-wider">
                STEP 01
              </div>
              <h3 className="text-sm sm:text-base font-bold text-ink font-display">Profile &amp; Face Registration</h3>
              <p className="mt-2 text-xs text-muted leading-relaxed">
                Faculty register student details and capture high-quality face profiles through the camera to generate secure facial descriptors.
              </p>
            </div>

            {/* Step 2 */}
            <div className="group relative rounded-[22px] border border-line/90 bg-white p-6 shadow-card hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300">
              <div className="inline-block rounded-lg bg-indigo-50 border border-indigo-200/60 px-2.5 py-1 text-[11px] font-black text-indigo-800 mb-3 tracking-wider">
                STEP 02
              </div>
              <h3 className="text-sm sm:text-base font-bold text-ink font-display">Session Attendance</h3>
              <p className="mt-2 text-xs text-muted leading-relaxed">
                Faculty start an attendance session. The system recognizes enrolled students in real-time or allows manual attendance entries.
              </p>
            </div>

            {/* Step 3 */}
            <div className="group relative rounded-[22px] border border-line/90 bg-white p-6 shadow-card hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300">
              <div className="inline-block rounded-lg bg-sky-50 border border-sky-200/60 px-2.5 py-1 text-[11px] font-black text-sky-800 mb-3 tracking-wider">
                STEP 03
              </div>
              <h3 className="text-sm sm:text-base font-bold text-ink font-display">Secure Record Storage</h3>
              <p className="mt-2 text-xs text-muted leading-relaxed">
                Attendance records are validated and stored in the database, automatically updating cumulative subject percentages and session histories.
              </p>
            </div>

            {/* Step 4 */}
            <div className="group relative rounded-[22px] border border-line/90 bg-white p-6 shadow-card hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300">
              <div className="inline-block rounded-lg bg-purple-50 border border-purple-200/60 px-2.5 py-1 text-[11px] font-black text-purple-800 mb-3 tracking-wider">
                STEP 04
              </div>
              <h3 className="text-sm sm:text-base font-bold text-ink font-display">Analytics &amp; Transparency</h3>
              <p className="mt-2 text-xs text-muted leading-relaxed">
                Administrators audit attendance compliance, faculty review subject statistics, and students monitor their own attendance standing.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Benefits Section */}
      <section id="benefits" className="border-t border-line bg-white px-6 py-14 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">Value Proposition</span>
            <h2 className="mt-1 text-2xl sm:text-3xl font-bold font-display text-ink">
              Why Choose ClassVision AI?
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-muted">
              Practical advantages designed to modernize attendance tracking and save instructional time.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-2xl border border-line bg-[#F8FAF7] p-6">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 mb-2">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <span>Centralized Records</span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                All attendance entries are consolidated across classes and subjects, preventing lost paperwork and fragmented spreadsheets.
              </p>
            </div>

            <div className="rounded-2xl border border-line bg-[#F8FAF7] p-6">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 mb-2">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <span>Streamlined Classroom Management</span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Replaces roll calls with rapid verification so instructors can dedicate maximum classroom time to teaching and learning.
              </p>
            </div>

            <div className="rounded-2xl border border-line bg-[#F8FAF7] p-6">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 mb-2">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <span>Clear Attendance Summaries</span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Faculty and students gain transparent, real-time percentages and low-attendance warnings that help maintain institutional policy compliance.
              </p>
            </div>

            <div className="rounded-2xl border border-line bg-[#F8FAF7] p-6">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 mb-2">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <span>Flexible Attendance Methods</span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Supports automated facial recognition while maintaining full manual attendance capabilities for exceptional situations.
              </p>
            </div>

            <div className="rounded-2xl border border-line bg-[#F8FAF7] p-6">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 mb-2">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <span>Institutional Export Formats</span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Export session logs, student records, and aggregate statistics into CSV and PDF formats for formal academic auditing.
              </p>
            </div>

            <div className="rounded-2xl border border-line bg-[#F8FAF7] p-6">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 mb-2">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <span>Privacy &amp; Security Focused</span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Facial embeddings are converted into encrypted numeric representations, strictly adhering to role-based access boundaries.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Call to Action Section */}
      <section className="px-6 py-14 sm:py-16">
        <div className="relative mx-auto max-w-4xl overflow-hidden rounded-[28px] border border-emerald-500/30 bg-gradient-to-br from-[#091D17] via-[#0D251F] to-[#143B30] p-8 sm:p-12 text-center text-white shadow-2xl">
          {/* Ambient light ring */}
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

          <div className="relative z-10">
            <span className="inline-block rounded-full bg-emerald-400/10 border border-emerald-400/20 px-3.5 py-1 text-xs font-black uppercase tracking-widest text-emerald-300">
              Institutional Access
            </span>
            <h2 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-black font-display text-white">
              Ready to access your smart classroom portal?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-xs sm:text-sm text-[#A7C7BD] leading-relaxed">
              Sign in to access your administrative dashboard, conduct classroom attendance sessions, or view your academic records.
            </p>
            <div className="mt-7 flex justify-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-xs sm:text-sm font-extrabold text-[#0D251F] shadow-lg hover:bg-[#F0F8F5] hover:scale-105 transition-all duration-200"
              >
                <span>Sign In to Portal</span>
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Footer */}
      <footer className="border-t border-line bg-white px-6 py-8">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#081B15] border border-emerald-500/30 shadow-xs">
              <img src="/logo.png" alt="ClassVision AI Logo" className="h-full w-full object-contain" />
            </div>
            <div>
              <p className="text-xs font-bold text-ink">ClassVision AI</p>
              <p className="text-[10px] text-muted">Smart Classroom &amp; Attendance Analytics Portal</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-5 text-xs text-muted font-medium">
            <a
              href="#home"
              onClick={(e) => scrollToSection(e, 'home')}
              className="hover:text-ink transition"
            >
              Home
            </a>
            <a
              href="#features"
              onClick={(e) => scrollToSection(e, 'features')}
              className="hover:text-ink transition"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              onClick={(e) => scrollToSection(e, 'how-it-works')}
              className="hover:text-ink transition"
            >
              How It Works
            </a>
            <a
              href="#benefits"
              onClick={(e) => scrollToSection(e, 'benefits')}
              className="hover:text-ink transition"
            >
              Benefits
            </a>
            <Link to="/login" className="font-bold text-primary hover:underline">
              Sign In
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
