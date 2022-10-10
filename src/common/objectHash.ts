import hashsum from "hash-sum";

/**
 * Returns hash of given object, which, crucially, is invariant under application of 
 * JSON.parse(JSON.stringify()). This ensures hash matches client- & server-side when
 * sending object over Websocket connection.
 * 
 * @param object the object to hash
 * @returns 4-byte hex hash of given object
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sum = (object: any) => hashsum(JSON.parse(JSON.stringify(object)));

export default sum;