// SOS Push Server - Send API | HYPER CORE TECH
// שליחת Push notifications עם Vercel KV

import { kv } from '@vercel/kv';
import webpush from 'web-push';

// הגדרת VAPID
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BEPOE6wk0miKLhhFuVHUwb0HVD3s1xoLnWVQb0JA09dZXUDncoG3fJ7gN6fkfL4k7olamxRP28IZwWflxpmr0KI';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:admin@sos.app';

if (VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

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
    const { pubkey, payload } = req.body;

    if (!pubkey) {
      return res.status(400).json({ ok: false, error: 'Missing pubkey' });
    }

    if (!VAPID_PRIVATE_KEY) {
      return res.status(500).json({ ok: false, error: 'VAPID_PRIVATE_KEY not configured' });
    }

    // מקבלים את רשימת המנויים של המשתמש
    const userSubsJson = await kv.get(`user:${pubkey}`);
    
    if (!userSubsJson) {
      console.log(`[SEND] No subscriptions found for user ${pubkey.slice(0, 8)}`);
      return res.status(200).json({ ok: true, sent: 0, message: 'No subscriptions found for user' });
    }

    const subscriptionIds = JSON.parse(userSubsJson);
    console.log(`[SEND] Found ${subscriptionIds.length} subscriptions for user ${pubkey.slice(0, 8)}`);

    let sent = 0;
    let failed = 0;
    const expiredSubs = [];

    // שליחת Push לכל המנויים
    for (const subId of subscriptionIds) {
      try {
        const subDataJson = await kv.get(`sub:${subId}`);
        if (!subDataJson) {
          expiredSubs.push(subId);
          continue;
        }

        const subData = JSON.parse(subDataJson);
        const subscription = subData.subscription;

        await webpush.sendNotification(
          subscription,
          JSON.stringify(payload),
          {
            TTL: 60 * 60 * 24, // 24 hours
            urgency: 'high'
          }
        );

        sent++;
        console.log(`[SEND] ✅ Sent to ${subId.slice(0, 8)}`);

      } catch (pushError) {
        console.error(`[SEND] ❌ Failed to send to ${subId}:`, pushError.message);
        
        // אם המנוי פג תוקף - מסירים אותו
        if (pushError.statusCode === 410 || pushError.statusCode === 404) {
          expiredSubs.push(subId);
        }
        failed++;
      }
    }

    // ניקוי מנויים שפגו תוקף
    if (expiredSubs.length > 0) {
      const remainingSubs = subscriptionIds.filter(id => !expiredSubs.includes(id));
      await kv.set(`user:${pubkey}`, JSON.stringify(remainingSubs));
      
      // מחיקת המנויים עצמם
      for (const expiredId of expiredSubs) {
        await kv.del(`sub:${expiredId}`);
      }
      console.log(`[SEND] Cleaned up ${expiredSubs.length} expired subscriptions`);
    }

    res.status(200).json({
      ok: true,
      sent,
      failed,
      cleaned: expiredSubs.length
    });

  } catch (error) {
    console.error('[SEND] Error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
}
