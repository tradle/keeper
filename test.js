var crypto = require('crypto')
var test = require('tape')
var parallel = require('run-parallel')
var memdown = require('memdown')
var levelup = require('levelup')
var protocol = require('@tradle/protocol')
var constants = protocol.constants
var TYPE = constants.TYPE
var createKeeper = require('./')
var cachify = require('./cachify')
var counter = 0

test('basic', function (t) {
  var sigKey = protocol.genECKey()
  var author = {
    sign: function (msg, cb) {
      cb(null, protocol.utils.sign(msg, sigKey))
    },
    sigPubKey: sigKey
  }

  var encryptions = [
    { key: crypto.randomBytes(32), salt: crypto.randomBytes(32) },
    { password: 'blah' }
  ]

  var iteration = 0
  parallel(encryptions.map(function (encryption) {
    return function (cb) {
      var path = 'test' + (iteration++)
      var keeper = createKeeper({ path, encryption, db: memdown })
      var obj = { hey: 'ho', [TYPE]: 'something' }
      protocol.sign({ object: obj, author: author }, function (err, result) {
        if (err) throw err

        obj = result.object
        var key = protocol.link(obj, 'hex')
        // should succeed
        keeper.put(key, obj, function (err) {
          if (err) throw err

          keeper.get(key, function (err, decrypted) {
            if (err) throw err

            t.same(decrypted, obj)
            keeper.close(function (err) {
              if (err) throw err

              db = levelup('test', { db: memdown })
              db.get(key, function (err) {
                t.ok(err) // actual key is hashed
                db.close()
                cb()
              })
            })
          })
        })
      })
    }
  }), function (err) {
    t.error(err)
    t.end()
  })
})

test('cachified', function (t) {
  t.plan(4)

  var encryption = { key: crypto.randomBytes(32) }
  var path = 'test' + Math.random()
  var keeper = createKeeper({ path, encryption, db: memdown, validateOnPut: false })
  cachify(keeper)

  // should fail (invalid key)
  keeper.put('a', 'b', function (err) {
    if (err) throw err

    db.get = t.fail
    keeper.get('a', function (err, val) {
      if (err) throw err

      t.same(val, 'b')
    })
  })

  keeper.batch([
    { type: 'put', key: 'hey', value: 'ho' },
    { type: 'put', key: 'ho', value: 'hey' },
  ], function (err) {
    if (err) throw err

    keeper.get('hey', function (err, val) {
      if (err) throw err

      t.equal(val, 'ho')
    })

    keeper.get('ho', function (err, val) {
      if (err) throw err

      t.equal(val, 'hey')
    })

    keeper.del('hey', function (err) {
      if (err) throw err

      keeper.get('hey', function (err) {
        t.ok(err)
      })
    })
  })
})
