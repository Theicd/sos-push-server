// SOS Push Server - Config API | HYPER CORE TECH
// מחזיר את ה-VAPID public key עם לוגים מפורטים

module.exports = function handler(req, res) {
  const requestId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  console.log(`[CONFIG][${requestId}] ====== בקשת Config חדשה ======`);
  console.log(`[CONFIG][${requestId}] Method: ${req.method}`);
  console.log(`[CONFIG][${requestId}] Headers:`, JSON.stringify(req.headers, null, 2));
  console.log(`[CONFIG][${requestId}] Origin: ${req.headers.origin || 'N/A'}`);
  console.log(`[CONFIG][${requestId}] User-Agent: ${req.headers['user-agent'] || 'N/A'}`);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    console.log(`[CONFIG][${requestId}] ✅ CORS Preflight - מחזיר 200`);
    return res.status(200).end();
  }

  // VAPID keys
  const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BK_EV-pOGBdyr1z5Nzz7tib8IKkRCm0F97yaklkjiPGUxowhU86ZQgOOWsAJY9yGB0cmaNU6QdYFNEs6AK_7A8Y';

  console.log(`[CONFIG][${requestId}] VAPID_PUBLIC_KEY מוגדר: ${VAPID_PUBLIC_KEY ? 'כן' : 'לא'}`);
  console.log(`[CONFIG][${requestId}] אורך מפתח: ${VAPID_PUBLIC_KEY?.length || 0}`);
  console.log(`[CONFIG][${requestId}] מקור מפתח: ${process.env.VAPID_PUBLIC_KEY ? 'ENV' : 'DEFAULT'}`);

  const response = {
    ok: true,
    publicKey: VAPID_PUBLIC_KEY,
    requestId,
    timestamp: new Date().toISOString()
  };

  console.log(`[CONFIG][${requestId}] ✅ מחזיר תגובה:`, JSON.stringify(response));
  res.status(200).json(response);
}
