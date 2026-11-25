// Bringing a gym found in 2GIS or Yandex Maps back into openGym.
//
// Neither app offers a free API, and their terms do not allow scraping. What a person can do is
// share or copy the gym card, then paste the link here. This module only reads that user-supplied
// text: it never calls either map service. A link gives coordinates and sometimes the name; the
// shared text gives the name and address, and the editor lets the person correct both.

const URL_RE = /https?:\/\/[^\s<>"']+/i

const clean = v => String(v || '').replace(/\s+/g, ' ').trim()
const decoded = v => {
  try { return decodeURIComponent(String(v || '').replace(/\+/g, ' ')) } catch { return String(v || '') }
}

function coordPair(value) {
  const first = String(value || '').split('~')[0].split('/')[0]
  const [a, b] = first.split(',').map(Number)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  // Both providers use longitude,latitude in these links.
  if (Math.abs(a) > 180 || Math.abs(b) > 90) return null
  return { lat: b, lng: a }
}

const ADDRESS = /(?:^|[\s,.])(?:ул\.?|улица|просп\.?|проспект|переул\.?|бульвар|шоссе|наб\.?|набережная|пл\.?|площадь|д\.?|дом|корп\.?|стр\.?|к\d|вл\d|лит\.?)\s|\d+[а-я]?(?:\s|,|$)/i
// Where an address starts inside a single shared line, including the street name before "пр."
// ("DDX Fitness Шараповский пр., вл2с3"): the optional capitalised token is that street name.
const ADDRESS_AT = /(?:^|\s)(?:[А-ЯЁA-Z][^\s,]*\s+)?(?:ул\.?|улица|просп\.?|проспект|пр\.?|переул\.?|бульвар|шоссе|наб\.?|набережная|пл\.?|площадь|д\.?|дом|корп\.?|стр\.?|к\d|вл\d+[^\s,]*|лит\.?)(?=\s|[.,]|$)/i

/** The public search links: https opens the installed app (universal link) or its website. */
export function mapSearchUrls({ q = '', near = null } = {}) {
  const query = clean(q)
  const dgis = new URL(query ? 'https://2gis.ru/search/' + encodeURIComponent(query) : 'https://2gis.ru/')
  const yandex = new URL('https://yandex.ru/maps/')
  if (query) yandex.searchParams.set('text', query)
  if (near && Number.isFinite(near.lat) && Number.isFinite(near.lng)) {
    dgis.searchParams.set('m', near.lng + ',' + near.lat + '/15')
    yandex.searchParams.set('ll', near.lng + ',' + near.lat)
    yandex.searchParams.set('z', '15')
  }
  return { dgis: dgis.href, yandex: yandex.href }
}

/**
 * Read a card copied from 2GIS or Yandex Maps. Returns { name, address, lat, lng, source, url };
 * lat/lng are null when the link has no point. The person can edit every field in the gym editor.
 */
export function parseGymCard(value) {
  const text = String(value || '').trim()
  if (!text) return null
  const match = text.match(URL_RE)
  const url = match ? match[0].replace(/[),.;]+$/, '') : ''
  let params = null
  let path = ''
  try {
    if (url) {
      const u = new URL(url)
      params = u.searchParams
      path = u.pathname
    }
  } catch { params = null }
  const host = (() => { try { return new URL(url).hostname.toLowerCase() } catch { return '' } })()
  const source = host.includes('2gis') ? '2gis' : host.includes('yandex') ? 'yandex' : null
  const rawCoord = params && (params.get('ll') || params.get('pt') || params.get('whatshere[point]') || params.get('m') || params.get('geo'))
  let pos = rawCoord ? coordPair(rawCoord) : null
  if (!pos && source === '2gis') {
    const geo = path.match(/\/geo\/([-\d.]+),([-\d.]+)/)
    if (geo) pos = coordPair(geo[1] + ',' + geo[2])
  }
  // A Yandex organisation URL often carries its readable slug: /maps/org/fitness-club/123/.
  let slugName = ''
  const org = path.match(/\/org\/([^/]+)/i)
  if (org && source === 'yandex' && !/^\d+$/.test(org[1])) {
    slugName = clean(decoded(org[1]).replace(/-/g, ' '))
  }
  const lines = text.split(/\r?\n/)
    .map(line => clean(url ? line.replace(url, '') : line))
    .filter(Boolean)
    .filter(line => !/^(?:2гис|2gis|яндекс\.?\s*карты|yandex maps|поделиться|share)$/i.test(line))
  let name = slugName
  let address = ''
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue
    // The maps share text usually puts the address on the same line as the name (Yandex does),
    // so find where the street part starts before falling back to the first comma.
    const at = ADDRESS_AT.exec(line)
    if (at) {
      const start = at.index + (line[at.index] === ' ' ? 1 : 0)
      const head = clean(line.slice(0, start).replace(/[,\s]+$/, ''))
      const tail = clean(line.slice(start))
      if (head) name = head
      if (!address && ADDRESS.test(tail)) address = tail
      continue
    }
    if (!name || name === slugName) { name = line; continue }
  }
  if (!url && !name && !address) return null
  return { name, address, lat: pos?.lat ?? null, lng: pos?.lng ?? null, source, url }
}
