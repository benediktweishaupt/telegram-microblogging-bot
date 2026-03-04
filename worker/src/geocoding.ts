interface NominatimAddress {
  city?: string;
  town?: string;
  village?: string;
  county?: string;
  country?: string;
}

interface NominatimResponse {
  display_name?: string;
  address: NominatimAddress;
}

export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<string | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10&addressdetails=1`;

  const res = await fetch(url, {
    headers: { 'User-Agent': '360degre-es-bot/1.0' },
  });

  if (!res.ok) return null;

  const data = (await res.json()) as NominatimResponse;
  const addr = data.address;
  const city = addr.city || addr.town || addr.village || addr.county || '';
  const country = addr.country || '';

  if (city && country) return `${city}, ${country}`;

  return (
    data.display_name?.split(',').slice(0, 2).join(',').trim() || null
  );
}

export function extractCoordsFromText(
  text: string,
): { lat: number; lng: number } | null {
  const patterns = [
    /maps\.google\.com\/?\?q=([-\d.]+),([-\d.]+)/,
    /google\.com\/maps\/@([-\d.]+),([-\d.]+)/,
    /google\.com\/maps\/place\/[^/]+\/@([-\d.]+),([-\d.]+)/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1] && match[2]) {
      return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
    }
  }

  return null;
}

export async function resolveShortUrl(
  text: string,
): Promise<{ lat: number; lng: number } | null> {
  const shortPattern = /https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps)\/\S+/;
  const match = text.match(shortPattern);
  if (!match) return null;

  try {
    const res = await fetch(match[0], { redirect: 'follow' });
    return extractCoordsFromText(res.url);
  } catch {
    return null;
  }
}
