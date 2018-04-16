#!/usr/bin/env bash

node index.js
if [ -z "$(git status --porcelain)" ]; then 
  echo clean
else
  ./publish.sh
fi

