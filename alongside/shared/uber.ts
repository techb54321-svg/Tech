// Uber's documented universal deep link ("ul"), which opens the Uber app (or
// m.uber.com) with the drop-off filled in. The rider then confirms and pays in
// Uber: https://developer.uber.com/docs/riders/ride-requests/tutorials/deep-links/introduction
export function uberDeepLink(
  dest: { label: string; address: string; latitude?: number | null; longitude?: number | null },
  clientId?: string | null,
): string {
  const p = new URLSearchParams({ action: 'setPickup', pickup: 'my_location' })
  if (clientId) p.set('client_id', clientId)
  p.set('dropoff[nickname]', dest.label)
  if (dest.address) p.set('dropoff[formatted_address]', dest.address)
  if (dest.latitude != null && dest.longitude != null) {
    p.set('dropoff[latitude]', String(dest.latitude))
    p.set('dropoff[longitude]', String(dest.longitude))
  }
  return `https://m.uber.com/ul/?${p.toString()}`
}
