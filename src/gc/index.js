import { registry } from '@polylith/core';
import '@polylith/features'
import '@polylith/config';
import './main/main.js'

await registry.start();
