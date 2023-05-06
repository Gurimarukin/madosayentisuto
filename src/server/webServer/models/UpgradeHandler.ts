import type { IncomingMessage } from 'http'
import { Status } from 'hyper-ts'
import type { Duplex } from 'stream'

import { Either, Future } from '../../../shared/utils/fp'

import { SimpleHttpResponse } from './SimpleHttpResponse'

export type UpgradeHandler = (
  request: IncomingMessage,
  socket: Duplex,
  head: Buffer,
) => Future<Either<SimpleHttpResponse, void>>

const NotFound: UpgradeHandler = () =>
  Future.successful(Either.left(SimpleHttpResponse.of(Status.NotFound, '')))

export const UpgradeHandler = { NotFound }
