
const crypto = require('crypto')
const levelup = require('levelup')
const encryption = require('level-encrypt')
// const protocol = require('@tradle/protocol')
const errors = require('./errors')

module.exports = function keeper (opts) {
  // may want to have a safe/dangerous API
  //   safe: generate key from value on 'put'
  //   dangerous: accept passed in key on 'put'
  const encryptionOpts = opts.encryption
  const rawDB = levelup(opts.path, {
    db: opts.db,
    keyEncoding: opts.keyEncoding || 'binary',
    valueEncoding: opts.valueEncoding || 'binary'
  })

  const db = encryption.toEncrypted(rawDB, encryptionOpts)
  db.close = function (cb) {
    rawDB.close(cb)
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
