// strongly typed expect

export const expectT = expect as <A = never>(
  actual: A,
) => {
  readonly toStrictEqual: (expected: A) => A
}
