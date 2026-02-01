#!/usr/bin/env node

import { main } from './cli.js';

main(process.argv).then((code) => process.exit(code));
