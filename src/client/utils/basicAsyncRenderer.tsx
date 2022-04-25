import React from 'react'
import type { SWRResponse } from 'swr'

export function basicAsyncRenderer<A>({
  data,
  error,
}: Pick<SWRResponse<A, unknown>, 'data' | 'error'>): <B>(render: (a: A) => B) => JSX.Element | B {
  return render => {
    if (error !== undefined) return <pre>error</pre>
    if (data === undefined) return <pre>loading...</pre>
    return render(data)
  }
}
