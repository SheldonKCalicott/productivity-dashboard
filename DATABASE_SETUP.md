# Productivity Dashboard - PostgreSQL Setup Guide

## Prerequisites

1. **PostgreSQL Database** - Install PostgreSQL on your system:
   - Download from: https://www.postgresql.org/download/
   - Create a database named `productivity_dashboard`
   - Note your username/password

## Quick Start

1. **Update Database Configuration**
   ```bash
   # Edit .env file with your PostgreSQL credentials
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=productivity_dashboard
   DB_USER=your_postgres_username
   DB_PASSWORD=your_postgres_password
   ```

2. **Install Dependencies** 
   ```bash
   npm install
   ```

3. **Setup Database Schema**
   ```bash
   npm run db:setup
   ```

4. **Start the Application**
   ```bash
   npm run dev:full
   ```
   This starts both the backend API (port 3001) and frontend (port 5173)

## Database Schema

- **stores** - Store information (id, name, location)
- **productivity_records** - Daily productivity data by daypart
- **operational_weights** - Daypart weight percentages  
- **store_settings** - Ambition tier selections

## API Endpoints

- `GET /api/store/:storeName` - Get store info, weights, settings
- `POST /api/productivity` - Save productivity data
- `GET /api/productivity/:storeName/:date` - Load specific date data
- `GET /api/productivity/:storeName/range/:start/:end` - Export date range

## Features

✅ **Save Data**: Click "Save" to store productivity data to PostgreSQL  
✅ **Auto-Load**: Data automatically loads when changing dates  
✅ **Export**: Export date ranges to CSV from database  
✅ **Multi-Store**: Ready for multiple restaurant locations  
✅ **Real-time**: Updates save immediately to database

## Troubleshooting

**Database Connection Issues:**
- Verify PostgreSQL is running
- Check .env database credentials
- Ensure database exists: `CREATE DATABASE productivity_dashboard;`

**Port Conflicts:**
- Backend: Change PORT in .env (default 3001)  
- Frontend: Change port in vite.config.js (default 5173)

**Data Not Saving:**
- Check browser console for errors
- Verify backend is running on :3001
- Check database connection in terminal