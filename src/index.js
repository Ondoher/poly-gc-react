import "./init.js";
import { registry } from '@polylith/core';
import '@polylith/features'

import main from './main/main'
import './features/directory'

await registry.start();

main();
