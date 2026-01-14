# SOS Push Server v2.0

שרת Push Notifications עם **Vercel KV** לשמירת מנויים בצורה קבועה.

## התקנה

### 1. צור ריפוזיטורי חדש ב-GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/Theicd/sos-push-server.git
git push -u origin main
```

### 2. חבר ל-Vercel
- היכנס ל-Vercel Dashboard
- Import את הריפוזיטורי החדש
- או עדכן את הפרויקט הקיים `sos-push-server`

### 3. הוסף Vercel KV
- ב-Vercel Dashboard → Storage → Create Database → KV
- חבר את ה-KV לפרויקט

### 4. הגדר Environment Variables
```
VAPID_PUBLIC_KEY=BEPOE6wk0miKLhhFuVHUwb0HVD3s1xoLnWVQb0JA09dZXUDncoG3fJ7gN6fkfL4k7olamxRP28IZwWflxpmr0KI
VAPID_PRIVATE_KEY=<your-private-key>
VAPID_EMAIL=mailto:admin@sos.app
```

### 5. Deploy
```bash
vercel --prod
```

## API Endpoints

- `GET /api/push/config` - מחזיר VAPID public key
- `POST /api/push/subscribe` - רישום מנוי
- `POST /api/push/send` - שליחת Push

## בדיקה
```bash
# בדיקת config
curl https://sos-push-server.vercel.app/api/push/config

# רישום מנוי
curl -X POST https://sos-push-server.vercel.app/api/push/subscribe \
  -H "Content-Type: application/json" \
  -d '{"subscription":{"endpoint":"..."},"pubkey":"test123"}'

# שליחת Push
curl -X POST https://sos-push-server.vercel.app/api/push/send \
  -H "Content-Type: application/json" \
  -d '{"pubkey":"test123","payload":{"title":"Test","body":"Hello"}}'
```
