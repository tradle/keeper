
const Cache = require('lru-cache')
const clone = require('clone')

// Would be nice to do this without monkey-patching
// but attempts with level-updown caused fun encoding nightmares

module.exports = function cachify (keeper, opts) {
  const cache = new Cache(opts || {})
  const getFn = keeper.get
  const putFn = keeper.put
  const delFn = keeper.del
  const batchFn = keeper.batch

  keeper.get = function (key, cb) {
    const cached = getCached(key)
    if (cached) return process.nextTick(() => cb(null, cached))

    getFn.call(keeper, key, function (err, val) {
      if (err) return cb(err)

      setCached(key, val)
      cb(null, val)
    })
  }

  keeper.put = function (key, val, cb) {
    if (cache.get(key) === val) return process.nextTick(() => cb())

    setCached(key, val)
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
        setCached(row.key, row.value)
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

  function setCached (key, val) {
    cache.set(key, clone(val))
  }

  function getCached (key) {
    const val = cache.get(key)
    if (val) return clone(val)
  }

  return keeper
}
