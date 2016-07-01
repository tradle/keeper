var test = require('tape')
var memdown = require('memdown')
var levelup = require('levelup')
var protocol = require('@tradle/protocol')
var constants = protocol.constants
var TYPE = constants.TYPE
var createKeeper = require('./')
var counter = 0

test('keeper', function (t) {
  t.plan(4)

  var sigKey = protocol.genECKey()
  var author = {
    sign: function (msg, cb) {
      cb(null, protocol.utils.sign(msg, sigKey))
    },
    sigPubKey: sigKey
  }

  var encryption = { password: 'blah' }
  var path = 'test'
  var keeper = createKeeper({ path, encryption, db: memdown })
  var obj = { hey: 'ho', [TYPE]: 'something' }
  protocol.sign({ object: obj, author: author }, function (err, result) {
    if (err) throw err

    obj = result.object
    var key = protocol.link(obj, 'hex')
    // should fail (invalid key)
    keeper.put('bad', obj, function (err) {
      t.equal(err.type, 'invalidkey')

      // should succeed
      keeper.put(key, obj, function (err) {
        if (err) throw err

        keeper.get(key, function (err, decrypted) {
          if (err) throw err

          t.same(decrypted, obj)
          // allow disabling of validation
          keeper.put('bad', obj, { validate: false }, function (err) {
            if (err) throw err

            // invalidate signature
            obj.blah = 'ha'
            keeper.put(key, obj, function (err) {
              t.equal(err.type, 'invalidsignature')

              keeper.close(function (err) {
                if (err) throw err

                db = levelup('test', { db: memdown })
                db.get(key, function (err) {
                  t.ok(err) // actual key is hashed
                  db.close()
                })
              })
            })
          })
        })
      })
    })
  })
})
