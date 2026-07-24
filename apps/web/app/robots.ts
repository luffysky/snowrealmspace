import type { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://snowrealm-space.snowrealm.pet'

/**
 * 封閉測試（邀請制 + 站台閘門）階段：只放行公開的法律頁，其餘不索引。
 * 對外開放時把 disallow 改成 allow all。
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: ['/privacy', '/terms'], disallow: '/' }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
