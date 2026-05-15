type ID = string | number
type Nullable<T> = T | null
type Optional<T> = T | undefined
type Maybe<T> = T | null | undefined
type AsyncResult<T> = Promise<T>
type Dict<T = unknown> = Record<string, T>
type Primitive = string | number | boolean | null | undefined