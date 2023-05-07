// strongly typed expect

export const expectT = expect as <A = never>(
  actual: A,
) => {
  toStrictEqual: (expected: A) => A
}
