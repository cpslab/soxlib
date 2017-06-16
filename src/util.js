// @flow
const $ = require('jquery')

const PubSubUtil = {
  extractNodeList(msg /* : any */) {
    // console.debug('got msg: ' + msg.length + ' bytes');
    const nodeArray = []
    const entry = msg.getElementsByTagName('query')
    $(entry).find('item').each(function() {
      const node = $(this).attr('node')
      if (node.indexOf('_meta') !== -1) {
        nodeArray.push(node.substr(0, node.length - 5))
      }
    })

    nodeArray.sort()
    return nodeArray
  },

  endsWithMeta(nodeName /* : string */) {
    const len = nodeName.length
    return len >= 5 && nodeName.substring(len - 5, len) === '_meta'
  },

  endsWithData(nodeName /* : string */) {
    const len = nodeName.length
    return len >= 5 && nodeName.substring(len - 5, len) === '_data'
  },
}

export default PubSubUtil
