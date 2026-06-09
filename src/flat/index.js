import { registry } from '@polylith/core';
import '@polylith/features';
import '@polylith/config';
import './services/index.js';
import './models/index.js';
import './main/index.js';

await registry.start();
