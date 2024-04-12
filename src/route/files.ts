import { EContext, validateRequest } from '../helper';

export async function getFile(c: EContext) {
	const path = c.req.param('path');
	const subdomain = c.req.param('subdomain');
	const key = `${subdomain}/${path}`;
	const object = await c.env.EIDOS_PUBLISH_BUCKET.get(key);
	if (object === null) {
		return c.text('Not Found', {
			status: 404,
			headers: { 'Content-Type': 'text/plain' },
		});
	}
	const headers = new Headers();
	object.writeHttpMetadata(headers);
	headers.set('etag', object.httpEtag);
	headers.set('uploaded', object.uploaded.toISOString());
	return new Response(object.body, {
		headers,
	});
}

export async function uploadFile(c: EContext) {
	const subdomain = c.req.param('subdomain');
	const path = c.req.param('path');
	const valid = await validateRequest(subdomain, c);
	if (!valid) {
		return c.json({ success: false, message: 'authentication failed' });
	}
	const key = `${subdomain}/${path}`;
	await c.env.EIDOS_PUBLISH_BUCKET.put(key, c.req.raw.body);
	return c.json({ success: true });
}

export async function checkFile(c: EContext) {
	const path = c.req.param('path');
	const subdomain = c.req.param('subdomain');
	const key = `${subdomain}/${path}`;
	const object = await c.env.EIDOS_PUBLISH_BUCKET.get(key);
	if (object === null) {
		return c.json({ success: false, message: 'File not found' });
	}
	return c.json({ success: true });
}
