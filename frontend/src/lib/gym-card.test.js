import { describe, expect, it } from 'vitest'
import { mapSearchUrls, parseGymCard } from './gym-card.js'

describe('map search links', () => {
  it('opens the public search, with the point that keeps it near the phone', () => {
    const urls = mapSearchUrls({ q: 'фитнес', near: { lat: 55.7, lng: 37.6 } })
    expect(urls.dgis).toBe('https://2gis.ru/search/%D1%84%D0%B8%D1%82%D0%BD%D0%B5%D1%81?m=37.6%2C55.7%2F15')
    expect(urls.yandex).toBe('https://yandex.ru/maps/?text=%D1%84%D0%B8%D1%82%D0%BD%D0%B5%D1%81&ll=37.6%2C55.7&z=15')
  })

  it('just opens the maps when there is no query yet', () => {
    expect(mapSearchUrls()).toEqual({ dgis: 'https://2gis.ru/', yandex: 'https://yandex.ru/maps/' })
  })
})

describe('a card copied from 2GIS or Yandex Maps', () => {
  it('reads a 2GIS card: the name and, when present, the link point', () => {
    expect(parseGymCard('DDX Fitness https://2gis.ru/moscow/geo/70000001000000000'))
      .toMatchObject({ name: 'DDX Fitness', address: '', source: '2gis' })
    expect(parseGymCard('Фитнес-клуб X, ул. Ленина, 1\nhttps://2gis.ru/moscow/firm/123?m=37.6,55.7/15'))
      .toMatchObject({ name: 'Фитнес-клуб X', address: 'ул. Ленина, 1', lat: 55.7, lng: 37.6, source: '2gis' })
  })

  it('reads the name, address and point from Yandex Maps share text', () => {
    const text = 'DDX Fitness Шараповский пр., вл2с3 https://yandex.ru/maps/org/ddx-fitness/123/'
    expect(parseGymCard(text)).toMatchObject({
      name: 'DDX Fitness', address: 'Шараповский пр., вл2с3', source: 'yandex', lat: null, lng: null,
    })
    const withPoint = text + '?ll=37.6,55.7'
    expect(parseGymCard(withPoint)).toMatchObject({ lat: 55.7, lng: 37.6 })
  })

  it('keeps the readable Yandex slug when the share text has only a link', () => {
    expect(parseGymCard('https://yandex.ru/maps/org/ddx-fitness/123/?ll=37.6%2C55.7'))
      .toMatchObject({ name: 'ddx fitness', lat: 55.7, lng: 37.6, source: 'yandex' })
  })

  it('does not invent a place from empty or unrelated text', () => {
    expect(parseGymCard('')).toBe(null)
    expect(parseGymCard('https://example.com/somewhere')).toEqual({
      name: '', address: '', lat: null, lng: null, source: null, url: 'https://example.com/somewhere',
    })
  })
})
