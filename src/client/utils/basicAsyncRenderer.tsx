import type React from 'react'
import type { SWRResponse } from 'swr'

export function basicAsyncRenderer<A>({
  data,
  error,
}: Pick<SWRResponse<A, unknown>, 'data' | 'error'>): <B>(
  render: (a: A) => B,
) => React.JSX.Element | B {
  return render => {
    if (error !== undefined) return <pre className="mt-4">error</pre>
    if (data === undefined) return <pre className="mt-4">loading...</pre>
    return render(data)
  }
}
