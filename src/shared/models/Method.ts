export type Method = (typeof values)[number]

const values = ['get', 'post', 'put', 'patch', 'head', 'delete'] as const

export const Method = { values }
