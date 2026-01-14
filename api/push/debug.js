// SOS Push Server - Debug API | HYPER CORE TECH
// כלי דיבוג מקיף למערכת Push - מציג מידע מפורט על Redis ומנויים

const { Redis } = require('@upstash/redis');

// יצירת חיבור ל-Redis
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || 'https://included-krill-36492.upstash.io';
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || 'AY6MAAIncDE5NmZlODY1Njc2ODU0ZjNmOTdlOTRkMTcwMmQwMDA5OXAxMzY0OTI';

// VAPID keys
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BK_EV-pOGBdyr1z5Nzz7tib8IKkRCm0F97yaklkjiPGUxowhU86ZQgOOWsAJY9yGB0cmaNU6QdYFNEs6AK_7A8Y';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'zji1vkdl4YaQQx155uP-89vc8H2-83lUlO7vWLSb6LU';
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:admin@sos.app';

let redis = null;
function getRedis() {
  if (!redis) {
    redis = new Redis({
      url: REDIS_URL,
      token: REDIS_TOKEN,
    });
  }
  return redis;
}

module.exports = async function handler(req, res) {
  const requestId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  console.log(`\n[DEBUG][${requestId}] ====== בקשת Debug ======`);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { action, pubkey } = req.method === 'POST' ? req.body : req.query;
    
    console.log(`[DEBUG][${requestId}] Action: ${action || 'status'}`);
    console.log(`[DEBUG][${requestId}] Pubkey: ${pubkey || 'N/A'}`);

    const result = {
      ok: true,
      requestId,
      timestamp: new Date().toISOString(),
      server: {
        nodeVersion: process.version,
        platform: process.platform,
        uptime: process.uptime(),
      },
      config: {
        redisUrl: REDIS_URL,
        redisTokenSet: !!REDIS_TOKEN,
        vapidPublicKeySet: !!VAPID_PUBLIC_KEY,
        vapidPublicKeyLength: VAPID_PUBLIC_KEY?.length,
        vapidPrivateKeySet: !!VAPID_PRIVATE_KEY,
        vapidEmail: VAPID_EMAIL,
        envVarsUsed: {
          UPSTASH_REDIS_REST_URL: !!process.env.UPSTASH_REDIS_REST_URL,
          UPSTASH_REDIS_REST_TOKEN: !!process.env.UPSTASH_REDIS_REST_TOKEN,
          VAPID_PUBLIC_KEY: !!process.env.VAPID_PUBLIC_KEY,
          VAPID_PRIVATE_KEY: !!process.env.VAPID_PRIVATE_KEY,
        }
      }
    };

    // בדיקת חיבור Redis
    console.log(`[DEBUG][${requestId}] בודק חיבור Redis...`);
    try {
      const pingStart = Date.now();
      const pingResult = await getRedis().ping();
      const pingTime = Date.now() - pingStart;
      
      result.redis = {
        connected: true,
        ping: pingResult,
        latency: `${pingTime}ms`
      };
      console.log(`[DEBUG][${requestId}] ✅ Redis PING: ${pingResult} (${pingTime}ms)`);
    } catch (redisErr) {
      result.redis = {
        connected: false,
        error: redisErr.message
      };
      console.error(`[DEBUG][${requestId}] ❌ Redis Error:`, redisErr.message);
    }

    // סטטיסטיקות כלליות
    if (!action || action === 'status' || action === 'stats') {
      console.log(`[DEBUG][${requestId}] מחשב סטטיסטיקות...`);
      try {
        const userKeys = await getRedis().keys('user:*');
        const subKeys = await getRedis().keys('sub:*');
        
        result.stats = {
          totalUsers: userKeys.length,
          totalSubscriptions: subKeys.length,
          userKeys: userKeys.slice(0, 10).map(k => k.replace('user:', '').slice(0, 8) + '...'),
          subKeys: subKeys.slice(0, 10).map(k => k.replace('sub:', '').slice(0, 12) + '...')
        };
        console.log(`[DEBUG][${requestId}] 📊 Users: ${userKeys.length}, Subs: ${subKeys.length}`);
      } catch (statsErr) {
        result.stats = { error: statsErr.message };
      }
    }

    // חיפוש מנויים לפי pubkey
    if (action === 'lookup' && pubkey) {
      console.log(`[DEBUG][${requestId}] מחפש מנויים עבור: ${pubkey.slice(0, 16)}...`);
      try {
        const userSubs = await getRedis().get(`user:${pubkey}`);
        const subsArray = userSubs ? (typeof userSubs === 'string' ? JSON.parse(userSubs) : userSubs) : [];
        
        result.lookup = {
          pubkey: pubkey.slice(0, 16) + '...',
          subscriptionCount: subsArray.length,
          subscriptionIds: subsArray
        };

        // פרטים על כל מנוי
        result.lookup.subscriptions = [];
        for (const subId of subsArray) {
          const subData = await getRedis().get(`sub:${subId}`);
          if (subData) {
            const parsed = typeof subData === 'string' ? JSON.parse(subData) : subData;
            result.lookup.subscriptions.push({
              id: subId.slice(0, 12) + '...',
              endpoint: parsed.subscription?.endpoint?.slice(0, 60) + '...',
              hasKeys: !!parsed.subscription?.keys,
              createdAt: new Date(parsed.createdAt).toISOString(),
              updatedAt: new Date(parsed.updatedAt).toISOString()
            });
          } else {
            result.lookup.subscriptions.push({
              id: subId.slice(0, 12) + '...',
              status: 'NOT_FOUND'
            });
          }
        }
        
        console.log(`[DEBUG][${requestId}] 📋 נמצאו ${subsArray.length} מנויים`);
      } catch (lookupErr) {
        result.lookup = { error: lookupErr.message };
      }
    }

    // ניקוי כל המנויים (זהירות!)
    if (action === 'cleanup') {
      console.log(`[DEBUG][${requestId}] ⚠️ מנקה את כל המנויים...`);
      try {
        const userKeys = await getRedis().keys('user:*');
        const subKeys = await getRedis().keys('sub:*');
        
        let deleted = 0;
        for (const key of [...userKeys, ...subKeys]) {
          await getRedis().del(key);
          deleted++;
        }
        
        result.cleanup = {
          deletedUsers: userKeys.length,
          deletedSubscriptions: subKeys.length,
          totalDeleted: deleted
        };
        console.log(`[DEBUG][${requestId}] 🧹 נמחקו ${deleted} רשומות`);
      } catch (cleanupErr) {
        result.cleanup = { error: cleanupErr.message };
      }
    }

    // ניקוי מנויים של משתמש ספציפי
    if (action === 'cleanup-user' && pubkey) {
      console.log(`[DEBUG][${requestId}] 🧹 מנקה מנויים של: ${pubkey.slice(0, 16)}...`);
      try {
        const userSubs = await getRedis().get(`user:${pubkey}`);
        const subsArray = userSubs ? (typeof userSubs === 'string' ? JSON.parse(userSubs) : userSubs) : [];
        
        let deleted = 0;
        for (const subId of subsArray) {
          await getRedis().del(`sub:${subId}`);
          deleted++;
        }
        await getRedis().del(`user:${pubkey}`);
        
        result.cleanupUser = {
          pubkey: pubkey.slice(0, 16) + '...',
          deletedSubscriptions: deleted,
          userIndexDeleted: true
        };
        console.log(`[DEBUG][${requestId}] 🧹 נמחקו ${deleted} מנויים + אינדקס משתמש`);
      } catch (cleanupErr) {
        result.cleanupUser = { error: cleanupErr.message };
      }
    }

    console.log(`[DEBUG][${requestId}] ✅ תגובה מוכנה`);
    res.status(200).json(result);

  } catch (error) {
    console.error(`[DEBUG][${requestId}] ❌ שגיאה:`, error.message);
    res.status(500).json({ ok: false, error: error.message, requestId });
  }
}
