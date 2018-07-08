#!/bin/sh

cleanup() {
  kill -TERM $nwjs
  wait $nwjs
  kill -TERM $xvfb
  rm -f /usr/var/simpljs/SingletonLock
}

trap cleanup TERM INT

Xvfb :99 -ac -screen 0 1280x720x16 -nolisten tcp &
xvfb=$!

export DISPLAY=:99

/usr/lib/simpljs/nw $@ --disable-gpu --user-data-dir=/usr/var/simpljs --port=8000 &
nwjs=$!

wait $nwjs
wait $xvfb
