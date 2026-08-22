import { supabaseAdmin } from '../config/supabase.js';
import { serverCache } from '../services/cacheService.js';

export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Missing or malformed access token'
      });
    }

    const token = authHeader.split(' ')[1];
    const cacheKey = `auth_user_${token}`;
    let user = serverCache.get(cacheKey);

    if (!user) {
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !data?.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized: Invalid or expired access token'
        });
      }
      user = data.user;
      serverCache.set(cacheKey, user, 120000); // 2-minute cache
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const cacheKey = `auth_user_${token}`;
      let user = serverCache.get(cacheKey);

      if (!user) {
        const { data } = await supabaseAdmin.auth.getUser(token);
        if (data?.user) {
          user = data.user;
          serverCache.set(cacheKey, user, 120000);
        }
      }

      if (user) {
        req.user = user;
      }
    }
    next();
  } catch (error) {
    next();
  }
};

export const requireAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Missing access token'
      });
    }

    const token = authHeader.split(' ')[1];
    const cacheKey = `admin_user_${token}`;
    let adminUser = serverCache.get(cacheKey);

    if (adminUser) {
      req.user = adminUser;
      return next();
    }

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Invalid or expired access token'
      });
    }

    // Verify role in profiles table
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isSuperAdminEmail = 
      user.email === 'hetpatel140505@gmail.com' || 
      user.email?.toLowerCase().includes('admin');

    const role = (isSuperAdminEmail || profile?.role === 'admin' || user.user_metadata?.role === 'admin') 
      ? 'admin' 
      : (profile?.role || user.user_metadata?.role || 'customer');

    if (role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access Denied: Admin privileges required'
      });
    }

    if (isSuperAdminEmail && profile?.role !== 'admin') {
      supabaseAdmin.from('profiles').upsert({ id: user.id, email: user.email, role: 'admin' }, { onConflict: 'id' }).then(() => {}).catch(() => {});
    }

    adminUser = { ...user, role };
    serverCache.set(cacheKey, adminUser, 120000);
    req.user = adminUser;
    next();
  } catch (error) {
    next(error);
  }
};

