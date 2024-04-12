import { EContext } from '../helper';

export async function register(c: EContext) {
	const { subdomain } = await c.req.json<{ subdomain: string }>();
	const { results } = await c.env.DB.prepare(`select * from subdomain where subdomain = ?`).bind(subdomain).all();

	// generate a random token for the subdomain
	const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

	if (results.length === 0) {
		await c.env.DB.prepare(`insert into subdomain (subdomain,token) values (?,?)`).bind(subdomain, token).run();
		return c.json({
			success: true,
			token: token,
			message: 'Subdomain registered, keep your token safe, it will be used to authenticate your requests',
		});
	} else {
		return c.json({ success: false, message: 'Subdomain already registered' });
	}
}
