import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

function sanitizeRedirect(target: string | null): string {
  if (!target) return '/dashboard'
  // Disallow absolute URLs or protocol-relative URLs (e.g., //evil.com, https://evil.com, /\evil.com)
  if (!target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\')) {
    return '/dashboard'
  }
  return target
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const rawNext = searchParams.get('next')
  const next = sanitizeRedirect(rawNext)

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Check if user has profile and organization membership
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // Check if profile exists safely with maybeSingle
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .maybeSingle()

        // Check if user has organization membership (maybeSingle avoids PGRST116 on >1 rows)
        const { data: membership } = await supabase
          .from('organization_members')
          .select('id, organization_id')
          .eq('profile_id', user.id)
          .limit(1)
          .maybeSingle()

        // If no profile, create one
        if (!profile && user.email) {
          await supabase.from('profiles').upsert({
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || null,
          })
        }

        // If no membership, redirect to setup page
        if (!membership) {
          return NextResponse.redirect(`${origin}/setup-organization`)
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Return to login page with error
  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)
}

