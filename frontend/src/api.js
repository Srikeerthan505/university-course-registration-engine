const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || 'The request failed.');
    error.code = payload.code;
    error.status = response.status;
    throw error;
  }
  return payload;
}

export const api = {
  getCourses: () => request('/courses'),
  getStudents: () => request('/students'),
  getSchedule: (studentId) => request(`/students/${studentId}/schedule`),
  enroll: (studentId, sectionId) =>
    request('/enroll', { method: 'POST', body: JSON.stringify({ studentId, sectionId }) }),
  drop: (studentId, sectionId) =>
    request('/enroll', { method: 'DELETE', body: JSON.stringify({ studentId, sectionId }) }),
};
