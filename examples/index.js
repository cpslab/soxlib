import SoxLib from '../src/soxlib'

const boshService = 'http://sox.ht.sfc.keio.ac.jp:5280/http-bind/'
const jid = 'guest@sox.ht.sfc.keio.ac.jp'
const password = 'miroguest'

const node = '河川カメラ千ノ川 富士見橋付近(茅ヶ崎市浜之郷付近)'
const node2 = '河川カメラ境川 境川橋付近(藤沢市鵠沼藤ヶ谷付近)'

const sox = new SoxLib(boshService, jid, password)

sox.getNodeList(x => {
  console.log(x)
})

sox.getMeta(node, x => {
  console.log(x)
})

sox.subscribe(node, (node, data) => {
  console.log(node)
  console.log(data)
})

sox.subscribe(node2, (node, data) => {
  console.log(node)
  console.log(data)
})
