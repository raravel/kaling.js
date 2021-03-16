# Kaling.js
<a href="https://developers.kakao.com/docs/latest/ko/message/common#kakaolink" target="_blank">
    <p align="center">
        <img src="https://t1.kakaocdn.net/kakaocorp/Kakao/kakaocom/assets/link/h2_kakaolink.png"> 
    </p>
</a>

## Install

```bash
npm install kaling.js
```

## Usage

<br>

### Simple Use
```javascript
import { KakaoLink } from 'kaling.js';

(async () => {
    const kaling = new KakaoLink('Your Kakao Deveoper App Key', 'Your Host Url');
	await kaling.login('Your Kakao Id', 'Your Kakao Password');
	await kaling.send('Chat Room Title', {
        template_id: KakaoLink Template Id,
        template_args: {
            // KakaoLink Template Argument
        }
    });
})();
```

<br>

### Set Link_Ver
```javascript
kaling.version = "x.x"; // default "4.0"
```
