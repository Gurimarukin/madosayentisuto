import { createEnum } from '../../../shared/utils/createEnum'

type PlaylistType = typeof PlaylistType.T

const PlaylistType = createEnum('elevator', 'heimerLoco')

export { PlaylistType }
