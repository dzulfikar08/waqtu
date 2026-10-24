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

const POLAR_API = 'https://api.polar.sh/v1';

async function polarActivate(
  key: string,
  deviceId: string,
  orgId: string,
  token: string
): Promise<{ activation_id?: string; error?: string }> {
  const res = await fetch(`${POLAR_API}/customer-portal/license-keys/activate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      key: key.trim(),
      organization_id: orgId,
      label: deviceId,
      meta: { device_id: deviceId },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    return { error: t || `Activate failed: ${res.status}` };
  }
  const data = (await res.json()) as { id?: string };
  return { activation_id: data.id };
}

async function polarValidate(
  key: string,
  activationId: string,
  orgId: string,
  token: string
): Promise<{ valid: boolean; error?: string }> {
  const res = await fetch(`${POLAR_API}/customer-portal/license-keys/validate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      key: key.trim(),
      organization_id: orgId,
      activation_id: activationId,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    return { valid: false, error: t || `Validate failed: ${res.status}` };
  }
  return { valid: true };
}

export default {
  async fetch(
    request: Request,
    env: {
      DB: D1Database;
      POLAR_ACCESS_TOKEN?: string;
      POLAR_ORG_ID?: string;
    }
  ): Promise<Response> {
    const url = new URL(request.url);

    // Redirect to latest DMG (for landing page "Download for Mac" link)
    if (request.method === 'GET' && url.pathname === '/latest') {
      try {
        const { results } = await env.DB.prepare(
          'SELECT enclosure_url FROM releases ORDER BY version DESC LIMIT 1'
        )
          .all<{ enclosure_url: string }>();
        const latest = results?.[0];
        if (latest?.enclosure_url) {
          return Response.redirect(latest.enclosure_url, 302);
        }
      } catch (e) {
        console.error('Latest redirect error:', e);
      }
      return new Response('No release found', { status: 404 });
    }

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

    if (request.method === 'POST' && url.pathname === '/license/activate') {
      const token = env.POLAR_ACCESS_TOKEN;
      const orgId = env.POLAR_ORG_ID;
      if (!token || !orgId) {
        return Response.json({ valid: false, error: 'License server not configured' }, { status: 500 });
      }
      let body: { key?: string; device_id?: string };
      try {
        body = (await request.json()) as { key?: string; device_id?: string };
      } catch {
        return Response.json({ valid: false, error: 'Invalid JSON' }, { status: 400 });
      }
      const key = body.key;
      const deviceId = body.device_id;
      if (!key || !deviceId) {
        return Response.json({ valid: false, error: 'key and device_id required' }, { status: 400 });
      }
      const result = await polarActivate(key, deviceId, orgId, token);
      if (result.error) {
        return Response.json({ valid: false, error: result.error }, { status: 200 });
      }
      return Response.json({ valid: true, activation_id: result.activation_id });
    }

    if (request.method === 'POST' && url.pathname === '/license/validate') {
      const token = env.POLAR_ACCESS_TOKEN;
      const orgId = env.POLAR_ORG_ID;
      if (!token || !orgId) {
        return Response.json({ valid: false, error: 'License server not configured' }, { status: 500 });
      }
      let body: { key?: string; device_id?: string; activation_id?: string };
      try {
        body = (await request.json()) as { key?: string; device_id?: string; activation_id?: string };
      } catch {
        return Response.json({ valid: false, error: 'Invalid JSON' }, { status: 400 });
      }
      const { key, activation_id } = body;
      if (!key || !activation_id) {
        return Response.json({ valid: false, error: 'key and activation_id required' }, { status: 400 });
      }
      const result = await polarValidate(key, activation_id, orgId, token);
      if (!result.valid) {
        return Response.json({ valid: false, error: result.error }, { status: 200 });
      }
      return Response.json({ valid: true });
    }

    return new Response('Not found', { status: 404 });
  },
};
