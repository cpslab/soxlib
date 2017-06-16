# soxlib [![Build Status](https://travis-ci.org/akameco/soxlib.svg?branch=master)](https://travis-ci.org/akameco/soxlib)

> sox client

## Install

```
$ yarn add soxlib
```

or

```
$ npm install soxlib
```

## Usage

```js
import Soxlib from 'soxlib'

const boshService = 'http://sox.ht.sfc.keio.ac.jp:5280/http-bind/'
const jid = 'guest@sox.ht.sfc.keio.ac.jp'
const password = 'miroguest'

const sox = new SoxLib(boshService, jid, password)

sox.getNodeList(nodes => {
  console.log(nodes)
  // => ["   横浜　天気　温度", " 温度　横浜", "24時間降水量-えびの", "24時間降水量-えりも岬", ...]
})

const node = '河川カメラ千ノ川 富士見橋付近(茅ヶ崎市浜之郷付近)'

sox.getMeta(node, meta => {
  console.log(meta)
  // => 河川カメラ千ノ川 富士見橋付近(茅ヶ崎市浜之郷付近)_meta
})

sox.subscribe(node, (info, data) => {
  console.log(info) // => 河川カメラ千ノ川 富士見橋付近(茅ヶ崎市浜之郷付近)_data
  console.log(data)
  /* =>
  {
    _timestamp: Object,
    image: 'data:image/jpeg....',
    "imagedate": "2016/03/08 03:28",
    "latitude": "35.3428771",
    "url": "http://www.pref.kanagawa.jp/sys/suibou/web_general/suibou_joho/camera/camera.htm?screenId=100000000025",
    "longitude": "139.39323330000002"
  }
  **/
})
```


## API

### SoxLib(boshService, jid, password)

#### boshService
#### jid
#### password

Type: `string`

### sox#subscribe()

### sox#unsubscribe()

### sox#getMeta()

### sox#getNodeList()


## Dev

```
$ npm run dev
```

```
$ npm start
```

## License

MIT © [akameco](http://akameco.github.io)
