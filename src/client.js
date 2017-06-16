// @flow
import { Strophe, $pres } from 'strophe.js'
import soxPlugin from './strophejs-plugin-sox'
import PubSubUtil from './util'

const $ = require('jquery')

Strophe.addConnectionPlugin('PubSub', soxPlugin)

const SoxPacket = {
  // '<data xmlns="http://jabber.org/protocol/sox">
  // <transducerValue id="simple" timestamp="2014-05-14T16:33:32.778352+09:00" typedValue="50"/>
  // <transducerValue id="simple2" timestamp="2014-05-14T16:33:32.778352+09:00" typedValue="60"/>
  // </data>'
  // => { simple: 50, simple2: 60, _timestamps: { simple: DateObject, simple2: DateObject } }
  parse(entry) {
    const xml = $(entry.toString())
    return SoxPacket._parseTransducerValueNode(xml)
  },

  _parseTransducerValueNode(node) {
    // args: node => should be a jQuery DOM node
    const tValues = node.find('transducerValue')
    const result = {}
    result._timestamps = {}
    for (let i = 0; i < tValues.length; i++) {
      const tv = tValues[i]
      const tId = tv.attributes.id.value
      const tValue = tv.attributes.typedValue.value

      const rawTimestamp = tv.attributes.timestamp
      if (rawTimestamp === undefined) {
        result._timestamps[tId] = new Date() // now
      } else {
        const timestamp = new Date(rawTimestamp.value)
        result._timestamps[tId] = timestamp
      }

      result[tId] = tValue
    }
    return result
  },

  parseMeta(entry) {
    // const dom = $(entry)
    const deviceNode = $(entry).find('device')[0]
    const devAttr = deviceNode.attributes

    // device meta data
    const name = devAttr.name.value
    const deviceId = devAttr.id === undefined ? undefined : devAttr.id.value
    const type = devAttr.type === undefined ? undefined : devAttr.type.value
    const serialNumber = devAttr.serialNumber === undefined
      ? undefined
      : devAttr.serialNumber.value

    // transducer names
    const transducers = SoxPacket._extractTransducersOfMeta(entry)

    const result = {
      name,
      deviceId,
      type,
      serialNumber,
      transducers,
    }
    return result
  },

  _extractTransducersOfMeta(entry) {
    const transducerIds = []
    entry = entry.toString().replace(/&lt;/g, '<')
    entry = entry.toString().replace(/&gt;/g, '>')
    entry = entry.toString().replace(/&apos;/g, "'")
    $(entry).find('transducer').each(function() {
      const _id = $(this).attr('id')
      transducerIds.push(_id)
    })

    return transducerIds
  },
}

