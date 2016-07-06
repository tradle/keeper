
const crypto = require('crypto')
const levelup = require('levelup')
const encryption = require('level-encrypt')
const protocol = require('@tradle/protocol')
const errors = require('./errors')

module.exports = function keeper (opts) {
  // may want to have a safe/dangerous API
  //   safe: generate key from value on 'put'
  //   dangerous: accept passed in key on 'put'
  const encryptionOpts = opts.encryption
  const validateOnPut = opts.validateOnPut
  const rawDB = levelup(opts.path, {
    db: opts.db
  })

  const db = encryption.toEncrypted(rawDB, encryptionOpts)
  const putFn = db.put
  db.put = function (key, value, opts, cb) {
    if (maybeValidate(key, value, opts, cb)) {
      putFn.apply(db, arguments)
    }
  }

  const batchFn = db.batch
  db.batch = function (batch, opts, cb) {
    if (!arguments.length || !Array.isArray(batch)) {
      throw new Error('chained batch mode is not supported')
    }

    const valid = batch.every(function (op) {
      return op.type === 'del' || maybeValidate(op.key, op.value, opts, cb)
    })

    if (valid) {
      return batchFn.apply(db, arguments)
    }
  }

  return db

  function maybeValidate (key, value, opts, cb) {
    if (typeof opts === 'function') {
      cb = opts
      opts = null
    }

    var validate = opts && ('validate' in opts) ? opts.validate : validateOnPut
    if (validate === false) return true

    var err
    if (protocol.link(value, 'hex') !== key) {
      err = new errors.InvalidKey({ key: key })
    } else if (!protocol.verifySig({ object: value })) {
      err = errors.InvalidSignature({ sig: value[protocol.constants.SIG] })
    }

    if (!err) return true

    process.nextTick(function () {
      cb(err)
    })
  }

  // const multiPut = opts.multiPut
  // if (multiPut) {
  //   // on some architectures there is a fast multi-put / multi-get
  //   // e.g. react-native has AsyncStorage.multiPut / AsyncStorage.multiGet
  //   const writeBatch = db.batch
  //   db.batch = function (batch) {
  //     const fn = batch.every(row => row.type === 'put')
  //       ? multiPut
  //       : writeBatch

  //     return fn.apply(db, arguments)
  //   }
  // }

  // if (opts.multiGet) {
  //   db.multiGet = opts.multiGet.bind(db)
  // }

  return db
}

// function createDefaultMultiPut (db, batch) {
//   return function multiPut (batch, cb) {
//     batch = batch.map(row => extend(row, { type: 'put' }))
//     db.batch(batch, cb)
//   }
// }

function sha256 (data) {
  return crypto.createHash('sha256').update(data).digest('hex')
}
