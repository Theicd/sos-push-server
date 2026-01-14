// SOS Push Server - Send API | HYPER CORE TECH
// שליחת Push notifications עם Upstash Redis - עם לוגים מפורטים

const { Redis } = require('@upstash/redis');
const webpush = require('web-push');

// יצירת חיבור ל-Redis (lazy initialization)
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || 'https://included-krill-36492.upstash.io';
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || 'AY6MAAIncDE5NmZlODY1Njc2ODU0ZjNmOTdlOTRkMTcwMmQwMDA5OXAxMzY0OTI';

let redis = null;
function getRedis() {
  if (!redis) {
    console.log('[SEND] יוצר חיבור Redis חדש...');
    redis = new Redis({
      url: REDIS_URL,
      token: REDIS_TOKEN,
    });
  }
  return redis;
}

// הגדרת VAPID (lazy initialization)
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BK_EV-pOGBdyr1z5Nzz7tib8IKkRCm0F97yaklkjiPGUxowhU86ZQgOOWsAJY9yGB0cmaNU6QdYFNEs6AK_7A8Y';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'zji1vkdl4YaQQx155uP-89vc8H2-83lUlO7vWLSb6LU';
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:admin@sos.app';

let vapidConfigured = false;
function setupVapid(requestId) {
  if (!vapidConfigured && VAPID_PRIVATE_KEY) {
    try {
      console.log(`[SEND][${requestId}] 🔐 מגדיר VAPID...`);
      console.log(`[SEND][${requestId}]   - Public Key: ${VAPID_PUBLIC_KEY?.slice(0, 20)}...`);
      console.log(`[SEND][${requestId}]   - Private Key: ${VAPID_PRIVATE_KEY ? '***מוגדר***' : 'חסר!'}`);
      console.log(`[SEND][${requestId}]   - Email: ${VAPID_EMAIL}`);
      
      webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
      vapidConfigured = true;
      console.log(`[SEND][${requestId}] ✅ VAPID מוגדר בהצלחה`);
    } catch (e) {
      console.error(`[SEND][${requestId}] ❌ VAPID setup error:`, e.message);
    }
  }
}

