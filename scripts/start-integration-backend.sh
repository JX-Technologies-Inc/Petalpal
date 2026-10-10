#!/bin/sh
set -e

node lib/integration-environment.js
exec npm start
