// SOS Push Server - Subscribe API | HYPER CORE TECH
// רישום מנוי Push עם שמירה ב-Upstash Redis

import { Redis } from '@upstash/redis';

// יצירת חיבור ל-Redis
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const { subscription, pubkey } = req.body;

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ ok: false, error: 'Missing subscription' });
    }

    // יצירת מזהה ייחודי מה-endpoint
    const subscriptionId = subscription.endpoint.split('/').pop();

    // שמירת המנוי ב-Redis
    const subscriptionData = {
      subscription,
      pubkey: pubkey || null,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // שמירה לפי ID
    await redis.set(`sub:${subscriptionId}`, JSON.stringify(subscriptionData));

    // אם יש pubkey - שומרים גם אינדקס לפי pubkey
    if (pubkey) {
      // מקבלים את רשימת המנויים הקיימים של המשתמש
      const existingSubs = await redis.get(`user:${pubkey}`) || '[]';
      const subsArray = typeof existingSubs === 'string' ? JSON.parse(existingSubs) : existingSubs;
      
      // מוסיפים את המנוי החדש אם לא קיים
      if (!subsArray.includes(subscriptionId)) {
        subsArray.push(subscriptionId);
        await redis.set(`user:${pubkey}`, JSON.stringify(subsArray));
      }
    }

    // סטטיסטיקות
    const stats = await getStats();

    console.log(`[SUBSCRIBE] Saved subscription ${subscriptionId} for pubkey ${pubkey?.slice(0, 8) || 'anonymous'}`);

    res.status(200).json({
      ok: true,
      subscriptionId,
      stats: {
        ...stats,
        persistent: true
      }
    });

  } catch (error) {
    console.error('[SUBSCRIBE] Error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
}

async function getStats() {
  try {
    // ספירת משתמשים ומכשירים
    const keys = await redis.keys('user:*');
    const subKeys = await redis.keys('sub:*');
    return {
      users: keys.length,
      devices: subKeys.length
    };
  } catch {
    return { users: 0, devices: 0 };
  }
}
