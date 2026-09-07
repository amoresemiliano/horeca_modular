# PRODUCTION STATE — HORECA MODULAR

## 1. Production Architecture Overview
- **Production URL**: `https://horecamodular.vercel.app/`
- **Git Branch**: `main`
- **Current HEAD SHA**: `8a1fcb1a502a291165aff53dcd3005048c01cd65`
- **Hosting Provider**: Vercel
- **Backend**: Supabase Production Managed Project

## 2. Production Security Parameters
- **Authentication**: Native Supabase Auth with Google & GitHub OAuth enabled. Password login disabled (`VITE_DEV_PASSWORD_AUTH=false` or unset).
- **Fail-Closed Security**: 100% fail-closed authorization enforced by `AuthContext.jsx` and Database RLS.
- **Data Isolation**: Multi-tenant RLS using `get_auth_user_org_id()`.

## 3. Legacy Migration Status
- Legacy Firebase authentication (`ec-plataforma.firebaseapp.com`) is deprecated and pending complete removal in WP-001.
- Production business data is preserved and frozen during WP-000 preflight.
