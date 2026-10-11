import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { Court } from '@/types/database'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const surface = searchParams.get('surface')
  const indoor  = searchParams.get('indoor')
  const clubId  = searchParams.get('club_id')
  const date    = searchParams.get('date')

  let query = supabase
    .from('courts')
    .select('*, club:clubs(name, city, address)')
    .eq('is_active', true)

  if (surface) query = query.eq('surface', surface)
  if (indoor !== null) query = query.eq('is_indoor', indoor === 'true')
  if (clubId) query = query.eq('club_id', clubId)

  const { data: courtsData, error } = await query.order('price_per_hour')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const courts = (courtsData ?? []) as (Court & { club?: { name: string; city: string; address: string } | null })[]

  if (!date) return NextResponse.json(courts)

  const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0)
  const dayEnd   = new Date(date); dayEnd.setHours(23, 59, 59, 999)

  const { data: bookingsData } = await supabase
    .from('bookings')
    .select('court_id, starts_at, ends_at')
    .in('court_id', courts.map(c => c.id))
    .eq('status', 'confirmed')
    .gte('starts_at', dayStart.toISOString())
    .lte('ends_at', dayEnd.toISOString())

  const bookings = (bookingsData ?? []) as { court_id: string; starts_at: string; ends_at: string }[]
  const bookedMap: Record<string, { starts_at: string; ends_at: string }[]> = {}
  bookings.forEach(b => {
    if (!bookedMap[b.court_id]) bookedMap[b.court_id] = []
    bookedMap[b.court_id].push({ starts_at: b.starts_at, ends_at: b.ends_at })
  })

  return NextResponse.json(courts.map(c => ({ ...c, booked_slots: bookedMap[c.id] ?? [] })))
}
