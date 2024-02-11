type HttpMethod = (typeof values)[number]

const values = ['get', 'post', 'put', 'patch', 'head', 'delete'] as const

const HttpMethod = { values }

export { HttpMethod }
