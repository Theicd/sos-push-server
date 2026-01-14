// SOS Push Server - Config API | HYPER CORE TECH
// מחזיר את ה-VAPID public key

export default function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // VAPID keys - יש להחליף למפתחות שלך
  const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BEPOE6wk0miKLhhFuVHUwb0HVD3s1xoLnWVQb0JA09dZXUDncoG3fJ7gN6fkfL4k7olamxRP28IZwWflxpmr0KI';

  res.status(200).json({
    ok: true,
    publicKey: VAPID_PUBLIC_KEY
  });
}
