import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {startCompanion} from './companion-server.mjs';
export {createCompanionServer} from './companion-server.mjs';
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))startCompanion();