export default function SoxClient() {
  const that = this

  this._connection = null // will be set by connect()
  this._metaLastItemDispatchTable = {}
  this._metaPubItemDispatchTable = {}
  this._dataLastItemDispatchTable = {}
  this._dataPubItemDispatchTable = {}
  this._getNodesCallback = null
  this._fullyConnected = false

  this._boshService = null
  this._jid = null
  this._password = null

  this.isConnected = function() {
    return that._fullyConnected
  }

  this.connect = function(boshService, jid, password) {
    that._boshService = boshService
    that._jid = jid
    that._password = password

    const conn = new Strophe.Connection(boshService)
    conn.rawInput = that.onRawInput
    conn.rawOutput = that.onRawOutput
    conn.connect(jid, password, that._onConnectionStatusUpdate)
    that._connection = conn
  }

  this.getNodes = function(callback) {
    // exposed API
    const conn = that._connection

    const onNodesHandler = function(msg) {
      // console.debug('primitive nodelist handler called');
      const nodes = PubSubUtil.extractNodeList(msg)
      // console.debug('primitive nodelist handler: parse finished');
      callback(nodes, that._boshService)
    }

    conn.addHandler(onNodesHandler, null, 'iq', 'result', null, null)
    conn.PubSub.discoverNodes()
  }

  this.getMetaData = function(node, callback) {
    // exposed API
    if (PubSubUtil.endsWithMeta(node)) {
      // NOTE: node doesn't require "_meta"
      console.warn("You don't have to add _meta to getMetaData() arg: " + node)
      return
    }

    const realNode = node + '_meta'
    const table = that._metaLastItemDispatchTable
    const handlers = table[realNode]
    if (handlers === undefined || handlers.length === 0) {
      table[realNode] = [{ disposable: true, callback }]
      that._connection.PubSub.subscribe(realNode)
    } else {
      handlers.push({ disposable: true, callback })
    }
  }

  this.subscribe = function(node, callback, callbackId) {
    // exposed API
    if (callbackId === undefined) {
      console.warn('subscribe(): callbackId is undefined')
    }
    if (PubSubUtil.endsWithData(node)) {
      // NOTE: node doesn't require "_data"
      console.warn("You don't have to add _data to subscribe() arg: " + node)
      return
    }

    const realNode = node + '_data'
    const table = that._dataPubItemDispatchTable
    const handlers = table[realNode]
    if (handlers === undefined || handlers.length === 0) {
      table[realNode] = [{ id: callbackId, callback, disposable: false }]
      that._connection.PubSub.subscribe(realNode)
    } else {
      handlers.push({ id: callbackId, callback })
    }
  }

  this.unsubscribe = function(node, callbackId) {
    // exposed API
    if (callbackId === undefined) {
      console.warn('subscribe(): callbackId is undefined')
    }
    if (PubSubUtil.endsWithData(node)) {
      // NOTE: node doesn't require "_data"
      console.warn("You don't have to add _data to unsubscribe() arg: " + node)
      return
    }

    const realNode = node + '_data'

    const table = that._dataPubItemDispatchTable
    const handlers = table[realNode]
    if (handlers === undefined || handlers.length === 0) {
      return
    }
    const newHandlers = []
    for (let i = 0; i < handlers.length; i++) {
      const handler = handlers[i]
      if (handler.id !== callbackId) {
        newHandlers.push(handler)
      }
    }
    table[realNode] = newHandlers
    if (newHandlers.length === 0) {
      that._connection.PubSub.unsubscribe(realNode)
    }
  }

  // API user can override these method!
  this.onRawInput = function() {}
  this.onRawOutput = function() {}
  this.onConnConnecting = function() {}
  this.onConnFail = function() {}
  this.onConnDisconnecting = function() {}
  this.onConnDisconnected = function() {}
  this.onConnConnected = function() {}

  this._setHandlers = function() {
    // register last-item/published-item callbacks to connection
    that._connection.PubSub.bind(
      'xmpp:pubsub:last-published-item',
      that._onLastPublishedItemReceived
    )

    that._connection.PubSub.bind(
      'xmpp:pubsub:item-published',
      that._onPublishedItemReceived
    )
  }

  this._onConnectionStatusUpdate = function(status) {
    if (status === Strophe.Status.CONNECTING) {
      console.debug('SoxConnection: connecting...')
      that.onConnConnecting()
    } else if (status === Strophe.Status.CONNFAIL) {
      console.error('SoxConnection: connfail')
      that.onConnFail()
    } else if (status === Strophe.Status.DISCONNECTING) {
      console.debug('SoxConnection: disconnecting...')
      that.onConnDisconnecting()
    } else if (status === Strophe.Status.DISCONNECTED) {
      console.debug('SoxConnection: disconnected!')
      that.onConnDisconnected()
    } else if (status === Strophe.Status.CONNECTED) {
      that._connection.send($pres().c('priority').t('-1'))

      that._setHandlers() // set PubSub callback
      that.onConnConnected()
      that._fullyConnected = true
      console.debug('SoxConnection: fully connected!')
    }
    return true
  }

  this._onLastPublishedItemReceived = function(obj) {
    if (PubSubUtil.endsWithMeta(obj.node)) {
      that._dispatchMetaLast(obj)
    } else if (PubSubUtil.endsWithData(obj.node)) {
      that._dispatchDataPub(obj)
    } else {
      console.warn(
        `unknown node data for _onLastPublishedItemReceived: ${obj.node}`
      )
    }
  }

  this._onPublishedItemReceived = function(obj) {
    if (PubSubUtil.endsWithMeta(obj.node)) {
      that._dispatchMetaPub(obj)
    } else if (PubSubUtil.endsWithData(obj.node)) {
      that._dispatchDataPub(obj)
    } else {
      console.warn(
        `unknown node data for _onPublishedItemReceived: ${obj.node}`
      )
    }
  }

  this._dispatchMetaLast = function(obj) {
    // console.debug('dispatchMetaLast');
    that._dispatch(that._metaLastItemDispatchTable, obj, false)
  }

  this._dispatchMetaPub = function(obj) {
    // console.debug('dispatchMetaPub');
    that._dispatch(that._metaPubItemDispatchTable, obj, false)
  }

  this._dispatchDataPub = function(obj) {
    // console.debug('dispatchDataPub');
    that._dispatch(that._dataPubItemDispatchTable, obj, true)
  }

  this._dispatch = function(table, obj, isData) {
    // available: obj.node, obj.id, obj.entry, obj.timestamp
    let i
    const node = obj.node
    // console.debug('dispatching, node=' + obj.node);
    // node = node.substring(0, node.length - 5);  // 'hogege_meta' => 'hogege'

    // console.debug('table=' + Object.keys(table));
    const handlers = table[node]
    // console.debug('after dumping table');
    if (handlers !== undefined && handlers.length > 0) {
      // console.debug('dispatching: handlers.length=' + handlers.length);
      const data = isData
        ? SoxPacket.parse(obj.entry)
        : SoxPacket.parseMeta(obj.entry)
      // console.debug('data parse ok');
      const newHandlers = []

      for (i = 0; i < handlers.length; i++) {
        const handler = handlers[i]
        // console.debug('handler=' + handler);
        const callback = handler.callback
        // console.debug('calling callback i=' + i);
        // console.debug('callback calling for node=' + node + ', data=' + JSON.stringify(data));
        console.debug('callback calling for node=' + node)
        callback(node, data, that._boshService)
        console.debug('callback called')
        // console.debug('calling callback i=' + i + ': finished');

        if (!handler.disposable) {
          newHandlers.push(handler)
        }
      }

      table[node] = newHandlers
      if (newHandlers.length === 0) {
        that._connection.PubSub.unsubscribe(obj.node)
      }
    } else {
      console.warn(`_dispatch() called with unregistered node: ${obj.node}`)
    }
  }
}
