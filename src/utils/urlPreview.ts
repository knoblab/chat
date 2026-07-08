import { MatrixClient } from 'matrix-js-sdk';

export interface LinkPreviewData {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  url: string;
}

// Precise regular expression to match HTTP/HTTPS URLs (including single-label hostnames like localhost) and avoid capturing trailing punctuation like period or comma.
export const URL_REGEX = /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}(?:\.[a-zA-Z0-9()]{1,6})?\b(?:[-a-zA-Z0-9()@:%_+.~#?&//=]*[a-zA-Z0-9()@:%_+~#=/])?/gi;

const previewCache = new Map<string, LinkPreviewData | null>();

/**
 * Fetches Open Graph metadata for a given URL using the Matrix homeserver's preview API.
 * Uses an in-memory cache to prevent redundant network requests.
 */
export const fetchLinkPreview = async (
  client: MatrixClient | null,
  url: string
): Promise<LinkPreviewData | null> => {
  if (!client) return null;
  if (previewCache.has(url)) {
    return previewCache.get(url)!;
  }

  try {
    const token = client.getAccessToken();
    const baseUrl = client.baseUrl;
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const previewUrlParam = encodeURIComponent(url);
    const endpoints = [
      `${baseUrl}/_matrix/media/v3/preview_url?url=${previewUrlParam}`,
      `${baseUrl}/_matrix/media/r0/preview_url?url=${previewUrlParam}`,
    ];

    let data: any = null;
    let success = false;

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, { headers });
        if (response.ok) {
          data = await response.json();
          success = true;
          break;
        }
      } catch (err) {
        console.warn(`Failed fetching preview from ${endpoint}:`, err);
      }
    }

    if (!success || !data) {
      previewCache.set(url, null);
      return null;
    }

    const previewData: LinkPreviewData = {
      title: data['og:title'] || data['title'],
      description: data['og:description'] || data['description'],
      image: data['og:image'] || data['matrix:image:url'],
      siteName: data['og:site_name'],
      url,
    };

    // Cache the result if we have a title or description
    if (previewData.title || previewData.description) {
      previewCache.set(url, previewData);
      return previewData;
    }

    previewCache.set(url, null);
    return null;
  } catch (err) {
    console.warn(`URL preview failed for ${url}:`, err);
    previewCache.set(url, null);
    return null;
  }
};
