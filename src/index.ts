import qs from 'querystring';
import { AES } from 'crypto-js';
import { parse as CookieParse } from 'tough-cookie';
import got from 'got';

import fs from 'fs';

type Json = Record<string, unknown>;

const unescapeHTML = (str: string) => str.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, '\'').replace(/&amp;/g, '&');

export class KakaoLink {

	private readonly SHARER_LINK: string = 'https://sharer.kakao.com';
	private readonly TIARA_LINK: string = 'https://track.tiara.kakao.com';
	private readonly ACCOUNT_LINK: string = 'https://accounts.kakao.com';
	private readonly PICKER_LINK: string = `${this.SHARER_LINK}/talk/friends/picker/link`;
	private readonly SDK_VERSION: string = '1.39.14';
	private readonly connect: any = got.extend({
		headers: {
			'user-agent': this.userAgent,
		},
		hooks: {
			beforeError: [
				(error: any) => {
					const { response } = error;
					console.log(response);
					return error;
				},
			],
		},
	});

	private SDK_INFO: string = '';
	private p: string = '';
	private continue: string = '';
	private cookie: Json = {};
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
			if ( cookie ) {
				cookies = [ CookieParse(cookie).toJSON() ];
			}
		}

		cookies.forEach((ck: Json) => {
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

	private cooking(cook: Json, keys: string[]) {
		keys.forEach((k: string) => this.cookie[k] = cook[k]);
		return this.cookie;
	}

	private async req(method: string, url: string, data: any = {}, opt: Json = {}) {
		method = method.toLowerCase();

		if ( Object.keys(data).length ) {
			opt['json'] = data;
		}

		const res = await this.connect[method](url, opt);
		res.cookies = this.cooker(res.headers['set-cookie']);
		res.data = res.body;

		return res;
	}

	private async picker(action: string = 'default', params: Json = {}) {
		const opt: Json = {};

		const cookie = this.cook([ '_kadu', 'TIARA', '_kawlt', '_kawltea', '_karmt', '_karmtea' ]);
		if ( cookie && this.continue ) {
			opt['headers'] = {
				'referer': this.continue,
				'Cookie': cookie,
			};
		}

		return await this.req('POST', this.PICKER_LINK, {
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
				'Referer': this.continue,
				'Cookie': this.cook(),
			},
		});

		this.cooking(res.cookies, [ '_kawlt', '_kawltea', '_karmt', '_karmtea' ]);

		return this;
	}

	public async send(roomTitle: string, template: Json) {
		let res: any;

		if ( !template['link_ver'] ) {
			template['link_ver'] = this.version;
		}

		res = await this.picker('custom', template);

		this.cooking(res.cookies, [ 'KSHARER', 'using' ]);

		const tmpStr = res.data.match(/<input.*?value="(.*?)".*?id="validatedTalkLink".*?>/m)[1];
		template = JSON.parse(unescapeHTML(tmpStr));

		const token = res.data.match(/<div.*?ng-init="token='(.*?)'".*?>/m)[1];

		res = await this.req('GET', `${this.SHARER_LINK}/api/talk/chats`, {}, {
			headers: {
				'Referer': this.PICKER_LINK,
				'Csrf-Token': token,
				'App-Key': this.key,
				'Cookie': this.cook(),
			},
		});

		const { securityKey, chats } = JSON.parse(res.data);
		const room = chats.find((c: Json) => c['title'] === roomTitle);

		if ( !room ) return false;

		res = await this.req('POST', `${this.SHARER_LINK}/api/talk/message/link`, {
			'validatedTalkLink': template,
			securityKey,
			'receiverType': 'chat',
			'receiverIds': [ room.id ],
			'receiverChatRoomMemberCount': [ 1 ],
		}, {
			headers: {
				'Referer': this.PICKER_LINK,
				'Csrf-Token': token,
				'App-Key': this.key,
				'Cookie': this.cook([ '_kadu', 'TIARA', '_kawlt', '_kawltea', '_karmt', '_karmtea', 'KSHARER', 'using' ]),
			},
		});

		return true;
	}

}
