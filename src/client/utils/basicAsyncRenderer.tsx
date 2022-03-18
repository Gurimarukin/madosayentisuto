import React from 'react'
import type { SWRResponse } from 'swr'

export function basicAsyncRenderer<A>({
  data,
  error,
}: Pick<SWRResponse<A, unknown>, 'data' | 'error'>): (
  render: (a: A) => React.ReactNode,
) => React.ReactNode {
  return render => {
    if (error !== undefined) return <pre>error</pre>
    if (data === undefined) return <pre>loading...</pre>
    return render(data)
  }
}
