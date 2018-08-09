#!/bin/sh

set -e

NODE_PORT=${PORT:-80}

export NODE_PORT

[ ! -d mirrors ] && mkdir mirrors

node /server.js

