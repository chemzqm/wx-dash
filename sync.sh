#!/usr/bin/env bash

node index.js
if [ -z "$(git status --porcelain)" ]; then 
  ./publish.sh
fi

