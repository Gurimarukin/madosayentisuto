#!/bin/bash

set -e

CONTAINER_ALREADY_STARTED="CONTAINER_ALREADY_STARTED"

if [ ! -e $CONTAINER_ALREADY_STARTED ]; then
    touch $CONTAINER_ALREADY_STARTED

    cp -r dist/client/* "$APP_DATA_VOLUME"  
fi

node --experimental-specifier-resolution=node dist/server/index.js