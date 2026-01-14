// SOS Push Server - Subscribe API | HYPER CORE TECH
// רישום מנוי Push עם שמירה ב-Upstash Redis - עם לוגים מפורטים

const { Redis } = require('@upstash/redis');

// יצירת חיבור ל-Redis (lazy initialization)
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || 'https://included-krill-36492.upstash.io';
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || 'AY6MAAIncDE5NmZlODY1Njc2ODU0ZjNmOTdlOTRkMTcwMmQwMDA5OXAxMzY0OTI';

let redis = null;
function getRedis() {
  if (!redis) {
    console.log('[SUBSCRIBE] יוצר חיבור Redis חדש...');
    console.log('[SUBSCRIBE] REDIS_URL:', REDIS_URL);
    console.log('[SUBSCRIBE] REDIS_TOKEN מוגדר:', REDIS_TOKEN ? 'כן' : 'לא');
    redis = new Redis({
      url: REDIS_URL,
      token: REDIS_TOKEN,
    });
  }
  return redis;
}

module.exports = async function handler(req, res) {
  const requestId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  console.log(`\n[SUBSCRIBE][${requestId}] ====== בקשת Subscribe חדשה ======`);
  console.log(`[SUBSCRIBE][${requestId}] Method: ${req.method}`);
  console.log(`[SUBSCRIBE][${requestId}] Timestamp: ${new Date().toISOString()}`);
  console.log(`[SUBSCRIBE][${requestId}] Origin: ${req.headers.origin || 'N/A'}`);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    console.log(`[SUBSCRIBE][${requestId}] ✅ CORS Preflight`);
    return res.status(200).end();
  }

  // DELETE - הסרת מנוי
  if (req.method === 'DELETE') {
    console.log(`[SUBSCRIBE][${requestId}] 🗑️ בקשת הסרת מנוי`);
    try {
      const { endpoint } = req.body || {};
      console.log(`[SUBSCRIBE][${requestId}] Endpoint להסרה: ${endpoint?.slice(0, 50)}...`);
      
      if (!endpoint) {
        console.log(`[SUBSCRIBE][${requestId}] ❌ חסר endpoint`);
        return res.status(400).json({ ok: false, error: 'Missing endpoint' });
      }
      
      const subscriptionId = endpoint.split('/').pop();
      console.log(`[SUBSCRIBE][${requestId}] Subscription ID: ${subscriptionId}`);
      
      await getRedis().del(`sub:${subscriptionId}`);
      console.log(`[SUBSCRIBE][${requestId}] ✅ מנוי הוסר`);
      
      return res.status(200).json({ ok: true, deleted: subscriptionId, requestId });
    } catch (error) {
      console.error(`[SUBSCRIBE][${requestId}] ❌ שגיאה בהסרה:`, error.message);
      return res.status(500).json({ ok: false, error: error.message, requestId });
    }
  }

  if (req.method !== 'POST') {
    console.log(`[SUBSCRIBE][${requestId}] ❌ Method לא נתמך: ${req.method}`);
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    console.log(`[SUBSCRIBE][${requestId}] 📥 Body:`, JSON.stringify(req.body, null, 2));
    
    const { subscription, pubkey } = req.body;

    // בדיקת subscription
    if (!subscription) {
      console.log(`[SUBSCRIBE][${requestId}] ❌ חסר subscription object`);
      return res.status(400).json({ ok: false, error: 'Missing subscription', requestId });
    }
    
    if (!subscription.endpoint) {
      console.log(`[SUBSCRIBE][${requestId}] ❌ חסר subscription.endpoint`);
      return res.status(400).json({ ok: false, error: 'Missing subscription endpoint', requestId });
    }

    console.log(`[SUBSCRIBE][${requestId}] 📋 פרטי מנוי:`);
    console.log(`[SUBSCRIBE][${requestId}]   - Endpoint: ${subscription.endpoint.slice(0, 80)}...`);
    console.log(`[SUBSCRIBE][${requestId}]   - Keys: ${subscription.keys ? 'קיימים' : 'חסרים'}`);
    console.log(`[SUBSCRIBE][${requestId}]   - Pubkey: ${pubkey ? pubkey.slice(0, 16) + '...' : 'לא סופק'}`);

    // יצירת מזהה ייחודי מה-endpoint
    const subscriptionId = subscription.endpoint.split('/').pop();
    console.log(`[SUBSCRIBE][${requestId}] 🔑 Subscription ID: ${subscriptionId}`);

    // שמירת המנוי ב-Redis
    const subscriptionData = {
      subscription,
      pubkey: pubkey || null,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    console.log(`[SUBSCRIBE][${requestId}] 💾 שומר מנוי ב-Redis...`);
    
    // בדיקת חיבור Redis
    try {
      const pingResult = await getRedis().ping();
      console.log(`[SUBSCRIBE][${requestId}] ✅ Redis PING: ${pingResult}`);
    } catch (pingErr) {
      console.error(`[SUBSCRIBE][${requestId}] ❌ Redis PING נכשל:`, pingErr.message);
    }

    // שמירה לפי ID
    await getRedis().set(`sub:${subscriptionId}`, JSON.stringify(subscriptionData));
    console.log(`[SUBSCRIBE][${requestId}] ✅ מנוי נשמר: sub:${subscriptionId}`);

    // אם יש pubkey - שומרים גם אינדקס לפי pubkey
    if (pubkey) {
      console.log(`[SUBSCRIBE][${requestId}] 👤 מעדכן אינדקס משתמש: user:${pubkey.slice(0, 8)}...`);
      
      // מקבלים את רשימת המנויים הקיימים של המשתמש
      const existingSubs = await getRedis().get(`user:${pubkey}`) || '[]';
      console.log(`[SUBSCRIBE][${requestId}] 📋 מנויים קיימים למשתמש: ${existingSubs}`);
      
      const subsArray = typeof existingSubs === 'string' ? JSON.parse(existingSubs) : existingSubs;
      
      // מוסיפים את המנוי החדש אם לא קיים
      if (!subsArray.includes(subscriptionId)) {
        subsArray.push(subscriptionId);
        await getRedis().set(`user:${pubkey}`, JSON.stringify(subsArray));
        console.log(`[SUBSCRIBE][${requestId}] ✅ אינדקס משתמש עודכן: ${subsArray.length} מנויים`);
      } else {
        console.log(`[SUBSCRIBE][${requestId}] ℹ️ מנוי כבר קיים באינדקס`);
      }
    }

    // סטטיסטיקות
    const stats = await getStats(requestId);
    console.log(`[SUBSCRIBE][${requestId}] 📊 סטטיסטיקות:`, stats);

    const response = {
      ok: true,
      subscriptionId,
      pubkey: pubkey?.slice(0, 8) || null,
      stats: {
        ...stats,
        persistent: true
      },
      requestId,
      timestamp: new Date().toISOString()
    };

    console.log(`[SUBSCRIBE][${requestId}] ✅ תגובה מוצלחת:`, JSON.stringify(response));
    res.status(200).json(response);

  } catch (error) {
    console.error(`[SUBSCRIBE][${requestId}] ❌ שגיאה כללית:`, error.message);
    console.error(`[SUBSCRIBE][${requestId}] Stack:`, error.stack);
    res.status(500).json({ ok: false, error: error.message, requestId });
  }
}

async function getStats(requestId) {
  try {
    console.log(`[SUBSCRIBE][${requestId}] 📊 מחשב סטטיסטיקות...`);
    const keys = await getRedis().keys('user:*');
    const subKeys = await getRedis().keys('sub:*');
    console.log(`[SUBSCRIBE][${requestId}] 📊 משתמשים: ${keys.length}, מכשירים: ${subKeys.length}`);
    return {
      users: keys.length,
      devices: subKeys.length
    };
  } catch (err) {
    console.error(`[SUBSCRIBE][${requestId}] ❌ שגיאה בסטטיסטיקות:`, err.message);
    return { users: 0, devices: 0 };
  }
}
