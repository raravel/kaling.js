import qs from 'querystring';
import { AES } from 'crypto-js';
import { parse as CookieParse } from 'tough-cookie';
import got from 'got';

import fs from 'fs';

export class KakaoLink {

	private readonly SHARER_LINK: string = 'https://sharer.kakao.com';
	private readonly TIARA_LINK: string = 'https://track.tiara.kakao.com';
	private readonly ACCOUNT_LINK: string = 'https://accounts.kakao.com';
	private readonly SDK_VERSION: string = '1.39.14';
	private readonly connect: any = got.extend({
		headers: {
			'user-agent': this.userAgent,
		},
		hooks: {
			beforeError: [
				(error: any) => {
					const { response } = error;
					console.log(error, response.body);
					return error;
				},
			],
		},
	});

	private SDK_INFO: string = '';
	private p: string = '';
	private continue: string = '';
	private cookie: Record<string, unknown> = {};
	private ver: string = '4.0';

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

	get version() {
		return this.ver;
	}

	set version(val: string) {
		this.ver = val;
	}

	private validateEmail(email: string) {
		const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
		return re.test(email.toLowerCase());
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

	private cook(filter?: string[]) {
		const entries = Object.entries(this.cookie);
		const cookie: string[] = [];
		for ( const [key, val] of entries ){
			if ( filter ) {
				if ( filter.includes(key) ) {
					cookie.push(`${key}=${(val as any).value}`);
				}
			} else {
				cookie.push(`${key}=${(val as any).value}`);
			}
		}
		return cookie.join('; ') + ';';
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

	private async picker(action: string = 'default', params: Record<string, unknown> = {}) {
		const opt: Record<string, unknown> = {};

		const cookie = this.cook([ '_kadu', 'TIARA', '_kawlt', '_kawltea', '_karmt', '_karmtea' ]);
		if ( cookie && this.continue ) {
			opt['headers'] = {
				'referer': this.continue,
				'Cookie': cookie,
			};
		}

		return await this.req('POST',`${this.SHARER_LINK}/talk/friends/picker/link`, {
			'app_key': this.key,
			'validation_action': action,
			'validation_params': JSON.stringify(params),
			'ka': this.SDK_INFO,
			'lcba': '',
		}, opt);
	}

	public async login(email: string, pw: string) {
		let res: any;

		if ( !this.validateEmail(email) ) {
			email += '@kakao.com';
		}

		res = await this.picker();

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

		return this;
	}

	public async send(room_title: string, template: Record<string, unknown>) {
		let res: any;

		if ( !template['link_ver'] ) {
			template['link_ver'] = this.version;
		}

		res = await this.picker('custom', template);
	}

}
