# 🚀 Vercel Deployment Instructions

## What We Built
✅ **Frontend**: React productivity dashboard  
✅ **Backend**: Vercel serverless functions (replaces Express)  
✅ **Database**: Supabase PostgreSQL (cloud)

## 🏗️ API Endpoints (Serverless)
- `POST /api/productivity` - Save productivity data
- `GET /api/productivity/[storeName]/[date]` - Get specific date data  
- `GET /api/productivity/[storeName]/range/[startDate]/[endDate]` - Export range
- `GET /api/store/[storeName]` - Get store info & settings
- `POST /api/setup-database` - Initialize database tables
- `GET /api/health` - Health check

## 📱 Deploy to Vercel

1. **Install Vercel CLI** (if not already installed)
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Deploy**
   ```bash
   vercel --prod
   ```

4. **Set Environment Variable**
   In Vercel dashboard → Settings → Environment Variables:
   - **Key**: `DATABASE_URL`  
   - **Value**: `postgresql://postgres:Pr0duct1v1ty-dashb0ard@db.ctdodsxmbbmcueqrgtot.supabase.co:5432/postgres`

5. **Initialize Database**
   After deployment, visit: `https://your-app.vercel.app/api/setup-database` (POST request)

## 🎯 Benefits
- ✅ **Tablets can access**: No more localhost issues
- ✅ **Auto-scaling**: Handles traffic spikes  
- ✅ **Global CDN**: Fast loading worldwide
- ✅ **Zero maintenance**: Serverless infrastructure
- ✅ **Same hosting**: Frontend + backend on Vercel

## 🔧 Testing Locally
```bash
npm run dev        # Frontend only (React)
vercel dev         # Full-stack (React + API routes)
```

Your dashboard is now **production-ready** and accessible from any device! 🎉