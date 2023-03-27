import Canvas from '@napi-rs/canvas'
import { pipe } from 'fp-ts/function'

import { Future, IO } from '../../shared/utils/fp'

const loadImage = (
  source: string | Buffer | Uint8Array | URL | ArrayBufferLike | Canvas.Image, // | internal.Readable
  options?: Canvas.LoadImageOptions | undefined,
): Future<Canvas.Image> => Future.tryCatch(() => Canvas.loadImage(source, options))

const createCanvas = (width: number, height: number): IO<Canvas.Canvas> =>
  IO.tryCatch(() => Canvas.createCanvas(width, height))

const canvasContext2DModify =
  (f: (context: Canvas.SKRSContext2D) => IO<Canvas.SKRSContext2D>) =>
  (canvas: Canvas.Canvas): IO<Canvas.Canvas> =>
    pipe(
      IO.tryCatch(() => canvas.getContext('2d')),
      IO.chain(f),
      IO.map<Canvas.SKRSContext2D, Canvas.Canvas>(() => canvas),
    )

const canvasEncode =
  (format: 'png') =>
  (canvas: Canvas.Canvas): Future<Buffer> =>
    Future.tryCatch(() => canvas.encode(format))

function contextDrawImage(
  image: Canvas.Image | Canvas.Canvas,
  dx: number,
  dy: number,
): (context: Canvas.SKRSContext2D) => IO<Canvas.SKRSContext2D>
function contextDrawImage(
  image: Canvas.Image | Canvas.Canvas,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
): (context: Canvas.SKRSContext2D) => IO<Canvas.SKRSContext2D>
function contextDrawImage(
  image: Canvas.Image | Canvas.Canvas,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
): (context: Canvas.SKRSContext2D) => IO<Canvas.SKRSContext2D>
function contextDrawImage(
  image: Canvas.Image | Canvas.Canvas,
  sx: number,
  sy: number,
  sw?: number,
  sh?: number,
  dx?: number,
  dy?: number,
  dw?: number,
  dh?: number,
): (context: Canvas.SKRSContext2D) => IO<Canvas.SKRSContext2D> {
  return context =>
    pipe(
      IO.tryCatch(() =>
        context.drawImage(
          image,
          sx,
          sy,
          sw as number,
          sh as number,
          dx as number,
          dy as number,
          dw as number,
          dh as number,
        ),
      ),
      IO.map<void, Canvas.SKRSContext2D>(() => context),
    )
}

export const CanvasHelper = {
  loadImage,
  createCanvas,
  canvasContext2DModify,
  canvasEncode,
  contextDrawImage,
}
