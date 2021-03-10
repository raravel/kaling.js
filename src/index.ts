import qs from 'querystring';
import { AES } from 'crypto-js';
import { parse as CookieParse } from 'tough-cookie';
import got from 'got';

export class KakaoLink {

	private readonly SHARER_LINK: string = 'https://sharer.kakao.com';
	private readonly TIARA_LINK: string = 'https://track.tiara.kakao.com';
	private readonly ACCOUNT_LINK: string = 'https://accounts.kakao.com';
	private readonly SDK_VERSION: string = '1.39.14';
	private readonly connect: any = got.extend({
		headers: {
			'user-agent': this.userAgent,
		},
	});

	private SDK_INFO: string = '';
	private p: string = '';
	private continue: string = '';
	private cookie: Record<string, unknown> = {};

	constructor(private key: string, host: string, private userAgent: string = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.66 Safari/537.36') {
		this.SDK_INFO = [
			`sdk/${this.SDK_VERSION}`,
			`os/javascript`,
			`sdk_type/javascript`,
			`lang/ko-KR`,
			`device/Linux_x86_64`,
			`origin/${qs.escape(host)}`,
		].join(' ');
	}

	private enc(text: string) {
		return AES.encrypt(text, this.p).toString();
	}

	private cooker(cookie: any) {
		const cook: Record<string, unknown> = {};
		let cookies: any = [];
		if ( cookie instanceof Array) {
			cookies = cookie.map((c) => CookieParse(c).toJSON());
		} else {
			cookies = [ CookieParse(cookie).toJSON() ];
		}

		cookies.forEach((ck: Record<string, unknown>) => {
			cook[ck.key as string] = {
				value: ck.value,
				domain: ck.domain,
			};
		});
		return cook;
	}

	private cook() {
		return Object.entries(this.cookie).map((ck: any) => `${ck[0]}=${ck[1].value}`).join('; ') + ';';
	}

	private cooking(cook: Record<string, unknown>, keys: string[]) {
		keys.forEach((k: string) => this.cookie[k] = cook[k]);
		return this.cookie;
	}

	private async req(method: string, url: string, data: any = {}, opt: Record<string, unknown> = {}) {
		method = method.toLowerCase();
		opt['json'] = data;

		const res = await this.connect[method](url, opt);
		res.cookies = this.cooker(res.headers['set-cookie']);
		res.data = res.body;

		return res;
	}

	async login(email: string, pw: string) {
		let res: any;
		res = await this.req('POST',`${this.SHARER_LINK}/talk/friends/picker/link`,{
			'app_key': this.key,
			'validation_action': 'default',
			'validation_params': '{}',
			'ka': this.SDK_INFO,
			'lcba': '',
		});

		const ckey = res.data.match(/<input.*?name="p".*?value="(.*?)".*?>/m)[1];
		const token = res.data.match(/<meta.*?name="csrf-token".*?content="(.*?)".*?>/m)[1];
		this.p = ckey;
		this.continue = res.redirectUrls[0];

		this.cooking(res.cookies, [ '_kadu', '_kadub', '_maldive_oauth_webapp_session' ]);

		res = await this.req('POST', `${this.TIARA_LINK}/queen/footsteps`);

		this.cooking(res.cookies, [ 'TIARA' ]);

		res = await this.req('POST', `${this.ACCOUNT_LINK}/weblogin/authenticate.json`, {
			'os': 'web',
			'webview_v': '2',
			'email': this.enc(email),
			'password': this.enc(pw),
			'continue': qs.unescape(this.continue.replace(`${this.ACCOUNT_LINK}/login?continue=`, '')),
			'third': 'false',
			'k': 'true',
			'authenticity_token': token,
		}, {
			headers: {
				'referer': this.continue,
				'Cookie': this.cook(),
			},
		});

		this.cooking(res.cookies, [ '_kawlt', '_kawltea', '_karmt', '_karmtea' ]);
	}

}
