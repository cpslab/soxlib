// @flow
import defaultConnManager from './manager'

export default class SoxLib {
  server /* : string */
  jid /* : string */
  password /* :string */

  constructor(server /* :string */, jid /* :string */, password /* :string */) {
    this.server = server
    this.jid = jid
    this.password = password
  }

  getNodeList = (callback /* : Function */) => {
    const conn = defaultConnManager.getConnection(
      this.server,
      this.jid,
      this.password
    )

    if (conn.isConnected()) {
      conn.getNodes(callback)
    } else {
      setTimeout(() => {
        this.getNodeList(callback)
      }, 100)
    }
  }

  getMeta = (node /* : string */, callback /* : Function */) => {
    const conn = defaultConnManager.getConnection(
      this.server,
      this.jid,
      this.password
    )

    if (conn.isConnected()) {
      conn.getMetaData(node, callback)
    } else {
      setTimeout(() => {
        this.getMeta(node, callback)
      }, 100)
    }
  }

  subscribe(
    node /* : string */,
    callback /* : Function */,
    callbackId /* : ?string */
  ) {
    const conn = defaultConnManager.getConnection(
      this.server,
      this.jid,
      this.password
    )
    if (conn.isConnected()) {
      conn.subscribe(node, callback, callbackId)
    } else {
      setTimeout(() => {
        this.subscribe(node, callback, callbackId)
      }, 100)
    }
  }

  unsubscribe(node /* : string */, callbackId /* : ?string */) {
    const conn = defaultConnManager.getConnection(
      this.server,
      this.jid,
      this.password
    )
    if (conn.isConnected()) {
      conn.unsubscribe(node, callbackId)
    } else {
      setTimeout(() => {
        this.unsubscribe(node, callbackId)
      }, 100)
    }
  }
}
