// Helper de lookup d'adresses geocodees par cellule de grille (~11m).
// Utilise par la carte et les listes pour afficher des adresses dans tooltips
// sans refaire des appels Nominatim (le cache est en DB cote backend).

import type { AddressLite } from './api'

export type AddressLookup = (lat: number, lng: number) => AddressLite | null

export function buildAddressLookup(addresses: AddressLite[]): AddressLookup {
  const map = new Map<string, AddressLite>()
  for (const a of addresses) {
    map.set(`${a.lat_e4},${a.lng_e4}`, a)
  }
  return (lat: number, lng: number) => {
    const key = `${Math.round(lat * 10000)},${Math.round(lng * 10000)}`
    // Lookup exact
    const exact = map.get(key)
    if (exact) return exact
    // Fallback : cellule voisine la plus proche (±1 dans la grille)
    const lat_e4 = Math.round(lat * 10000)
    const lng_e4 = Math.round(lng * 10000)
    for (const dlat of [0, 1, -1]) {
      for (const dlng of [0, 1, -1]) {
        if (dlat === 0 && dlng === 0) continue
        const a = map.get(`${lat_e4 + dlat},${lng_e4 + dlng}`)
        if (a) return a
      }
    }
    return null
  }
}
