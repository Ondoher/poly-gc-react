import { registry } from '@polylith/core';
import '@polylith/features'
import '@polylith/config';
import './common/size-watcher.js'
import './main/main.js'

await registry.start();
