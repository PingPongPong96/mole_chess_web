#!/bin/bash
set -e
cd "$(dirname "$0")"
if [ -x "./prebuilt_runtime/macos-arm64/node/bin/node" ]; then
  ./prebuilt_runtime/macos-arm64/node/bin/node ./expo_dual_window_launcher.mjs --open=2 --query=expo=1
elif [ -x "./prebuilt_runtime/macos-x64/node/bin/node" ]; then
  ./prebuilt_runtime/macos-x64/node/bin/node ./expo_dual_window_launcher.mjs --open=2 --query=expo=1
else
  node ./expo_dual_window_launcher.mjs --open=2 --query=expo=1
fi
