#!/bin/bash

set -e

CONTAINER_ALREADY_STARTED="CONTAINER_ALREADY_STARTED"

if [ ! -e $CONTAINER_ALREADY_STARTED ]; then
    touch $CONTAINER_ALREADY_STARTED

    mkdir -p "$APP_DATA_VOLUME"
    cp -r dist/client/* "$APP_DATA_VOLUME"
fi

YTDLP_PATH=/app/yt-dlp node --experimental-specifier-resolution=node dist/server/index.js
