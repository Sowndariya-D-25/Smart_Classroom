import dotenv from 'dotenv';
dotenv.config();

async function testHttpEndpoint() {
  const baseUrl = `http://localhost:${process.env.PORT || 5000}`;
  console.log(`Testing HTTP API at ${baseUrl}...`);

  // 1. Login as teacher
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'teacher1@smartclassroom.local',
      password: 'Password123!',
    }),
  });
  const loginData = await loginRes.json();
  if (!loginData.success) throw new Error('Teacher login failed: ' + JSON.stringify(loginData));
  const token = loginData.data.token;
  console.log('✓ Teacher login successful');

  // 2. Fetch teacher subjects
  const subjRes = await fetch(`${baseUrl}/api/teacher/subjects`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const subjData = await subjRes.json();
  const subject = subjData.data?.items?.[0];

  // Fetch classrooms
  const classRes = await fetch(`${baseUrl}/api/teacher/classrooms`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const classData = await classRes.json();
  const classroom = classData.data?.items?.[0];

  // 3. Create a new active session
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const sessRes = await fetch(`${baseUrl}/api/teacher/attendance/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      subject: subject._id,
      classroom: classroom._id,
      date: dateStr,
      period: 7,
      startTime: '16:00',
      endTime: '17:00',
      department: subject.department,
      section: 'A',
    }),
  });
  const sessData = await sessRes.json();
  if (!sessData.success) throw new Error('Create session failed: ' + JSON.stringify(sessData));
  const sessionId = sessData.data.session._id;
  console.log('✓ Attendance session created over HTTP:', sessionId);

  // 4. Test UNREGISTERED face descriptor over HTTP
  const unregisteredFace = Array.from({ length: 128 }, (_, i) => Number((Math.sin(i * 1.3) * 0.1).toFixed(6)));
  const norm = Math.sqrt(unregisteredFace.reduce((s, v) => s + v * v, 0));
  const unitUnregisteredFace = unregisteredFace.map(v => v / norm);

  const recogRes = await fetch(`${baseUrl}/api/teacher/attendance/sessions/${sessionId}/recognize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      descriptor: unitUnregisteredFace,
    }),
  });
  const recogData = await recogRes.json();
  console.log('HTTP Recognize Response (Unregistered Face):', recogData);

  if (recogData.data.matched === false && recogData.data.student === null) {
    console.log('✓ PASS: Unregistered face returned matched: false, student: null');
  } else {
    throw new Error('FAIL: Unregistered face was matched!');
  }

  // 5. Complete session
  const compRes = await fetch(`${baseUrl}/api/teacher/attendance/sessions/${sessionId}/complete`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const compData = await compRes.json();
  console.log('✓ Session completed over HTTP:', compData.message);

  console.log('ALL HTTP VERIFICATIONS PASSED SUCCESSFULLY!');
}

testHttpEndpoint().catch(err => {
  console.error('HTTP Test Failed:', err);
  process.exit(1);
});
