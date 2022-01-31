import hashsum from "hash-sum";

/**
 * Returns a hash of the given object, which, crucially, is invariant under application of
 * JSON.parse(JSON.stringify()) to the object. This means that the hash of an object is matches
 * client- and server-side when sending the object over a websocket.
 * 
 * @param object the object to hash
 * @returns a 4-byte hex hash
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sum = (object: any) => hashsum(JSON.parse(JSON.stringify(object)));

export default sum;