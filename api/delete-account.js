import { createClient } from '@supabase/supabase-js'

// Deletes a user's account and personal data.
//
// The caller's identity comes from their Supabase access token (JWT) in the
// Authorization header — never from anything in the request body. Requires the
// SUPABASE_SERVICE_ROLE_KEY env var (see .env.example); until it is set on
// Vercel this endpoint returns 500 and the app shows the email fallback.
//
// What gets deleted: the auth user plus (via FK cascade) the profile,
// wishlist, notifications and support/direct-order conversations with their
// messages. Order records (orders/order_items) are intentionally retained for
// legal & accounting purposes — matching the Privacy Policy's "Data deletion"
// section. Order voice notes in storage are order-scoped and already cleaned
// up by the daily cleanup job, so no per-user storage sweep is needed here.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Deletion endpoint not configured' })
  }

  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Verify the caller's identity from their JWT.
  const {
    data: { user },
    error: userError,
  } = await admin.auth.getUser(token)
  if (userError || !user) {
    return res.status(401).json({ error: 'Invalid session' })
  }
  const userId = user.id

  // Explicit row deletes first (idempotent, and safe even if a table's FK
  // cascade is missing in a given environment), then the auth user.
  const userTables = [
    'profiles',
    'wishlist_items',
    'notifications',
    'conversations',
  ]
  for (const table of userTables) {
    const { error } = await admin.from(table).delete().eq('user_id', userId)
    if (error) {
      console.error(`delete-account: failed to clear ${table}:`, error.message)
    }
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
  if (deleteError) {
    return res.status(500).json({ error: 'Failed to delete account' })
  }

  return res.status(200).json({ ok: true })
}
