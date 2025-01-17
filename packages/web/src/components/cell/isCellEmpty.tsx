import { DataObject } from './cellTypes'

/**
 * The default `isEmpty` implementation. Checks if any of the field is `null` or an empty array.
 *
 * Consider the following queries. The former returns an object, the latter a list:
 *
 * ```js
 * export const QUERY = gql`
 *   post {
 *     title
 *   }
 * `
 *
 * export const QUERY = gql`
 *   posts {
 *     title
 *   }
 * `
 * ```
 *
 * If either are "empty", they return:
 *
 * ```js
 * {
 *   data: {
 *     post: null
 *   }
 * }
 *
 * {
 *   data: {
 *     posts: []
 *   }
 * }
 * ```
 *
 * Note that the latter can return `null` as well depending on the SDL (`posts: [Post!]`).
 * ```
 */
function isFieldEmptyArray(field: unknown) {
  return Array.isArray(field) && field.length === 0
}
export function isDataEmpty(data: DataObject) {
  return Object.values(data).every((fieldValue) => {
    return fieldValue === null || isFieldEmptyArray(fieldValue)
  })
}
