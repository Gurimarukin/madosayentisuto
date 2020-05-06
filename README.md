# Madosayentisuto

Create `conf/local.conf.json` file using content of `conf/local.example.conf.json` (change needed values).


## Bot commands

    okb defaultRole set <role>


## Deploy

    pnpm i
    npm run build
    npm run checkConfig
    node dist/src/index.js


## Dev

    dev/docker.sh start

    mongo -u user -p password --authenticationDatabase admin madosayentisuto

    pnpm i
    npm run ~run
