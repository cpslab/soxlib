const { Strophe, $iq, $build } = require('strophe.js')

const $ = require('jquery')
const _ = require('underscore')
const Backbone = require('backbone')

export default {
  _connection: null,
  service: null,
  events: {},

  // **init** adds the various namespaces we use and extends the component
  // from **Backbone.Events**.
  init(connection /* : Function */) {
    this._connection = connection
    Strophe.addNamespace('PUBSUB', 'http://jabber.org/protocol/pubsub')
    Strophe.addNamespace('PUBSUB_EVENT', Strophe.NS.PUBSUB + '#event')
    Strophe.addNamespace('PUBSUB_OWNER', Strophe.NS.PUBSUB + '#owner')
    Strophe.addNamespace(
      'PUBSUB_NODE_CONFIG',
      Strophe.NS.PUBSUB + '#node_config'
    )
    Strophe.addNamespace('ATOM', 'http://www.w3.org/2005/Atom')
    Strophe.addNamespace('DELAY', 'urn:xmpp:delay')
    Strophe.addNamespace('RSM', 'http://jabber.org/protocol/rsm')
    _.extend(this, Backbone.Events)
  },

  // Register to PEP events when connected
  statusChanged(status) {
    if (
      status === Strophe.Status.CONNECTED ||
      status === Strophe.Status.ATTACHED
    ) {
      this.service = 'pubsub.' + Strophe.getDomainFromJid(this._connection.jid)
      this._connection.addHandler(
        this._onReceivePEPEvent.bind(this),
        null,
        'message',
        null,
        null,
        this.service
      )
    }
  },

  // Handle PEP events and trigger own events.
  _onReceivePEPEvent(ev) {
    const self = this
    const delay = $('delay[xmlns="' + Strophe.NS.DELAY + '"]', ev).attr('stamp')

    $('item', ev).each((idx, item) => {
      const node = $(item).parent().attr('node')
      const id = $(item).attr('id')
      const entry = Strophe.serialize($(item)[0])

      if (delay) {
        // PEP event for the last-published item on a node.
        self.trigger('xmpp:pubsub:last-published-item', {
          node,
          id,
          entry,
          timestamp: delay,
        })
        self.trigger('xmpp:pubsub:last-published-item:' + node, {
          id,
          entry,
          timestamp: delay,
        })
      } else {
        // PEP event for an item newly published on a node.
        self.trigger('xmpp:pubsub:item-published', {
          node,
          id,
          entry,
        })
        self.trigger('xmpp:pubsub:item-published:' + node, {
          id,
          entry,
        })
      }
    })

    // PEP event for the item deleted from a node.
    $('retract', ev).each((idx, item) => {
      const node = $(item).parent().attr('node')
      const id = $(item).attr('id')
      self.trigger('xmpp:pubsub:item-deleted', {
        node,
        id,
      })
      self.trigger('xmpp:pubsub:item-deleted:' + node, {
        id,
      })
    })

    return true
  },

  // **createNode** creates a PubSub node with id `node` with configuration options defined by `options`.
  // See [http://xmpp.org/extensions/xep-0060.html#owner-create](http://xmpp.org/extensions/xep-0060.html#owner-create)
  createNode(node, options) {
    const d = $.Deferred() // eslint-disable-line
    const iq = $iq({
      to: this.service,
      type: 'set',
      id: this._connection.getUniqueId('pubsub'),
    })
      .c('pubsub', {
        xmlns: Strophe.NS.PUBSUB,
      })
      .c('create', {
        node,
      })
    const fields = []
    let form

    if (options) {
      fields.push(
        new Strophe.x.Field({
          var: 'FORM_TYPE',
          type: 'hidden',
          value: Strophe.NS.PUBSUB_NODE_CONFIG,
        })
      )
      _.each(options, (value, option) => {
        fields.push(
          new Strophe.x.Field({
            var: option,
            value,
          })
        )
      })
      form = new Strophe.x.Form({
        type: 'submit',
        fields,
      })
      iq.up().c('configure').cnode(form.toXML())
    }
    this._connection.sendIQ(iq.tree(), d.resolve, d.reject)
    return d.promise()
  },

  // **deleteNode** deletes the PubSub node with id `node`.
  // See [http://xmpp.org/extensions/xep-0060.html#owner-delete](http://xmpp.org/extensions/xep-0060.html#owner-delete)
  deleteNode(node) {
    const d = $.Deferred() // eslint-disable-line
    const iq = $iq({
      to: this.service,
      type: 'set',
      id: this._connection.getUniqueId('pubsub'),
    })
      .c('pubsub', {
        xmlns: Strophe.NS.PUBSUB_OWNER,
      })
      .c('delete', {
        node,
      })

    this._connection.sendIQ(iq.tree(), d.resolve, d.reject)
    return d.promise()
  },

  // **getNodeConfig** returns the node's with id `node` configuration options in JSON format.
  // See [http://xmpp.org/extensions/xep-0060.html#owner-configure](http://xmpp.org/extensions/xep-0060.html#owner-configure)
  getNodeConfig(node) {
    const d = $.Deferred() // eslint-disable-line
    const iq = $iq({
      to: this.service,
      type: 'get',
      id: this._connection.getUniqueId('pubsub'),
    })
      .c('pubsub', {
        xmlns: Strophe.NS.PUBSUB_OWNER,
      })
      .c('configure', {
        node,
      })
    let form

    this._connection.sendIQ(
      iq.tree(),
      result => {
        form = Strophe.x.Form.fromXML($('x', result))
        d.resolve(form.toJSON().fields)
      },
      d.reject
    )
    return d.promise()
  },

  // **discoverNodes** returns the nodes of a *Collection* node with id `node`.
  // If `node` is not passed, the nodes of the root node on the service are returned instead.
  // See [http://xmpp.org/extensions/xep-0060.html#entity-nodes](http://xmpp.org/extensions/xep-0060.html#entity-nodes)
  discoverNodes(node) {
    const d = $.Deferred() // eslint-disable-line
    const iq = $iq({
      to: this.service,
      type: 'get',
      id: this._connection.getUniqueId('pubsub'),
    })

    if (node) {
      iq.c('query', {
        xmlns: Strophe.NS.DISCO_ITEMS,
        node,
      })
    } else {
      iq.c('query', {
        xmlns: Strophe.NS.DISCO_ITEMS,
      })
    }
    this._connection.sendIQ(
      iq.tree(),
      result => {
        d.resolve(
          $.map($('item', result), item => {
            return $(item).attr('node')
          })
        )
      },
      d.reject
    )
    return d.promise()
  },

  // **publish** publishes `item`, an XML tree typically built with **$build** to the node specific by `node`.
  // Optionally, takes `item_id` as the desired id of the item.
  // Resolves on success to the id of the item on the node.
  // See [http://xmpp.org/extensions/xep-0060.html#publisher-publish](http://xmpp.org/extensions/xep-0060.html#publisher-publish)
  publish(node, item, itemId) {
    const d = $.Deferred() // eslint-disable-line
    const iq = $iq({
      to: this.service,
      type: 'set',
      id: this._connection.getUniqueId('pubsub'),
    })
      .c('pubsub', {
        xmlns: Strophe.NS.PUBSUB,
      })
      .c('publish', {
        node,
      })
      .c(
        'item',
        itemId
          ? {
              id: itemId,
            }
          : {}
      )
      .cnode(item)
    this._connection.sendIQ(
      iq.tree(),
      result => {
        d.resolve($('item', result).attr('id'))
      },
      d.reject
    )
    return d.promise()
  },

  // **publishAtom** publishes a JSON object as an ATOM entry.
  publishAtom(node, json, itemId) {
    json.updated = json.updated || this._ISODateString(new Date())
    return this.publish(node, this._JsonToAtom(json), itemId)
  },

  // **deleteItem** deletes the item with id `item_id` from the node with id `node`.
  // `notify` specifies whether the service should notify all subscribers with a PEP event.
  // See [http://xmpp.org/extensions/xep-0060.html#publisher-delete](http://xmpp.org/extensions/xep-0060.html#publisher-delete)
  deleteItem(node, itemId, notify) {
    notify = notify || true
    const d = $.Deferred() // eslint-disable-line
    const iq = $iq({
      to: this.service,
      type: 'set',
      id: this._connection.getUniqueId('pubsub'),
    })
      .c('pubsub', {
        xmlns: Strophe.NS.PUBSUB,
      })
      .c(
        'retract',
        notify
          ? {
              node,
              notify: 'true',
            }
          : {
              node,
            }
      )
      .c('item', {
        id: itemId,
      })
    this._connection.sendIQ(iq.tree(), d.resolve, d.reject)
    return d.promise()
  },

  // **items** retrieves the items from the node with id `node`.
  // Optionally, you can specify `max_items` to retrieve a maximum number of items,
  // or a list of item ids with `item_ids` in `options` parameters.
  // See [http://xmpp.org/extensions/xep-0060.html#subscriber-retrieve](http://xmpp.org/extensions/xep-0060.html#subscriber-retrieve)
  // Resolves with an array of items.
  // Also if your server supports [Result Set Management](http://xmpp.org/extensions/xep-0059.html)
  // on PubSub nodes, you can pass in options an `rsm` object literal with `before`, `after`, `max` parameters.
  // You cannot specify both `rsm` and `max_items` or `items_ids`.
  // Requesting with `rsm` will resolve with an object literal with `items` providing a list of the items retrieved,
  // and `rsm` with `last`, `first`, `count` properties.

  items(node, options) {
    const d = $.Deferred() // eslint-disable-line
    const iq = $iq({
      to: this.service,
      type: 'get',
    })
      .c('pubsub', {
        xmlns: Strophe.NS.PUBSUB,
      })
      .c('items', {
        node,
      })

    options = options || {}

    if (options.rsm) {
      const rsm = $build('set', {
        xmlns: Strophe.NS.RSM,
      })
      _.each(options.rsm, (val, key) => {
        rsm.c(key, {}, val)
      })
      iq.up()
      iq.cnode(rsm.tree())
    } else if (options.max_items) {
      iq.attrs({
        max_items: options.max_items // eslint-disable-line
      })
    } else if (options.item_ids) {
      _.each(options.item_ids, id => {
        iq
          .c('item', {
            id,
          })
          .up()
      })
    }

    this._connection.sendIQ(
      iq.tree(),
      res => {
        const items = _.map($('item', res), item => {
          return item.cloneNode(true)
        })

        if (options.rsm && $('set', res).length) {
          d.resolve({
            items,
            rsm: {
              count: parseInt($('set > count', res).text(), 10),
              first: $('set >first', res).text(),
              last: $('set > last', res).text(),
            },
          })
        } else {
          d.resolve(items)
        }
      },
      d.reject
    )
    return d.promise()
  },

  // **subscribe** subscribes the user's bare JID to the node with id `node`.
  // See [http://xmpp.org/extensions/xep-0060.html#subscriber-subscribe](http://xmpp.org/extensions/xep-0060.html#subscriber-subscribe)
  subscribe(node) {
    const d = $.Deferred() // eslint-disable-line
    const iq = $iq({
      from: this._connection.jid,
      to: this.service,
      type: 'set',
      id: this._connection.getUniqueId('pubsub'),
    })
      .c('pubsub', {
        xmlns: Strophe.NS.PUBSUB,
      })
      .c('subscribe', {
        node,
        jid: this._connection.jid,
      })
    this._connection.sendIQ(iq, d.resolve, d.reject)
    return d.promise()
  },

  // **unsubscribe** unsubscribes the user's bare JID from the node with id `node`. If managing multiple
  // subscriptions it is possible to optionally specify the `subid`.
  // See [http://xmpp.org/extensions/xep-0060.html#subscriber-unsubscribe](http://xmpp.org/extensions/xep-0060.html#subscriber-unsubscribe)
  unsubscribe(node, subid) {
    const d = $.Deferred() // eslint-disable-line
    const iq = $iq({
      to: this.service,
      type: 'set',
      id: this._connection.getUniqueId('pubsub'),
    })
      .c('pubsub', {
        xmlns: Strophe.NS.PUBSUB,
      })
      .c('unsubscribe', {
        node,
        // jid : Strophe.getBareJidFromJid(this._connection.jid)
        jid: this._connection.jid,
      })
    if (subid) {
      iq.attrs({
        subid,
      })
    }
    this._connection.sendIQ(iq, d.resolve, d.reject)
    return d.promise()
  },

  // **getSubscriptions** retrieves the subscriptions of the user's bare JID to the service.
  // See [http://xmpp.org/extensions/xep-0060.html#entity-subscriptions](http://xmpp.org/extensions/xep-0060.html#entity-subscriptions)
  getSubscriptions() {
    const d = $.Deferred() // eslint-disable-line
    const iq = $iq({
      to: this.service,
      type: 'get',
      id: this._connection.getUniqueId('pubsub'),
    })
      .c('pubsub', {
        xmlns: Strophe.NS.PUBSUB,
      })
      .c('subscriptions')
    let $item

    this._connection.sendIQ(
      iq.tree(),
      res => {
        d.resolve(
          _.map($('subscription', res), item => {
            $item = $(item)
            return {
              node: $item.attr('node'),
              jid: $item.attr('jid'),
              subid: $item.attr('subid'),
              subscription: $item.attr('subscription'),
            }
          })
        )
      },
      d.reject
    )
    return d.promise()
  },

  // Private utility functions

  // **_ISODateString** converts a date to an ISO-formatted string.
  _ISODateString(d) {
    function pad(n) {
      return n < 10 ? '0' + n : n
    }

    return (
      d.getUTCFullYear() +
      '-' +
      pad(d.getUTCMonth() + 1) +
      '-' +
      pad(d.getUTCDate()) +
      'T' +
      pad(d.getUTCHours()) +
      ':' +
      pad(d.getUTCMinutes()) +
      ':' +
      pad(d.getUTCSeconds()) +
      'Z'
    )
  },

  // **_JsonToAtom** produces an atom-format XML tree from a JSON object.
  _JsonToAtom(obj, tag) {
    let builder

    if (tag) {
      builder = $build(tag)
    } else {
      builder = $build('entry', {
        xmlns: Strophe.NS.ATOM,
      })
    }
    _.each(
      obj,
      function(value, key) {
        if (typeof value === 'string') {
          builder.c(key, {}, value)
        } else if (typeof value === 'number') {
          builder.c(key, {}, value.toString())
        } else if (typeof value === 'boolean') {
          builder.c(key, {}, value.toString())
        } else if (typeof value === 'object' && 'toUTCString' in value) {
          builder.c(key, {}, this._ISODateString(value))
        } else if (typeof value === 'object') {
          builder.cnode(this._JsonToAtom(value, key)).up()
        } else {
          this.c(key).up()
        }
      },
      this
    )
    return builder.tree()
  },

  // **_AtomToJson** produces a JSON object from an atom-formatted XML tree.
  _AtomToJson(xml) {
    const json = {}
    const self = this
    let jqEl
    let val

    $(xml).children().each((idx, el) => {
      jqEl = $(el)
      if (jqEl.children().length === 0) {
        val = jqEl.text()
        if ($.isNumeric(val)) {
          val = Number(val)
        }
        json[el.nodeName.toLowerCase()] = val
      } else {
        json[el.nodeName.toLowerCase()] = self._AtomToJson(el)
      }
    })
    return json
  },
}
