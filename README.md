# Madosayentisuto

    cp conf/local.example.conf.json conf/local.conf.json # change needed values


## Deploy

    yarn install
    yarn run build
    node dist/src/index.js


## Dev

    dev/docker.sh start

    mongo -u user -p password --authenticationDatabase admin madosayentisuto

    yarn install
    yarn run ~run
