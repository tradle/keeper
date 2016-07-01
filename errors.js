
var TypedError = require('error/typed')

exports.InvalidSignature = TypedError({
  type: 'invalidsignature',
  message: 'invalid signature {sig}',
  sig: null
})

exports.InvalidKey = TypedError({
  type: 'invalidkey',
  message: 'invalid key {key}',
  key: null
})