module.exports = async function handler(req, res) {
  const requestId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  console.log(`\n[SEND][${requestId}] ====== בקשת Send חדשה ======`);
  console.log(`[SEND][${requestId}] Method: ${req.method}`);
  console.log(`[SEND][${requestId}] Timestamp: ${new Date().toISOString()}`);
  console.log(`[SEND][${requestId}] Origin: ${req.headers.origin || 'N/A'}`);

  // CORS headers - חייבים להיות ראשונים!
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    console.log(`[SEND][${requestId}] ✅ CORS Preflight`);
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    console.log(`[SEND][${requestId}] ❌ Method לא נתמך: ${req.method}`);
    return res.status(405).json({ ok: false, error: 'Method not allowed', requestId });
  }

  // הגדרת VAPID בתוך הפונקציה
  setupVapid(requestId);

  try {
    console.log(`[SEND][${requestId}] 📥 Body:`, JSON.stringify(req.body, null, 2));
    
    const { pubkey, payload } = req.body;

    if (!pubkey) {
      console.log(`[SEND][${requestId}] ❌ חסר pubkey`);
      return res.status(400).json({ ok: false, error: 'Missing pubkey', requestId });
    }

    if (!VAPID_PRIVATE_KEY) {
      console.log(`[SEND][${requestId}] ❌ VAPID_PRIVATE_KEY לא מוגדר`);
      return res.status(500).json({ ok: false, error: 'VAPID_PRIVATE_KEY not configured', requestId });
    }

    console.log(`[SEND][${requestId}] 🎯 שולח ל-pubkey: ${pubkey.slice(0, 16)}...`);
    console.log(`[SEND][${requestId}] 📦 Payload type: ${payload?.type || 'N/A'}`);
    console.log(`[SEND][${requestId}] 📦 Payload title: ${payload?.title || 'N/A'}`);

    // בדיקת חיבור Redis
    try {
      const pingResult = await getRedis().ping();
      console.log(`[SEND][${requestId}] ✅ Redis PING: ${pingResult}`);
    } catch (pingErr) {
      console.error(`[SEND][${requestId}] ❌ Redis PING נכשל:`, pingErr.message);
    }

    // מקבלים את רשימת המנויים של המשתמש
    console.log(`[SEND][${requestId}] 🔍 מחפש מנויים עבור user:${pubkey.slice(0, 8)}...`);
    const userSubsJson = await getRedis().get(`user:${pubkey}`);
    
    console.log(`[SEND][${requestId}] 📋 תוצאת חיפוש: ${userSubsJson || 'לא נמצא'}`);

    if (!userSubsJson) {
      console.log(`[SEND][${requestId}] ⚠️ לא נמצאו מנויים למשתמש`);
      return res.status(200).json({ 
        ok: true, 
        sent: 0, 
        failed: 0,
        message: 'No subscriptions found for user',
        requestId 
      });
    }

    const subscriptionIds = typeof userSubsJson === 'string' ? JSON.parse(userSubsJson) : userSubsJson;
    console.log(`[SEND][${requestId}] 📱 נמצאו ${subscriptionIds.length} מנויים: ${JSON.stringify(subscriptionIds)}`);

    let sent = 0;
    let failed = 0;
    const expiredSubs = [];
    const results = [];

    // שליחת Push לכל המנויים
    for (let i = 0; i < subscriptionIds.length; i++) {
      const subId = subscriptionIds[i];
      console.log(`[SEND][${requestId}] 📤 [${i+1}/${subscriptionIds.length}] מנסה לשלוח ל-${subId.slice(0, 12)}...`);
      
      try {
        const subDataJson = await getRedis().get(`sub:${subId}`);
        
        if (!subDataJson) {
          console.log(`[SEND][${requestId}] ⚠️ מנוי ${subId.slice(0, 12)} לא נמצא ב-Redis - מסמן למחיקה`);
          expiredSubs.push(subId);
          results.push({ subId: subId.slice(0, 12), status: 'not_found' });
          failed++;
          continue;
        }

        const subData = typeof subDataJson === 'string' ? JSON.parse(subDataJson) : subDataJson;
        const subscription = subData.subscription;

        console.log(`[SEND][${requestId}] 📋 פרטי מנוי ${subId.slice(0, 12)}:`);
        console.log(`[SEND][${requestId}]   - Endpoint: ${subscription.endpoint?.slice(0, 60)}...`);
        console.log(`[SEND][${requestId}]   - Keys: ${subscription.keys ? 'קיימים' : 'חסרים'}`);
        console.log(`[SEND][${requestId}]   - Created: ${new Date(subData.createdAt).toISOString()}`);

        const pushPayload = JSON.stringify(payload);
        console.log(`[SEND][${requestId}] 📦 Payload size: ${pushPayload.length} bytes`);

        await webpush.sendNotification(
          subscription,
          pushPayload,
          {
            TTL: 60 * 60 * 24, // 24 hours
            urgency: 'high'
          }
        );

        sent++;
        console.log(`[SEND][${requestId}] ✅ [${i+1}/${subscriptionIds.length}] נשלח בהצלחה ל-${subId.slice(0, 12)}`);
        results.push({ subId: subId.slice(0, 12), status: 'sent' });

      } catch (pushError) {
        console.error(`[SEND][${requestId}] ❌ [${i+1}/${subscriptionIds.length}] שגיאה בשליחה ל-${subId.slice(0, 12)}:`);
        console.error(`[SEND][${requestId}]   - Error: ${pushError.message}`);
        console.error(`[SEND][${requestId}]   - StatusCode: ${pushError.statusCode || 'N/A'}`);
        console.error(`[SEND][${requestId}]   - Body: ${pushError.body || 'N/A'}`);
        
        // אם המנוי פג תוקף - מסירים אותו
        if (pushError.statusCode === 410 || pushError.statusCode === 404) {
          console.log(`[SEND][${requestId}] 🗑️ מנוי ${subId.slice(0, 12)} פג תוקף (${pushError.statusCode}) - מסמן למחיקה`);
          expiredSubs.push(subId);
          results.push({ subId: subId.slice(0, 12), status: 'expired', code: pushError.statusCode });
        } else {
          results.push({ subId: subId.slice(0, 12), status: 'error', error: pushError.message, code: pushError.statusCode });
        }
        failed++;
      }
    }

    // ניקוי מנויים שפגו תוקף
    if (expiredSubs.length > 0) {
      console.log(`[SEND][${requestId}] 🧹 מנקה ${expiredSubs.length} מנויים שפגו תוקף...`);
      
      const remainingSubs = subscriptionIds.filter(id => !expiredSubs.includes(id));
      await getRedis().set(`user:${pubkey}`, JSON.stringify(remainingSubs));
      console.log(`[SEND][${requestId}] ✅ אינדקס משתמש עודכן: ${remainingSubs.length} מנויים נשארו`);
      
      // מחיקת המנויים עצמם
      for (const expiredId of expiredSubs) {
        await getRedis().del(`sub:${expiredId}`);
        console.log(`[SEND][${requestId}] 🗑️ נמחק: sub:${expiredId.slice(0, 12)}`);
      }
    }

    const response = {
      ok: true,
      sent,
      failed,
      total: subscriptionIds.length,
      cleaned: expiredSubs.length,
      results,
      requestId,
      timestamp: new Date().toISOString()
    };

    console.log(`[SEND][${requestId}] ====== סיכום ======`);
    console.log(`[SEND][${requestId}] ✅ נשלחו: ${sent}`);
    console.log(`[SEND][${requestId}] ❌ נכשלו: ${failed}`);
    console.log(`[SEND][${requestId}] 🧹 נוקו: ${expiredSubs.length}`);
    console.log(`[SEND][${requestId}] 📊 סה"כ: ${subscriptionIds.length}`);

    res.status(200).json(response);

  } catch (error) {
    console.error(`[SEND][${requestId}] ❌ שגיאה כללית:`, error.message);
    console.error(`[SEND][${requestId}] Stack:`, error.stack);
    res.status(500).json({ ok: false, error: error.message, requestId });
  }
}
