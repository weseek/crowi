export type Primaries = {
  docs: { count: number, deleted: number },
  store: { size_in_bytes: number },
  indexing: {
    index_total: number,
    index_time_in_millis: number,
    index_current: number,
    index_failed: number,
    delete_total: number,
    delete_time_in_millis: number,
    delete_current: number,
    noop_update_total: number,
    is_throttled: false,
    throttle_time_in_millis: number
  }
};

export type Indexing = {
  index_total: number,
  index_time_in_millis: number,
  index_current: number,
  index_failed: number,
  delete_total: number,
  delete_time_in_millis: number,
  delete_current: number,
  noop_update_total: number,
  is_throttled: boolean,
  throttle_time_in_millis: number
}

export type Indices = {
  growi: {
    uuid: string,
    primaries: Primaries
  },
  total: {
    docs: { count: number, deleted: number },
    store: { size_in_bytes: number },
    indexing: Indexing
  }
}

export type Aliases = {
  growi: {
    aliases: {
      "growi-alias": {
        alias: string
      }
    }
  }
}

export type SearchIndicesInfo = {
  info: {
    indices: Indices,
    aliases: Aliases,
    isNormalized: boolean
  },
}

