// @flow
import SoxClient from './client'

class SoxConnectionManager {
  _conninfo2conn = {}
  _isConnected = {}

  getConnection(
    server /* : string */,
    jid /* : string */,
    password /* : string */
  ) {
    const key = `server=${server},jid=${jid}`

    let conn = this._conninfo2conn[key]
    if (conn === undefined) {
      conn = new SoxClient()
      // $FlowFixMe
      conn.connect(server, jid, password)
      console.debug('SoxConnectionManager: connected to server=' + server)
      this._conninfo2conn[key] = conn
      return conn
    }
    return conn
  }
}

const defaultConnManager = new SoxConnectionManager()

export default defaultConnManager
