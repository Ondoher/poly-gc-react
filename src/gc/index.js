import { registry } from '@polylith/core';
import '@polylith/features'

import main from './main/main'
import config from '@polylith/config';
await registry.start();

console.log(config.get('names'));

main();
