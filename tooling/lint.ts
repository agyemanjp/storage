#!/usr/bin/env -S node -r "ts-node/register"

import * as shell from 'shelljs'

let output = shell.exec("eslint -c ./tooling/.eslintrc.js . --ext .ts")

