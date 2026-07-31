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

    const userData = {
      ...req.user,
      role: profile?.role || 'customer'
    };

    res.status(200).json({
      success: true,
      user: userData,
      profile: profile || null
    });
  } catch (error) {
    next(error);
  }
};
