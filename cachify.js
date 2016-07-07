
const Cache = require('lru-cache')

// Would be nice to do this without monkey-patching
// but attempts with level-updown caused fun encoding nightmares

module.exports = function cachify (keeper, opts) {
  const cache = new Cache(opts || {})
  const getFn = keeper.get
  const putFn = keeper.put
  const delFn = keeper.del
  const batchFn = keeper.batch

  keeper.get = function (key, cb) {
    const cached = cache.get(key)
    if (cached) return process.nextTick(() => cb(null, cached))

    getFn.call(keeper, key, function (err, val) {
      if (err) return cb(err)

      cache.set(key, val)
      cb(null, val)
    })
  }

  keeper.put = function (key, val, cb) {
    if (cache.get(key) === val) return process.nextTick(() => cb())

    cache.set(key, val)
    // safe to pre-cache?
    putFn.call(keeper, key, val, function (err) {
      if (err) {
        cache.del(key)
        return cb(err)
      }

      cb()
    })
  }

  keeper.del = function (key, cb) {
    cache.del(key)
    return delFn.call(keeper, key, cb)
  }

  keeper.batch = function (batch, cb) {
    if (!batch) throw new Error('chained batch not supported')

    batch = batch.filter(row => {
      return !(row.type === 'put' && cache.get(row.key) === row.value)
    })

    if (!batch.length) return process.nextTick(() => cb())

    batch.forEach(row => {
      if (row.type === 'put') {
        cache.set(row.key, row.value)
      } else {
        cache.del(row.key)
      }
    })

    return batchFn.call(keeper, batch, function (err) {
      if (err) {
        batch.forEach(row => {
          if (row.type === 'put') cache.del(row.key)

          // TODO: restored deleted
        })

        return cb(err)
      }

      cb()
    })
  }

  return keeper
}
