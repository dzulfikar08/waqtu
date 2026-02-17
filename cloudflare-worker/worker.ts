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
  const itemsXml = items.map(item => `
    <item>
      <title>${item.title}</title>
      <sparkle:version>${item.version}</sparkle:version>
      <sparkle:shortVersionString>${item.shortVersionString}</sparkle:shortVersionString>
      <description><![CDATA[${item.description}]]></description>
      <pubDate>${item.pubDate}</pubDate>
      <enclosure
        url="${item.enclosureUrl}"
        sparkle:edSignature="${item.edSignature}"
        sparkle:version="${item.version}"
        length="${item.length}"
        type="application/octet-stream"
      />
    </item>`).join('');

  return `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Waqt App Updates</title>
    <link>https://waqt-updates.YOUR_SUBDOMAIN.workers.dev/</link>
    <description>Most recent Waqt releases with automatic updates.</description>
    <language>en</language>
    ${itemsXml}
  </channel>
</rss>`;
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Serve appcast.xml at root or /appcast path
    if (url.pathname === '/' || url.pathname === '/appcast.xml') {
      // TODO: Replace with KV binding or R2 for dynamic updates
      const appcast = generateAppcast([{
        title: "Version 1.0.0",
        version: "1.0.0",
        shortVersionString: "1.0.0",
        description: "Initial release with prayer time notifications.",
        pubDate: new Date().toUTCString(),
        enclosureUrl: "https://YOUR_R2_BUCKET.r2.dev/Waqt-1.0.0.dmg",
        edSignature: "PLACEHOLDER_SIGNATURE",
        length: 0
      }]);

      return new Response(appcast, {
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Cache-Control': 'public, max-age=600'
        }
      });
    }

    return new Response('Not found', { status: 404 });
  }
};
