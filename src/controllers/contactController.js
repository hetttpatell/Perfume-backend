import { supabaseAdmin } from '../config/supabase.js';

// Submit a new contact message (public — no auth required)
export const submitContactMessage = async (req, res, next) => {
  try {
    const { fullName, email, subject, message } = req.body;

    if (!fullName || !email || !message) {
      return res.status(400).json({
        success: false,
        error: 'Full name, email, and message are required'
      });
    }

    const { data: newMsg, error } = await supabaseAdmin
      .from('contact_messages')
      .insert({
        full_name: fullName,
        email,
        subject: subject || '',
        message
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.status(201).json({
      success: true,
      message: 'Your message has been received. Our concierge team will respond shortly.'
    });
  } catch (error) {
    next(error);
  }
};

// Admin: List all contact messages
export const getAllContactMessages = async (req, res, next) => {
  try {
    const { data: messages, error } = await supabaseAdmin
      .from('contact_messages')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === 'PGRST205') {
        return res.status(200).json({
          success: true,
          count: 0,
          messages: []
        });
      }
      return res.status(500).json({ success: false, error: error.message });
    }

    res.status(200).json({
      success: true,
      count: (messages || []).length,
      messages: messages || []
    });
  } catch (error) {
    next(error);
  }
};

// Admin: Update message status (new → read → replied → archived)
export const updateContactMessageStatus = async (req, res, next) => {
  try {
    const { id, status } = req.body;
    if (!id || !status) {
      return res.status(400).json({ success: false, error: 'Message ID and status are required' });
    }

    const validStatuses = ['new', 'read', 'replied', 'archived'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: `Status must be one of: ${validStatuses.join(', ')}` });
    }

    const { data: updated, error } = await supabaseAdmin
      .from('contact_messages')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.status(200).json({
      success: true,
      message: `Message status updated to ${status}`,
      contact: updated
    });
  } catch (error) {
    next(error);
  }
};

// Admin: Delete a contact message
export const deleteContactMessage = async (req, res, next) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, error: 'Message ID is required' });
    }

    const { error } = await supabaseAdmin.from('contact_messages').delete().eq('id', id);
    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.status(200).json({
      success: true,
      message: 'Contact message deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
