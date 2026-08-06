import { supabase, supabaseAdmin } from '../config/supabase.js';
import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    fullName: z.string().min(2, 'Full name is required')
  })
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required')
  })
});

export const register = async (req, res, next) => {
  try {
    const { email, password, fullName } = req.body;

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName }
      }
    });

    if (authError) {
      return res.status(400).json({ success: false, error: authError.message });
    }

    if (authData.user) {
      await supabaseAdmin.from('profiles').upsert({
        id: authData.user.id,
        email: authData.user.email,
        full_name: fullName
      });
    }

    res.status(201).json({
      success: true,
      message: 'Registration successful! Please check your email for verification link.',
      user: authData.user,
      session: authData.session
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return res.status(401).json({ success: false, error: 'Invalid login credentials' });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    const userData = {
      ...data.user,
      role: profile?.role || 'customer',
      profile: profile || null
    };

    res.status(200).json({
      success: true,
      message: 'Login successful',
      user: userData,
      session: data.session
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res, next) => {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      return res.status(500).json({ success: false, error: error.message });
    }

    const metadata = req.user.user_metadata || {};

    const mergedProfile = {
      id: req.user.id,
      email: req.user.email,
      role: profile?.role || 'customer',
      full_name: profile?.full_name || metadata.full_name || metadata.name || '',
      phone: profile?.phone || metadata.phone || '',
      street_address: profile?.street_address || metadata.street_address || '',
      city: profile?.city || metadata.city || '',
      state: profile?.state || metadata.state || '',
      postal_code: profile?.postal_code || metadata.postal_code || '',
      country: profile?.country || metadata.country || '',
      created_at: profile?.created_at || req.user.created_at,
      updated_at: profile?.updated_at || req.user.updated_at
    };

    const userData = {
      ...req.user,
      role: mergedProfile.role,
      profile: mergedProfile
    };

    res.status(200).json({
      success: true,
      user: userData,
      profile: mergedProfile
    });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { fullName, phone, streetAddress, city, state, postalCode, country } = req.body;

    // 1. Update user_metadata in Supabase Auth via admin client
    const { data: authUserData, error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: {
        full_name: fullName,
        phone: phone || null,
        street_address: streetAddress || null,
        city: city || null,
        state: state || null,
        postal_code: postalCode || null,
        country: country || null
      }
    });

    if (authError) {
      return res.status(400).json({ success: false, error: authError.message });
    }

    // 2. Update profiles table
    const profilePayload = {
      id: userId,
      email: req.user.email,
      full_name: fullName,
      phone: phone || null,
      updated_at: new Date().toISOString()
    };

    await supabaseAdmin.from('profiles').upsert(profilePayload, { onConflict: 'id' });

    const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', userId).single();

    const mergedProfile = {
      id: userId,
      email: req.user.email,
      role: profile?.role || 'customer',
      full_name: fullName || profile?.full_name || authUserData?.user?.user_metadata?.full_name || '',
      phone: phone || profile?.phone || authUserData?.user?.user_metadata?.phone || '',
      street_address: streetAddress || authUserData?.user?.user_metadata?.street_address || '',
      city: city || authUserData?.user?.user_metadata?.city || '',
      state: state || authUserData?.user?.user_metadata?.state || '',
      postal_code: postalCode || authUserData?.user?.user_metadata?.postal_code || '',
      country: country || authUserData?.user?.user_metadata?.country || '',
      updated_at: new Date().toISOString()
    };

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      profile: mergedProfile,
      user: {
        ...authUserData?.user,
        role: mergedProfile.role,
        profile: mergedProfile
      }
    });
  } catch (error) {
    next(error);
  }
};

export const refreshSession = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, error: 'Refresh token is required' });
    }

    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });

    if (error || !data.session) {
      return res.status(401).json({ success: false, error: error?.message || 'Invalid refresh token' });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    const metadata = data.user.user_metadata || {};
    const mergedProfile = {
      id: data.user.id,
      email: data.user.email,
      role: profile?.role || 'customer',
      full_name: profile?.full_name || metadata.full_name || metadata.name || '',
      phone: profile?.phone || metadata.phone || '',
      street_address: profile?.street_address || metadata.street_address || '',
      city: profile?.city || metadata.city || '',
      state: profile?.state || metadata.state || '',
      postal_code: profile?.postal_code || metadata.postal_code || '',
      country: profile?.country || metadata.country || ''
    };

    const userData = {
      ...data.user,
      role: mergedProfile.role,
      profile: mergedProfile
    };

    res.status(200).json({
      success: true,
      message: 'Session refreshed successfully',
      user: userData,
      session: data.session
    });
  } catch (error) {
    next(error);
  }
};

