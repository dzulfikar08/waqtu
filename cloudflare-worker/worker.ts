interface D1Database {
  prepare(query: string): {
    all<T>(): Promise<{ results: T[] }>;
  };
}

interface AppcastItem {
  title: string;
  version: string;
  shortVersionString: string;
  description: string;
  pubDate: string;
  enclosureUrl: string;
  edSignature: string;
  length: number;
}

function generateAppcast(items: AppcastItem[]): string {
  const itemsXml = items
    .map(
      (item) => `
    <item>
      <title>${escapeXml(item.title)}</title>
      <sparkle:version>${escapeXml(item.version)}</sparkle:version>
      <sparkle:shortVersionString>${escapeXml(item.shortVersionString)}</sparkle:shortVersionString>
      <description><![CDATA[${item.description}]]></description>
      <pubDate>${item.pubDate}</pubDate>
      <enclosure
        url="${escapeXml(item.enclosureUrl)}"
        sparkle:edSignature="${escapeXml(item.edSignature)}"
        sparkle:version="${escapeXml(item.version)}"
        length="${item.length}"
        type="application/octet-stream"
      />
    </item>`
    )
    .join('');

  return `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Waqtu App Updates</title>
    <link>https://waqt-updates.dzulfikar-at.workers.dev/</link>
    <description>Most recent Waqtu releases with automatic updates.</description>
    <language>en</language>
    ${itemsXml}
  </channel>
</rss>`;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export default {
  async fetch(
    request: Request,
    env: { DB: D1Database }
  ): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/' || url.pathname === '/appcast.xml') {
      try {
        const { results } = await env.DB.prepare(
          'SELECT version, short_version_string, title, description, enclosure_url, ed_signature, length, pub_date FROM releases ORDER BY version DESC'
        )
          .all<{
            version: number;
            short_version_string: string;
            title: string;
            description: string;
            enclosure_url: string;
            ed_signature: string;
            length: number;
            pub_date: string;
          }>();

        const items: AppcastItem[] = (results ?? []).map((row) => ({
          title: row.title,
          version: String(row.version),
          shortVersionString: row.short_version_string,
          description: row.description,
          pubDate: row.pub_date,
          enclosureUrl: row.enclosure_url,
          edSignature: row.ed_signature,
          length: row.length,
        }));

        const appcast = generateAppcast(items);

        return new Response(appcast, {
          headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=600',
          },
        });
      } catch (e) {
        console.error('Appcast error:', e);
        return new Response(
          '<?xml version="1.0"?><rss version="2.0"><channel><title>Waqtu Updates</title><item></item></channel></rss>',
          {
            status: 200,
            headers: { 'Content-Type': 'application/xml; charset=utf-8' },
          }
        );
      }
    }

    return new Response('Not found', { status: 404 });
  },
};
